// 六本木ヒルズを引っこ抜け — 港区 筍狩り
import * as THREE from './lib/three.module.min.js';
import { t, lang, setLang, applyI18n, onLangChange, landmarkName } from './i18n.js';

// Android / iOS アプリ（Capacitor）で動いているか。Web 版では Capacitor がないので何もしない
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const plugin = name => (NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null);
const Ads = window.Ads || { available: false, canReward: false, showing: false, privacyOptionsRequired: false, initDone: Promise.resolve(), showInterstitial: async () => {}, showRewarded: async () => 'unavailable', setBanner() {}, showPrivacyOptions: async () => {} };

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
const IS_MOBILE = window.matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.3 : 2));
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
sun.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
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
  g.fillStyle = '#6f9a4c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) {
    const v = Math.random();
    g.fillStyle = `rgba(${80 + v * 50 | 0},${120 + v * 50 | 0},${50 + v * 30 | 0},.45)`;
    g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }
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
const landMat = new THREE.MeshStandardMaterial({ color: 0x6f9a4c, roughness: 1 });
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
const parkMat = new THREE.MeshStandardMaterial({ color: 0x4f8a3c, roughness: 1 });
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
// ---------------------------------------------------------------------
// 地下鉄：大江戸線・日比谷線の近くに生えたヒルズは、根っこに電車が絡まっている
//   線路は実際の駅の位置をつないだ折れ線（おおよそ）
// ---------------------------------------------------------------------
const SUBWAY_LINES = {
  oedo: {
    color: 0xce045b,
    paths: [
      [[35.6907, 139.6927], [35.6881, 139.6995], [35.6831, 139.7020], [35.6800, 139.7148], [35.6727, 139.7240],
        [35.6634, 139.7317], [35.6556, 139.7369], [35.6550, 139.7438], [35.6567, 139.7547], [35.6647, 139.7608],
        [35.6650, 139.7700], [35.6588, 139.7766], [35.6650, 139.7840], [35.6720, 139.7960]],
      [[35.6907, 139.6927], [35.6930, 139.6990], [35.6977, 139.7075], [35.6990, 139.7180], [35.6990, 139.7245],
        [35.7020, 139.7350], [35.7020, 139.7450], [35.7090, 139.7530], [35.7070, 139.7600]],
    ],
  },
  hibiya: {
    color: 0x9c9c94,
    paths: [
      [[35.6440, 139.6990], [35.6467, 139.7100], [35.6503, 139.7222], [35.6627, 139.7310], [35.6630, 139.7450],
        [35.6685, 139.7495], [35.6737, 139.7510], [35.6750, 139.7600], [35.6717, 139.7650], [35.6695, 139.7670],
        [35.6680, 139.7720], [35.6750, 139.7780], [35.6800, 139.7800], [35.6860, 139.7820], [35.6910, 139.7780],
        [35.6980, 139.7740], [35.7070, 139.7770]],
    ],
  },
};
Object.values(SUBWAY_LINES).forEach(l => { l.paths = l.paths.map(path => path.map(([a, b]) => geo(a, b))); });
const SUBWAY_NEAR = 300; // この距離（m）以内に生えたヒルズには電車が絡まる
function subwayAt(p) {
  const near = Object.keys(SUBWAY_LINES).filter(k => SUBWAY_LINES[k].paths.some(path => distToPolyline(p, path) < SUBWAY_NEAR));
  return near.length ? near[Math.random() * near.length | 0] : null;
}
const trainMats = {
  body: new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.35, metalness: 0.6 }),
  window: new THREE.MeshStandardMaterial({ color: 0x1d2633, roughness: 0.2, metalness: 0.3 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.8 }),
};
// 2両編成。見やすいように実物の約3倍の大きさにしている
function makeTrain(line) {
  const band = new THREE.MeshStandardMaterial({ color: SUBWAY_LINES[line].color, roughness: 0.4, metalness: 0.2 });
  const train = new THREE.Group();
  const L = 48, W = 8.5, H = 10.5;
  for (let i = 0; i < 2; i++) {
    const car = new THREE.Group();
    car.add(new THREE.Mesh(new THREE.BoxGeometry(L, H, W), trainMats.body));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 2.2, W + 0.3), band);
    stripe.position.y = -1.3;
    const win = new THREE.Mesh(new THREE.BoxGeometry(L - 6, 3.2, W + 0.2), trainMats.window);
    win.position.y = 2.3;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(L - 2, 0.8, W - 1), trainMats.dark);
    roof.position.y = H / 2 + 0.4;
    [-1, 1].forEach(sx => {
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, W - 1.6), trainMats.window);
      front.position.set(sx * (L / 2 + 0.05), 1.4, 0);
      car.add(front);
    });
    car.add(stripe, win, roof);
    // 2両目は連結部で折れ曲がってぶら下がる
    car.position.set(i * (L + 1.5) * Math.cos(i * 0.5), -i * (L + 1.5) * Math.sin(i * 0.5), 0);
    car.rotation.z = -i * 0.5;
    train.add(car);
  }
  // 根っこの外側の先で斜めに引っかかっている
  const ang = rand(0, Math.PI * 2), rad = rand(70, 90);
  train.position.set(Math.cos(ang) * rad, rand(-120, -100), Math.sin(ang) * rad);
  train.rotation.set(rand(-0.3, 0.3), rand(0, Math.PI * 2), rand(-0.6, -0.3));
  // 電車を引っかけている根っこ
  const hook = new THREE.CatmullRomCurve3([
    new THREE.Vector3(train.position.x * 0.3, 0, train.position.z * 0.3),
    new THREE.Vector3(train.position.x * 0.8, train.position.y * 0.5, train.position.z * 0.8 + 10),
    train.position.clone().add(new THREE.Vector3(0, 6, 0)),
  ]);
  const g = new THREE.Group();
  g.add(train, new THREE.Mesh(new THREE.TubeGeometry(hook, 10, 5, 5), hillsMats.root));
  return g;
}

function makeHills(sprout, line = null) {
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
    if (line) g.add(makeTrain(line));
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

// 高層ビルのランドマーク（建物そのものは PLATEAU のデータで表示し、ここでは名前だけ付ける）
[
  ['東京ミッドタウン', 35.66545, 139.73116, 290],
  ['虎ノ門ヒルズ', 35.66680, 139.74960, 300],
  ['渋谷スクランブルスクエア', 35.65838, 139.70225, 270],
  ['ドコモタワー', 35.68450, 139.70150, 300],
  ['丸の内', 35.68180, 139.76420, 240],
  ['麻布台ヒルズ', 35.66055, 139.73995, 370],
  ['東京都庁', 35.68963, 139.69214, 290],
  ['汐留', 35.66340, 139.75990, 260],
  ['品川', 35.62850, 139.74000, 200],
].forEach(([name, lat, lon, y]) => addLandmark(name, geoV(lat, lon), y, 90));
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
// 遠景の街並み（PLATEAU データの範囲外＝半径6km より外は手続き生成）
// ---------------------------------------------------------------------
const PLATEAU_R = 6000;
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
{
  const mats = new THREE.MeshStandardMaterial({ color: 0xffffff, map: buildingTex, roughness: 0.75, metalness: 0.1 });
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
  place(110, PLATEAU_R + 60, 8000, 0.6, 0.8);
  place(170, 8000, 14000, 0.55, 0.6);
  const mesh = new THREE.InstancedMesh(geom, mats, items.length);
  items.forEach((b, i) => {
    _q.setFromEuler(_e.set(0, b.rot, 0));
    _m4.compose(new THREE.Vector3(b.x, 0, b.z), _q, _s.set(b.w, b.h, b.d));
    mesh.setMatrixAt(i, _m4);
    mesh.setColorAt(i, _c.setHex(b.col).offsetHSL(0, 0, (srand() - 0.5) * 0.06));
  });
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
  const treeMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x4d7a3a, roughness: 1, flatShading: true }), trees.length);
  trees.forEach((t, i) => {
    _m4.compose(new THREE.Vector3(t.x, t.s * 0.9, t.z), _q.identity(), _s.set(t.s, t.s * 1.1, t.s));
    treeMesh.setMatrixAt(i, _m4);
    treeMesh.setColorAt(i, _c.setHex(0x4d7a3a).offsetHSL((srand() - 0.5) * 0.05, 0, (srand() - 0.5) * 0.1));
  });
  treeMesh.castShadow = true;
  scene.add(treeMesh);
}

