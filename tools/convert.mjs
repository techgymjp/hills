// PLATEAU LOD1 3D Tiles (b3dm + Draco) → 平面形+高さのコンパクトなバイナリ
import fs from 'fs';
import draco3d from 'draco3dgltf';

const LAT0 = 35.6604, LON0 = 139.7292, RMAX = 6000;
const D = Math.PI / 180;
const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F);
function ecef(lat, lon, h) {
  const s = Math.sin(lat * D), c = Math.cos(lat * D), N = A / Math.sqrt(1 - E2 * s * s);
  return [(N + h) * c * Math.cos(lon * D), (N + h) * c * Math.sin(lon * D), (N * (1 - E2) + h) * s];
}
const O = ecef(LAT0, LON0, 0);
const sl = Math.sin(LAT0 * D), cl = Math.cos(LAT0 * D), so = Math.sin(LON0 * D), co = Math.cos(LON0 * D);
function enu(x, y, z) {
  const dx = x - O[0], dy = y - O[1], dz = z - O[2];
  return [-so * dx + co * dy, -sl * co * dx - sl * so * dy + cl * dz, cl * co * dx + cl * so * dy + sl * dz];
}

const M = await draco3d.createDecoderModule({});
function decodeDraco(buf, attrIds) {
  const dec = new M.Decoder();
  const db = new M.DecoderBuffer();
  db.Init(new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength), buf.byteLength);
  const mesh = new M.Mesh();
  const st = dec.DecodeBufferToMesh(db, mesh);
  if (!st.ok()) throw new Error('draco: ' + st.error_msg());
  const nf = mesh.num_faces(), np = mesh.num_points();
  const out = { faces: new Uint32Array(nf * 3) };
  const ptr = M._malloc(nf * 12);
  dec.GetTrianglesUInt32Array(mesh, nf * 12, ptr);
  out.faces.set(new Uint32Array(M.HEAPU32.buffer, ptr, nf * 3));
  M._free(ptr);
  for (const [name, id] of Object.entries(attrIds)) {
    const att = dec.GetAttributeByUniqueId(mesh, id);
    const nc = att.num_components();
    const arr = new M.DracoFloat32Array();
    dec.GetAttributeFloatForAllPoints(mesh, att, arr);
    const a = new Float32Array(np * nc);
    for (let i = 0; i < a.length; i++) a[i] = arr.GetValue(i);
    M.destroy(arr);
    out[name] = a;
  }
  M.destroy(mesh); M.destroy(db); M.destroy(dec);
  return out;
}

function kindOf(usage) {
  if (!usage) return 0;
  if (/住宅/.test(usage)) return 1;
  if (/業務|商業|宿泊|店舗/.test(usage)) return 2;
  if (/文教|医療|官公庁|厚生/.test(usage)) return 3;
  return 0;
}

function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; }
function simplify(pts, eps) { // Douglas-Peucker（閉じたリング）
  if (pts.length <= 4) return pts;
  const dp = (a, b) => {
    let idx = -1, dm = 0;
    const [x1, y1] = pts[a], [x2, y2] = pts[b % pts.length];
    const L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((x2 - x1) * (y1 - pts[i][1]) - (x1 - pts[i][0]) * (y2 - y1)) / L;
      if (d > dm) { dm = d; idx = i; }
    }
    if (dm > eps) return [...dp(a, idx), ...dp(idx, b)];
    return [pts[a]];
  };
  // 最も離れた2点で分割
  let far = 0, fd = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
  return [...dp(0, far), ...dp(far, pts.length)];
}

