// 六本木ヒルズを引っこ抜け — 港区 筍狩り
import * as THREE from './lib/three.module.min.js';

// =====================================================================
// 座標系：六本木ヒルズ森タワーを原点、1単位 = 1m
//   x = 東, z = 南（北は -z）, y = 上
// =====================================================================
const ORIGIN = { lat: 35.6604, lon: 139.7292 };
const MX = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const MZ = 110574;
const geo = (lat, lon) => ({ x: (lon - ORIGIN.lon) * MX, z: -(lat - ORIGIN.lat) * MZ });
const geoV = (lat, lon, y = 0) => { const p = geo(lat, lon); return new THREE.Vector3(p.x, y, p.z); };

const STAGE_R = 5000;          // ゲームエリア半径
const GAME_TIME = 90;          // 制限時間（秒）
const ROOT_LIMIT = 5;          // この本数定着したら負け
const HILLS_H = 238;           // 森タワーの高さ
const EARTH_R = 6371000;
const FUJI_SCALE = 1.8;     // 遠景の富士山の見かけの大きさ（実寸=1）

// ---------------------------------------------------------------------
// 乱数
// ---------------------------------------------------------------------
function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const srand = mulberry32(20031025); // 街の生成用（毎回同じ街）
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------
// 地理データ（おおまかな形）
// ---------------------------------------------------------------------
const BAY = [
  [35.700, 139.840], [35.652, 139.802], [35.648, 139.785], [35.656, 139.772],
  [35.650, 139.764], [35.640, 139.757], [35.628, 139.752], [35.612, 139.749],
  [35.598, 139.748], [35.585, 139.756], [35.552, 139.790], [35.520, 139.760],
  [35.470, 139.680], [35.300, 139.700], [35.300, 140.150], [35.620, 140.150],
  [35.665, 139.950],
].map(([a, b]) => geo(a, b));
const ISLANDS = [
  // お台場
  [[35.6335, 139.7640], [35.6335, 139.7900], [35.6180, 139.7930], [35.6150, 139.7700], [35.6260, 139.7620]],
  // 月島・晴海・豊洲
  [[35.6690, 139.7760], [35.6670, 139.7980], [35.6460, 139.8030], [35.6480, 139.7860], [35.6590, 139.7770]],
  // 天王洲・品川埠頭
  [[35.6230, 139.7500], [35.6250, 139.7620], [35.6080, 139.7600], [35.6080, 139.7520]],
].map(poly => poly.map(([a, b]) => geo(a, b)));
const SUMIDA = [
  [35.7200, 139.8000], [35.7050, 139.7960], [35.6930, 139.7880], [35.6800, 139.7880],
  [35.6700, 139.7810], [35.6600, 139.7740],
].map(([a, b]) => geo(a, b));
// 緑地：[lat, lon, 東西半径m, 南北半径m, 名前]
const PARKS = [
  [35.6852, 139.7528, 650, 750, '皇居'],
  [35.6764, 139.6993, 450, 650, '明治神宮'],
  [35.6717, 139.6949, 380, 380, '代々木公園'],
  [35.6852, 139.7100, 600, 260, '新宿御苑'],
  [35.6667, 139.7222, 230, 420, '青山霊園'],
  [35.6795, 139.7255, 380, 420, '赤坂御用地'],
  [35.6560, 139.7480, 200, 320, '芝公園'],
  [35.6600, 139.7633, 260, 260, '浜離宮'],
  [35.6513, 139.7247, 130, 130, '有栖川公園'],
  [35.6370, 139.7190, 260, 260, '自然教育園'],
  [35.6735, 139.7605, 160, 260, '日比谷公園'],
  [35.6930, 139.7470, 180, 160, '北の丸公園'],
];
// 高層ビルが集まる地区：[lat, lon, 広がりm, 強さ]
const HUBS = [
  [35.6905, 139.6935, 500, 1.0], [35.6580, 139.7010, 380, 0.8], [35.6630, 139.7330, 520, 0.9],
  [35.6670, 139.7480, 450, 1.0], [35.6640, 139.7610, 380, 1.0], [35.6810, 139.7650, 550, 1.0],
  [35.6280, 139.7400, 480, 0.9], [35.6190, 139.7280, 320, 0.8], [35.6730, 139.7370, 380, 0.7],
  [35.6550, 139.7570, 320, 0.8], [35.6450, 139.7480, 320, 0.6], [35.6960, 139.7020, 300, 0.5],
].map(([a, b, s, k]) => ({ ...geo(a, b), s, k }));

function inPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
function distToPolyline(p, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
  }
  return best;
}
const parkData = PARKS.map(([a, b, rx, rz, name]) => ({ ...geo(a, b), rx, rz, name }));
const inPark = p => parkData.some(k => ((p.x - k.x) / k.rx) ** 2 + ((p.z - k.z) / k.rz) ** 2 < 1);
const isWater = p => (inPoly(p, BAY) && !ISLANDS.some(is => inPoly(p, is))) || distToPolyline(p, SUMIDA) < 110;

// ---------------------------------------------------------------------
// レンダラー・シーン・カメラ
// ---------------------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color(0xc9dcec);
scene.fog = new THREE.Fog(FOG_COLOR, 5000, 26000);

const camera = new THREE.PerspectiveCamera(45, 1, 3, 250000);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 55 : 45;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// 空
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(200000, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x4f8cd6) }, horizon: { value: FOG_COLOR } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y*2.2, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0); }',
  }),
);
sky.renderOrder = -10;
sky.frustumCulled = false;
scene.add(sky);

// 光
scene.add(new THREE.HemisphereLight(0xdfeeff, 0x6b6450, 1.1));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 6000;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 1.5;
scene.add(sun, sun.target);
const SUN_OFFSET = new THREE.Vector3(900, 1800, 1100); // 南東の空から

function setShadowRange(r) {
  const c = sun.shadow.camera;
  if (c.right === r) return;
  c.left = -r; c.right = r; c.top = r; c.bottom = -r;
  c.updateProjectionMatrix();
}
setShadowRange(1500);

// ---------------------------------------------------------------------
// テクスチャ
// ---------------------------------------------------------------------
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
// 森タワーの外壁
const hillsWallTex = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#7d889c'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
    g.fillStyle = Math.random() < 0.12 ? '#f3e2b0' : (Math.random() < 0.5 ? '#9fb2cc' : '#5d6b82');
    g.fillRect(x + 1, y + 2, 6, 5);
  }
  g.fillStyle = 'rgba(40,46,60,.6)';
  for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h);
});
// 一般ビルの窓
const buildingTex = canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8) {
    g.fillStyle = 'rgba(70,85,110,.45)';
    g.fillRect(0, y + 3, w, 4);
  }
  for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x, 0, 2, h); }
});
// 鉄骨（東京タワー・スカイツリー用）
function latticeTex(color) {
  return canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h);
    g.moveTo(0, 0); g.lineTo(0, h); g.moveTo(w, 0); g.lineTo(w, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2);
    g.stroke();
  });
}
// 地面
const groundTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#9a978d'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    const v = 130 + Math.random() * 40 | 0;
    g.fillStyle = `rgba(${v},${v - 4},${v - 14},.5)`;
    g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }
  g.strokeStyle = 'rgba(70,70,74,.55)'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(0, 3); g.lineTo(w, 3); g.moveTo(3, 0); g.lineTo(3, h); g.stroke();
});