// ---------------------------------------------------------------------
// PLATEAU の建物（data/buildings.bin）
//   出典：国土交通省 Project PLATEAU 3D都市モデル（LOD1）を加工して作成
//   形式：Uint32 件数、各建物 [Uint16 高さ(0.1m), Uint8 種別, Uint8 頂点数, (Int16 東, Int16 南)×n]（0.25m単位）
// ---------------------------------------------------------------------
const SPOTS = [];
const Q = 0.25;                 // 頂点座標の単位（m）
const CHUNK = 800;              // メッシュを分割する格子の大きさ（m）
const SMALL_VIEW = IS_MOBILE ? 1300 : 2000; // 小さな建物を描く距離（m）
const smallChunks = [];
// 本家ヒルズ・東京タワーの足元は自前のモデルを使う
const PLATEAU_SKIP = [{ x: 0, z: 0, r: 85 }, { ...geo(35.65858, 139.74543), r: 60 }];

const plateauMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide });
plateauMat.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>\nvLocal = position * ${Q.toFixed(2)};`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 ln = normalize(cross(dFdx(vLocal), dFdy(vLocal)));
      if (abs(ln.y) < 0.5) {
        float fy = fract(vLocal.y / 3.6);
        float fh = fract((vLocal.x + vLocal.z) / 3.2);
        float win = step(0.38, fy) * step(0.18, fh) * step(fh, 0.82) * step(3.0, vLocal.y);
        float aa = clamp(1.0 - fwidth(vLocal.y / 3.6) * 2.5, 0.0, 1.0);
        diffuseColor.rgb *= mix(1.0, 0.6, win * aa);
      } else {
        diffuseColor.rgb *= 0.82;
      }`);
};

const PALETTES = [
  [0xc4c2bc, 0xb3b5ba, 0xd2cec4, 0xa9adb4],          // その他
  [0xe3ddd0, 0xd8cfbf, 0xeae6dc, 0xcfc4b2, 0xc9bfae], // 住宅
  [0x9fb3c9, 0x8ea2b8, 0xb5c3d2, 0xa8b0ba, 0xc2cad3], // 業務・商業
  [0xd9d2c3, 0xcfc8b8, 0xe0dbd0],                     // 文教・医療・官公庁
];

async function loadPlateau(onProgress) {
  const res = await fetch('data/buildings.bin');
  if (!res.ok) throw new Error('建物データを読み込めませんでした');
  // サーバーが gzip 圧縮して送ると content-length は圧縮後のサイズになるので、
  // 受け取った断片をためてから最後につなげる（content-length は進捗の目安にだけ使う）
  const DATA_BYTES = 2915852;
  let buf;
  if (res.body && res.body.getReader) {
    const reader = res.body.getReader();
    const parts = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); got += value.length;
      onProgress(Math.min(1, got / DATA_BYTES) * 0.6);
    }
    const bytes = new Uint8Array(got);
    let o = 0;
    for (const part of parts) { bytes.set(part, o); o += part.length; }
    buf = bytes.buffer;
  } else {
    buf = await res.arrayBuffer();
  }
  const dv = new DataView(buf);
  const n = dv.getUint32(0, true);

  // 1回目：建物ごとの情報と、格子ごとの頂点・インデックス数を数える
  const recs = [];
  const chunkInfo = new Map();
  const grid = new Map(); // 候補地探し用（100m 格子）
  let p = 4;
  for (let i = 0; i < n; i++) {
    const h = dv.getUint16(p, true) / 10, kind = dv.getUint8(p + 2), np = dv.getUint8(p + 3);
    const off = p + 4;
    p = off + np * 4;
    let cx = 0, cz = 0, area = 0;
    for (let j = 0; j < np; j++) {
      const x = dv.getInt16(off + j * 4, true) * Q, z = dv.getInt16(off + j * 4 + 2, true) * Q;
      const k = (j + 1) % np;
      const x2 = dv.getInt16(off + k * 4, true) * Q, z2 = dv.getInt16(off + k * 4 + 2, true) * Q;
      cx += x; cz += z; area += x * z2 - x2 * z;
    }
    cx /= np; cz /= np; area = Math.abs(area) / 2;
    if (PLATEAU_SKIP.some(s => Math.hypot(cx - s.x, cz - s.z) < s.r)) continue;
    let rad = 0;
    for (let j = 0; j < np; j++) rad = Math.max(rad, Math.hypot(dv.getInt16(off + j * 4, true) * Q - cx, dv.getInt16(off + j * 4 + 2, true) * Q - cz));
    const small = h < 13 && area < 250;
    const key = Math.floor(cx / CHUNK) + ',' + Math.floor(cz / CHUNK) + (small ? 's' : 'b');
    let ci = chunkInfo.get(key);
    if (!ci) { ci = { v: 0, t: 0, small, cx: (Math.floor(cx / CHUNK) + 0.5) * CHUNK, cz: (Math.floor(cz / CHUNK) + 0.5) * CHUNK, list: [] }; chunkInfo.set(key, ci); }
    ci.list.push(recs.length);
    ci.v += np * 2; ci.t += np * 2 + (np - 2);
    recs.push({ off, np, h, kind, cx, cz });
    const gk = Math.floor(cx / 100) + ',' + Math.floor(cz / 100);
    if (!grid.has(gk)) grid.set(gk, []);
    grid.get(gk).push(cx, cz, rad);
    if (i % 20000 === 0) { onProgress(0.6 + i / n * 0.1); await new Promise(r => setTimeout(r)); }
  }

  // 2回目：格子ごとに外壁と屋上のメッシュを作る（1メッシュ 65535 頂点まで）
  const contour = [];
  let done = 0;
  for (const ci of chunkInfo.values()) {
    let start = 0;
    while (start < ci.list.length) {
      let v = 0, t = 0, end = start;
      while (end < ci.list.length && v + recs[ci.list[end]].np * 2 <= 65535) {
        const r = recs[ci.list[end]]; v += r.np * 2; t += r.np * 2 + r.np - 2; end++;
      }
      const pos = new Int16Array(v * 3), col = new Uint8Array(v * 3), idx = new Uint16Array(t * 3);
      let vi = 0, ii = 0;
      for (let b = start; b < end; b++) {
        const r = recs[ci.list[b]];
        const pal = PALETTES[r.kind] || PALETTES[0];
        let cHex = pal[(r.off * 7 + r.np) % pal.length];
        if (r.h > 60) cHex = PALETTES[2][(r.off >> 3) % PALETTES[2].length];
        _c.setHex(cHex).offsetHSL(0, 0, (((r.off * 13) % 17) / 17 - 0.5) * 0.08);
        const cr = _c.r * 255, cg = _c.g * 255, cb = _c.b * 255;
        const base = vi;
        const top = Math.round(r.h / Q);
        contour.length = 0;
        for (let j = 0; j < r.np; j++) {
          const x = dv.getInt16(r.off + j * 4, true), z = dv.getInt16(r.off + j * 4 + 2, true);
          pos.set([x, 0, z], (base + j) * 3);
          pos.set([x, top, z], (base + r.np + j) * 3);
          contour.push(new THREE.Vector2(x, z));
        }
        for (let j = 0; j < r.np * 2; j++) col.set([cr, cg, cb], (base + j) * 3);
        for (let j = 0; j < r.np; j++) {
          const k = (j + 1) % r.np;
          idx.set([base + j, base + k, base + r.np + k, base + j, base + r.np + k, base + r.np + j], ii); ii += 6;
        }
        const tris = THREE.ShapeUtils.triangulateShape(contour, []);
        for (let q = 0; q < tris.length && q < r.np - 2; q++) {
          idx.set([base + r.np + tris[q][0], base + r.np + tris[q][1], base + r.np + tris[q][2]], ii); ii += 3;
        }
        vi += r.np * 2;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
      g.setIndex(new THREE.BufferAttribute(ii === idx.length ? idx : idx.slice(0, ii), 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, plateauMat);
      mesh.scale.setScalar(Q);
      mesh.castShadow = !ci.small; // 小さな建物は影を落とさない（軽くするため）
      mesh.receiveShadow = true;
      scene.add(mesh);
      if (ci.small) smallChunks.push({ mesh, x: ci.cx, z: ci.cz });
      start = end;
    }
    if (++done % 20 === 0) { onProgress(0.7 + done / chunkInfo.size * 0.28); await new Promise(r => setTimeout(r)); }
  }

  // ヒルズが生えてくる候補地：まわり 40m に建物がない陸地
  const clearance = (x, z) => {
    let best = Infinity;
    const gx = Math.floor(x / 100), gz = Math.floor(z / 100);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const arr = grid.get((gx + a) + ',' + (gz + b));
      if (!arr) continue;
      for (let k = 0; k < arr.length; k += 3) best = Math.min(best, Math.hypot(arr[k] - x, arr[k + 1] - z) - arr[k + 2]);
    }
    return best;
  };
  let tries = 0;
  while (SPOTS.length < 260 && tries++ < 60000) {
    const r = Math.sqrt(srand()) * (STAGE_R - 150);
    const a = srand() * Math.PI * 2;
    const sp = { x: Math.cos(a) * r, z: Math.sin(a) * r };
    if (isWater(sp)) continue;
    if (reserved.some(q => Math.hypot(sp.x - q.x, sp.z - q.z) < q.r + 120)) continue;
    if (SPOTS.some(q => Math.hypot(sp.x - q.x, sp.z - q.z) < 250)) continue;
    if (clearance(sp.x, sp.z) < 40) continue;
    SPOTS.push({ ...sp, used: false });
  }
  onProgress(1);
  return { buildings: recs.length, spots: SPOTS.length };
}

