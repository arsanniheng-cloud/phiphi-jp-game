// ============================================================================
// scene.js — ฉากประชุม คปอ. และฉากอบรม: วาดห้องประชุม/ลานฝึก ผู้เข้าร่วม และของประกอบการสอนด้วยโค้ด
// ใช้ตัวละครแบบเดียวกับในเกม (Art.person) ท่าทางเปลี่ยนตามผลคำตอบ · พิกัดฉากคงที่ 640×400 แล้วย่อ/ขยายตามขนาดจอ
// ฉากแต่ละหัวข้ออยู่ใน scene_train.js (ลงทะเบียนผ่าน Scene.register)
// ============================================================================
(function (root) {
  'use strict';
  const A = root.Art, G = root.GAME_DATA;
  const TAU = Math.PI * 2, W = 640, H = 400;
  const FONT = '"Leelawadee UI","Sarabun",Tahoma,sans-serif';
  const rr = A.rr, shade = A.shade;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const OUT = 'rgba(70,40,30,.55)';
  const ol = (c, w) => { c.strokeStyle = OUT; c.lineWidth = w || 1.4; c.lineJoin = 'round'; c.stroke(); };
  const fe = (c, fill, w) => { c.fillStyle = fill; c.fill(); ol(c, w); };
  const oval = (c, x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); };
  const linear = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  const KINDS = {};
  let cur = null;

  // ------------------------------------------------------------------ ตัวช่วยวาดทั่วไป
  function txt(c, s, x, y, size, col, align, weight) {
    c.font = (weight || '700') + ' ' + size + 'px ' + FONT;
    c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.fillStyle = col || '#fff';
    c.fillText(s, x, y);
  }
  function fitSize(c, s, maxW, size, weight) {
    let z = size;
    c.font = (weight || '700') + ' ' + z + 'px ' + FONT;
    while (z > 10 && c.measureText(s).width > maxW) { z--; c.font = (weight || '700') + ' ' + z + 'px ' + FONT; }
    return z;
  }
  function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  // กรอบข้อความลอย (ปลายหางชี้ที่ x,y)
  function bubble(c, x, y, s, size) {
    size = size || 19;
    c.font = '700 ' + size + 'px ' + FONT;
    const w = Math.min(330, c.measureText(s).width + 26), h = size + 16;
    const bx = clamp(x - w / 2, 6, W - w - 6), by = y - h - 14;
    c.beginPath(); c.moveTo(x - 8, by + h - 1); c.lineTo(x + 8, by + h - 1); c.lineTo(x, y); c.closePath(); fe(c, '#ffffff', 1.4);
    rr(c, bx, by, w, h, 12); fe(c, '#ffffff', 1.4);
    c.fillStyle = '#ffffff'; c.fillRect(x - 7, by + h - 3, 14, 4);
    txt(c, s, bx + w / 2, by + h / 2 + 1, size, '#26323d');
  }
  // สัญลักษณ์อารมณ์เหนือหัว
  function emote(c, x, y, kind, t) {
    const bob = Math.sin(t * 6) * 2.2;
    c.save(); c.translate(x, y + bob);
    if (kind === 'sweat') {
      c.beginPath(); c.moveTo(0, -12); c.quadraticCurveTo(9, 2, 0, 7); c.quadraticCurveTo(-9, 2, 0, -12); fe(c, '#7cc4ff', 1.2);
    } else if (kind === 'heart') {
      c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(-16, -4, -9, -16, 0, -8); c.bezierCurveTo(9, -16, 16, -4, 0, 8); fe(c, '#ff5d7a', 1.2);
    } else {
      const map = { q: ['?', '#ffb02e'], ok: ['✓', '#2fbf71'], idea: ['!', '#ffd23f'], x: ['✕', '#ff5a5f'] }[kind] || ['!', '#ffb02e'];
      oval(c, 0, 0, 13, 13); fe(c, map[1], 1.4);
      txt(c, map[0], 0, 1, 20, kind === 'idea' ? '#7a4b00' : '#ffffff');
    }
    c.restore();
  }
  // ภาพ sprite จาก Blender (ถ้ามี)
  function spr(c, key, x, y, s, flip) {
    const p = A.sprite(key);
    if (!p) return false;
    c.save(); c.translate(x, y); if (flip) c.scale(-1, 1); c.scale(s, s);
    c.drawImage(p.img, -p.ax, -p.ay, p.sw, p.sh);
    c.restore();
    return true;
  }
  function sprList(prefix) { return A.spriteList(prefix); }

  // ------------------------------------------------------------------ ท่าทางตัวละคร
  // แขน [ไหล่, ศอก]: 0 = ห้อยลง · บวก = กางออกด้านนอก (~1.57 = ระดับไหล่ · ~3.1 = ชูตรงขึ้น) ศอกติดลบ = พับเข้าหาตัว
  function poseOf(state, t, a) {
    const ph = t * 1.7 + a.seed, sw = Math.sin(ph) * 0.03;
    const blink = ((t + a.seed * 3.1) % 4.3) < 0.13;
    const talk = Math.sin(t * 11 + a.seed) > 0.15 ? 'open' : 'smile';
    switch (state) {
      case 'cheer': { const b = Math.abs(Math.sin(t * 9 + a.seed)); return { pose: { l: [2.6 + b * 0.35, 0.3], r: [2.6 + b * 0.35, 0.3], eyes: 'happy', mouth: 'grin' }, bob: b * 3.2 }; }
      case 'clap': { const k = Math.sin(t * 15 + a.seed) * 0.28; return { pose: { l: [0.55, -1.8 + k], r: [0.55, -1.8 + k], eyes: 'happy', mouth: 'grin' }, bob: Math.abs(Math.sin(t * 7 + a.seed)) * 1.2 }; }
      case 'confused': return { pose: { l: [0.12, 0.08], r: [2.4, 0.7], eyes: 'worry', mouth: 'o', brow: 'worry' }, bob: 0 };
      case 'raise': return { pose: { l: [0.12 + sw, 0.08], r: [3.0 + Math.sin(t * 4 + a.seed) * 0.1, 0.1], eyes: blink ? 'closed' : 'normal', mouth: 'smile' }, bob: 0 };
      case 'think': return { pose: { l: [0.12, 0.08], r: [0.9, 2.4], eyes: 'normal', brow: 'up', mouth: 'flat' }, bob: 0 };
      case 'teach': return { pose: { l: [0.14, 0.1], r: [1.5 + Math.sin(t * 1.4) * 0.12, 0.3], eyes: blink ? 'closed' : 'normal', mouth: talk }, bob: Math.sin(ph) * 0.4 };
      case 'point': return { pose: { l: [0.14, 0.1], r: [2.2 + Math.sin(t * 1.5) * 0.08, 0.2], eyes: blink ? 'closed' : 'normal', mouth: talk }, bob: 0 };
      case 'sorry': return { pose: { l: [0.2, 0.15], r: [0.2, 0.15], eyes: 'worry', mouth: 'flat', brow: 'worry' }, bob: 0 };
      case 'sit': return { pose: { l: [0.5, -1.15], r: [0.5, -1.15], eyes: blink ? 'closed' : 'normal', mouth: 'smile' }, bob: Math.sin(ph * 0.8) * 0.3 };
      case 'hold': return { pose: { l: [0.14, 0.1], r: a.holdArm || [0.9, 0.9], eyes: blink ? 'closed' : 'normal', mouth: talk }, bob: Math.sin(ph) * 0.3 };
      default: return { pose: { l: [0.12 + sw, 0.08], r: [0.12 - sw, 0.08], eyes: blink ? 'closed' : 'normal', mouth: 'smile' }, bob: Math.sin(ph * 0.8) * 0.4 };
    }
  }
  function drawActor(c, a, t, S) {
    let st = a.state || 'listen';
    if (a.react && S.fin) {          // จบการอบรม: ปรบมือต่อเนื่องถ้าผ่าน
      if (S.fin.good) st = t - S.fin.t - a.seed * 0.05 < 1.8 ? 'cheer' : 'clap';
    } else if (a.react && S.res) {   // ผู้ฟังตอบสนองต่อผลคำตอบ (เหลื่อมเวลากันเล็กน้อยให้ดูเป็นธรรมชาติ)
      const dt = t - S.resT - a.seed * 0.06;
      if (S.res === 'right') st = dt < 0 ? st : dt < 1.7 ? 'cheer' : dt < 3.6 ? 'clap' : st;
      else st = dt < 0 ? st : dt < 2.4 ? 'confused' : st;
    }
    if (a.force) st = a.force(t, S) || st;
    const p = poseOf(st === 'listen' && a.sit ? 'sit' : st, t, a);
    const pose = a.lean ? Object.assign({}, p.pose, { lean: a.lean }) : p.pose;
    A.person(c, a.x, a.y, a.L, a.dir, 0, false, { scale: a.s, pose, bob: p.bob + (a.bobF ? a.bobF(t, S) : 0), hold: a.hold, squat: a.squat, t });
    a.pst = st;
  }
  function mkActor(L, x, y, s, dir, o) {
    return Object.assign({ L, x, y, s, dir: dir | 0, seed: Math.random() * 6.28, react: true, state: 'listen', name: '' }, o || {});
  }
  const headOf = a => ({ x: a.x, y: a.y - 40 * a.s });

  // ------------------------------------------------------------------ ผู้เข้าร่วม (ใช้ตัวจริงจากเกมถ้ามี ไม่งั้นใช้ข้อมูลพนักงานในไฟล์ข้อมูล)
  function staticPeople(kind, a) {
    const out = [], depts = G.departments;
    if (kind === 'KPO') {
      depts.forEach(d => { const n = G.npcs.find(x => x.department_id === d.id); if (n) out.push({ name: n.name, department_id: d.id, L: A.npcLook(n, d, false) }); });
    } else {
      const d = depts.find(x => x.id === (a && a.department_id)) || depts[0];
      G.npcs.filter(x => x.department_id === d.id).slice(0, 10).forEach(n => out.push({ name: n.name, department_id: d.id, L: A.npcLook(n, d, false) }));
    }
    return out;
  }
  function peopleFor(kind, a) {
    let list = [];
    try { if (root.Sim && root.Sim.attendeesOf && a) list = root.Sim.attendeesOf(a); } catch (e) { list = []; }
    return list.length ? list : staticPeople(kind, a);
  }
  function trainerLook() {
    try {
      const S = root.Sim && root.Sim.S, pl = root.Sim && root.Sim.pinfo && root.Sim.actor ? root.Sim.pinfo(root.Sim.actor.id) : null;
      if (pl && pl.look) return A.avatarLook(pl.look);
    } catch (e) { /* ใช้ค่าเริ่มต้น */ }
    return A.playerLook();
  }

  // ------------------------------------------------------------------ พื้นหลังห้อง (ใช้ซ้ำหลายฉาก)
  function bgIndoor(c, th) {
    th = Object.assign({ wall: ['#f7ecd6', '#ead8b6'], wain: '#b98a5a', floor: ['#d3a96d', '#b6874f'], hz: 250, tile: false }, th);
    const hz = th.hz;
    c.fillStyle = linear(c, 0, 0, 0, hz, th.wall); c.fillRect(0, 0, W, hz);
    c.fillStyle = shade(th.wall[0], -0.09); c.fillRect(0, 0, W, 9); c.fillStyle = 'rgba(0,0,0,.07)'; c.fillRect(0, 9, W, 3);
    const wy = hz - 76;
    c.fillStyle = th.wain; c.fillRect(0, wy, W, hz - wy);
    c.fillStyle = shade(th.wain, 0.2); c.fillRect(0, wy, W, 5);
    c.strokeStyle = shade(th.wain, -0.2); c.lineWidth = 1.5;
    for (let x = 14; x < W; x += 70) { rr(c, x, wy + 12, 54, 52, 3); c.stroke(); }
    c.fillStyle = shade(th.wain, -0.3); c.fillRect(0, hz - 7, W, 7);
    c.fillStyle = linear(c, 0, hz, 0, H, th.floor); c.fillRect(0, hz, W, H - hz);
    c.strokeStyle = 'rgba(0,0,0,.1)'; c.lineWidth = 1.2;
    if (th.tile) {
      for (let y = hz + 14; y < H; y += 22 + (y - hz) * 0.12) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      for (let x = -200; x < W + 200; x += 70) { c.beginPath(); c.moveTo(320 + (x - 320) * 0.45, hz); c.lineTo(x, H); c.stroke(); }
    } else {
      for (let x = -360; x < W + 360; x += 78) { c.beginPath(); c.moveTo(320 + (x - 320) * 0.5, hz); c.lineTo(x, H); c.stroke(); }
    }
    c.fillStyle = linear(c, 0, hz, 0, hz + 26, ['rgba(0,0,0,.2)', 'rgba(0,0,0,0)']); c.fillRect(0, hz, W, 26);
  }
  // หน้าต่างบานใหญ่มองเห็นทะเลและต้นมะพร้าว (ใช้ภาพ 3 มิติจาก Blender ถ้ามี)
  function windowView(c, x, y, w, h) {
    c.save();
    rr(c, x - 6, y - 6, w + 12, h + 12, 6); fe(c, '#f4f0e6', 1.6);
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = linear(c, 0, y, 0, y + h, ['#8fd3ff', '#d9f3ff']); c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,255,255,.75)'; oval(c, x + w * 0.3, y + h * 0.28, 26, 9); c.fill(); oval(c, x + w * 0.42, y + h * 0.33, 20, 7); c.fill();
    const sy = y + h * 0.58;
    c.fillStyle = linear(c, 0, sy, 0, y + h, ['#35d0d6', '#0e9ac2']); c.fillRect(x, sy, w, y + h - sy);
    c.fillStyle = '#7fb77a'; oval(c, x + w * 0.2, sy, 30, 14); c.fill(); c.fillStyle = '#9fa9a0'; oval(c, x + w * 0.2, sy + 3, 28, 7); c.fill();
    c.fillStyle = '#5c9d63'; oval(c, x + w * 0.62, sy, 20, 10); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(x + 10 + i * 30, sy + 10 + (i % 2) * 8); c.lineTo(x + 28 + i * 30, sy + 10 + (i % 2) * 8); c.stroke(); }
    spr(c, 'boat_longtail_red', x + w * 0.55, sy + 22, 0.55);
    const palms = sprList('tree_palm_');
    if (palms.length) { const p = palms[0]; c.drawImage(p.img, x + w - 70, y + h - p.sh * 0.8 + 6, p.sw * 0.8, p.sh * 0.8); }
    c.restore();
    c.strokeStyle = '#f4f0e6'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h * 0.5); c.lineTo(x + w, y + h * 0.5); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(x + 10, y); c.lineTo(x + 44, y); c.lineTo(x + 10, y + h); c.lineTo(x - 18, y + h); c.closePath(); c.fill();
  }
  function plant(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = '#2f9e44';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42;
      c.save(); c.rotate(a + Math.PI / 2); c.beginPath(); c.moveTo(0, -8); c.bezierCurveTo(-9, -36, -6, -62, 0, -76); c.bezierCurveTo(6, -62, 9, -36, 0, -8); fe(c, i % 2 ? '#2f9e44' : '#40b455', 1.2); c.restore();
    }
    c.beginPath(); c.moveTo(-15, -12); c.lineTo(15, -12); c.lineTo(11, 18); c.lineTo(-11, 18); c.closePath(); fe(c, '#c8693a', 1.4);
    c.restore();
  }

  // ------------------------------------------------------------------ ของประกอบฉาก (ใช้ร่วมกัน)
  const P = {};
  P.txt = txt; P.bubble = bubble; P.emote = emote; P.spr = spr; P.oval = oval; P.fe = fe; P.ol = ol; P.linear = linear; P.plant = plant; P.bgIndoor = bgIndoor; P.windowView = windowView; P.cut = cut; P.fitSize = fitSize;

  // ไฟ: (x,y) = ฐานไฟ · k = ความแรง 0..1
  function tongue(c, x, y, w, h, col, sway) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, y);
    c.bezierCurveTo(x - w, y - h * 0.45, x - w * 0.3 + sway, y - h * 0.62, x + sway * 1.6, y - h);
    c.bezierCurveTo(x + w * 0.3 + sway, y - h * 0.62, x + w, y - h * 0.45, x + w, y); c.closePath(); c.fill();
  }
  P.flame = function (c, x, y, s, t, k) {
    if (k <= 0.02) return;
    c.save(); c.translate(x, y); c.scale(s * k, s * k);
    const f1 = Math.sin(t * 11), f2 = Math.sin(t * 17 + 1), f3 = Math.sin(t * 13 + 2);
    const g = c.createRadialGradient(0, -16, 2, 0, -16, 46); g.addColorStop(0, 'rgba(255,190,60,.5)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, -16, 46, 0, TAU); c.fill();
    tongue(c, 0, 0, 19, 44 + f1 * 5, '#ff4e1a', f2 * 3);
    tongue(c, -11, 0, 11, 28 + f2 * 4, '#ff7a1a', f1 * 3); tongue(c, 12, 0, 11, 31 + f3 * 4, '#ff7a1a', f3 * 3);
    tongue(c, 0, 0, 12, 30 + f3 * 3, '#ffb21f', f1 * 2);
    tongue(c, 0, 0, 6.5, 17 + f2 * 2, '#fff1a8', 0);
    c.restore();
  };
  P.smoke = function (c, x, y, s, t, k) {
    if (k <= 0.02) return;
    for (let i = 0; i < 5; i++) {
      const u = ((t * 0.45 + i / 5) % 1), r = (7 + u * 16) * s;
      c.fillStyle = 'rgba(70,70,76,' + (0.32 * (1 - u) * k).toFixed(3) + ')';
      oval(c, x + Math.sin(t * 2 + i * 1.7) * 7 * s * u + (i - 2) * 2.5 * s, y - 34 * s * k - u * 62 * s, r, r * 0.8); c.fill();
    }
  };
  // สเปรย์ผงเคมี/โฟมจากหัวฉีด (x0,y0) → (x1,y1)
  P.spray = function (c, x0, y0, x1, y1, t, k) {
    if (k <= 0.02) return;
    const dx = x1 - x0, dy = y1 - y0;
    for (let i = 0; i < 16; i++) {
      const u = ((t * 2.2 + i / 16) % 1), sp = u * u;
      const px = x0 + dx * u + Math.sin(i * 12.9 + t * 6) * 5 * u, py = y0 + dy * u + Math.cos(i * 7.7 + t * 5) * 7 * u;
      c.fillStyle = 'rgba(245,248,252,' + (0.78 * (1 - u * 0.7) * k).toFixed(3) + ')';
      oval(c, px, py, 4 + sp * 16, 3.5 + sp * 12); c.fill();
    }
  };
  P.extinguisher = function (c, x, y, s, o) {
    o = o || {};
    c.save(); c.translate(x, y); c.scale(s, s);
    oval(c, 0, 0, 13, 4); c.fillStyle = 'rgba(0,0,0,.22)'; c.fill();
    rr(c, -10, -46, 20, 46, 8); fe(c, '#d92b32', 1.4);
    c.fillStyle = 'rgba(255,255,255,.28)'; rr(c, -7, -42, 4, 38, 2); c.fill();
    c.fillStyle = '#ffffff'; rr(c, -10, -31, 20, 13, 1); c.fill(); ol(c, 1);
    txt(c, 'ABC', 0, -24.5, 9, '#1d2b36', 'center', '800');
    rr(c, -5.5, -53, 11, 9, 2); fe(c, '#2b2b30', 1.2);
    c.beginPath(); c.moveTo(-8, -58); c.lineTo(11, -60); c.lineTo(13, -55); c.lineTo(-4, -53); c.closePath(); fe(c, '#3a3a40', 1.2);
    oval(c, 5, -47, 4.2, 4.2); fe(c, '#f5f5f5', 1); c.strokeStyle = '#2fbf71'; c.lineWidth = 1.6; c.beginPath(); c.arc(5, -47, 2.4, Math.PI, TAU * 0.95); c.stroke();
    c.strokeStyle = '#1b1b1f'; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(8, -52); c.bezierCurveTo(26, -50, 28, -36, 20, -28); c.stroke();
    c.fillStyle = '#1b1b1f'; c.beginPath(); c.moveTo(17, -29); c.lineTo(25, -27); c.lineTo(23, -21); c.lineTo(15, -24); c.closePath(); c.fill();
    if (o.pin !== 0) {               // สลักนิรภัย (ถอดออกแล้วเมื่อ pin = 0)
      c.strokeStyle = '#e8c02a'; c.lineWidth = 1.8; c.beginPath(); c.arc(-12, -53, 3.8, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(-9, -56); c.lineTo(-3, -57); c.stroke();
    }
    c.restore();
  };
  P.firepan = function (c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    oval(c, 0, 4, 46, 13); c.fillStyle = 'rgba(0,0,0,.25)'; c.fill();
    oval(c, 0, 0, 38, 12); fe(c, '#656c75', 1.4);
    oval(c, 0, -1.5, 33, 9.5); fe(c, '#25282e', 1.2);
    c.fillStyle = 'rgba(255,255,255,.12)'; oval(c, -9, -3, 14, 3); c.fill();
    c.restore();
  };

  // ------------------------------------------------------------------ ตัวฉาก
  function create(kind, o) {
    const def = KINDS[kind];
    if (!def) return null;
    o = o || {};
    const S = { kind, def, o, t0: 0, last: 0, demo: null, demoT: 0, res: null, resT: 0, cap: '', intro: true, actors: [], extra: {}, fin: null };
    S.people = (o.people && o.people.length ? o.people : peopleFor(kind, o.act)).slice(0, 12);
    S.trainer = o.trainerLook || trainerLook();
    S.title = def.title || '';
    S.cv = document.createElement('canvas'); S.cv.className = 'stage';
    S.cv.setAttribute('role', 'img'); S.cv.setAttribute('aria-label', 'ภาพจำลอง' + (def.title || 'ฉาก'));
    S.c = S.cv.getContext('2d');
    S.bg = null;
    if (def.setup) def.setup(S);
    S.ctl = controller(S);
    return S;
  }
  function controller(S) {
    return {
      demo(key) { S.demo = key; S.demoT = nowT(S); S.res = null; S.intro = false; S.cap = ''; if (S.def.onDemo) S.def.onDemo(S, key); },
      reveal(right) { S.res = right ? 'right' : 'wrong'; S.resT = nowT(S); },
      caption(s) { S.cap = s || ''; },
      board(b) { S.extra.board = b; },
      focus(deptId, label) { S.extra.focus = { dept: deptId, label: label || '', t: nowT(S) }; },
      clearFocus() { S.extra.focus = null; },
      vote(n, total) { S.extra.vote = { t: nowT(S), n, total }; return new Promise(res => setTimeout(res, 2600)); },
      finish(good) { S.fin = { good: !!good, t: nowT(S) }; S.res = good ? 'right' : 'wrong'; S.resT = nowT(S); },
      now() { return nowT(S); },
      stop() { stop(); }
    };
  }
  const nowT = S => (performance.now() - S.t0) / 1000;

  function dims(S) {
    const dpr = Math.min(2, root.devicePixelRatio || 1), w = Math.max(160, Math.round(S.cv.clientWidth * dpr)), h = Math.round(w * H / W);
    return { w, h, k: w / W };
  }
  // วาดหนึ่งเฟรมลงใน canvas ที่กำหนด (ใช้ทั้งตอนเล่นจริงและตอนทดสอบ)
  function drawFrame(S, c, k, t) {
    c.setTransform(k, 0, 0, k, 0, 0);
    if (!S.bg || S.bgK !== k) {
      S.bg = document.createElement('canvas'); S.bg.width = Math.round(W * k); S.bg.height = Math.round(H * k); S.bgK = k;
      const b = S.bg.getContext('2d'); b.setTransform(k, 0, 0, k, 0, 0); S.def.bg(b, S);
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(S.bg, 0, 0); c.setTransform(k, 0, 0, k, 0, 0);
    const items = [];
    const push = (y, f) => items.push({ y, f });
    S.actors.forEach(a => push(a.y, () => drawActor(c, a, t, S)));
    const kk = S.res ? ease((t - S.resT) / 2.6) : 0;
    S.def.items(S, t, kk, push, c);
    items.sort((p, q) => p.y - q.y);
    items.forEach(it => it.f(c));
    if (S.def.over) S.def.over(S, c, t, kk);
    if (S.fin && S.fin.good) {       // กระดาษสีโปรยตอนจบการอบรมที่ผ่าน
      const dt = t - S.fin.t, cols = ['#ff5d7a', '#ffd23f', '#37d67a', '#4dabf7', '#b197fc', '#ff9f43'];
      if (dt < 5) for (let i = 0; i < 46; i++) {
        const sp = 70 + (i % 5) * 26, x = (i * 97.3) % W + Math.sin(dt * 2 + i) * 14, y = -20 - ((i * 37) % 220) + dt * sp;
        if (y < -10 || y > H) continue;
        c.save(); c.translate(x, y); c.rotate(dt * 4 + i); c.fillStyle = cols[i % cols.length]; c.globalAlpha = Math.min(1, (5 - dt) * 0.8); c.fillRect(-4, -2.5, 8, 5); c.restore();
      }
    }
    // แสงและเงาขอบภาพ
    const v = c.createRadialGradient(W / 2, H * 0.46, H * 0.35, W / 2, H * 0.5, H * 0.95);
    v.addColorStop(0, 'rgba(20,10,0,0)'); v.addColorStop(1, 'rgba(20,10,0,.3)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    // ป้ายหัวข้อและคำบรรยาย
    if (S.title) {
      c.font = '700 17px ' + FONT; const w = c.measureText(S.title).width + 24;
      rr(c, 10, 10, w, 30, 15); c.fillStyle = 'rgba(14,30,44,.72)'; c.fill(); txt(c, S.title, 22, 26, 17, '#ffffff', 'left');
    }
    const cap = S.cap || (S.demo && S.def.caption ? S.def.caption(S, kk) : '');
    if (cap) {
      const z = fitSize(c, cap, W - 56, 21), w = Math.min(W - 20, c.measureText(cap).width + 34);
      rr(c, (W - w) / 2, H - 46, w, 36, 18); c.fillStyle = 'rgba(14,30,44,.8)'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.2; c.stroke();
      txt(c, cap, W / 2, H - 27, z, '#ffffff');
    }
  }
  function frame(now) {
    const S = cur;
    if (!S) return;
    if (!S.cv.isConnected || !S.cv.clientWidth) { S.raf = 0; return; }
    S.raf = requestAnimationFrame(frame);
    if (now - S.last < 30) return;
    S.last = now;
    const d = dims(S);
    if (S.cv.width !== d.w) { S.cv.width = d.w; S.cv.height = d.h; }
    drawFrame(S, S.c, d.k, nowT(S));
  }
  // เปิดฉาก: สร้างใหม่ถ้าชนิดฉากเปลี่ยน แล้วใส่ canvas ลงในช่องที่กำหนด
  function open(kind, o, slot) {
    if (!cur || cur.kind !== kind || (o && o.fresh)) {
      stop();
      cur = create(kind, o);
      if (!cur) return null;
      cur.t0 = performance.now();
    }
    attach(slot);
    return cur.ctl;
  }
  function attach(slot) {
    if (!cur || !slot) return;
    slot.appendChild(cur.cv);
    if (!cur.raf) cur.raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (cur) { if (cur.raf) cancelAnimationFrame(cur.raf); cur.raf = 0; if (cur.cv.parentNode) cur.cv.parentNode.removeChild(cur.cv); }
    cur = null;
  }
  function register(kind, def) { KINDS[kind] = def; }

  root.Scene = { W, H, register, open, attach, stop, create, drawFrame, P, KINDS, mkActor, drawActor, bgIndoor, windowView, plant, txt, bubble, emote, poseOf, headOf, ease, clamp, linear, oval, fe, ol, spr, sprList, cut, fitSize, trainerLook, current: () => cur };
})(window);
