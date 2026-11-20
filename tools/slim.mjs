// buildings.bin を軽くする：小さく低い建物を省き、平面形の頂点を間引く
// 使い方: node tools/slim.mjs 入力.bin 出力.bin
import fs from 'fs';
const [, , src, dst] = process.argv;
const b = fs.readFileSync(src);
const n = b.readUInt32LE(0);
const KEEP_AREA = 80, KEEP_H = 15, EPS = 1.2; // m
function simplify(pts, eps) {
  if (pts.length <= 4) return pts;
  const dp = (a, b) => {
    let idx = -1, dm = 0;
    const [x1, y1] = pts[a], [x2, y2] = pts[b % pts.length];
    const L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((x2 - x1) * (y1 - pts[i][1]) - (x1 - pts[i][0]) * (y2 - y1)) / L;
      if (d > dm) { dm = d; idx = i; }
    }
    return dm > eps ? [...dp(a, idx), ...dp(idx, b)] : [pts[a]];
  };
  let far = 0, fd = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
  const out = [...dp(0, far), ...dp(far, pts.length)];
  return out.length >= 3 ? out : pts;
}
const outRecs = [];
let p = 4;
for (let i = 0; i < n; i++) {
  const hq = b.readUInt16LE(p), kind = b.readUInt8(p + 2), np = b.readUInt8(p + 3);
  const pts = [];
  for (let j = 0; j < np; j++) pts.push([b.readInt16LE(p + 4 + j * 4) / 4, b.readInt16LE(p + 6 + j * 4) / 4]);
  p += 4 + np * 4;
  let a = 0;
  for (let j = 0; j < np; j++) { const q = pts[j], r = pts[(j + 1) % np]; a += q[0] * r[1] - r[0] * q[1]; }
  if (Math.abs(a) / 2 < KEEP_AREA && hq / 10 < KEEP_H) continue;
  outRecs.push({ hq, kind, pts: simplify(pts, EPS) });
}
let size = 4;
outRecs.forEach(r => { size += 4 + r.pts.length * 4; });
const out = Buffer.alloc(size);
out.writeUInt32LE(outRecs.length, 0);
let o = 4, tris = 0;
for (const r of outRecs) {
  out.writeUInt16LE(r.hq, o); out.writeUInt8(r.kind, o + 2); out.writeUInt8(r.pts.length, o + 3); o += 4;
  for (const [x, z] of r.pts) { out.writeInt16LE(Math.round(x * 4), o); out.writeInt16LE(Math.round(z * 4), o + 2); o += 4; }
  tris += 3 * r.pts.length - 2;
}
fs.writeFileSync(dst, out);
console.log(JSON.stringify({ before: n, after: outRecs.length, bytes: size, tris }));