// PLATEAU の道路（LOD1 道路面）を描き込んだマスク画像を地面に重ねる
const ROAD_TEX_SIZE = 12288; // 画像がカバーする一辺の長さ（m）
function loadRoads() {
  return new Promise(resolve => {
    new THREE.TextureLoader().load('data/roads.png', tex => {
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_TEX_SIZE, ROAD_TEX_SIZE),
        new THREE.MeshStandardMaterial({ color: 0x8c8c90, roughness: 0.95, alphaMap: tex, alphaTest: 0.45 }),
      );
      road.rotation.x = -Math.PI / 2;
      road.position.y = 1.4;
      road.receiveShadow = true;
      scene.add(road);
      resolve(true);
    }, undefined, () => resolve(false));
  });
}

function updateSmallChunks() {
  for (const c of smallChunks) c.mesh.visible = Math.hypot(c.x - camera.position.x, c.z - camera.position.z) < SMALL_VIEW + cam.dist * 0.3;
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
// 土煙（もくもく広がる煙のスプライト）
const smokeTex = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, false);
const smokes = [];
for (let i = 0; i < 180; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xb59a78, transparent: true, depthWrite: false, opacity: 0 }));
  sp.visible = false;
  scene.add(sp);
  smokes.push({ sp, life: 0, max: 1, vel: new THREE.Vector3(), s0: 1, s1: 1 });
}
let smokeCursor = 0;
function smoke(x, y, z, vx, vy, vz, size, life, color = 0xb59a78) {
  const s = smokes[smokeCursor = (smokeCursor + 1) % smokes.length];
  s.sp.position.set(x, y, z);
  s.vel.set(vx, vy, vz);
  s.life = s.max = life;
  s.s0 = size * 0.4; s.s1 = size;
  s.sp.material.color.setHex(color);
  s.sp.visible = true;
}
function updateSmokes(dt) {
  for (const s of smokes) {
    if (s.life <= 0) continue;
    s.life -= dt;
    const k = 1 - s.life / s.max;
    s.vel.multiplyScalar(Math.exp(-dt * 1.6));
    s.vel.y += 6 * dt;
    s.sp.position.addScaledVector(s.vel, dt);
    s.sp.scale.setScalar(lerp(s.s0, s.s1, 1 - Math.pow(1 - k, 2)));
    s.sp.material.opacity = Math.min(1, k * 8) * Math.pow(1 - k, 0.8);
    if (s.life <= 0) s.sp.visible = false;
  }
}
// 横倒しになったヒルズの足元から地吹雪
function landingBlast(pos, dir) {
  for (let i = 0; i < 80; i++) {
    const along = rand(-20, HILLS_H);
    const x = pos.x + dir.x * along, z = pos.z + dir.z * along;
    const a = rand(0, Math.PI * 2), sp = rand(70, 200);
    smoke(x, rand(5, 40), z, Math.cos(a) * sp, rand(10, 60), Math.sin(a) * sp, rand(110, 220), rand(2.5, 4.2), Math.random() < 0.5 ? 0xc2a782 : 0xddd2bf);
  }
  for (let i = 0; i < 32; i++) { // 地面を這って広がる輪
    const a = i / 32 * Math.PI * 2;
    smoke(pos.x + dir.x * HILLS_H * 0.5, 15, pos.z + dir.z * HILLS_H * 0.5, Math.cos(a) * 340, 0, Math.sin(a) * 340, 160, 3.0, 0xe2d8c6);
  }
  dirt(pos.x + dir.x * HILLS_H * 0.5, 0, pos.z + dir.z * HILLS_H * 0.5, 160, 1.8);
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
// 効果音・BGM
//   スタート前の読み込み中に OfflineAudioContext で音声データを作っておき、
//   プレイ中はそれを再生するだけにする（スマホで音がびりつかないように）
// ---------------------------------------------------------------------
const SR = 44100;
const sounds = {};
let audio = null, master = null, sfxBus = null, bgmBus = null, bgmSrc = null;
let muted = false;
try { muted = localStorage.getItem('hills_muted') === '1'; } catch (_) { /* ignore */ }

function makeNoise(ctx) {
  const buf = ctx.createBuffer(1, SR * 2, SR);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function sNoise(ctx, nb, dest, t, dur, freq, gain, type = 'lowpass', freqEnd) {
  const src = ctx.createBufferSource(); src.buffer = nb;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
function sTone(ctx, dest, t, type, f0, f1, dur, vol, attack = 0.005) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function sPluck(ctx, dest, t, f, dur, vol) { // 三味線っぽい撥音
  const fl = ctx.createBiquadFilter(), g = ctx.createGain();
  fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 6, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  fl.connect(g); g.connect(dest);
  [['sawtooth', 1], ['square', 1.004]].forEach(([type, k]) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * k;
    o.connect(fl); o.start(t); o.stop(t + dur + 0.02);
  });
}
function sFlute(ctx, dest, t, f, dur, vol) { // 篠笛っぽい音
  const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = f * 2;
  lfo.frequency.value = 5.5; lg.gain.value = f * 0.012;
  lfo.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
  g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
}
async function renderSound(dur, fn) {
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, Math.ceil(SR * dur), SR);
  const out = ctx.createGain(); out.connect(ctx.destination);
  fn(ctx, makeNoise(ctx), out);
  return ctx.startRendering();
}
function normalize(buf, peak = 0.85) {
  const d = buf.getChannelData(0);
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m;
  return buf;
}

// BGM：オリジナル曲（ヨナ抜き風の祭り囃子）
const NOTE = { D3: 146.83, G3: 196.0, A3: 220.0, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, B4: 493.88, D5: 587.33, E5: 659.25 };
const MELODY = [ // 8分音符 × 8 × 8小節。'.' は前の音をのばす、'-' は休み
  'D5 . B4 A4 B4 . D5 .', 'E5 D5 B4 . A4 . - -', 'G4 A4 B4 . A4 G4 E4 .', 'D4 . E4 G4 A4 . - -',
  'D5 . E5 D5 B4 . A4 B4', 'D5 . B4 A4 G4 . - -', 'E4 G4 A4 B4 D5 . B4 A4', 'G4 . A4 . D4 . - -',
].join(' ').split(' ');
const BASS = ['D3', 'D3', 'G3', 'D3', 'D3', 'G3', 'A3', 'D3'];
const TEMPO = 138;

async function prepareSounds(onProgress) {
  const jobs = {
    pop: [0.35, (c, nb, d) => { sNoise(c, nb, d, 0, 0.25, 1200, 0.3); sTone(c, d, 0, 'square', 180, 1100, 0.25, 0.2); }],
    pull: [0.12, (c, nb, d) => { sTone(c, d, 0, 'sawtooth', 85, 85, 0.09, 0.08); }],
    sprout: [0.2, (c, nb, d) => { sTone(c, d, 0, 'sine', 320, 520, 0.15, 0.12); }],
    root: [0.6, (c, nb, d) => { sTone(c, d, 0, 'triangle', 140, 40, 0.5, 0.35); }],
    whistle: [3.1, (c, nb, d) => { sTone(c, d, 0, 'sine', 1400, 260, 3.0, 0.08, 0.9); }],
    thud: [2.8, (c, nb, d) => { // 着地の地響き：ドン＋ゴゴゴ＋砂ぼこりのザーッ
      sTone(c, d, 0, 'sine', 75, 28, 1.1, 0.9);
      sNoise(c, nb, d, 0, 0.35, 1800, 0.5);
      sNoise(c, nb, d, 0.05, 2.4, 900, 0.35, 'lowpass', 150);
      sNoise(c, nb, d, 0.15, 1.8, 3000, 0.08, 'highpass');
    }],
  };
  const names = Object.keys(jobs);
  for (let i = 0; i < names.length; i++) {
    const [dur, fn] = jobs[names[i]];
    sounds[names[i]] = normalize(await renderSound(dur, fn), names[i] === 'pull' ? 0.3 : 0.8);
    onProgress((i + 1) / (names.length + 3));
  }
  // BGM 1ループ分（はみ出した余韻は先頭に重ねて、つなぎ目なくループさせる）
  const e = 60 / TEMPO / 2, loop = e * 64;
  const raw = await renderSound(loop + 1, (c, nb, d) => {
    for (let i = 0; i < 64; i++) {
      const t = i * e, bar = Math.floor(i / 8), b = i % 8, n = MELODY[i];
      if (n !== '.' && n !== '-') {
        let len = 1;
        while (MELODY[(i + len) % 64] === '.') len++;
        sFlute(c, d, t, NOTE[n], e * len * 0.95, 0.09);
        sPluck(c, d, t, NOTE[n], 0.22, 0.05);
      }
      if (b % 2 === 0) sPluck(c, d, t, NOTE[BASS[bar]] / 2, 0.3, 0.09);
      if (b === 0 || b === 4) { sTone(c, d, t, 'sine', 130, 55, 0.4, 0.5); sNoise(c, nb, d, t, 0.06, 900, 0.2); }
      if (bar % 2 === 1 && b === 6) [0, e / 2].forEach(dt => sTone(c, d, t + dt, 'sine', 130, 55, 0.4, 0.35));
      if (b % 2 === 1) [1870, 2630].forEach(f => sTone(c, d, t, 'square', f, f, 0.09, 0.02, 0.002));
    }
  });
  onProgress((names.length + 2) / (names.length + 3));
  const len = Math.round(loop * SR);
  const bgmBuf = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: SR });
  const src = raw.getChannelData(0), dst = bgmBuf.getChannelData(0);
  for (let i = 0; i < len; i++) dst[i] = src[i] + (i + len < src.length ? src[i + len] : 0);
  sounds.bgm = normalize(bgmBuf, 0.8);
  onProgress(1);
}

