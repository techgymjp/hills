import subprocess, struct, zlib, json, sys
def rng(url, a, b):
    r = subprocess.run(['curl','-sS','-m','300','-r',f'{a}-{b}',url], capture_output=True, check=True)
    return r.stdout
def size(url):
    r = subprocess.run(['curl','-sSI','-m','60',url], capture_output=True, text=True, check=True)
    for l in r.stdout.splitlines():
        if l.lower().startswith('content-length:'): return int(l.split(':')[1])
def listing(url):
    n = size(url)
    tail = rng(url, n - 70000, n - 1)
    i = tail.rfind(b'PK\x05\x06')
    cd_size, cd_off = struct.unpack('<II', tail[i+12:i+20])
    j = tail.rfind(b'PK\x06\x06')
    if j >= 0:
        cd_size, cd_off = struct.unpack('<QQ', tail[j+40:j+56])
    cd = rng(url, cd_off, cd_off + cd_size - 1)
    out = []; p = 0
    while p < len(cd) and cd[p:p+4] == b'PK\x01\x02':
        meth, = struct.unpack('<H', cd[p+10:p+12])
        csz, usz = struct.unpack('<II', cd[p+20:p+28])
        nl, el, cl = struct.unpack('<HHH', cd[p+28:p+34])
        lho, = struct.unpack('<I', cd[p+42:p+46])
        name = cd[p+46:p+46+nl].decode('utf8', 'replace')
        extra = cd[p+46+nl:p+46+nl+el]
        q = 0
        while q < len(extra):
            hid, hl = struct.unpack('<HH', extra[q:q+4])
            if hid == 1:
                vals = extra[q+4:q+4+hl]; k = 0
                if usz == 0xFFFFFFFF: usz, = struct.unpack('<Q', vals[k:k+8]); k += 8
                if csz == 0xFFFFFFFF: csz, = struct.unpack('<Q', vals[k:k+8]); k += 8
                if lho == 0xFFFFFFFF: lho, = struct.unpack('<Q', vals[k:k+8]); k += 8
            q += 4 + hl
        out.append(dict(name=name, meth=meth, csz=csz, usz=usz, off=lho))
        p += 46 + nl + el + cl
    return out
def fetch(url, e):
    h = rng(url, e['off'], e['off'] + 29)
    nl, el = struct.unpack('<HH', h[26:30])
    start = e['off'] + 30 + nl + el
    data = rng(url, start, start + e['csz'] - 1)
    return zlib.decompress(data, -15) if e['meth'] == 8 else data
if __name__ == '__main__':
    url = sys.argv[1]
    L = listing(url)
    print(len(L))
    for e in L:
        if '/tran/' in e['name'] or '/luse/' in e['name']: print(e['name'], e['csz'], e['usz'])
