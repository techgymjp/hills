import json, math, re, os, sys, concurrent.futures as cf
from remotezip import listing, fetch
LAT0, LON0, R = 35.6604, 139.7292, 6300
MX = 111320*math.cos(math.radians(LAT0)); MZ = 110574
def mesh_bounds(code):
    p, u, q, v, r, w = int(code[0:2]), int(code[2:4]), int(code[4]), int(code[5]), int(code[6]), int(code[7])
    lat = p / 1.5 + q * (5/60) + r * (30/3600); lon = u + 100 + v * (7.5/60) + w * (45/3600)
    return lat, lon, lat + 30/3600, lon + 45/3600
def near(code):
    s, w, n, e = mesh_bounds(code)
    lon = min(max(LON0, w), e); lat = min(max(LAT0, s), n)
    return math.hypot((lon-LON0)*MX, (lat-LAT0)*MZ) <= R
d = json.load(open('catalog.json'))
codes = ['13101','13102','13103','13104','13105','13106','13108','13109','13110','13113']
zips = {it['id']: it['url'] for it in d['citygml'] if it['id'] in codes}
os.makedirs('roads', exist_ok=True)
jobs = []
for c, url in zips.items():
    L = listing(url)
    sel = [e for e in L if e['name'].startswith('udx/tran/') and e['name'].endswith('.gml') and near(os.path.basename(e['name'])[:8])]
    print(c, len(sel), sum(e['csz'] for e in sel)//1_000_000, 'MB', flush=True)
    jobs += [(c, url, e) for e in sel]
POS = re.compile(rb'<gml:posList[^>]*>([^<]+)</gml:posList>')
def work(j):
    c, url, e = j
    out = f"roads/{c}_{os.path.basename(e['name'])[:8]}.json"
    if os.path.exists(out): return 0
    data = fetch(url, e)
    polys = []
    # LOD1 の道路面だけを使う（lod1MultiSurface ブロック内の posList）
    for blk in re.finditer(rb'<tran:lod1MultiSurface>(.*?)</tran:lod1MultiSurface>', data, re.S):
        for m in POS.finditer(blk.group(1)):
            v = list(map(float, m.group(1).split()))
            pts = [((v[i+1]-LON0)*MX, -(v[i]-LAT0)*MZ) for i in range(0, len(v), 3)]
            polys.append([[round(x, 1), round(z, 1)] for x, z in pts])
    json.dump(polys, open(out, 'w'))
    return len(polys)
with cf.ThreadPoolExecutor(8) as ex:
    n = sum(ex.map(work, jobs))
print('polys', n)