function ensureAudio() {
  if (audio) { if (audio.state === 'suspended') audio.resume(); return audio; }
  audio = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
  const comp = audio.createDynamicsCompressor(); // 音が重なっても割れないように
  comp.threshold.value = -12; comp.ratio.value = 6;
  master = audio.createGain(); master.gain.value = muted ? 0 : 1;
  master.connect(comp); comp.connect(audio.destination);
  sfxBus = audio.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
  bgmBus = audio.createGain(); bgmBus.gain.value = 0.3; bgmBus.connect(master);
  return audio;
}
function setMuted(m) {
  muted = m;
  try { localStorage.setItem('hills_muted', m ? '1' : '0'); } catch (_) { /* ignore */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, audio.currentTime, 0.05);
  document.getElementById('mute').textContent = m ? '🔇' : '🔊';
}
function playSound(name, volume = 1, rate = 1) {
  if (!audio || !sounds[name]) return;
  const src = audio.createBufferSource();
  src.buffer = sounds[name];
  src.playbackRate.value = rate;
  const g = audio.createGain(); g.gain.value = volume;
  src.connect(g); g.connect(sfxBus);
  src.start();
}
function sfx(type, opt = {}) {
  try {
    ensureAudio();
    if (type === 'thud') playSound('thud', opt.volume ?? 1);
    else if (type === 'whistle') playSound('whistle', 1, clamp(3 / (opt.dur || 3), 0.6, 2));
    else if (type === 'pull') playSound('pull', 1, rand(0.85, 1.15));
    else playSound(type);
  } catch (_) { /* 音が出なくてもゲームは続ける */ }
}
function startBgm() {
  try {
    ensureAudio();
    if (bgmSrc || !sounds.bgm) return;
    bgmSrc = audio.createBufferSource();
    bgmSrc.buffer = sounds.bgm;
    bgmSrc.loop = true;
    bgmSrc.connect(bgmBus);
    bgmBus.gain.cancelScheduledValues(audio.currentTime);
    bgmBus.gain.setValueAtTime(0.3, audio.currentTime);
    bgmSrc.start(audio.currentTime + 0.05);
  } catch (_) { /* ignore */ }
}
function stopBgm() {
  if (!bgmSrc) return;
  const src = bgmSrc;
  bgmSrc = null;
  bgmBus.gain.setTargetAtTime(0.0001, audio.currentTime, 0.3);
  src.stop(audio.currentTime + 1.5);
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
const showBest = () => { ui.best.textContent = best ? t('best', { n: best.toLocaleString() }) : ''; };

const sprouts = [];
const TRAIN_BONUS = 100;    // 地下鉄ごと引っこ抜いたときのボーナス
const GRAV = 300;          // 飛んでいくヒルズの重力（ゲーム用に強め）
const FLY_T = 1.3;         // 引っこ抜いてから着地するまでの秒数
const LIE_Y = 58;          // 横倒しになったときの基点の高さ
const UP = new THREE.Vector3(0, 1, 0);
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
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
    time: 0, score: 0, rooted: 0, pulled: 0, trains: 0, continues: 0, combo: 0, comboT: 0, nextSpawn: 0.5,
    best: { name: '', pts: 0 }, counts: { gold: 0, good: 0, ok: 0, old: 0 },
  };
  state = 'play';
  paused = false;
  closeOffer();
  cam.target.set(0, 0, 0);
  flyTo(0, 0, 1500);
  ui.overlay.hidden = true;
  showPanel(null);
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
  const line = subwayAt(spot);
  const group = makeHills(true, line);
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
    spot, group, mound, ring, line,
    state: 'warn', t: 0, grow: 0,
    growTime: (20 - d * 9) * rand(0.85, 1.2),
    ripeTime: 5,
    loosen: 0, grabbed: false, lift: 0,
    vel: new THREE.Vector3(), spin: new THREE.Vector3(),
  });
}

function requiredPull(s) {
  // 若いほど短いスワイプで抜ける。いちばん育ったものでも画面の高さの4割強
  // 早く見つけるほど楽：若いほど短いスワイプで抜ける。根付くと何回もスワイプが必要
  if (s.state === 'rooted') return window.innerHeight * 1.6;
  return window.innerHeight * (0.07 + s.grow * 0.26 + (s.state === 'ripe' ? 0.1 : 0));
}

