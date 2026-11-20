import json, math, os, subprocess, urllib.parse
LAT0, LON0 = 35.6604, 139.7292
R = 6200
MX = 111320*math.cos(math.radians(LAT0)); MZ = 110574
def overlaps(region):
    w,s,e,n = [math.degrees(v) for v in region[:4]]
    # nearest point of box to origin
    lon = min(max(LON0, w), e); lat = min(max(LAT0, s), n)
    return math.hypot((lon-LON0)*MX, (lat-LAT0)*MZ) <= R
wards = json.load(open('wards.json'))
urls = []
def fetch_json(url, path):
    if not os.path.exists(path):
        subprocess.run(['curl','-sS','-m','60','-o',path,url], check=True)
    return json.load(open(path))
def walk(node, base, ward):
    bv = node.get('boundingVolume', {})
    if 'region' in bv and not overlaps(bv['region']): return
    ch = node.get('children') or []
    c = node.get('content', {}).get('uri') or node.get('content', {}).get('url')
    if c and c.endswith('.json'):
        u = urllib.parse.urljoin(base, c)
        sub = fetch_json(u, f'tiles/{ward}_{abs(hash(u))}.json')
        walk(sub['root'], u, ward)
    elif c and not ch:
        urls.append((ward, urllib.parse.urljoin(base, c)))
    for k in ch: walk(k, base, ward)
for code, v in sorted(wards.items()):
    t = fetch_json(v['url'], f'tiles/{code}_tileset.json')
    n0 = len(urls)
    walk(t['root'], v['url'], code)
    print(code, len(urls)-n0)
with open('urls.txt','w') as f:
    for w,u in urls: f.write(f"{u}\n  out=tiles/{w}_{u.split('/')[-1]}\n")
print('total', len(urls))