// ---------------------------------------------------------------------
// 地面・海・川・緑地
// ---------------------------------------------------------------------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400000, 400000),
  new THREE.MeshStandardMaterial({ color: 0xffffff, map: groundTex, roughness: 1 }),
);
groundTex.repeat.set(400000 / 180, 400000 / 180);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function flatShape(points, y, material) {
  const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, -p.z)));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}
const waterMat = new THREE.MeshStandardMaterial({ color: 0x3f74a3, roughness: 0.25, metalness: 0.2 });
const landMat = new THREE.MeshStandardMaterial({ color: 0x9a978d, roughness: 1 });
flatShape(BAY, 0.6, waterMat);
ISLANDS.forEach(is => flatShape(is, 1.2, landMat));
{ // 隅田川
  const pts = SUMIDA.map(p => new THREE.Vector3(p.x, 0.7, p.z));
  const left = [], right = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const d = new THREE.Vector3().subVectors(b, a).normalize();
    const n = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(110);
    left.push(p.clone().add(n)); right.push(p.clone().sub(n));
  });
  flatShape([...left, ...right.reverse()], 0.7, waterMat);
}
const parkMat = new THREE.MeshStandardMaterial({ color: 0x5f8f4a, roughness: 1 });
parkData.forEach(k => {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), parkMat);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(k.rx, k.rz, 1);
  m.position.set(k.x, 0.9, k.z);
  m.receiveShadow = true;
  scene.add(m);
});
{ // 皇居のお濠
  const k = parkData[0];
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.08, 48), waterMat);
  ring.rotation.x = -Math.PI / 2;
  ring.scale.set(k.rx, k.rz, 1);
  ring.position.set(k.x, 1.0, k.z);
  scene.add(ring);
}

// ---------------------------------------------------------------------
// ランドマーク
// ---------------------------------------------------------------------
const LANDMARKS = [];      // {name, pos(頂上), el}
const reserved = [];       // 一般ビルを置かない場所 {x,z,r}

function addLandmark(name, pos, labelY, r = 120) {
  reserved.push({ x: pos.x, z: pos.z, r });
  if (name) LANDMARKS.push({ name, pos: new THREE.Vector3(pos.x, labelY, pos.z) });
}
function shadowAll(obj) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

// 六本木ヒルズ（森タワー）。sprout=true は引っこ抜ける分身（根っこ付き）
const hillsMats = {
  podium: new THREE.MeshStandardMaterial({ color: 0x8b8f99, roughness: 0.8 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xffffff, map: hillsWallTex, roughness: 0.45, metalness: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2b3142, roughness: 0.4, metalness: 0.5 }),
  crown: new THREE.MeshStandardMaterial({ color: 0x38506e, roughness: 0.15, metalness: 0.7, emissive: 0x0d1a2a }),
  root: new THREE.MeshStandardMaterial({ color: 0xe0cfa0, roughness: 0.9 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 }),
};
hillsWallTex.repeat.set(5, 22);
function makeHills(sprout) {
  const g = new THREE.Group();
  // 基壇
  const podium = new THREE.Mesh(new THREE.BoxGeometry(150, 32, 120), hillsMats.podium);
  podium.position.y = 16;
  g.add(podium);
  // 本体：角を落とした多角柱（下が少し太い）
  const body = new THREE.Mesh(new THREE.CylinderGeometry(41, 46, 190, 12), hillsMats.wall);
  body.position.y = 32 + 95;
  body.rotation.y = Math.PI / 12;
  g.add(body);
  // 縦のリブ
  for (let i = 0; i < 6; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(5, 190, 10), hillsMats.dark);
    const a = i / 6 * Math.PI * 2;
    fin.position.set(Math.cos(a) * 44, 32 + 95, Math.sin(a) * 44);
    fin.rotation.y = -a;
    g.add(fin);
  }
  // 中間の帯
  const band = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 5, 12), hillsMats.dark);
  band.position.y = 140;
  g.add(band);
  // 頂部（展望台・美術館）
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(44, 41, 20, 12), hillsMats.crown);
  crown.position.y = 222 + 10 - 10;
  g.add(crown);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(36, 44, 6, 12), hillsMats.dark);
  cap.position.y = 235;
  g.add(cap);
  const heli = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 2, 16), hillsMats.podium);
  heli.position.y = 239;
  g.add(heli);
  // 根っこ
  if (sprout) {
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + rand(-0.2, 0.2);
      const r0 = rand(15, 50);
      const len = rand(70, 150);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * r0, 2, Math.sin(a) * r0),
        new THREE.Vector3(Math.cos(a) * (r0 + 15), -len * 0.35, Math.sin(a) * (r0 + 15)),
        new THREE.Vector3(Math.cos(a + 0.3) * (r0 + 30), -len * 0.7, Math.sin(a + 0.3) * (r0 + 30)),
        new THREE.Vector3(Math.cos(a + 0.1) * (r0 + 20), -len, Math.sin(a + 0.1) * (r0 + 20)),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, rand(3, 7), 5), hillsMats.root));
    }
    const clod = new THREE.Mesh(new THREE.SphereGeometry(60, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), hillsMats.soil);
    clod.scale.y = 0.5;
    g.add(clod);
  }
  return shadowAll(g);
}

{ // 本家・六本木ヒルズ
  const h = makeHills(false);
  scene.add(h);
  addLandmark('六本木ヒルズ', new THREE.Vector3(0, 0, 0), 280, 200);
}

// 東京タワー
{
  const p = geoV(35.65858, 139.74543);
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xff5a1f, map: latticeTex('#fff'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, map: latticeTex('#fff'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  [orange.map, white.map].forEach(t => t.repeat.set(4, 3));
  const R = h => 50 * Math.pow(1 - h / 333, 1.9) + 1.5;
  const bands = [0, 45, 90, 120, 150, 170, 190, 210, 230, 250, 270, 290, 310, 333];
  for (let i = 0; i < bands.length - 1; i++) {
    const h0 = bands[i], h1 = bands[i + 1];
    const m = new THREE.Mesh(new THREE.CylinderGeometry(R(h1), R(h0), h1 - h0, 4, 1, true), i % 2 ? white : orange);
    m.position.y = (h0 + h1) / 2;
    m.rotation.y = Math.PI / 4;
    g.add(m);
    if (h0 >= 90) {
      const core = new THREE.Mesh(new THREE.CylinderGeometry(R(h1) * 0.55, R(h0) * 0.55, h1 - h0, 4), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf4f4f4 : 0xff5a1f, roughness: 0.6 }));
      core.position.y = (h0 + h1) / 2;
      core.rotation.y = Math.PI / 4;
      g.add(core);
    }
  }
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xe9eef3, roughness: 0.4 });
  const deck1 = new THREE.Mesh(new THREE.CylinderGeometry(22, 20, 14, 8), deckMat);
  deck1.position.y = 150;
  const deck2 = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 8, 8), deckMat);
  deck2.position.y = 250;
  const footing = new THREE.Mesh(new THREE.BoxGeometry(70, 16, 70), new THREE.MeshStandardMaterial({ color: 0xd8d4cc }));
  footing.position.y = 8;
  g.add(deck1, deck2, footing);
  g.position.copy(p);
  scene.add(shadowAll(g));
  addLandmark('東京タワー', p, 360, 120);
}