function grade(s) {
  if (s.state === 'rooted') return { pts: 30, name: t('gRooted'), key: 'old', color: '#ffb36b' };
  if (s.state === 'ripe') return { pts: 20, name: t('gRipe'), key: 'old', color: '#ff8c5a' };
  if (s.grow < 0.12) return { pts: 500, name: t('gGold'), key: 'gold', color: '#ffe14d' };
  if (s.grow < 0.35) return { pts: 250, name: t('gGood'), key: 'good', color: '#7dff9a' };
  if (s.grow < 0.7) return { pts: 100, name: t('gOk'), key: 'ok', color: '#ffffff' };
  return { pts: 40, name: t('gOld'), key: 'old', color: '#c9c9c9' };
}

function yank(s, free = false) {
  // free: リワード広告のコンティニューで根付いたヒルズを抜くとき（点数は入らない）
  if (free) { launch(s); return; }
  const g = grade(s);
  game.combo = game.comboT > 0 ? game.combo + 1 : 1;
  game.comboT = 3;
  const mult = 1 + Math.min(game.combo - 1, 10) * 0.1;
  const pts = Math.round(g.pts * mult);
  const trainBonus = s.line ? TRAIN_BONUS : 0;
  game.score += pts + trainBonus;
  if (s.line) game.trains++;
  game.pulled++;
  game.counts[g.key]++;
  if (pts > game.best.pts) game.best = { name: g.name, pts };

  if (s.state === 'rooted') game.rooted = Math.max(0, game.rooted - 1);
  launch(s);
  const sp = project(s.spot.x, s.group.position.y + HILLS_H, s.spot.z);
  popup(`${g.name}<small>+${pts}${game.combo > 1 ? t('comboSuffix', { n: game.combo }) : ''}</small>`, sp.x, sp.y, g.color, g.key === 'gold' ? 34 : 28);
  if (s.line) setTimeout(() => popup(`${t(s.line === 'oedo' ? 'trainOedo' : 'trainHibiya')}<small>+${TRAIN_BONUS}</small>`, sp.x, sp.y + 70, s.line === 'oedo' ? '#ff5aa0' : '#e6e6e0', 24), 350);
}

// 引っこ抜いたヒルズを飛ばす（放物線で飛んで、横倒しで着地する）
function launch(s) {
  if (!everPulled) { everPulled = true; try { localStorage.setItem('hills_pulled', '1'); } catch (_) { /* ignore */ } }
  s.state = 'fly';
  s.t = 0;
  s.grabbed = false;
  // 放物線で飛んで、横倒しで着地する
  const yaw = rand(0, Math.PI * 2);
  const dir = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  // 地面の下に埋まっていた分は一気に引き上げ、どのヒルズも FLY_T 秒で着地させる
  const y0 = Math.max(s.group.position.y, -40);
  s.group.position.y = y0;
  const vy = (GRAV * FLY_T * FLY_T / 2 - y0) / FLY_T;
  const hs = rand(50, 80);
  s.vel.set(dir.x * hs, vy, dir.z * hs);
  s.flyT = FLY_T;
  s.y0 = y0;
  s.start = s.group.position.clone();
  s.landDir = dir;
  s.q0 = s.group.quaternion.clone();
  s.q1 = new THREE.Quaternion().setFromUnitVectors(UP, dir).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rand(0, Math.PI * 2)));
  s.tumbleAxis = new THREE.Vector3(-dir.z, 0, dir.x);
  sfx('whistle', { dur: s.flyT });
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
    } else if (s.state === 'grow' || s.state === 'ripe' || s.state === 'rooted') {
      if (s.state === 'rooted') {
        // 根付いたヒルズ：抜けないことはないが、何回もスワイプが必要
      } else if (s.state === 'grow') {
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
          if (sp.front) popup(t('tookRoot'), sp.x, sp.y, '#ff6b6b', 24);
          if (game.rooted >= ROOT_LIMIT) endGame(t('reasonLost'), true);
        }
      }
      // スワイプの合間（1.5秒以内）は上がった分を保つ
      if (!s.grabbed && performance.now() - (s.lastPull || 0) > 1500) s.loosen = Math.max(0, s.loosen - requiredPull(s) * 0.12 * dt);
      const looseK = Math.min(1, s.loosen / requiredPull(s));
      // 根付いたヒルズはスワイプのたびに大きく持ち上がり、根っこが見えてくる
      s.lift = lerp(s.lift, looseK * (s.state === 'rooted' ? 150 : 40), Math.min(1, dt * 10));
      const wob = s.state === 'ripe' ? Math.sin(s.t * 18) * 0.012 : 0;
      const shake = s.grabbed ? 0.02 * looseK : 0;
      s.group.position.y = -HILLS_H * (1 - s.grow) + s.lift;
      s.group.rotation.x = wob + rand(-shake, shake);
      s.group.rotation.z = rand(-shake, shake);
    } else if (s.state === 'fly') {
      const t = Math.min(s.t, s.flyT), k = t / s.flyT;
      s.group.position.set(
        s.start.x + s.vel.x * t,
        s.y0 + s.vel.y * t - GRAV * t * t / 2 + LIE_Y * k,
        s.start.z + s.vel.z * t,
      );
      // 1回転しながら横倒しの姿勢へ
      _qa.slerpQuaternions(s.q0, s.q1, k);
      _qb.setFromAxisAngle(s.tumbleAxis, Math.PI * 2 * (1 - Math.pow(1 - k, 1.5)));
      s.group.quaternion.copy(_qb.multiply(_qa));
      if (s.t >= s.flyT) {
        s.state = 'landed';
        s.t = 0;
        s.group.quaternion.copy(s.q1);
        s.group.position.y = LIE_Y;
        landingBlast(s.group.position, s.landDir);
        const d = camera.position.distanceTo(s.group.position);
        const near = clamp(1 - d / 5000, 0.15, 1);
        sfx('thud', { volume: near });
        cam.shake = Math.max(cam.shake, 22 * near);
        if (navigator.vibrate) navigator.vibrate([60, 30, 120]);
      }
    } else if (s.state === 'landed') {
      // 着地の反動で少し跳ねてから落ち着き、やがて地面に沈む
      const bounce = Math.exp(-s.t * 5) * Math.abs(Math.sin(s.t * 14)) * 10;
      s.group.position.y = LIE_Y + bounce - Math.max(0, s.t - 6) * 30;
      if (s.t < 1.5 && Math.random() < dt * 20) {
        const along = rand(0, HILLS_H);
        smoke(s.group.position.x + s.landDir.x * along, 10, s.group.position.z + s.landDir.z * along, rand(-30, 30), rand(5, 20), rand(-30, 30), rand(50, 90), 2.5);
      }
      if (s.t > 9) { scene.remove(s.group); sprouts.splice(i, 1); }
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
  if (game.time >= GAME_TIME) endGame(t('reasonTime'));

  ui.score.textContent = game.score.toLocaleString();
  ui.time.textContent = Math.ceil(Math.max(0, GAME_TIME - game.time));
  ui.rooted.textContent = `${game.rooted}/${ROOT_LIMIT}`;
  ui.rooted.parentElement.style.background = game.rooted >= ROOT_LIMIT - 1 ? 'rgba(200,40,40,.85)' : '';
  if (game.combo > 1) { ui.combo.hidden = false; ui.combo.textContent = t('comboBanner', { n: game.combo }); }
  else ui.combo.hidden = true;
}

function rankOf(score) {
  if (score >= 9000) return t('rankS');
  if (score >= 6000) return t('rankA');
  if (score >= 3500) return t('rankB');
  if (score >= 1500) return t('rankC');
  return t('rankD');
}

function endGame(reason, occupied = false) {
  if (state !== 'play') return;
  if (pull.sprout) { pull.sprout.grabbed = false; pull.sprout = null; }
  // 港区陥落（一番悔しい失敗）のときは、広告を見て続けられるか聞く（アプリのみ・1 ゲーム 1 回）
  if (occupied && Ads.canReward && game.continues < CONTINUE_MAX) {
    state = 'offer';
    offer.pending = OFFER_DELAY;
    offer.reason = reason;
    return;
  }
  finishGame(reason);
}

