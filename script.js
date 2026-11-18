/* ═══════════════════════════════════════════════════════════
   霓虹游戏厅 · 祝福显化扭蛋机 — 交互脚本
   状态机：idle → coin → spinning → dropping → opened → (again/idle)
   所有出蛋/投币动画均相对 .machine 定位（.drop-layer 与机器共用定位上下文）
   音频：Web Audio 纯合成（音乐盒 BGM + 交互音效），零外部素材
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
  const audioToggle  = $('#audioToggle');

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

  /* ═════════ 音频引擎：Web Audio 纯合成 ═════════ */
  const AudioEngine = (() => {
    let ctx = null, master = null, musicBus = null, sfxBus = null;
    let started = false, schedTimer = null, nextTime = 0, step = 0;
    let muted = false;
    try { muted = localStorage.getItem('gachaAudio') === 'off'; } catch (e) { /* 隐私模式 */ }

    const BPM = 96;
    const BEAT = 60 / BPM;
    const STEP = BEAT / 2;          // 八分音符
    const LOOP_STEPS = 32;          // 4 小节 × 8 步

    /* 每小节和弦：琶音音组 + 低音根音（温暖大调进行 C–Am–F–G） */
    const CHORDS = [
      { tones:[523.25, 659.25, 783.99, 1046.50], bass:130.81 }, // C
      { tones:[440.00, 523.25, 659.25, 880.00],  bass:110.00 }, // Am
      { tones:[349.23, 440.00, 523.25, 698.46],  bass:87.31 },  // F
      { tones:[392.00, 493.88, 587.33, 783.99],  bass:98.00 }   // G
    ];
    const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 2, 3];
    /* 旋律（八分步 → 频率），轻快的音乐盒主题 */
    const MELODY = {
      0: 659.25, 2: 783.99, 4: 880.00, 6: 783.99,   // E5 G5 A5 G5
      8: 659.25, 10: 523.25, 12: 587.33, 14: 659.25, // E5 C5 D5 E5
      16: 698.46, 18: 880.00, 20: 783.99, 22: 698.46,// F5 A5 G5 F5
      24: 587.33, 26: 659.25, 28: 587.33, 30: 523.25 // D5 E5 D5 C5
    };

    function ensureCtx() {
      if (ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);

        musicBus = ctx.createGain();
        musicBus.gain.value = 0.8;
        musicBus.connect(master);
        /* 轻延迟做梦幻回声 */
        const delay = ctx.createDelay(1);
        delay.delayTime.value = BEAT * 0.75;
        const fb = ctx.createGain(); fb.gain.value = 0.3;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
        const wet = ctx.createGain(); wet.gain.value = 0.22;
        musicBus.connect(delay);
        delay.connect(lp); lp.connect(fb); fb.connect(delay);
        lp.connect(wet); wet.connect(master);

        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.9;
        sfxBus.connect(master);
        return true;
      } catch (e) { return false; }
    }

    function resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
    const ready = () => !muted && ensureCtx() && ctx;

    /* 音乐盒拨弦音色：基频 + 八度泛音，快起 exponential 衰减 */
    function pluck(freq, t, gain, bus) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      const g = ctx.createGain(), g2 = ctx.createGain();
      o1.type = 'sine'; o1.frequency.value = freq;
      o2.type = 'sine'; o2.frequency.value = freq * 2;
      g2.gain.value = 0.25;
      o1.connect(g); o2.connect(g2); g2.connect(g);
      g.connect(bus || musicBus);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o1.start(t); o2.start(t);
      o1.stop(t + 0.65); o2.stop(t + 0.65);
    }

    /* 旋律音色：三角波，缓起长尾 */
    function melodyNote(freq, t, gain, bus) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      o.connect(g); g.connect(bus || musicBus);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
      o.start(t); o.stop(t + 1.2);
    }

    function bassNote(freq, t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      o.connect(g); g.connect(musicBus);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      o.start(t); o.stop(t + 0.9);
    }

    function scheduleStep(s, t) {
      const bar = Math.floor(s / 8);
      const pos = s % 8;
      const ch = CHORDS[bar];
      if (pos === 0 || pos === 4) bassNote(ch.bass, t);
      pluck(ch.tones[ARP_PATTERN[pos]], t, 0.05);
      const m = MELODY[s];
      if (m) melodyNote(m, t, 0.06);
    }

    function tick() {
      while (nextTime < ctx.currentTime + 0.9) {
        scheduleStep(step, nextTime);
        step = (step + 1) % LOOP_STEPS;
        nextTime += STEP;
      }
    }

    function startMusic() {
      if (started || muted || !ensureCtx()) return;
      resume();
      started = true;
      step = 0;
      nextTime = ctx.currentTime + 0.15;
      schedTimer = setInterval(tick, 250);
      tick();
    }

    function stopMusic() {
      started = false;
      if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    }

    /* ── 音效 ── */
    function blip(freq, t, dur, gain, type) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      o.connect(g); g.connect(sfxBus);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    }

    function noiseBurst(t, dur, freq, gain) {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp); bp.connect(g); g.connect(sfxBus);
      src.start(t); src.stop(t + dur + 0.05);
    }

    const sfx = {
      coin() {          /* 投币：经典双音叮咚 */
        if (!ready()) return; const t = ctx.currentTime;
        blip(1567.98, t, 0.1, 0.12);
        blip(2093.00, t + 0.07, 0.16, 0.12);
      },
      knob() {          /* 旋钮：咔哒 */
        if (!ready()) return; const t = ctx.currentTime;
        blip(190, t, 0.06, 0.08, 'square');
        noiseBurst(t + 0.02, 0.06, 3200, 0.05);
      },
      rattle() {        /* 翻滚：胶囊碰撞沙沙 */
        if (!ready()) return;
        noiseBurst(ctx.currentTime, 0.1, 900, 0.05);
      },
      plop() {          /* 滑出出口：噗落 */
        if (!ready()) return; const t = ctx.currentTime;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(480, t);
        o.frequency.exponentialRampToValueAtTime(150, t + 0.16);
        o.connect(g); g.connect(sfxBus);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.start(t); o.stop(t + 0.2);
      },
      pop() {           /* 开蛋：啵 + 星屑琶音 */
        if (!ready()) return; const t = ctx.currentTime;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(260, t);
        o.frequency.exponentialRampToValueAtTime(920, t + 0.1);
        o.connect(g); g.connect(sfxBus);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        o.start(t); o.stop(t + 0.16);
        [1046.5, 1318.5, 1567.98, 2093.0].forEach((f, i) => pluck(f, t + 0.06 + i * 0.05, 0.07, sfxBus));
      },
      chime() {         /* 祝福卡出现：柔和和弦 */
        if (!ready()) return; const t = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => melodyNote(f, t + i * 0.03, 0.05, sfxBus));
      }
    };

    function prime() {
      if (!ensureCtx()) return;
      resume();
      startMusic();
    }

    function toggle() {
      muted = !muted;
      try { localStorage.setItem('gachaAudio', muted ? 'off' : 'on'); } catch (e) { /* ignore */ }
      if (muted) stopMusic(); else { resume(); startMusic(); }
      return muted;
    }

    /* 浏览器自动播放策略：首次用户手势时激活 */
    document.addEventListener('pointerdown', prime, { once: true, capture: true });

    return { sfx, toggle, isMuted: () => muted };
  })();

  /* ── 状态 ── */
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
    const colors = ['rgba(255,170,60,.95)', 'rgba(255,110,150,.95)', 'rgba(255,230,180,.95)', 'rgba(255,200,220,.95)'];
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('span');
      b.className = 'bokeh';
      const size = rand(6, 40);
      b.style.width = b.style.height = size.toFixed(0) + 'px';
      b.style.left = rand(2, 96).toFixed(1) + '%';
      b.style.top = rand(4, 72).toFixed(1) + '%';
      b.style.setProperty('--c', colors[i % colors.length]);
      b.style.setProperty('--b', rand(2, 6).toFixed(1) + 'px');
      b.style.setProperty('--o', rand(.25, .6).toFixed(2));
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
    AudioEngine.sfx.coin();
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
    AudioEngine.sfx.knob();
    const rattleTimer = setInterval(() => AudioEngine.sfx.rattle(), 200);
    rotation += 360;
    knobRotor.style.transform = 'rotate(' + rotation + 'deg)';
    machine.classList.add('spinning');
    setTimeout(() => {
      clearInterval(rattleTimer);
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
      AudioEngine.sfx.plop();
      setTimeout(() => outlet.classList.remove('flash'), 900);
    }, 1000);

    cap.addEventListener('animationend', (e) => {
      if (e.animationName !== 'dropPath') return;
      cap.classList.remove('travel');
      cap.classList.add('open');
      tray.classList.add('landed');
      burstSparkles();
      AudioEngine.sfx.pop();
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
    AudioEngine.sfx.chime();
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

  /* 音乐开关 */
  function refreshToggle() {
    const muted = AudioEngine.isMuted();
    audioToggle.textContent = muted ? '🔇' : '🔊';
    audioToggle.classList.toggle('off', muted);
  }
  audioToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    AudioEngine.toggle();
    refreshToggle();
  });
  refreshToggle();

  /* ── 启动 ── */
  buildBokeh();
  buildDome();

  console.log('%c✦ 心愿币已备好，转动旋钮吧', 'color:#f2507e;font-size:14px;font-weight:bold;');
})();