// 東京スカイツリー
{
  const p = geoV(35.71006, 139.81070);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe4edf6, map: buildingTex, roughness: 0.4, metalness: 0.2 });
  const prof = [];
  for (let i = 0; i <= 20; i++) {
    const h = i / 20 * 500;
    prof.push(new THREE.Vector2(38 - 24 * Math.pow(h / 500, 0.8), h));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 12), mat);
  const solid = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.3, metalness: 0.3 });
  const deck1 = new THREE.Mesh(new THREE.CylinderGeometry(24, 18, 22, 24), solid);
  deck1.position.y = 345;
  const deck2 = new THREE.Mesh(new THREE.CylinderGeometry(16, 14, 12, 24), solid);
  deck2.position.y = 448;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(3, 8, 134, 8), solid);
  mast.position.y = 567;
  g.add(body, deck1, deck2, mast);
  g.position.copy(p);
  scene.add(shadowAll(g));
  addLandmark('東京スカイツリー', p, 680, 150);
}

// 富士山（約96km先。地球の丸みのぶん沈める）
{
  const p = geoV(35.3606, 138.7274);
  const d = Math.hypot(p.x, p.z);
  const drop = d * d / (2 * EARTH_R) * 0.87;
  const prof = [];
  const H = 3776 * FUJI_SCALE, R = 22000 * FUJI_SCALE;
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    prof.push(new THREE.Vector2(R * Math.pow(1 - t, 2.1) + 450 * (1 - t * 0.3), H * t));
  }
  prof.push(new THREE.Vector2(0, H - 60));
  const geom = new THREE.LatheGeometry(prof.reverse().map(v => v).reverse(), 48);
  const colors = [];
  const pos = geom.attributes.position;
  const snow = new THREE.Color(0xf7f9fc), rock = new THREE.Color(0x8193b4), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / FUJI_SCALE;
    const n = Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 9) * 180;
    c.copy(y + n > 2400 ? snow : rock);
    colors.push(c.r, c.g, c.b);
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const fuji = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  fuji.position.set(p.x, -drop * FUJI_SCALE, p.z);
  scene.add(fuji);
  LANDMARKS.push({ name: '富士山', pos: new THREE.Vector3(p.x, (3776 - drop) * FUJI_SCALE + 400, p.z) });
}

// 丹沢・奥多摩などの遠い山なみ
{
  const mat = new THREE.MeshBasicMaterial({ color: 0x9fb0c9, fog: false });
  const ranges = [
    [35.47, 139.16, 1600, 9000], [35.43, 139.08, 1400, 8000], [35.52, 139.20, 1200, 7000],
    [35.80, 139.10, 1500, 10000], [35.86, 139.02, 1700, 11000], [35.72, 139.15, 900, 7000],
    [35.36, 139.03, 1300, 9000], [35.40, 139.95, 350, 9000],
  ];
  ranges.forEach(([a, b, h, r]) => {
    const p = geoV(a, b);
    const d = Math.hypot(p.x, p.z);
    const drop = d * d / (2 * EARTH_R) * 0.87;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h + drop, 7), mat);
    m.scale.z = 0.5;
    m.rotation.y = srand() * Math.PI;
    m.position.set(p.x, (h + drop) / 2 - drop, p.z);
    scene.add(m);
  });
}

// 高層ビルのランドマーク
function towerBox(lat, lon, w, d, h, color, name, opts = {}) {
  const p = geoV(lat, lon);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.4, map: buildingTex });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  body.position.y = h / 2;
  g.add(body);
  if (opts.spire) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(w * 0.35, opts.spire, 4), mat);
    s.position.y = h + opts.spire / 2;
    s.rotation.y = Math.PI / 4;
    g.add(s);
  }
  if (opts.crown) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, opts.crown, d * 1.12), mat);
    c.position.y = h - opts.crown / 2;
    g.add(c);
  }
  g.rotation.y = opts.rot || 0;
  g.position.copy(p);
  scene.add(shadowAll(g));
  addLandmark(name, p, h + (opts.spire || 0) + 40, Math.max(w, d));
  return g;
}
towerBox(35.66545, 139.73116, 55, 50, 248, 0xc9d3dd, '東京ミッドタウン', { rot: 0.2 });
towerBox(35.66680, 139.74960, 62, 45, 255, 0xb9c6d6, '虎ノ門ヒルズ', { crown: 40, rot: -0.3 });
towerBox(35.66843, 139.74865, 50, 50, 266, 0xd0d8e0, null, { rot: 0.1 });
towerBox(35.65838, 139.70225, 58, 50, 230, 0xb6c3d3, '渋谷スクランブルスクエア', { rot: 0.4 });
towerBox(35.68450, 139.70150, 45, 45, 200, 0xa8b1bd, 'ドコモタワー', { spire: 72 });
towerBox(35.66340, 139.75990, 48, 48, 213, 0x9eb0c4, null, { rot: 0.5 });
towerBox(35.66100, 139.76230, 50, 40, 210, 0xc4ced8, null, { rot: 0.5 });
towerBox(35.62850, 139.74000, 55, 45, 160, 0xb0bccb, null);
towerBox(35.68180, 139.76420, 50, 45, 200, 0xc9cfd6, '丸の内', { rot: 0.15 });
{ // 麻布台ヒルズ 森JPタワー（丸みのある頂部）
  const p = geoV(35.66055, 139.73995);
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const h = i / 24 * 325;
    const t = h / 325;
    prof.push(new THREE.Vector2(36 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, t - 0.75) / 0.25, 2))) + (t > 0.98 ? 0 : 0.5), h));
  }
  prof.push(new THREE.Vector2(0, 325));
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.3, metalness: 0.3, map: buildingTex }));
  m.position.copy(p);
  scene.add(shadowAll(m));
  addLandmark('麻布台ヒルズ', p, 370, 120);
}
{ // 東京都庁（ツインタワー）
  const p = geoV(35.68963, 139.69214);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb8b2a8, roughness: 0.6, map: buildingTex });
  const base = new THREE.Mesh(new THREE.BoxGeometry(110, 160, 40), mat);
  base.position.y = 80;
  g.add(base);
  [-30, 30].forEach(x => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(34, 83, 34), mat);
    t.position.set(x, 160 + 41, 0);
    t.rotation.y = Math.PI / 4 * 0.2;
    g.add(t);
  });
  g.position.copy(p);
  scene.add(shadowAll(g));
  addLandmark('東京都庁', p, 290, 150);
}
{ // レインボーブリッジ
  const A = geoV(35.6378, 139.7613), B = geoV(35.6343, 139.7668);
  const dir = new THREE.Vector3().subVectors(B, A);
  const span = dir.length();
  dir.normalize();
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf3f3f0, roughness: 0.5 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(span * 2.4, 8, 30), white);
  deck.position.y = 52;
  g.add(deck);
  [-span / 2, span / 2].forEach(x => {
    [-14, 14].forEach(z => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(10, 126, 8), white);
      t.position.set(x, 63, z);
      g.add(t);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 36), white);
    beam.position.set(x, 120, 0);
    g.add(beam);
  });
  [-14, 14].forEach(z => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const x = lerp(-span * 1.2, span * 1.2, i / 40);
      let y;
      if (Math.abs(x) <= span / 2) { const u = x / (span / 2); y = 60 + 64 * u * u; }
      else { y = 124 - (Math.abs(x) - span / 2) / (span * 0.7) * 68; }
      pts.push(new THREE.Vector3(x, y, z));
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff })));
  });
  g.position.copy(A.clone().add(B).multiplyScalar(0.5));
  g.rotation.y = -Math.atan2(dir.z, dir.x);
  scene.add(shadowAll(g));
  LANDMARKS.push({ name: 'レインボーブリッジ', pos: new THREE.Vector3(g.position.x, 170, g.position.z) });
  reserved.push({ x: g.position.x, z: g.position.z, r: 500 });
}