function finishGame(reason) {
  state = 'over';
  closeOffer();
  stopBgm();
  const isBest = game.score > best;
  if (isBest) { best = game.score; try { localStorage.setItem('hills_best3d', String(best)); } catch (_) { /* ignore */ } }
  showBest();
  document.getElementById('result-reason').textContent = reason;
  document.getElementById('result-score').textContent = t('points', { n: game.score.toLocaleString() });
  document.getElementById('result-rank').textContent = rankOf(game.score);
  const bestEl = document.getElementById('result-best');
  bestEl.hidden = !isBest;
  bestEl.textContent = t('newBest');
  // シェア用の画像：結果が出た瞬間のゲーム画面に点数を書き込む
  shareData = { score: game.score, rank: rankOf(game.score), pulled: game.pulled, continues: game.continues, reason };
  shareImage = null;
  try {
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const w = 1080, h = Math.round(1080 * src.height / src.width);
    const c = document.createElement('canvas');
    c.width = w; c.height = Math.min(h, 1920);
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0, src.width, src.height * c.height / h, 0, 0, w, c.height);
    g.fillStyle = 'rgba(20,22,31,.78)';
    g.fillRect(0, c.height - 330, w, 330);
    g.textAlign = 'center';
    g.fillStyle = '#ffcf33'; g.font = '900 54px sans-serif';
    g.fillText(t('pageTitle'), w / 2, c.height - 250);
    g.fillStyle = '#fff'; g.font = '900 96px sans-serif';
    g.fillText(t('points', { n: game.score.toLocaleString() }), w / 2, c.height - 140);
    g.font = '700 40px sans-serif';
    g.fillText(t('shareImgSub', { rank: rankOf(game.score), n: game.pulled }), w / 2, c.height - 60);
    c.toBlob(b => { if (b) shareImage = new File([b], 'hills-result.png', { type: 'image/png' }); }, 'image/png');
  } catch (_) { /* 画像が作れなくても文字だけでシェアする */ }
  const c = game.counts;
  document.getElementById('result-stats').innerHTML = `
    <dt>${t('stPulled')}</dt><dd>${t('count', { n: game.pulled })}</dd>
    <dt>${t('stGold')}</dt><dd>${t('count', { n: c.gold })}</dd>
    <dt>${t('stGood')}</dt><dd>${t('count', { n: c.good })}</dd>
    <dt>${t('stOkOld')}</dt><dd>${t('count', { n: c.ok + c.old })}</dd>
    <dt>${t('stTrains')}</dt><dd>${t('count', { n: game.trains })}</dd>
    <dt>${t('stRooted')}</dt><dd>${t('count', { n: game.rooted })}</dd>${game.continues ? `
    <dt>${t('stContinues')}</dt><dd>${t('times', { n: game.continues })}</dd>` : ''}`;
  setTimeout(() => {
    if (state !== 'over') return;
    ui.overlay.hidden = false;
    showPanel(ui.resultPanel);
    ui.hud.hidden = true;
    ui.combo.hidden = true;
  }, 900);
}

// ---------------------------------------------------------------------
// 画面の切り替え・ポーズ・全画面広告・戻るボタン（アプリ用の処理。Web 版でも同じ画面で動く）
// ---------------------------------------------------------------------
const panels = ['title-panel', 'howto-panel', 'result-panel', 'pause-panel'].map(id => document.getElementById(id));
function showPanel(el) { panels.forEach(p => { p.hidden = p !== el; }); }
let paused = false;

function pauseGame() {
  if (state !== 'play' || paused) return;
  paused = true;
  if (pull.sprout) { pull.sprout.grabbed = false; pull.sprout = null; }
  pointers.clear(); multi = null;
  ui.overlay.hidden = false;
  showPanel(document.getElementById('pause-panel'));
}
function resumeGame() {
  paused = false;
  ui.overlay.hidden = true;
  showPanel(null);
  last = performance.now();
}

// 全画面広告を出してから次へ進む（アプリのみ。Web 版ではそのまま進む）
let adBusy = false;
async function withInterstitial(next, intoPlay = false) {
  if (adBusy) return;
  if (Ads.available) {
    adBusy = true;
    // プレイに入るときは先にパネルを閉じて、広告のあとにバナーが一瞬出ないようにする
    if (intoPlay) { ui.overlay.hidden = true; Ads.setBanner(false); }
    await Ads.showInterstitial(3000);
    adBusy = false;
  }
  next();
}

function goTitle() {
  stopBgm();
  closeOffer();
  sprouts.forEach(sp => { scene.remove(sp.group, sp.mound, sp.ring); sp.spot.used = false; });
  sprouts.length = 0;
  state = 'title';
  paused = false;
  ui.overlay.hidden = false;
  ui.hud.hidden = true;
  ui.combo.hidden = true;
  ui.radar.hidden = true;
  showPanel(ui.titlePanel);
  cam.fly = null; cam.target.set(0, 0, 0); cam.dist = 1500;
}

// ---------------------------------------------------------------------
// リワード広告のチート：港区陥落のとき、広告を見ると根付いたヒルズを全部引っこ抜いて続けられる
//   陥落の様子を見届けられるよう少し待ってから案内を出し、数秒で自動的に結果画面へ進む
// ---------------------------------------------------------------------
const CONTINUE_MAX = 1;
const OFFER_DELAY = 2.5;
const OFFER_WAIT = 6;
const offer = { pending: 0, active: false, busy: false, t: 0, reason: '' };
const offerEl = document.getElementById('offer');
function showOffer() {
  Object.assign(offer, { active: true, busy: false, t: OFFER_WAIT, pending: 0 });
  document.getElementById('offer-watch').disabled = false;
  document.getElementById('offer-watch').innerHTML = t('offerWatch');
  document.getElementById('offer-note').innerHTML = t('offerNote');
  offerEl.hidden = false;
}
function closeOffer() {
  offer.active = false;
  offer.pending = 0;
  offerEl.hidden = true;
}
function updateOffer(dt) {
  if (state !== 'offer' || paused) return;
  if (offer.pending > 0) {
    offer.pending -= dt;
    if (offer.pending <= 0) showOffer();
    return;
  }
  if (!offer.active || offer.busy) return;
  offer.t -= dt;
  document.getElementById('offer-skip').innerHTML = t('offerSkip', { s: Math.max(0, Math.ceil(offer.t)) });
  if (offer.t <= 0) finishGame(offer.reason);
}
document.getElementById('offer-skip').addEventListener('click', () => { if (state === 'offer') finishGame(offer.reason); });
document.getElementById('offer-watch').addEventListener('click', async () => {
  if (!offer.active || offer.busy) return;
  offer.busy = true;
  document.getElementById('offer-watch').disabled = true;
  document.getElementById('offer-watch').innerHTML = t('offerLoading');
  const result = await Ads.showRewarded();
  if (state !== 'offer') return;
  if (result === 'unavailable') {
    document.getElementById('offer-note').innerHTML = t('offerFail');
    setTimeout(() => { if (state === 'offer') finishGame(offer.reason); }, 2000);
    return;
  }
  if (result !== 'rewarded') { finishGame(offer.reason); return; }
  // 根付いたヒルズを全部引っこ抜いて、ゲームを続ける
  closeOffer();
  game.continues++;
  sprouts.filter(sp => sp.state === 'rooted').forEach(sp => yank(sp, true));
  game.rooted = 0;
  state = 'play';
  last = performance.now();
  popup(t('continued'), window.innerWidth / 2, window.innerHeight * 0.4, '#7dff9a', 30);
});

let plateauInfo = null;
const startBtn = document.getElementById('start');
startBtn.disabled = true;
const loadProg = { city: 0, sound: 0 };
let loaded = false, loadFailed = false;
const showStart = () => {
  if (loadFailed) startBtn.innerHTML = t('loadFailed');
  else if (loaded) startBtn.innerHTML = t('start');
  else startBtn.innerHTML = t('loading', { p: Math.round((loadProg.city * 0.85 + loadProg.sound * 0.15) * 100) });
};
const showProg = () => showStart();
Promise.all([
  loadPlateau(k => { loadProg.city = k; showProg(); }),
  loadRoads(),
  prepareSounds(k => { loadProg.sound = k; showProg(); }).catch(err => console.warn('音の準備に失敗', err)),
]).then(([info]) => info)
  .then(info => {
    startBtn.disabled = false;
    loaded = true;
    showStart();
    plateauInfo = info;
  })
  .catch(err => {
    console.error(err);
    startBtn.disabled = false;
    loadFailed = true;
    showStart();
    startBtn.dataset.failed = '1';
  });
