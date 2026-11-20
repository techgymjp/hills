// 日本語・英語の文言
//   index.html の data-i18n="キー" の要素は innerHTML を差し替える
//   data-i18n-aria="キー" は aria-label を差し替える
const DICT = {
  ja: {
    pageTitle: '六本木ヒルズを引っこ抜け',
    langButton: 'English',
    hudScore: 'スコア', hudTime: 'のこり', hudRooted: '定着',
    muteLabel: '音のオン・オフ',
    pullHint: '<b>↑</b>上にスワイプ',
    kicker: '港区 筍狩り',
    titleH1: '六本木ヒルズを<br><span>引っこ抜け</span>',
    lead: '<span class="nw">港区のあちこちから</span><span class="nw">生えてくる</span><br><span class="nw">六本木ヒルズを、</span><span class="nw">上スワイプで引っこ抜け！</span>',
    credit: '舞台：六本木ヒルズから半径5km。建物・道路：国土交通省 Project PLATEAU 3D都市モデルを加工して作成',
    start: 'はじめる',
    loading: '街と音を読み込み中… {p}%',
    loadFailed: '読み込みに失敗。タップで再読み込み',
    howtoOpen: '遊び方',
    howtoKicker: '遊び方',
    hRules: 'ルール',
    rule1: '港区のあちこちから六本木ヒルズが生えてくる。<b>上スワイプ</b>で引っこ抜こう',
    rule2: '<b>早く見つけるほど楽に抜けて高得点</b>。育つほど長いスワイプが必要になる',
    rule3: '育ちきって放っておくと<b>根付く</b>。根付いたヒルズも何回かスワイプすれば抜ける',
    rule4: '根付いたヒルズが同時に<b>5本</b>になると港区陥落。制限時間は90秒',
    rule5: '続けて抜くとコンボで点数アップ',
    hPoints: '点数',
    ptGold: '極上の朝掘り（顔を出したばかり）', ptGood: '上物', ptOk: 'まあまあ', ptOld: '育ちすぎ',
    ptRooted: '根付いたヒルズ', ptRipe: 'ギリギリセーフ（根付く直前）',
    hControls: '操作',
    cPull: '引っこ抜く', cPullHow: '1本指で上スワイプ',
    cTurn: '向きを回転', cTurnHow: '1本指で左右スワイプ',
    cMove: '前進・後退', cMoveHow: '2本指で下・上にスワイプ',
    cZoom: '拡大・縮小', cZoomHow: '2本指でピンチ',
    cFar: '遠くへ移動', cFarHow: '画面端の矢印・レーダーをタップ',
    hRadar: 'レーダー',
    rYoung: '生え始めのヒルズ（今が狙い目）', rGrow: '育ってきたヒルズ', rRipe: 'もうすぐ根付くヒルズ', rRooted: '根付いたヒルズ',
    rHome: '本家・六本木ヒルズ', rTower: '東京タワー',
    rView: '白い円が今見ている範囲。画面の上が今向いている方向',
    back: 'もどる',
    share: '結果をシェア', retry: 'もう一回',
    best: 'ハイスコア {n} 点',
    points: '{n} 点',
    newBest: '★ 自己ベスト更新',
    reasonTime: 'タイムアップ！', reasonLost: '港区がヒルズに占領された！',
    stPulled: '引っこ抜いたヒルズ', stGold: '極上の朝掘り', stGood: '上物', stOkOld: 'まあまあ・育ちすぎ', stRooted: '根付いたヒルズ',
    count: '{n} 本',
    gGold: '極上の朝掘り！', gGood: '上物！', gOk: 'まあまあ', gOld: '育ちすぎ', gRooted: '根っこごと引っこ抜いた！', gRipe: 'ギリギリセーフ',
    comboSuffix: '（{n}連続）',
    comboBanner: '{n} 連続引っこ抜き！',
    tookRoot: '根付いてしまった…',
    rankS: 'ランクS　港区の守護神', rankA: 'ランクA　ヒルズハンター', rankB: 'ランクB　再開発キラー',
    rankC: 'ランクC　見習い筍掘り', rankD: 'ランクD　ヒルズに好かれた人',
    shareText: '六本木ヒルズを引っこ抜けで {score}点！ {rank}　{n}本引っこ抜いた #ヒルズ引っこ抜け',
    shareImgSub: '{rank}　{n}本引っこ抜いた',
  },
  en: {
    pageTitle: 'Pull Out Roppongi Hills',
    langButton: '日本語',
    hudScore: 'SCORE', hudTime: 'TIME', hudRooted: 'ROOTED',
    muteLabel: 'Sound on/off',
    pullHint: '<b>↑</b>Swipe up',
    kicker: 'MINATO CITY HARVEST',
    titleH1: 'Pull out<br><span>Roppongi Hills!</span>',
    lead: 'Roppongi Hills are sprouting all over Minato City.<br><span class="nw">Swipe up to pull them out!</span>',
    credit: 'Stage: 5 km around Roppongi Hills. Buildings &amp; roads: based on MLIT Project PLATEAU 3D city models',
    start: 'Start',
    loading: 'Loading city &amp; sounds… {p}%',
    loadFailed: 'Loading failed. Tap to reload',
    howtoOpen: 'How to play',
    howtoKicker: 'HOW TO PLAY',
    hRules: 'Rules',
    rule1: 'Roppongi Hills sprout all over Minato City. <b>Swipe up</b> to pull them out',
    rule2: '<b>The sooner you find one, the easier it comes out and the more it scores.</b> The bigger it grows, the longer the swipe you need',
    rule3: 'Leave a full-grown one and it <b>takes root</b>. Rooted ones still come out with a few swipes',
    rule4: 'If <b>5</b> are rooted at once, Minato City falls. Time limit: 90 seconds',
    rule5: 'Pull them out in a row for combo bonuses',
    hPoints: 'Points',
    ptGold: 'Morning-fresh (just peeking out)', ptGood: 'Prime', ptOk: 'Not bad', ptOld: 'Overgrown',
    ptRooted: 'Rooted', ptRipe: 'Close call (about to root)',
    hControls: 'Controls',
    cPull: 'Pull out', cPullHow: 'Swipe up with one finger',
    cTurn: 'Turn', cTurnHow: 'Swipe left/right with one finger',
    cMove: 'Forward / back', cMoveHow: 'Swipe down/up with two fingers',
    cZoom: 'Zoom', cZoomHow: 'Pinch with two fingers',
    cFar: 'Travel far', cFarHow: 'Tap an edge arrow or the radar',
    hRadar: 'Radar',
    rYoung: 'Just sprouted (pull it now!)', rGrow: 'Growing', rRipe: 'About to take root', rRooted: 'Rooted',
    rHome: 'The original Roppongi Hills', rTower: 'Tokyo Tower',
    rView: 'The white circle is your view. The top of the radar is the way you face',
    back: 'Back',
    share: 'Share result', retry: 'Play again',
    best: 'High score {n}',
    points: '{n} pts',
    newBest: '★ New personal best',
    reasonTime: "Time's up!", reasonLost: 'Minato City has been taken over by Hills!',
    stPulled: 'Hills pulled out', stGold: 'Morning-fresh', stGood: 'Prime', stOkOld: 'Not bad / Overgrown', stRooted: 'Hills that took root',
    count: '{n}',
    gGold: 'Morning-fresh!', gGood: 'Prime!', gOk: 'Not bad', gOld: 'Overgrown', gRooted: 'Roots and all!', gRipe: 'Close call',
    comboSuffix: ' ({n} in a row)',
    comboBanner: '{n} in a row!',
    tookRoot: 'It took root…',
    rankS: 'Rank S  Guardian of Minato', rankA: 'Rank A  Hills Hunter', rankB: 'Rank B  Redevelopment Wrecker',
    rankC: 'Rank C  Apprentice Digger', rankD: 'Rank D  Beloved by the Hills',
    shareText: 'I scored {score} in Pull Out Roppongi Hills! {rank} — pulled out {n} Hills #ヒルズ引っこ抜け',
    shareImgSub: '{rank}  {n} Hills pulled out',
  },
};