// ---------------------------------------------------------------------
// ヒルズが生えてくる候補地
// ---------------------------------------------------------------------
const SPOTS = [];
{
  let tries = 0;
  while (SPOTS.length < 320 && tries++ < 20000) {
    const r = Math.sqrt(srand()) * (STAGE_R - 150);
    const a = srand() * Math.PI * 2;
    const p = { x: Math.cos(a) * r, z: Math.sin(a) * r };
    if (isWater(p)) continue;
    if (reserved.some(q => Math.hypot(p.x - q.x, p.z - q.z) < q.r + 150)) continue;
    if (SPOTS.some(q => Math.hypot(p.x - q.x, p.z - q.z) < 260)) continue;
    SPOTS.push({ ...p, used: false });
  }
}

// ---------------------------------------------------------------------
// 一般の街並み（地区ごとの密度で手続き生成）
// ---------------------------------------------------------------------
{
  const mats = new THREE.MeshStandardMaterial({ color: 0xffffff, map: buildingTex, roughness: 0.75, metalness: 0.1 });
  buildingTex.repeat.set(1, 1);
  const geom = new THREE.BoxGeometry(1, 1, 1);
  geom.translate(0, 0.5, 0);
  const items = [];
  const palette = [0xd9d4c8, 0xc8c3b8, 0xe6e1d6, 0xb7b9bd, 0xa9aeb6, 0xd0c4b0, 0xbfc9d3, 0xe2ddd2, 0x9aa3ad, 0xc9b9a0];
  const glass = [0x8fa8c4, 0x7d93ad, 0xa6b8cc, 0x6f86a2];
  function place(step, rMin, rMax, keep, scaleH) {
    for (let x = -rMax; x <= rMax; x += step) {
      for (let z = -rMax; z <= rMax; z += step) {
        const p = { x: x + (srand() - 0.5) * step * 0.4, z: z + (srand() - 0.5) * step * 0.4 };
        const r = Math.hypot(p.x, p.z);
        if (r < rMin || r > rMax) continue;
        if (srand() > keep) continue;
        if (isWater(p) || inPark(p)) continue;
        if (reserved.some(q => Math.hypot(p.x - q.x, p.z - q.z) < q.r)) continue;
        if (SPOTS.some(q => Math.hypot(p.x - q.x, p.z - q.z) < 95)) continue;
        let hub = 0;
        HUBS.forEach(h => { hub = Math.max(hub, h.k * Math.exp(-((p.x - h.x) ** 2 + (p.z - h.z) ** 2) / (2 * h.s * h.s))); });
        let h = 8 + Math.pow(srand(), 2.2) * 45 + hub * 40;
        let tall = false;
        if (srand() < hub * 0.45) { h = 90 + srand() * 140 * hub; tall = true; }
        h *= scaleH;
        const w = tall ? 30 + srand() * 25 : step * (0.35 + srand() * 0.4);
        const d = tall ? 30 + srand() * 25 : step * (0.35 + srand() * 0.4);
        const col = tall || srand() < 0.15 ? glass[srand() * glass.length | 0] : palette[srand() * palette.length | 0];
        items.push({ x: p.x, z: p.z, w, d, h, col, rot: (srand() - 0.5) * 0.25 });
      }
    }
  }
  place(64, 0, 5600, 0.78, 1);
  place(100, 5600, 7500, 0.6, 0.8);
  place(170, 7500, 14000, 0.55, 0.6);

  const mesh = new THREE.InstancedMesh(geom, mats, items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler(), c = new THREE.Color();
  items.forEach((b, i) => {
    q.setFromEuler(e.set(0, b.rot, 0));
    m.compose(new THREE.Vector3(b.x, 0, b.z), q, s.set(b.w, b.h, b.d));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(b.col).offsetHSL(0, 0, (srand() - 0.5) * 0.06));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // 緑地の木
  const trees = [];
  parkData.forEach(k => {
    const n = Math.floor(k.rx * k.rz / 2500);
    for (let i = 0; i < n; i++) {
      const a = srand() * Math.PI * 2, r = Math.sqrt(srand());
      trees.push({ x: k.x + Math.cos(a) * r * k.rx * 0.95, z: k.z + Math.sin(a) * r * k.rz * 0.95, s: 9 + srand() * 9 });
    }
  });
  // 街路樹（候補地のまわりに少し）
  SPOTS.forEach(sp => {
    for (let i = 0; i < 5; i++) {
      const a = srand() * Math.PI * 2;
      trees.push({ x: sp.x + Math.cos(a) * 85, z: sp.z + Math.sin(a) * 85, s: 6 + srand() * 4 });
    }
  });
  const treeMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x4d7a3a, roughness: 1, flatShading: true }), trees.length);
  trees.forEach((t, i) => {
    m.compose(new THREE.Vector3(t.x, t.s * 0.9, t.z), q.identity(), s.set(t.s, t.s * 1.1, t.s));
    treeMesh.setMatrixAt(i, m);
    treeMesh.setColorAt(i, c.setHex(0x4d7a3a).offsetHSL((srand() - 0.5) * 0.05, 0, (srand() - 0.5) * 0.1));
  });
  treeMesh.castShadow = true;
  scene.add(treeMesh);
}

// ---------------------------------------------------------------------
// 土ぼこり
// ---------------------------------------------------------------------
const MAX_P = 900;
const pGeom = new THREE.BufferGeometry();
const pPos = new Float32Array(MAX_P * 3).fill(-99999);
const pVel = new Float32Array(MAX_P * 3);
const pLife = new Float32Array(MAX_P);
pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(pGeom, new THREE.PointsMaterial({ color: 0x7a5530, size: 9, sizeAttenuation: true }));
particles.frustumCulled = false;
scene.add(particles);
let pCursor = 0;
function dirt(x, y, z, n, power = 1) {
  for (let i = 0; i < n; i++) {
    const k = pCursor = (pCursor + 1) % MAX_P;
    pPos[k * 3] = x + rand(-50, 50); pPos[k * 3 + 1] = y + rand(0, 10); pPos[k * 3 + 2] = z + rand(-50, 50);
    pVel[k * 3] = rand(-60, 60) * power; pVel[k * 3 + 1] = rand(40, 140) * power; pVel[k * 3 + 2] = rand(-60, 60) * power;
    pLife[k] = rand(0.8, 1.6);
  }
}
function updateParticles(dt) {
  for (let k = 0; k < MAX_P; k++) {
    if (pLife[k] <= 0) continue;
    pLife[k] -= dt;
    pVel[k * 3 + 1] -= 200 * dt;
    pPos[k * 3] += pVel[k * 3] * dt; pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt; pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt;
    if (pLife[k] <= 0 || pPos[k * 3 + 1] < 0) { pLife[k] = 0; pPos[k * 3 + 1] = -99999; }
  }
  pGeom.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------------
// 効果音（WebAudio で合成）
// ---------------------------------------------------------------------
let audio = null;
function sfx(type) {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const o = audio.createOscillator(), g = audio.createGain();
    o.connect(g); g.connect(audio.destination);
    if (type === 'pop') {
      o.type = 'square';
      o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(1100, t + 0.12);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.start(t); o.stop(t + 0.26);
    } else if (type === 'pull') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70 + Math.random() * 30, t);
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.start(t); o.stop(t + 0.09);
    } else if (type === 'root') {
      o.type = 'triangle';
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.start(t); o.stop(t + 0.51);
    } else if (type === 'sprout') {
      o.type = 'sine';
      o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.1);
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.16);
    }
  } catch (_) { /* 音が出なくてもゲームは続ける */ }
}

