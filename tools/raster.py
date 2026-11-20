import json, glob
from PIL import Image, ImageDraw
SIZE_M, PX = 12288, 4096
s = PX / SIZE_M
img = Image.new('L', (PX, PX), 0)
dr = ImageDraw.Draw(img)
n = 0
for f in glob.glob('roads/*.json'):
    for poly in json.load(open(f)):
        if len(poly) < 3: continue
        pts = [((x + SIZE_M / 2) * s, (z + SIZE_M / 2) * s) for x, z in poly]
        dr.polygon(pts, fill=255)
        n += 1
img.save('roads.png', optimize=True)
print(n)
