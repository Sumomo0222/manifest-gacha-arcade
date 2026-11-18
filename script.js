/* ═══════════════════════════════════════════════════════════
   霓虹游戏厅 · 祝福显化扭蛋机 — 交互脚本
   状态机：idle → coin → spinning → dropping → opened → (again/idle)
   所有出蛋/投币动画均相对 .machine 定位（.drop-layer 与机器共用定位上下文）
   ═══════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const machine   = $('#machine');
  if (!machine) return;

  const screenText   = $('#screenText');
  const cta          = $('#cta');
  const knobBtn      = $('#knobBtn');
  const knobRotor    = $('#knobRotor');
  const coinSlot     = $('#coinSlot');
  const outlet       = $('#outlet');
  const tray         = $('#tray');
  const dropLayer    = $('#dropLayer');
  const domeCaps     = $('#domeCaps');
  const overlay      = $('#overlay');
  const bcIcon       = $('#bcIcon');
  const bcName       = $('#bcName');
  const bcHint       = $('#bcHint');
  const bcAction     = $('#bcAction');
  const bcShare      = $('#bcShare');
  const btnCopy      = $('#btnCopy');
  const btnAgain     = $('#btnAgain');
  const copyFallback = $('#copyFallback');
  const copyText     = $('#copyText');

  /* ── 祝福数据：显化提示 + 今日小行动 + 分享短句（情绪价值向，非结果承诺） ── */
  const BLESSINGS = [
    { name:'灵感显影', icon:'✨', hint:'一个模糊的想法正在变得清晰。', action:'把它写下来。', share:'灵感显影——把模糊的想法写下来，它就开始变清晰了。' },
    { name:'心愿发芽', icon:'🌱', hint:'你长期放在心里的愿望，正在积累第一次行动的能量。', action:'为它做一个 10 分钟内能完成的小动作。', share:'心愿发芽——我正在为心里那个愿望，攒第一次行动的勇气。' },
    { name:'机会靠近', icon:'🔔', hint:'一个反复出现的信号，可能指向新的可能性。', action:'记录今天最触动你的一个线索。', share:'机会靠近——今天要留意那些反复出现的小信号。' },
    { name:'勇气点亮', icon:'🔥', hint:'你不需要一次完成全部，只要迈出一个小而确定的动作。', action:'完成那件你一直拖延的小事。', share:'勇气点亮——不用做完所有事，先迈出小小的一步。' },
    { name:'丰盛打开', icon:'🌟', hint:'把注意力放在已经拥有的资源上，你会更容易看见下一步。', action:'写下 3 个你已经拥有的支持。', share:'丰盛打开——数一数已经拥有的支持，路会更清楚。' },
    { name:'好运显影', icon:'🍀', hint:'你正在更靠近一个合适的时机。', action:'保持开放，也做一个实际推进。', share:'好运显影——合适的时机在靠近，我保持开放也在推进。' },
    { name:'答案浮现', icon:'💡', hint:'答案会在你开始行动后变得更清楚。', action:'先试一个最小版本。', share:'答案浮现——先试一个最小版本，答案会在路上变清楚。' },
    { name:'节奏校准', icon:'🎧', hint:'属于你的节奏正在成形，慢一点也没关系。', action:'给今天定一个「这样就很好」的标准。', share:'节奏校准——按自己的节奏来，也算一种推进。' },
    { name:'星光让路', icon:'⭐', hint:'有扇门正在为你留一条缝，记得留意身边的善意。', action:'对今天遇到的一句善意说声谢谢。', share:'星光让路——留意今天出现的那些小小善意。' },
    { name:'雾散指南', icon:'🌫️', hint:'挡住视线的那层雾，往往比你想象的更薄。', action:'做一件能让画面更清楚的小整理。', share:'雾散指南——先迈出看得清的那一步。' }
  ];

  const CAP_COLORS = [
    ['#ff8fd8','#e55fb2'],
    ['#8ff7ff','#4bb8d9'],
    ['#ffd166','#e0a63a'],
    ['#b39aff','#8a68e8'],
    ['#7dffc3','#3ecf96']
  ];

  let phase = 'idle';       // idle | coin | spinning | dropping | opened
  let rotation = 0;
  let lastIndex = -1;
  let current = null;

  /* ── 工具 ── */
  const rand = (min, max) => min + Math.random() * (max - min);

  function setScreen(text, state) {
    screenText.textContent = text;
    machine.dataset.state = state;
  }

  function setCta(text, disabled) {
    cta.textContent = text;
    cta.disabled = !!disabled;
    cta.classList.toggle('pulse', !disabled);
  }

  /* ── 场景装饰：散景光斑 ── */
  function buildBokeh() {
    const field = $('#bokehField');
    const colors = ['rgba(255,122,217,.9)', 'rgba(110,231,255,.9)', 'rgba(167,139,250,.9)', 'rgba(255,209,102,.9)'];
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('span');
      b.className = 'bokeh';
      const size = rand(6, 40);
      b.style.width = b.style.height = size.toFixed(0) + 'px';
      b.style.left = rand(2, 96).toFixed(1) + '%';
      b.style.top = rand(4, 72).toFixed(1) + '%';
      b.style.setProperty('--c', colors[i % colors.length]);
      b.style.setProperty('--b', rand(2, 6).toFixed(1) + 'px');
      b.style.setProperty('--o', rand(.18, .5).toFixed(2));
      b.style.setProperty('--t', rand(3.5, 8).toFixed(1) + 's');
      b.style.setProperty('--d', (-rand(0, 6)).toFixed(1) + 's');
      field.appendChild(b);
    }
  }

  /* ── 场景装饰：玻璃罩内的胶囊 ── */
  function buildDome() {
    for (let i = 0; i < 11; i++) {
      const cap = document.createElement('span');
      cap.className = 'cap';
      const c = CAP_COLORS[Math.floor(Math.random() * CAP_COLORS.length)];
      cap.style.setProperty('--c1', c[0]);
      cap.style.setProperty('--c2', c[1]);
      cap.style.width = rand(11, 15).toFixed(1) + '%';
      cap.style.left = rand(12, 74).toFixed(1) + '%';
      cap.style.top = rand(30, 66).toFixed(1) + '%';
      cap.style.setProperty('--t', rand(2.6, 4.6).toFixed(2) + 's');
      cap.style.setProperty('--d', (-rand(0, 4)).toFixed(2) + 's');
      domeCaps.appendChild(cap);
    }
  }

  /* ── 投币 ── */
  function insertCoin(fast = false) {
    if (phase !== 'idle') return;
    phase = 'coin';
    setScreen('已投币 · 转动旋钮 TURN!', 'coin');
    setCta('转动旋钮 ↻', false);
    const coin = document.createElement('div');
    coin.className = 'drop-coin' + (fast ? ' fast' : '');
    coin.innerHTML = '<span>✦</span>';
    dropLayer.appendChild(coin);
    coin.addEventListener('animationend', () => coin.remove(), { once: true });
  }

  /* ── 转动旋钮 ── */
  function spin() {
    if (phase !== 'coin') return;
    phase = 'spinning';
    setScreen('正在显化', 'spin');
    setCta('显化中…', true);
    rotation += 360;
    knobRotor.style.transform = 'rotate(' + rotation + 'deg)';
    machine.classList.add('spinning');
    setTimeout(() => {
      machine.classList.remove('spinning');
      pickAndDrop();
    }, 1400);
  }

  /* ── 选中胶囊 → 出蛋（起点/出蛋口/托盘全部相对 .machine） ── */
  function pickAndDrop() {
    let i;
    do { i = Math.floor(Math.random() * BLESSINGS.length); } while (i === lastIndex && BLESSINGS.length > 1);
    lastIndex = i;
    current = BLESSINGS[i];
    phase = 'dropping';

    const c = CAP_COLORS[Math.floor(Math.random() * CAP_COLORS.length)];
    const cap = document.createElement('div');
    cap.className = 'drop-capsule travel';
    cap.style.setProperty('--c1', c[0]);
    cap.style.setProperty('--c2', c[1]);
    cap.innerHTML =
      '<span class="cap-h cap-h--top"></span>' +
      '<span class="cap-h cap-h--bot"></span>' +
      '<span class="cap-shine"></span>';
    dropLayer.appendChild(cap);

    /* 胶囊抵达出蛋口时点亮出口 */
    setTimeout(() => {
      outlet.classList.add('flash');
      setTimeout(() => outlet.classList.remove('flash'), 900);
    }, 1000);

    cap.addEventListener('animationend', (e) => {
      if (e.animationName !== 'dropPath') return;
      cap.classList.remove('travel');
      cap.classList.add('open');
      tray.classList.add('landed');
      burstSparkles();
      setScreen('祝福已抵达 ✦', 'done');
      setTimeout(() => {
        cap.remove();
        tray.classList.remove('landed');
        showCard(current);
      }, 760);
    }, { once: true });
  }

  /* ── 托盘上的星屑迸发（位置同样相对 .machine） ── */
  function burstSparkles() {
    for (let k = 0; k < 10; k++) {
      const s = document.createElement('i');
      s.className = 'spark';
      const angle = Math.random() * Math.PI * 2;
      const radius = rand(26, 70);
      s.style.setProperty('--tx', (Math.cos(angle) * radius).toFixed(0) + 'px');
      s.style.setProperty('--ty', (Math.sin(angle) * radius * .7).toFixed(0) + 'px');
      s.style.setProperty('--s', rand(.8, 2.2).toFixed(2));
      s.style.animationDelay = (Math.random() * .12).toFixed(2) + 's';
      dropLayer.appendChild(s);
      s.addEventListener('animationend', () => s.remove(), { once: true });
    }
  }

  /* ── 祝福卡 ── */
  function buildCopyText(b) {
    return '✦ ' + b.name + ' ✦\n' +
      '显化提示：' + b.hint + '\n' +
      '今日小行动：' + b.action + '\n' +
      b.share + '\n' +
      '—— 抽自「霓虹游戏厅 · 祝福显化扭蛋机」';
  }

  function showCard(b) {
    phase = 'opened';
    bcIcon.textContent = b.icon;
    bcName.textContent = b.name;
    bcHint.textContent = b.hint;
    bcAction.textContent = b.action;
    bcShare.textContent = b.share;
    copyFallback.hidden = true;
    btnCopy.textContent = '复制祝福';
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    setCta('祝福已抵达 ✦', true);
    setTimeout(() => btnCopy.focus({ preventScroll: true }), 380);
  }

  async function copyBlessing() {
    if (!current) return;
    const text = buildCopyText(current);
    try {
      if (!(navigator.clipboard && window.isSecureContext)) throw new Error('no-clipboard');
      await navigator.clipboard.writeText(text);
      btnCopy.textContent = '已复制 ✓';
      setTimeout(() => { btnCopy.textContent = '复制祝福'; }, 1800);
    } catch (err) {
      copyFallback.hidden = false;
      copyText.value = text;
      copyText.focus();
      copyText.select();
      try { document.execCommand('copy'); btnCopy.textContent = '已复制 ✓'; }
      catch (e2) { btnCopy.textContent = '全选复制 ↓'; }
      setTimeout(() => { btnCopy.textContent = '复制祝福'; }, 2600);
    }
  }

  function closeOverlay() {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
  }

  /* 再抽一次：关卡 → 自动投币 → 只等转动旋钮 */
  function again() {
    closeOverlay();
    setTimeout(() => {
      phase = 'idle';
      insertCoin(true);
    }, 220);
  }

  /* 收起卡片，回到待机 */
  function closeToIdle() {
    closeOverlay();
    phase = 'idle';
    setScreen('等待心愿币 · INSERT COIN', 'idle');
    setCta('投入心愿币 ✦', false);
  }

  /* ── 事件绑定 ── */
  cta.addEventListener('click', () => {
    if (phase === 'idle') insertCoin();
    else if (phase === 'coin') spin();
  });
  knobBtn.addEventListener('click', spin);
  coinSlot.addEventListener('click', () => { if (phase === 'idle') insertCoin(); });
  coinSlot.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (phase === 'idle') insertCoin(); }
  });
  btnCopy.addEventListener('click', copyBlessing);
  btnAgain.addEventListener('click', again);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeToIdle(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('show')) closeToIdle();
  });

  /* ── 启动 ── */
  buildBokeh();
  buildDome();

  console.log('%c✦ 心愿币已备好，转动旋钮吧', 'color:#ff8fd8;font-size:14px;font-weight:bold;');
})();