// ---------------------------------------------------------------------
// カメラ操作
// ---------------------------------------------------------------------
const cam = {
  target: new THREE.Vector3(0, 0, 0),
  heading: Math.atan2(geo(35.3606, 138.7274).x, -geo(35.3606, 138.7274).z), // 富士山の方角
  dist: 1500,
  fly: null,
  shake: 0,
};
const MIN_DIST = 350, MAX_DIST = 9000;
function updateCamera(dt) {
  if (cam.fly) {
    cam.fly.t = Math.min(1, cam.fly.t + dt / cam.fly.dur);
    const k = 1 - Math.pow(1 - cam.fly.t, 3);
    cam.target.lerpVectors(cam.fly.from, cam.fly.to, k);
    cam.dist = lerp(cam.fly.d0, cam.fly.d1, k);
    if (cam.fly.t >= 1) cam.fly = null;
  }
  const r = Math.hypot(cam.target.x, cam.target.z);
  if (r > STAGE_R) cam.target.multiplyScalar(STAGE_R / r);
  cam.dist = clamp(cam.dist, MIN_DIST, MAX_DIST);
  const z = (Math.log(cam.dist) - Math.log(MIN_DIST)) / (Math.log(MAX_DIST) - Math.log(MIN_DIST));
  const pitch = lerp(0.17, 1.05, Math.pow(z, 0.8));
  const fx = Math.sin(cam.heading), fz = -Math.cos(cam.heading);
  camera.position.set(
    cam.target.x - fx * Math.cos(pitch) * cam.dist,
    Math.max(160, Math.sin(pitch) * cam.dist + 40),
    cam.target.z - fz * Math.cos(pitch) * cam.dist,
  );
  if (cam.shake > 0) {
    camera.position.x += rand(-1, 1) * cam.shake;
    camera.position.y += rand(-1, 1) * cam.shake;
    cam.shake = Math.max(0, cam.shake - dt * 40);
  }
  camera.lookAt(cam.target.x, lerp(150, 60, Math.min(1, z * 2.5)), cam.target.z);
  sky.position.copy(camera.position);
  sun.position.copy(cam.target).add(SUN_OFFSET);
  sun.target.position.copy(cam.target);
  setShadowRange(clamp(cam.dist * 1.1, 800, 3500));
}
function flyTo(x, z, d = 1300) {
  cam.fly = { from: cam.target.clone(), to: new THREE.Vector3(x, 0, z), d0: cam.dist, d1: d, t: 0, dur: 0.6 };
}

// 画面座標 → 地面（y=0）の座標
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function screenToGround(sx, sy) {
  const ndc = new THREE.Vector2(sx / window.innerWidth * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const out = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, out) ? out : null;
}
const _v = new THREE.Vector3();
function project(x, y, z) {
  _v.set(x, y, z).project(camera);
  return { x: (_v.x + 1) / 2 * window.innerWidth, y: (1 - _v.y) / 2 * window.innerHeight, front: _v.z < 1 && _v.z > -1, ndcX: _v.x, ndcY: _v.y };
}

// ---------------------------------------------------------------------
// ゲーム本体
// ---------------------------------------------------------------------
const ui = {
  hud: document.getElementById('hud'),
  score: document.getElementById('score'),
  time: document.getElementById('time'),
  rooted: document.getElementById('rooted'),
  combo: document.getElementById('combo'),
  popups: document.getElementById('popups'),
  overlay: document.getElementById('overlay'),
  titlePanel: document.getElementById('title-panel'),
  resultPanel: document.getElementById('result-panel'),
  best: document.getElementById('best'),
  arrows: document.getElementById('arrows'),
  labels: document.getElementById('labels'),
  radar: document.getElementById('radar'),
};

let state = 'title';   // title | play | over
let game = null;
let best = 0;
try { best = parseInt(localStorage.getItem('hills_best3d'), 10) || 0; } catch (_) { /* ignore */ }
if (best) ui.best.textContent = `ハイスコア ${best.toLocaleString()} 点`;

const sprouts = [];
const holes = [];
const moundGeom = new THREE.CylinderGeometry(70, 95, 10, 18);
const ringGeom = new THREE.RingGeometry(95, 115, 40);
const holeGeom = new THREE.CircleGeometry(80, 24);
const holeMat = new THREE.MeshBasicMaterial({ color: 0x2a1a0c, transparent: true });

function newGame() {
  sprouts.forEach(s => { scene.remove(s.group, s.mound, s.ring); s.spot.used = false; });
  sprouts.length = 0;
  holes.forEach(h => scene.remove(h.mesh));
  holes.length = 0;
  game = {
    time: 0, score: 0, rooted: 0, pulled: 0, combo: 0, comboT: 0, nextSpawn: 0.5,
    best: { name: '', pts: 0 }, counts: { gold: 0, good: 0, ok: 0, old: 0 },
  };
  state = 'play';
  cam.target.set(0, 0, 0);
  flyTo(0, 0, 1500);
  ui.overlay.hidden = true;
  ui.hud.hidden = false;
  ui.radar.hidden = false;
  spawn(true); spawn(true);
}

function spawn(near) {
  const free = SPOTS.filter(s => !s.used);
  if (!free.length) return;
  let pool = free;
  if (near || Math.random() < 0.55) {
    const close = free.filter(s => Math.hypot(s.x - cam.target.x, s.z - cam.target.z) < 1700 && Math.hypot(s.x - cam.target.x, s.z - cam.target.z) > 200);
    if (close.length) pool = close;
  }
  const spot = pool[Math.random() * pool.length | 0];
  spot.used = true;
  const group = makeHills(true);
  group.position.set(spot.x, -HILLS_H - 160, spot.z);
  group.rotation.y = rand(0, Math.PI * 2);
  const mound = new THREE.Mesh(moundGeom, hillsMats.soil);
  mound.position.set(spot.x, 0, spot.z);
  mound.scale.set(0.01, 0.01, 0.01);
  mound.receiveShadow = true;
  const ring = new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(spot.x, 3, spot.z);
  scene.add(group, mound, ring);
  const d = game ? game.time / GAME_TIME : 0;
  sprouts.push({
    spot, group, mound, ring,
    state: 'warn', t: 0, grow: 0,
    growTime: (20 - d * 9) * rand(0.85, 1.2),
    ripeTime: 5,
    loosen: 0, grabbed: false, lift: 0,
    vel: new THREE.Vector3(), spin: new THREE.Vector3(),
  });
}