const seen = new Set();
const buildings = [];
let tilesDone = 0, dup = 0;
const files = fs.readdirSync('tiles').filter(f => f.endsWith('.b3dm'));
for (const f of files) {
  const b = fs.readFileSync('tiles/' + f);
  const ftj = b.readUInt32LE(12), ftb = b.readUInt32LE(16), btj = b.readUInt32LE(20), btb = b.readUInt32LE(24);
  let o = 28;
  const ft = JSON.parse(b.toString('utf8', o, o + ftj).trim() || '{}'); o += ftj + ftb;
  const bt = btj ? JSON.parse(b.toString('utf8', o, o + btj)) : {}; o += btj + btb;
  const glb = b.subarray(o);
  const jl = glb.readUInt32LE(12);
  const gj = JSON.parse(glb.toString('utf8', 20, 20 + jl));
  const binStart = 20 + jl + 8;
  const bin = glb.subarray(binStart);
  let rtc = (gj.extensions && gj.extensions.CESIUM_RTC && gj.extensions.CESIUM_RTC.center) || ft.RTC_CENTER || [0, 0, 0];
  const heights = bt['bldg:measuredHeight'] || [];
  const usage = bt['bldg:usage'] || [];
  const ids = bt['gml_id'] || [];
  const nodeMats = gj.nodes || [];
  for (const node of nodeMats) {
    if (node.mesh === undefined) continue;
    if (node.matrix || node.translation || node.rotation || node.scale) throw new Error('node transform not handled: ' + f);
    for (const prim of gj.meshes[node.mesh].primitives) {
      const ext = prim.extensions && prim.extensions.KHR_draco_mesh_compression;
      if (!ext) throw new Error('non-draco primitive: ' + f);
      const bv = gj.bufferViews[ext.bufferView];
      const buf = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
      const d = decodeDraco(buf, { pos: ext.attributes.POSITION, bid: ext.attributes._BATCHID });
      const np = d.pos.length / 3;
      // y-up → z-up、RTC を足して ECEF → ENU
      const P = new Float64Array(np * 3);
      for (let i = 0; i < np; i++) {
        const x = d.pos[i * 3], y = d.pos[i * 3 + 1], z = d.pos[i * 3 + 2];
        const e = enu(rtc[0] + x, rtc[1] - z, rtc[2] + y);
        P[i * 3] = e[0]; P[i * 3 + 1] = e[1]; P[i * 3 + 2] = e[2];
      }
      // 建物ごとに三角形を集める
      const byB = new Map();
      for (let t = 0; t < d.faces.length; t += 3) {
        const bid = Math.round(d.bid[d.faces[t]]);
        if (!byB.has(bid)) byB.set(bid, []);
        byB.get(bid).push(d.faces[t], d.faces[t + 1], d.faces[t + 2]);
      }
      for (const [bid, tri] of byB) {
        const gid = ids[bid];
        if (gid && seen.has(gid)) { dup++; continue; }
        let top = -1e9, bot = 1e9;
        for (const v of tri) { top = Math.max(top, P[v * 3 + 2]); bot = Math.min(bot, P[v * 3 + 2]); }
        // 屋上面の三角形 → 境界エッジ
        const key = v => Math.round(P[v * 3] * 20) + ',' + Math.round(P[v * 3 + 1] * 20);
        const edges = new Map(), coord = new Map();
        for (let t = 0; t < tri.length; t += 3) {
          const vs = [tri[t], tri[t + 1], tri[t + 2]];
          if (!vs.every(v => P[v * 3 + 2] > top - 0.3)) continue;
          const ks = vs.map(key);
          vs.forEach((v, i) => coord.set(ks[i], [P[v * 3], P[v * 3 + 1]]));
          for (let i = 0; i < 3; i++) {
            const a = ks[i], c = ks[(i + 1) % 3];
            if (a === c) continue;
            const k = a < c ? a + '|' + c : c + '|' + a;
            const e = edges.get(k);
            if (e) e.n++; else edges.set(k, { a, c, n: 1 });
          }
        }
        const adj = new Map();
        for (const e of edges.values()) if (e.n === 1) {
          if (!adj.has(e.a)) adj.set(e.a, []); if (!adj.has(e.c)) adj.set(e.c, []);
          adj.get(e.a).push(e.c); adj.get(e.c).push(e.a);
        }
        // ループを辿り、最大面積のものを外周とする
        const used = new Set(); let best = null, bestA = 0;
        for (const start of adj.keys()) {
          if (used.has(start)) continue;
          const loop = [start]; used.add(start);
          let prev = null, cur = start;
          for (let guard = 0; guard < 10000; guard++) {
            const nx = (adj.get(cur) || []).find(n => n !== prev && !used.has(n));
            if (!nx) break;
            loop.push(nx); used.add(nx); prev = cur; cur = nx;
          }
          if (loop.length < 3) continue;
          const pts = loop.map(k => coord.get(k));
          const ar = Math.abs(polyArea(pts));
          if (ar > bestA) { bestA = ar; best = pts; }
        }
        if (!best || bestA < 12) continue;
        let cx = 0, cy = 0; best.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= best.length; cy /= best.length;
        if (Math.hypot(cx, cy) > RMAX) continue;
        if (gid) seen.add(gid);
        let pts = simplify(best, 0.4);
        if (pts.length < 3) continue;
        if (polyArea(pts) < 0) pts.reverse(); // 反時計回り（x=東, y=北）にそろえる
        if (pts.length > 255) pts = pts.filter((_, i) => i % Math.ceil(pts.length / 255) === 0);
        const h = Math.max(2, Math.min(heights[bid] > 0 ? heights[bid] : top - bot, 400));
        buildings.push({ pts, h, kind: kindOf(usage[bid]), area: bestA });
      }
    }
  }
  if (++tilesDone % 50 === 0) console.error(tilesDone, '/', files.length, buildings.length);
}

// バイナリ出力：Uint32 件数、各建物 [Uint16 高さ(0.1m), Uint8 種別, Uint8 頂点数, (Int16 東, Int16 南)×n] 座標は0.25m単位
let size = 4;
buildings.forEach(b => { size += 4 + b.pts.length * 4; });
const out = Buffer.alloc(size);
let p = 0;
out.writeUInt32LE(buildings.length, p); p += 4;
for (const b of buildings) {
  out.writeUInt16LE(Math.round(b.h * 10), p); p += 2;
  out.writeUInt8(b.kind, p++);
  out.writeUInt8(b.pts.length, p++);
  for (const [x, y] of b.pts) {
    out.writeInt16LE(Math.round(x * 4), p); p += 2;
    out.writeInt16LE(Math.round(-y * 4), p); p += 2; // 南向きを正（ゲームの z）
  }
}
fs.writeFileSync('buildings.bin', out);
const hs = buildings.map(b => b.h).sort((a, b) => a - b);
console.log(JSON.stringify({ count: buildings.length, dup, bytes: size, avgPts: buildings.reduce((s, b) => s + b.pts.length, 0) / buildings.length, h50: hs[hs.length >> 1], h99: hs[Math.floor(hs.length * 0.99)], hmax: hs[hs.length - 1] }));