// 地図上のランドマーク名（内部では日本語名をキーにする）
const LANDMARK_EN = {
  '六本木ヒルズ': 'Roppongi Hills', '東京タワー': 'Tokyo Tower', '東京スカイツリー': 'Tokyo Skytree', '富士山': 'Mt. Fuji',
  '東京ミッドタウン': 'Tokyo Midtown', '虎ノ門ヒルズ': 'Toranomon Hills', '渋谷スクランブルスクエア': 'Shibuya Scramble Square',
  'ドコモタワー': 'Docomo Tower', '丸の内': 'Marunouchi', '麻布台ヒルズ': 'Azabudai Hills', '東京都庁': 'Tokyo Metropolitan Gov.',
  '汐留': 'Shiodome', '品川': 'Shinagawa', 'レインボーブリッジ': 'Rainbow Bridge',
};

function detect() {
  try {
    const saved = localStorage.getItem('hills_lang');
    if (saved === 'ja' || saved === 'en') return saved;
  } catch (_) { /* ignore */ }
  return (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export let lang = detect();

export function t(key, vars = {}) {
  const s = (DICT[lang] && DICT[lang][key]) ?? DICT.ja[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

export function landmarkName(name) {
  return lang === 'en' ? (LANDMARK_EN[name] || name) : name;
}

const listeners = [];
export function onLangChange(fn) { listeners.push(fn); }

export function applyI18n() {
  document.documentElement.lang = lang;
  document.title = t('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  listeners.forEach(fn => fn(lang));
}

export function setLang(l) {
  lang = l;
  try { localStorage.setItem('hills_lang', l); } catch (_) { /* ignore */ }
  applyI18n();
}