function requiredPull(s) {
  return window.innerHeight * (0.1 + s.grow * 0.55 + (s.state === 'ripe' ? 0.2 : 0));
}

function grade(s) {
  if (s.state === 'ripe') return { pts: 20, name: 'ギリギリセーフ', key: 'old', color: '#ff8c5a' };
  if (s.grow < 0.12) return { pts: 500, name: '極上の朝掘り！', key: 'gold', color: '#ffe14d' };
  if (s.grow < 0.35) return { pts: 250, name: '上物！', key: 'good', color: '#7dff9a' };
  if (s.grow < 0.7) return { pts: 100, name: 'まあまあ', key: 'ok', color: '#ffffff' };
  return { pts: 40, name: '育ちすぎ', key: 'old', color: '#c9c9c9' };
}

function yank(s) {
  const g = grade(s);
  game.combo = game.comboT > 0 ? game.combo + 1 : 1;
  game.comboT = 3;
  const mult = 1 + Math.min(game.combo - 1, 10) * 0.1;
  const pts = Math.round(g.pts * mult);
  game.score += pts;
  game.pulled++;
  game.counts[g.key]++;
  if (pts > game.best.pts) game.best = { name: g.name, pts };

  s.state = 'fly';
  s.t = 0;
  s.grabbed = false;
  s.vel.set(rand(-40, 40), 260 + s.grow * 60, rand(-40, 40));
  s.spin.set(rand(-1.2, 1.2), rand(-2, 2), rand(-1.2, 1.2));
  s.spot.used = false;
  scene.remove(s.mound, s.ring);
  const hole = new THREE.Mesh(holeGeom, holeMat.clone());
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(s.spot.x, 2, s.spot.z);
  scene.add(hole);
  holes.push({ mesh: hole, t: 4 });
  dirt(s.spot.x, 0, s.spot.z, 140, 1.4);
  cam.shake = 8;
  sfx('pop');
  if (navigator.vibrate) navigator.vibrate(40);

  const sp = project(s.spot.x, s.group.position.y + HILLS_H, s.spot.z);
  popup(`${g.name}<small>+${pts}${game.combo > 1 ? `（${game.combo}連続）` : ''}</small>`, sp.x, sp.y, g.color, g.key === 'gold' ? 34 : 28);
}

function popup(html, x, y, color = '#fff', size = 28) {
  const el = document.createElement('div');
  el.className = 'pop';
  el.innerHTML = html;
  el.style.left = clamp(x, 80, window.innerWidth - 80) + 'px';
  el.style.top = clamp(y, 90, window.innerHeight - 60) + 'px';
  el.style.color = color;
  el.style.fontSize = size + 'px';
  ui.popups.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function updateSprouts(dt) {
  for (let i = sprouts.length - 1; i >= 0; i--) {
    const s = sprouts[i];
    s.t += dt;
    if (s.state === 'warn') {
      // 地面が盛り上がる
      const k = Math.min(1, s.t / 1.2);
      s.mound.scale.set(k, k * (1 + Math.sin(s.t * 30) * 0.2), k);
      if (Math.random() < dt * 8) dirt(s.spot.x, 0, s.spot.z, 2, 0.4);
      if (s.t > 1.2) { s.state = 'grow'; s.t = 0; sfx('sprout'); }
    } else if (s.state === 'grow' || s.state === 'ripe') {
      if (s.state === 'grow') {
        if (!s.grabbed) s.grow = Math.min(1, s.grow + dt / s.growTime);
        if (s.grow >= 1) { s.state = 'ripe'; s.t = 0; }
      } else {
        s.ring.material.opacity = 0.35 + 0.35 * Math.sin(s.t * 10);
        if (s.t > s.ripeTime && !s.grabbed) {
          s.state = 'rooted';
          scene.remove(s.ring);
          s.mound.scale.set(1, 0.4, 1);
          game.rooted++;
          sfx('root');
          cam.shake = 6;
          const sp = project(s.spot.x, HILLS_H, s.spot.z);
          if (sp.front) popup('根付いてしまった…', sp.x, sp.y, '#ff6b6b', 24);
          if (game.rooted >= ROOT_LIMIT) endGame('港区がヒルズに占領された！');
        }
      }
      if (!s.grabbed) s.loosen = Math.max(0, s.loosen - requiredPull(s) * 0.3 * dt);
      const looseK = Math.min(1, s.loosen / requiredPull(s));
      s.lift = lerp(s.lift, looseK * 40, Math.min(1, dt * 12));
      const wob = s.state === 'ripe' ? Math.sin(s.t * 18) * 0.012 : 0;
      const shake = s.grabbed ? 0.02 * looseK : 0;
      s.group.position.y = -HILLS_H * (1 - s.grow) + s.lift;
      s.group.rotation.x = wob + rand(-shake, shake);
      s.group.rotation.z = rand(-shake, shake);
    } else if (s.state === 'fly') {
      s.vel.y -= 120 * dt;
      s.group.position.addScaledVector(s.vel, dt);
      s.group.rotation.x += s.spin.x * dt;
      s.group.rotation.y += s.spin.y * dt;
      s.group.rotation.z += s.spin.z * dt;
      if (s.t > 4) { scene.remove(s.group); sprouts.splice(i, 1); }
    }
  }
  for (let i = holes.length - 1; i >= 0; i--) {
    const h = holes[i];
    h.t -= dt;
    h.mesh.material.opacity = clamp(h.t / 2, 0, 1);
    if (h.t <= 0) { scene.remove(h.mesh); holes.splice(i, 1); }
  }
}

function updateGame(dt) {
  game.time += dt;
  game.comboT = Math.max(0, game.comboT - dt);
  if (game.comboT === 0) game.combo = 0;
  const d = game.time / GAME_TIME;
  game.nextSpawn -= dt;
  const active = sprouts.filter(s => s.state === 'warn' || s.state === 'grow' || s.state === 'ripe').length;
  if (game.nextSpawn <= 0 && active < 3 + Math.floor(d * 5)) {
    spawn(false);
    game.nextSpawn = lerp(3.0, 1.1, d) * rand(0.7, 1.3);
  }
  if (game.time >= GAME_TIME) endGame('タイムアップ！');

  ui.score.textContent = game.score.toLocaleString();
  ui.time.textContent = Math.ceil(Math.max(0, GAME_TIME - game.time));
  ui.rooted.textContent = `${game.rooted}/${ROOT_LIMIT}`;
  ui.rooted.parentElement.style.background = game.rooted >= ROOT_LIMIT - 1 ? 'rgba(200,40,40,.85)' : '';
  if (game.combo > 1) { ui.combo.hidden = false; ui.combo.textContent = `${game.combo} 連続引っこ抜き！`; }
  else ui.combo.hidden = true;
}

function rankOf(score) {
  if (score >= 9000) return 'ランクS　港区の守護神';
  if (score >= 6000) return 'ランクA　ヒルズハンター';
  if (score >= 3500) return 'ランクB　再開発キラー';
  if (score >= 1500) return 'ランクC　見習い筍掘り';
  return 'ランクD　ヒルズに好かれた人';
}

function endGame(reason) {
  if (state !== 'play') return;
  state = 'over';
  if (pull.sprout) { pull.sprout.grabbed = false; pull.sprout = null; }
  const isBest = game.score > best;
  if (isBest) { best = game.score; try { localStorage.setItem('hills_best3d', String(best)); } catch (_) { /* ignore */ } }
  ui.best.textContent = `ハイスコア ${best.toLocaleString()} 点`;
  document.getElementById('result-reason').textContent = reason;
  document.getElementById('result-score').textContent = `${game.score.toLocaleString()} 点`;
  document.getElementById('result-rank').textContent = rankOf(game.score) + (isBest ? '　★自己ベスト' : '');
  const c = game.counts;
  document.getElementById('result-stats').innerHTML = `
    <dt>引っこ抜いたヒルズ</dt><dd>${game.pulled} 本</dd>
    <dt>極上の朝掘り</dt><dd>${c.gold} 本</dd>
    <dt>上物</dt><dd>${c.good} 本</dd>
    <dt>まあまあ・育ちすぎ</dt><dd>${c.ok + c.old} 本</dd>
    <dt>根付いたヒルズ</dt><dd>${game.rooted} 本</dd>`;
  setTimeout(() => {
    ui.overlay.hidden = false;
    ui.titlePanel.hidden = true;
    ui.resultPanel.hidden = false;
    ui.hud.hidden = true;
    ui.combo.hidden = true;
  }, 900);
}

document.getElementById('start').addEventListener('click', () => { sfx('sprout'); newGame(); });
document.getElementById('retry').addEventListener('click', () => { sfx('sprout'); newGame(); });

// ---------------------------------------------------------------------
// 入力：ヒルズ上を上スワイプ＝引っこ抜く／それ以外のドラッグ＝移動
//       ピンチ＝ズーム＋回転、ホイール＝ズーム、右ドラッグ／Q・E＝回転
// ---------------------------------------------------------------------
const pointers = new Map();
const pull = { sprout: null, id: null };
let multi = null;
const el = renderer.domElement;

function pickSprout(x, y) {
  let bestS = null, bestD = Infinity;
  sprouts.forEach(s => {
    if (s.state !== 'grow' && s.state !== 'ripe') return;
    const top = Math.max(15, s.group.position.y + HILLS_H);
    const a = project(s.spot.x, 0, s.spot.z);
    const b = project(s.spot.x, top, s.spot.z);
    if (!a.front) return;
    const side = project(s.spot.x + 70, 0, s.spot.z);
    const halfW = Math.max(36, Math.hypot(side.x - a.x, side.y - a.y) + 16);
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
    if (d < halfW && d < bestD) { bestD = d; bestS = s; }
  });
  return bestS;
}

el.addEventListener('pointerdown', e => {
  el.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey });
  if (pointers.size === 1) {
    if (state === 'play' && e.button === 0 && !e.shiftKey) {
      const s = pickSprout(e.clientX, e.clientY);
      if (s) { pull.sprout = s; pull.id = e.pointerId; s.grabbed = true; cam.fly = null; }
    }
  } else if (pointers.size === 2) {
    if (pull.sprout) { pull.sprout.grabbed = false; pull.sprout = null; }
    const [p1, p2] = [...pointers.values()];
    multi = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), a: Math.atan2(p2.y - p1.y, p2.x - p1.x), mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2 };
  }
});