const howtoPanel = document.getElementById('howto-panel');
document.getElementById('howto-open').addEventListener('click', () => { showPanel(howtoPanel); howtoPanel.scrollTop = 0; });
// 遊び方 → トップ（全画面広告のあと）
document.getElementById('howto-close').addEventListener('click', () => withInterstitial(() => showPanel(ui.titlePanel)));
// プレイを始める・もう一回（全画面広告のあと）
const play = () => { ensureAudio(); withInterstitial(() => { sfx('sprout'); startBgm(); newGame(); }, true); };
startBtn.addEventListener('click', () => {
  if (startBtn.dataset.failed) { location.reload(); return; }
  play();
});
document.getElementById('retry').addEventListener('click', play);
document.getElementById('to-title').addEventListener('click', () => withInterstitial(goTitle));
document.getElementById('pause').addEventListener('click', pauseGame);
document.getElementById('pause-resume').addEventListener('click', () => withInterstitial(resumeGame, true));
document.getElementById('pause-title').addEventListener('click', () => withInterstitial(goTitle));

// Android の戻るボタン：プレイ中はポーズ（ポーズ中なら再開）、遊び方ならトップへ、トップ・結果画面ではアプリを閉じる
if (plugin('App')) {
  plugin('App').addListener('backButton', () => {
    if (adBusy) return;
    if (state === 'play' && paused) withInterstitial(resumeGame, true);
    else if (state === 'play') pauseGame();
    else if (!howtoPanel.hidden) withInterstitial(() => showPanel(ui.titlePanel));
    else if (state === 'title' || state === 'over') plugin('App').exitApp();
  });
}

// 裏に回ったら一時停止して音を止める（広告の表示中は広告側が音を止めている）
window.Sound = {
  suspend() { if (audio && audio.state === 'running') audio.suspend(); },
  resume() { if (audio && audio.state === 'suspended') audio.resume(); },
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGame();
    window.Sound.suspend();
  } else if (!Ads.showing) {
    window.Sound.resume();
  }
});

// タイトル画面の下に、バージョン（アプリ版）・プライバシーポリシー・広告の設定（EU など）を出す
if (window.APP_VERSION && window.APP_VERSION !== 'dev') document.getElementById('build-info').textContent = window.APP_VERSION;
Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) document.getElementById('ad-privacy').hidden = false; });
document.getElementById('ad-privacy-link').addEventListener('click', e => { e.preventDefault(); Ads.showPrivacyOptions(); });

// 結果のシェア：使える端末では OS の共有メニュー（画像付き）、ほかは X の投稿画面
const SHARE_URL = 'https://techgym.jp/column/claude-code-game-hills/';
let shareData = null, shareImage = null;
document.getElementById('share').addEventListener('click', async () => {
  if (!shareData) return;
  const url = SHARE_URL;
  const text = t('shareText', { score: shareData.score.toLocaleString(), rank: shareData.rank, n: shareData.pulled })
    + (shareData.continues ? t('shareContinues', { n: shareData.continues }) : '');
  // アプリでは Android の共有メニューを出す
  const nativeShare = plugin('Share');
  if (nativeShare) {
    try { await nativeShare.share({ title: t('pageTitle'), text, url, dialogTitle: t('share') }); } catch (_) { /* キャンセル */ }
    return;
  }
  if (navigator.share) {
    const data = { title: t('pageTitle'), text, url };
    try {
      if (shareImage && navigator.canShare && navigator.canShare({ files: [shareImage] })) await navigator.share({ ...data, files: [shareImage] });
      else await navigator.share(data);
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // ユーザーが閉じただけ
    }
  }
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
});

// ---------------------------------------------------------------------
// 入力：ヒルズ上を上スワイプ＝引っこ抜く／それ以外のドラッグ＝移動
//       ピンチ＝ズーム＋回転、ホイール＝ズーム、右ドラッグ／Q・E＝回転
// ---------------------------------------------------------------------
const pointers = new Map();
const pull = { sprout: null, id: null };
let multi = null;
const el = renderer.domElement;

function pickSprout(x, y, extra = 0) {
  let bestS = null, bestD = Infinity;
  sprouts.forEach(s => {
    if (s.state !== 'grow' && s.state !== 'ripe' && s.state !== 'rooted') return;
    const top = Math.max(15, s.group.position.y + HILLS_H);
    const a = project(s.spot.x, 0, s.spot.z);
    const b = project(s.spot.x, top, s.spot.z);
    if (!a.front) return;
    const side = project(s.spot.x + 70, 0, s.spot.z);
    const halfW = Math.max(70, Math.hypot(side.x - a.x, side.y - a.y) + 40) + extra;
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
    if (d < halfW && d < bestD) { bestD = d; bestS = s; }
  });
  return bestS;
}

// 指を置いてから最初に動いた方向で操作を決める
//   上 → 引っこ抜き（指の下のヒルズ、なければ近くのヒルズ）
//   左右 → 回転（上下の動きでは回転しない）
//   2本指 → ピンチで拡大・縮小、そろえて下へスワイプで前進（上で後退）
//   遠くへは矢印やレーダーのタップで移動
//   下 → 何もしない
const DECIDE_PX = 10;
function pickNearSprout(x, y) {
  return pickSprout(x, y) || pickSprout(x, y, 170);
}
function grabSprout(s, id) {
  pull.sprout = s; pull.id = id; s.grabbed = true; cam.fly = null;
}

el.addEventListener('pointerdown', e => {
  el.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, shift: e.shiftKey, mode: 'pending' });
  if (pointers.size === 2) {
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
    // 2本指をそろえて下へ動かすと前進、上へ動かすと後退（向いている方向に進む）
    const step = (my - multi.my) / window.innerHeight * cam.dist * 1.8;
    cam.target.x += Math.sin(cam.heading) * step;
    cam.target.z += -Math.cos(cam.heading) * step;
    multi = { d, a, mx, my };
    cam.fly = null;
    return;
  }

  if (p.mode === 'pending') {
    const dx = e.clientX - p.sx, dy = e.clientY - p.sy;
    if (Math.hypot(dx, dy) < DECIDE_PX) return;
    if (Math.abs(dx) >= Math.abs(dy)) p.mode = 'rotate';
    else if (dy < 0 && state === 'play') {
      const s = pickNearSprout(p.sx, p.sy);
      if (s) { grabSprout(s, e.pointerId); p.mode = 'pull'; s.loosen += -dy; }
      else p.mode = 'none';
    } else p.mode = 'none';
  }

  if (p.mode === 'pull') {
    const s = pull.sprout;
    if (!s || pull.id !== e.pointerId) return;
    const dy = py - e.clientY;
    if (dy > 0) {
      s.loosen += dy;
      s.lastPull = performance.now();
      if (Math.random() < 0.3) sfx('pull');
      if (Math.random() < 0.4) dirt(s.spot.x, 0, s.spot.z, 2, 0.6);
    }
    if (s.loosen >= requiredPull(s)) { yank(s); pull.sprout = null; }
  } else if (p.mode === 'rotate') {
    // 画面の幅いっぱいのスワイプで半回転。指の動きに街がついてくる向き
    cam.heading -= (e.clientX - px) / window.innerWidth * Math.PI;
  }
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
  if (pull.id === e.pointerId && pull.sprout) {
    const s = pull.sprout;
    // 根付いたヒルズ：1回のスワイプごとに「グラッ」と手応えを返す
    if (s.state === 'rooted' && s.loosen > 0 && state === 'play') {
      cam.shake = Math.max(cam.shake, 7);
      dirt(s.spot.x, 0, s.spot.z, 40, 1.1);
      for (let i = 0; i < 6; i++) { const a = rand(0, Math.PI * 2); smoke(s.spot.x + Math.cos(a) * 60, 10, s.spot.z + Math.sin(a) * 60, Math.cos(a) * 60, 15, Math.sin(a) * 60, 70, 1.6); }
      sfx('root');
      if (navigator.vibrate) navigator.vibrate(30);
    }
    s.grabbed = false; pull.sprout = null;
  }
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
document.getElementById('mute').addEventListener('click', () => { ensureAudio(); setMuted(!muted); });
setMuted(muted);