el.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const px = p.x, py = p.y;
  p.x = e.clientX; p.y = e.clientY;

  if (pointers.size >= 2 && multi) {
    const [p1, p2] = [...pointers.values()];
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const a = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    cam.dist *= multi.d / Math.max(1, d);
    let da = a - multi.a;
    if (da > Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    cam.heading -= da;
    panBy(multi.mx, multi.my, mx, my);
    multi = { d, a, mx, my };
    cam.fly = null;
    return;
  }

  if (pull.sprout && pull.id === e.pointerId) {
    const s = pull.sprout;
    const dy = py - e.clientY;
    if (dy > 0) {
      s.loosen += dy;
      if (Math.random() < 0.3) sfx('pull');
      if (Math.random() < 0.4) dirt(s.spot.x, 0, s.spot.z, 2, 0.6);
      if (s.loosen >= requiredPull(s)) { yank(s); pull.sprout = null; }
    }
    return;
  }

  if (p.button === 2 || p.shift) {
    cam.heading += (e.clientX - px) * 0.005;
    cam.fly = null;
    return;
  }
  panBy(px, py, e.clientX, e.clientY);
  cam.fly = null;
});

function panBy(x0, y0, x1, y1) {
  const a = screenToGround(x0, y0), b = screenToGround(x1, y1);
  if (!a || !b) return;
  const dx = a.x - b.x, dz = a.z - b.z;
  const lim = cam.dist * 0.5;
  cam.target.x += clamp(dx, -lim, lim);
  cam.target.z += clamp(dz, -lim, lim);
}

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pull.id === e.pointerId && pull.sprout) { pull.sprout.grabbed = false; pull.sprout = null; }
  if (pointers.size < 2) multi = null;
}
el.addEventListener('pointerup', endPointer);
el.addEventListener('pointercancel', endPointer);
el.addEventListener('contextmenu', e => e.preventDefault());
el.addEventListener('wheel', e => {
  e.preventDefault();
  cam.dist *= Math.exp(e.deltaY * 0.0012);
  cam.fly = null;
}, { passive: false });
const keys = new Set();
window.addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function updateKeys(dt) {
  if (keys.has('q')) cam.heading -= dt * 1.2;
  if (keys.has('e')) cam.heading += dt * 1.2;
  const sp = cam.dist * 0.9 * dt;
  const fx = Math.sin(cam.heading), fz = -Math.cos(cam.heading);
  if (keys.has('w') || keys.has('arrowup')) { cam.target.x += fx * sp; cam.target.z += fz * sp; }
  if (keys.has('s') || keys.has('arrowdown')) { cam.target.x -= fx * sp; cam.target.z -= fz * sp; }
  if (keys.has('a') || keys.has('arrowleft')) { cam.target.x += fz * sp; cam.target.z -= fx * sp; }
  if (keys.has('d') || keys.has('arrowright')) { cam.target.x -= fz * sp; cam.target.z += fx * sp; }
  if (keys.has('-')) cam.dist *= 1 + dt;
  if (keys.has('=') || keys.has('+')) cam.dist /= 1 + dt;
}
document.getElementById('rot-l').addEventListener('click', () => { cam.heading -= Math.PI / 4; });
document.getElementById('rot-r').addEventListener('click', () => { cam.heading += Math.PI / 4; });
document.getElementById('zoom-out').addEventListener('click', () => { cam.dist *= 1.6; });
document.getElementById('zoom-in').addEventListener('click', () => { cam.dist /= 1.6; });

// ---------------------------------------------------------------------
// 画面外のヒルズを示す矢印・ランドマーク名・レーダー
// ---------------------------------------------------------------------
const arrowEls = new Map();
function updateArrows() {
  const live = new Set();
  const W = window.innerWidth, H = window.innerHeight;
  if (state === 'play') {
    sprouts.forEach(s => {
      if (s.state !== 'grow' && s.state !== 'ripe' && s.state !== 'warn') return;
      const top = Math.max(10, s.group.position.y + HILLS_H * 0.5);
      const p = project(s.spot.x, top, s.spot.z);
      const onScreen = p.front && p.x > 20 && p.x < W - 20 && p.y > 70 && p.y < H - 20;
      const sizeRef = project(s.spot.x + 60, 0, s.spot.z);
      const tiny = Math.hypot(sizeRef.x - p.x, sizeRef.y - p.y) < 6;
      if (onScreen && !tiny) return;
      live.add(s);
      let a = arrowEls.get(s);
      if (!a) {
        a = document.createElement('button');
        a.className = 'arrow';
        a.innerHTML = '<i></i><span></span>';
        a.addEventListener('click', ev => { ev.stopPropagation(); flyTo(s.spot.x, s.spot.z); });
        ui.arrows.appendChild(a);
        arrowEls.set(s, a);
      }
      // 方向：カメラから見た水平方向
      const dx = s.spot.x - cam.target.x, dz = s.spot.z - cam.target.z;
      const fx = Math.sin(cam.heading), fz = -Math.cos(cam.heading);
      const forward = dx * fx + dz * fz, right = dx * -fz + dz * fx;
      let ang = Math.atan2(right, forward);
      let ax, ay;
      if (onScreen) { ax = p.x; ay = p.y; ang = Math.PI; }
      else {
        const cx = W / 2, cy = H / 2 + 20;
        const vx = Math.sin(ang), vy = -Math.cos(ang);
        const k = Math.min((W / 2 - 34) / Math.abs(vx || 1e-6), (H / 2 - 70) / Math.abs(vy || 1e-6));
        ax = cx + vx * k; ay = cy + vy * k;
      }
      a.style.left = ax + 'px';
      a.style.top = ay + 'px';
      a.querySelector('i').style.transform = `rotate(${ang}rad)`;
      const dist = Math.hypot(dx, dz);
      a.querySelector('span').textContent = dist >= 1000 ? (dist / 1000).toFixed(1) + 'km' : Math.round(dist) + 'm';
      a.classList.toggle('ripe', s.state === 'ripe');
      a.classList.toggle('young', s.state !== 'ripe' && s.grow < 0.35);
    });
  }
  arrowEls.forEach((a, s) => { if (!live.has(s)) { a.remove(); arrowEls.delete(s); } });
}

const labelEls = LANDMARKS.map(l => {
  const e = document.createElement('div');
  e.className = 'lm';
  e.textContent = l.name;
  ui.labels.appendChild(e);
  return e;
});
function updateLabels() {
  const W = window.innerWidth, H = window.innerHeight;
  LANDMARKS.forEach((l, i) => {
    const p = project(l.pos.x, l.pos.y, l.pos.z);
    const d = camera.position.distanceTo(l.pos);
    const major = ['富士山', '東京スカイツリー', '東京タワー', '六本木ヒルズ'].includes(l.name);
    const show = p.front && p.x > -50 && p.x < W + 50 && p.y > 20 && p.y < H && (major || d < 3500);
    labelEls[i].style.display = show ? '' : 'none';
    if (show) labelEls[i].style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
  });
}

const radarCtx = ui.radar.getContext('2d');
function drawRadar() {
  if (ui.radar.hidden) return;
  const S = ui.radar.width, c = S / 2, k = (S / 2 - 6) / STAGE_R;
  const g = radarCtx;
  g.clearRect(0, 0, S, S);
  g.save();
  g.translate(c, c);
  g.rotate(-cam.heading); // 画面の上＝カメラの向き
  g.fillStyle = 'rgba(20,22,31,.75)';
  g.beginPath(); g.arc(0, 0, S / 2 - 2, 0, 7); g.fill();
  g.save();
  g.beginPath(); g.arc(0, 0, S / 2 - 4, 0, 7); g.clip();
  g.fillStyle = 'rgba(63,116,163,.9)';
  g.beginPath(); BAY.forEach((p, i) => (i ? g.lineTo(p.x * k, p.z * k) : g.moveTo(p.x * k, p.z * k))); g.fill();
  g.fillStyle = 'rgba(20,22,31,.75)';
  ISLANDS.forEach(is => { g.beginPath(); is.forEach((p, i) => (i ? g.lineTo(p.x * k, p.z * k) : g.moveTo(p.x * k, p.z * k))); g.fill(); });
  g.fillStyle = 'rgba(95,143,74,.8)';
  parkData.forEach(p => { g.beginPath(); g.ellipse(p.x * k, p.z * k, p.rx * k, p.rz * k, 0, 0, 7); g.fill(); });
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.beginPath(); g.arc(0, 0, S / 2 - 4, 0, 7); g.stroke();
  // 本家ヒルズ・東京タワー
  g.fillStyle = '#ffcf33'; g.fillRect(-2.5, -2.5, 5, 5);
  const tt = geo(35.65858, 139.74543);
  g.fillStyle = '#ff5a1f'; g.fillRect(tt.x * k - 2, tt.z * k - 2, 4, 4);
  // ヒルズ
  sprouts.forEach(s => {
    if (s.state === 'fly') return;
    g.fillStyle = s.state === 'rooted' ? '#777' : s.state === 'ripe' ? '#ff4040' : s.grow < 0.35 ? '#7dff9a' : '#fff';
    g.beginPath(); g.arc(s.spot.x * k, s.spot.z * k, s.state === 'rooted' ? 2.5 : 3.5, 0, 7); g.fill();
  });
  // 視点
  g.strokeStyle = '#fff'; g.lineWidth = 1.5;
  const tx = cam.target.x * k, tz = cam.target.z * k;
  const fx = Math.sin(cam.heading), fz = -Math.cos(cam.heading);
  g.beginPath(); g.arc(tx, tz, Math.max(4, cam.dist * 0.4 * k), 0, 7); g.stroke();
  g.beginPath(); g.moveTo(tx, tz); g.lineTo(tx + fx * 12, tz + fz * 12); g.stroke();
  g.restore();
  // 方位
  g.fillStyle = '#fff'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('N', c + Math.sin(-cam.heading) * (S / 2 - 10), c - Math.cos(-cam.heading) * (S / 2 - 10));
}
ui.radar.addEventListener('click', e => {
  const rect = ui.radar.getBoundingClientRect();
  const S = ui.radar.width, k = (S / 2 - 6) / STAGE_R;
  const x = (e.clientX - rect.left) / rect.width * S - S / 2;
  const y = (e.clientY - rect.top) / rect.height * S - S / 2;
  const cs = Math.cos(cam.heading), sn = Math.sin(cam.heading);
  flyTo((x * cs - y * sn) / k, (x * sn + y * cs) / k, cam.dist);
});

// ---------------------------------------------------------------------
// メインループ
// ---------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === 'title') { cam.heading += dt * 0.06; }
  if (state === 'play') updateGame(dt);
  updateSprouts(dt);
  updateParticles(dt);
  updateKeys(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  updateArrows();
  updateLabels();
  drawRadar();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// デバッグ・テスト用
window.__hills = { camera, renderer, scene, get state() { return state; }, get game() { return game; }, sprouts, cam, newGame, yank, project, flyTo };