// ---------------------------------------------------------------------
// 画面外のヒルズを示す矢印・ランドマーク名・レーダー
// ---------------------------------------------------------------------
const arrowEls = new Map();
// 掴んでいるヒルズの抜け具合ゲージと、最初の操作ガイド
const pullGauge = document.getElementById('pull-gauge');
const pullHint = document.getElementById('pull-hint');
let everPulled = false;
try { everPulled = localStorage.getItem('hills_pulled') === '1'; } catch (_) { /* ignore */ }
function updatePullUi() {
  const s = pull.sprout;
  if (s && state === 'play') {
    const k = Math.min(1, s.loosen / requiredPull(s));
    const p = project(s.spot.x, Math.max(20, s.group.position.y + HILLS_H), s.spot.z);
    pullGauge.hidden = false;
    pullGauge.style.left = clamp(p.x, 60, window.innerWidth - 60) + 'px';
    pullGauge.style.top = clamp(p.y - 40, 90, window.innerHeight - 40) + 'px';
    pullGauge.firstElementChild.style.width = (k * 100).toFixed(0) + '%';
  } else {
    pullGauge.hidden = true;
  }
  let target = null;
  if (!everPulled && state === 'play' && !pull.sprout) {
    let bestD = Infinity;
    sprouts.forEach(sp => {
      if (sp.state !== 'grow' && sp.state !== 'ripe') return;
      const p = project(sp.spot.x, Math.max(20, sp.group.position.y + HILLS_H * 0.5), sp.spot.z);
      if (!p.front || p.x < 0 || p.x > window.innerWidth || p.y < 80 || p.y > window.innerHeight) return;
      const d = Math.hypot(p.x - window.innerWidth / 2, p.y - window.innerHeight / 2);
      if (d < bestD) { bestD = d; target = p; }
    });
  }
  pullHint.hidden = !target;
  if (target) { pullHint.style.left = target.x + 'px'; pullHint.style.top = target.y + 'px'; }
}

function updateArrows() {
  const live = new Set();
  const placed = [];
  const W = window.innerWidth, H = window.innerHeight;
  if (state === 'play') {
    sprouts.forEach(s => {
      if (s.state !== 'grow' && s.state !== 'ripe' && s.state !== 'warn' && s.state !== 'rooted') return;
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
        const rr = ui.radar.getBoundingClientRect();
        if (ax < rr.right + 30 && ay > rr.top - 30) ay = rr.top - 34;
      }
      placed.push({ a, x: ax, y: ay });
      a.querySelector('i').style.transform = `rotate(${ang}rad)`;
      const dist = Math.hypot(dx, dz);
      a.querySelector('span').textContent = dist >= 1000 ? (dist / 1000).toFixed(1) + 'km' : Math.round(dist) + 'm';
      a.classList.toggle('ripe', s.state === 'ripe');
      a.classList.toggle('young', s.state !== 'ripe' && s.state !== 'rooted' && s.grow < 0.35);
      a.classList.toggle('rooted', s.state === 'rooted');
    });
  }
  // 近い矢印どうしが重ならないように、画面の端に沿ってずらす。
  // レーダー（左下）と音のボタン（右下）の上には置かない
  const GAP = 58;
  const rr = ui.radar.getBoundingClientRect();
  const mr = document.getElementById('corner').getBoundingClientRect();
  const maxY = p => (p.x < rr.right + 30 ? rr.top - 34 : p.x > mr.left - 30 ? mr.top - 34 : H - 34);
  const fit = p => { p.x = clamp(p.x, 34, W - 34); p.y = clamp(p.y, 90, maxY(p)); };
  placed.forEach(fit);
  placed.sort((p, q) => p.y - q.y || p.x - q.x);
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = 0; j < placed.length; j++) {
        if (i === j) continue;
        const p = placed[i], q = placed[j];
        if (Math.hypot(p.x - q.x, p.y - q.y) >= GAP) continue;
        const sideEdge = p.x < 70 || p.x > W - 70;
        if (sideEdge) {
          const down = q.y + GAP;
          p.y = (p.y >= q.y && down <= maxY(p)) ? down : q.y - GAP;
        } else {
          p.x = q.x + (p.x >= q.x ? GAP : -GAP);
        }
        fit(p);
      }
    }
  }
  placed.forEach(p => { p.a.style.left = p.x + 'px'; p.a.style.top = p.y + 'px'; });
  arrowEls.forEach((a, s) => { if (!live.has(s)) { a.remove(); arrowEls.delete(s); } });
}

const labelEls = LANDMARKS.map(l => {
  const e = document.createElement('div');
  e.className = 'lm';
  e.textContent = landmarkName(l.name);
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
  const S = ui.radar.width, c = S / 2, k = (S / 2 - 6) / STAGE_R, u = S / 140;
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
  g.fillStyle = '#ffcf33'; g.fillRect(-3 * u, -3 * u, 6 * u, 6 * u);
  const tt = geo(35.65858, 139.74543);
  g.fillStyle = '#ff5a1f'; g.fillRect(tt.x * k - 2 * u, tt.z * k - 2 * u, 4 * u, 4 * u);
  // ヒルズ
  sprouts.forEach(s => {
    if (s.state === 'fly' || s.state === 'landed') return;
    g.fillStyle = s.state === 'rooted' ? '#777' : s.state === 'ripe' ? '#ff4040' : s.grow < 0.35 ? '#7dff9a' : '#fff';
    g.beginPath(); g.arc(s.spot.x * k, s.spot.z * k, (s.state === 'rooted' ? 2.5 : 3.5) * u, 0, 7); g.fill();
  });
  // 視点
  g.strokeStyle = '#fff'; g.lineWidth = 1.5 * u;
  const tx = cam.target.x * k, tz = cam.target.z * k;
  const fx = Math.sin(cam.heading), fz = -Math.cos(cam.heading);
  g.beginPath(); g.arc(tx, tz, Math.max(4 * u, cam.dist * 0.4 * k), 0, 7); g.stroke();
  g.beginPath(); g.moveTo(tx, tz); g.lineTo(tx + fx * 12 * u, tz + fz * 12 * u); g.stroke();
  g.restore();
  // 方位
  g.fillStyle = '#fff'; g.font = `bold ${10 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('N', c + Math.sin(-cam.heading) * (S / 2 - 10 * u), c - Math.cos(-cam.heading) * (S / 2 - 10 * u));
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
  if (!paused) {
    if (state === 'play') updateGame(dt);
    updateOffer(dt);
    updateSprouts(dt);
    updateParticles(dt);
    updateSmokes(dt);
  }
  // バナー広告：タイトル・遊び方・ポーズ・結果の画面だけ（プレイ中は出さない）
  Ads.setBanner(!ui.overlay.hidden);
  updateSmallChunks();
  if (!paused) updateKeys(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  updateArrows();
  updatePullUi();
  updateLabels();
  drawRadar();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// web-only:start
// 撮影・テスト用（アプリ用のビルドでは取り除く）
window.__hills = { get plateau() { return plateauInfo; }, spotStats: () => ({ spots: SPOTS.length, near: SPOTS.filter(sp => subwayAt(sp)).length }), camera, renderer, scene, get state() { return state; }, get game() { return game; }, sprouts, cam, newGame, yank, project, flyTo };
// web-only:end

// 言語の切り替え（タイトル画面のボタン）
document.getElementById('lang').addEventListener('click', () => setLang(lang === 'ja' ? 'en' : 'ja'));
onLangChange(() => {
  showStart();
  showBest();
  labelEls.forEach((e, i) => { e.textContent = landmarkName(LANDMARKS[i].name); });
});
applyI18n();
