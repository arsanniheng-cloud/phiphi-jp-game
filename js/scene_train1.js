// ============================================================================
// scene_train1.js — ฉากอบรม (1/2): ดับเพลิง · CPR · ตัดแยกพลังงาน (LOTO) · ทำงานบนที่สูง
// แต่ละคำถามมี "ฉากสาธิต" (demo) ก่อนตอบแสดงสถานการณ์ หลังตอบจะสาธิตวิธีที่ถูกต้องให้เห็น
// ============================================================================
(function (root) {
  'use strict';
  const Sc = root.Scene, P = Sc.P, A = root.Art;
  const rr = A.rr, shade = A.shade, ease = Sc.ease, clamp = Sc.clamp;
  const W = Sc.W, H = Sc.H, TAU = Math.PI * 2;
  const T = Sc.T = {};

  // ผู้เข้าอบรมยืนเป็นครึ่งวงกลม เว้นตรงกลางไว้ให้ของสาธิตและวิทยากร
  T.slots = [
    [86, 272, 2.2, 0], [150, 268, 2.2, 0], [572, 272, 2.2, 0], [508, 268, 2.2, 0],
    [48, 326, 2.6, 2], [598, 326, 2.6, 1], [118, 330, 2.6, 2], [536, 330, 2.6, 1],
    [208, 266, 2.1, 0], [462, 266, 2.1, 0]
  ];

  // ฉากกลางแจ้ง: ท้องฟ้า ทะเล เกาะหินปูน ชายหาด และพื้นลาน
  T.bgOutdoor = function (c, th) {
    th = Object.assign({ hz: 140, gy: 198, ground: ['#d7d9d6', '#bfc4c2'], lines: true }, th);
    const { hz, gy } = th;
    c.fillStyle = P.linear(c, 0, 0, 0, hz + 8, ['#6fc3fb', '#cfeeff']); c.fillRect(0, 0, W, hz + 8);
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (const [x, y, r] of [[90, 40, 1], [250, 26, 0.8], [470, 48, 1.1], [590, 24, 0.7]]) { P.oval(c, x, y, 40 * r, 12 * r); c.fill(); P.oval(c, x + 26 * r, y + 6, 30 * r, 10 * r); c.fill(); P.oval(c, x - 24 * r, y + 7, 26 * r, 9 * r); c.fill(); }
    c.fillStyle = P.linear(c, 0, hz, 0, gy, ['#2cc7d8', '#0c92bf']); c.fillRect(0, hz, W, gy - hz);
    c.fillStyle = '#8fa59a'; P.oval(c, 118, hz + 4, 52, 26); c.fill(); c.fillStyle = '#5d9a62'; P.oval(c, 118, hz - 8, 44, 14); c.fill();
    c.fillStyle = '#9aa89f'; P.oval(c, 540, hz + 3, 40, 20); c.fill(); c.fillStyle = '#5d9a62'; P.oval(c, 540, hz - 6, 34, 11); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const x = 20 + i * 72, y = hz + 14 + (i % 3) * 12; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 12, y - 4, x + 26, y); c.stroke(); }
    P.spr(c, 'boat_longtail_blue', 330, hz + 34, 0.6);
    c.fillStyle = '#f1deb0'; c.fillRect(0, gy - 10, W, 16);
    c.fillStyle = P.linear(c, 0, gy + 4, 0, H, th.ground); c.fillRect(0, gy + 4, W, H - gy - 4);
    if (th.lines) {
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2;
      for (let x = -200; x < W + 200; x += 96) { c.beginPath(); c.moveTo(320 + (x - 320) * 0.5, gy + 4); c.lineTo(x, H); c.stroke(); }
    }
    c.fillStyle = P.linear(c, 0, gy + 4, 0, gy + 30, ['rgba(0,0,0,.16)', 'rgba(0,0,0,0)']); c.fillRect(0, gy + 4, W, 26);
    const palms = P.sprList ? P.sprList('tree_palm_') : Sc.sprList('tree_palm_');
    if (palms.length) {
      const a = palms[1 % palms.length], b = palms[2 % palms.length];
      c.drawImage(a.img, -22, gy - a.sh * 0.95 + 20, a.sw * 0.95, a.sh * 0.95);
      c.drawImage(b.img, W - b.sw * 0.95 + 14, gy - b.sh * 0.95 + 24, b.sw * 0.95, b.sh * 0.95);
    }
  };
  T.banner = function (c, text, x0, x1, y) {
    c.strokeStyle = '#6b4a2b'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y - 4); c.lineTo(x0, y + 150); c.moveTo(x1, y - 4); c.lineTo(x1, y + 150); c.stroke();
    rr(c, x0, y, x1 - x0, 38, 6); P.fe(c, '#d6322e', 1.6);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x0 + 4, y + 4, x1 - x0 - 8, 5);
    P.txt(c, text, (x0 + x1) / 2, y + 20, P.fitSize(c, text, x1 - x0 - 24, 21, '800'), '#ffffff', 'center', '800');
  };

  // ตัวฉากอบรมมาตรฐาน: วิทยากร (ผู้เล่น) + ผู้เข้าอบรมตามช่องที่กำหนด
  T.make = function (def) {
    return Object.assign({
      setup(S) {
        const d = S.def;
        S.tr = Sc.mkActor(S.trainer, d.trainer[0], d.trainer[1], d.trainer[2], d.trainer[3] || 0, { react: false, state: 'teach', hold: d.hold, holdArm: d.holdArm });
        S.actors.push(S.tr);
        S.aud = [];
        const slots = d.slots || T.slots;
        S.people.slice(0, slots.length).forEach((p, i) => {
          const a = Sc.mkActor(p.L, slots[i][0], slots[i][1], slots[i][2], slots[i][3] || 0, Object.assign({ name: p.name }, slots[i][4]));
          S.aud.push(a); S.actors.push(a);
        });
        if (d.init) d.init(S);
      },
      trainerState(S, t) {
        const tr = S.tr;
        if (S.fin) { tr.state = S.fin.good ? 'cheer' : 'teach'; return; }
        if (S.res) { const dt = t - S.resT; tr.state = S.res === 'right' ? (dt < 1.7 ? 'cheer' : 'teach') : (dt < 2.2 ? 'sorry' : 'teach'); }
        else tr.state = S.def.holdArm ? 'hold' : 'teach';
      }
    }, def, {
      items(S, t, k, push, c) { S.def.trainerState(S, t); def.items(S, t, k, push, c); }
    });
  };
  // ขอบเขตวัตถุสาธิต (ลูกศรชี้)
  T.arrow = function (c, x, y, dir, col, t) {
    const b = Math.sin(t * 6) * 4;
    c.save(); c.translate(x, y); c.rotate(dir);
    c.beginPath(); c.moveTo(0, b); c.lineTo(11, b - 15); c.lineTo(4, b - 15); c.lineTo(4, b - 32); c.lineTo(-4, b - 32); c.lineTo(-4, b - 15); c.lineTo(-11, b - 15); c.closePath();
    P.fe(c, col || '#2fbf71', 1.5); c.restore();
  };
  T.tick = function (c, x, y, r, ok) {
    P.oval(c, x, y, r, r); P.fe(c, ok ? '#2fbf71' : '#ff5a5f', 1.5);
    c.strokeStyle = '#fff'; c.lineWidth = r * 0.28; c.lineCap = 'round'; c.beginPath();
    if (ok) { c.moveTo(x - r * 0.45, y); c.lineTo(x - r * 0.1, y + r * 0.38); c.lineTo(x + r * 0.5, y - r * 0.36); }
    else { c.moveTo(x - r * 0.4, y - r * 0.4); c.lineTo(x + r * 0.4, y + r * 0.4); c.moveTo(x + r * 0.4, y - r * 0.4); c.lineTo(x - r * 0.4, y + r * 0.4); }
    c.stroke();
  };
  // ห้องฝึกในร่ม (ผนังและพื้นเปลี่ยนสีตามหัวข้อ)
  T.sign = function (c, x, y, w, h, bg, text, size, col) {
    rr(c, x, y, w, h, 5); P.fe(c, bg, 1.6); P.txt(c, text, x + w / 2, y + h / 2 + 1, size || 16, col || '#fff', 'center', '800');
  };

  // ------------------------------------------------------------------ ดับเพลิง
  function triangleBoard(c, x, y, t, k) {
    rr(c, x - 84, y - 14, 168, 148, 8); P.fe(c, '#fbfbf7', 1.8);
    c.beginPath(); c.moveTo(x, y + 8); c.lineTo(x + 56, y + 92); c.lineTo(x - 56, y + 92); c.closePath();
    c.fillStyle = 'rgba(255,196,60,.28)'; c.fill(); c.strokeStyle = '#e8590c'; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke();
    const pts = [[x, y + 8, '#e8590c', 'ความร้อน', 'heat'], [x + 56, y + 92, '#8d5a2b', 'เชื้อเพลิง', 'fuel'], [x - 56, y + 92, '#1c7ed6', 'ออกซิเจน', 'oxy']];
    pts.forEach((p, i) => {
      const a = ease((k - i * 0.18) / 0.4), px = p[0], py = p[1];
      P.oval(c, px, py, 14, 14); P.fe(c, a > 0.5 ? p[2] : '#cfd6dc', 1.5);
      if (a < 0.5) P.txt(c, '?', px, py + 1, 20, '#7b8794');
      else if (p[4] === 'fuel') {      // ท่อนไม้ (วาดเอง ไม่ใช้อีโมจิที่บางเครื่องไม่รองรับ)
        c.fillStyle = '#e9d2a6'; rr(c, px - 8, py - 4, 16, 8, 3); c.fill(); c.strokeStyle = '#5a3b1a'; c.lineWidth = 1.4; c.stroke();
        c.beginPath(); c.arc(px + 8, py, 3, 0, TAU); c.stroke();
      } else P.txt(c, p[4] === 'heat' ? '🔥' : '💨', px, py + 1, 15, '#fff');
      if (a > 0.2) P.txt(c, p[3], i === 0 ? px + 50 : px, i === 0 ? py : py + 26, 15, p[2]);
    });
  }
  function lpgTank(c, x, y, s, t, leak, valve) {
    c.save(); c.translate(x, y); c.scale(s, s);
    P.oval(c, 0, 2, 22, 7); c.fillStyle = 'rgba(0,0,0,.22)'; c.fill();
    rr(c, -17, -70, 34, 70, 14); P.fe(c, '#d94841', 1.5);
    c.fillStyle = 'rgba(255,255,255,.25)'; rr(c, -12, -64, 5, 58, 3); c.fill();
    rr(c, -17, -42, 34, 14, 1); P.fe(c, '#f6f1e4', 1.2); P.txt(c, 'LPG', 0, -35, 11, '#b52b25', 'center', '800');
    rr(c, -7, -86, 14, 18, 3); P.fe(c, '#c9a227', 1.3);
    c.save(); c.translate(0, -88); c.rotate(valve * Math.PI * 1.5); rr(c, -14, -2.5, 28, 5, 2.5); P.fe(c, '#e0a030', 1.2); c.restore();
    c.restore();
    if (leak > 0.02) {
      for (let i = 0; i < 7; i++) {
        const u = ((t * 0.8 + i / 7) % 1);
        c.fillStyle = 'rgba(255,238,150,' + (0.4 * (1 - u) * leak).toFixed(3) + ')';
        P.oval(c, x + 8 * s + u * 46 * s, y - 92 * s - u * 22 * s + Math.sin(t * 4 + i) * 3, (5 + u * 14) * s, (4 + u * 10) * s); c.fill();
      }
    }
  }
  function noSwitch(c, x, y, t) {
    rr(c, x - 15, y - 20, 30, 40, 5); P.fe(c, '#f5f5f0', 1.4);
    rr(c, x - 6, y - 10, 12, 20, 3); P.fe(c, '#cfd6dc', 1.1); rr(c, x - 4, y - 8, 8, 9, 2); P.fe(c, '#6b7683', 1);
    P.oval(c, x, y, 28, 28); c.strokeStyle = '#ff3b3b'; c.lineWidth = 5; c.stroke();
    c.beginPath(); c.moveTo(x - 20, y + 20); c.lineTo(x + 20, y - 20); c.stroke();
  }
  Sc.register('FIRE', T.make({
    title: '🧯 อบรมดับเพลิงขั้นต้น',
    trainer: [236, 354, 3.1, 0], holdArm: [1.25, 0.45],
    slots: [[86, 272, 2.2, 0], [150, 268, 2.2, 0], [572, 272, 2.2, 0], [514, 268, 2.2, 0], [48, 328, 2.6, 2], [598, 328, 2.6, 1], [120, 332, 2.6, 2], [544, 332, 2.6, 1], [205, 264, 2.1, 0], [30, 278, 2.0, 0]],
    bg(c) { T.bgOutdoor(c, {}); T.banner(c, 'อบรมการดับเพลิงขั้นต้น', 116, 524, 52); },
    caption(S, k) {
      const m = { triangle: 'ไฟต้องมี 3 อย่าง: เชื้อเพลิง ความร้อน ออกซิเจน', pull: 'P — Pull ดึงสลักนิรภัยก่อน', aim: 'A — Aim เล็งที่ฐานของไฟ', lpg: 'ปิดวาล์ว เปิดช่องระบายอากาศ ห้ามสร้างประกายไฟ' }[S.demo];
      return S.res && m ? m : (S.demo === 'lpg' ? 'ก๊าซ LPG รั่ว! ทำอย่างไรดี' : S.demo === 'pull' ? 'เตรียมใช้ถังดับเพลิง' : S.demo === 'aim' ? 'ไฟกำลังลุก เล็งตรงไหนดี' : S.demo === 'triangle' ? 'ทำไมไฟถึงลุกไหม้ได้' : '');
    },
    items(S, t, k, push, c) {
      const d = S.demo, tr = S.tr;
      let fire = d === 'lpg' ? 0 : 1;
      if (d === 'aim') fire = k < 0.35 ? 1 : 1 - ease((k - 0.35) / 0.55);
      if (d === 'aim' && S.res && k > 0.95) fire = 0;
      const ex = tr.x + 60, ey = tr.y - 2, lifted = (d === 'aim' || d === 'pull') && S.res;
      if (d !== 'lpg') push(326, () => { P.firepan(c, 410, 328, 1.35); P.smoke(c, 410, 320, 1.2, t, fire); P.flame(c, 410, 324, 1.4, t, fire); });
      if (d === 'triangle') push(100, () => triangleBoard(c, 330, 108, t, S.res ? k : 0));
      if (d === 'lpg') {
        const valve = S.res ? ease(k / 0.5) : 0, leak = S.res ? 1 - ease((k - 0.45) / 0.3) : 1;
        push(300, () => { lpgTank(c, 420, 336, 1.4, t, leak, valve); });
        if (S.res && k > 0.5) push(301, () => { noSwitch(c, 520, 276, t); T.tick(c, 560, 252, 14, true); });
      } else {
        const pinK = d === 'pull' && S.res ? ease(k / 0.5) : 0;
        push(356, () => {
          c.save(); c.translate(ex, ey - (lifted ? 36 : 0)); if (lifted) c.rotate(-0.38);
          P.extinguisher(c, 0, 0, 1.7, { pin: pinK > 0.98 ? 0 : 1 });
          if (pinK > 0 && pinK <= 0.98) {                       // สลักหลุดออกและลอยไปด้านข้าง
            c.save(); c.translate(-20 * 1.7 - pinK * 30, -53 * 1.7 + pinK * 14); c.rotate(pinK * 1.2); c.scale(1.7, 1.7);
            c.strokeStyle = '#e8c02a'; c.lineWidth = 1.8; c.beginPath(); c.arc(0, 0, 3.8, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(3, -2); c.lineTo(9, -3); c.stroke(); c.restore();
          }
          c.restore();
        });
        if (d === 'pull' && S.res && k > 0.5) push(357, () => { T.arrow(c, ex - 44, ey - 128, Math.PI + 0.3, '#2fbf71', t); T.tick(c, ex - 66, ey - 160, 12, true); });
        if (d === 'aim' && S.res) {
          const spray = k > 0.3 && k < 0.98 ? 1 : 0;
          push(358, () => {
            if (spray) P.spray(c, ex + 14, ey - 80, 396, 318, t, 1);
            T.tick(c, 410, 292 - Math.sin(t * 5) * 3 - fire * 20 - 18, 13, true);
            if (k < 0.35) { T.tick(c, 410, 244, 12, false); }
          });
        }
      }
    }
  }));

  // ------------------------------------------------------------------ CPR
  function mannequin(c, x, y, s, t, press) {
    c.save(); c.translate(x, y); c.scale(s, s);
    rr(c, -92, -4, 184, 24, 10); P.fe(c, '#3b82d6', 1.6);
    rr(c, 24, -16, 58, 16, 7); P.fe(c, '#556070', 1.4);
    const sq = 1 - press * 0.16;
    c.save(); c.translate(-2, -14); c.scale(1, sq);
    rr(c, -34, -16, 66, 24, 10); P.fe(c, '#38bdf8', 1.5);
    c.fillStyle = 'rgba(255,255,255,.3)'; rr(c, -26, -12, 48, 5, 2); c.fill();
    c.restore();
    P.oval(c, -50, -20, 15, 12.5); P.fe(c, '#f2cba6', 1.4);
    c.fillStyle = '#2a1a16'; P.oval(c, -54, -22, 1.6, 2); c.fill(); P.oval(c, -46, -22, 1.6, 2); c.fill();
    c.strokeStyle = '#a24a42'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-52, -14); c.lineTo(-48, -14); c.stroke();
    c.restore();
  }
  function aed(c, x, y, s, t, glow) {
    c.save(); c.translate(x, y); c.scale(s, s);
    P.oval(c, 0, 2, 26, 6); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
    rr(c, -24, -34, 48, 34, 7); P.fe(c, '#22b565', 1.5);
    rr(c, -14, -44, 28, 12, 5); P.fe(c, '#1b8f50', 1.4);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -8); c.bezierCurveTo(-16, -18, -9, -30, 0, -23); c.bezierCurveTo(9, -30, 16, -18, 0, -8); c.fill();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(2, -26); c.lineTo(-5, -15); c.lineTo(0, -15); c.lineTo(-2, -7); c.lineTo(6, -19); c.lineTo(1, -19); c.closePath(); c.fill();
    if (glow) { c.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.sin(t * 8) * 0.25).toFixed(2) + ')'; c.lineWidth = 4; rr(c, -28, -38, 56, 42, 9); c.stroke(); }
    c.restore();
  }
  function phone(c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    rr(c, -14, -50, 28, 50, 6); P.fe(c, '#1f2937', 1.5);
    rr(c, -11, -45, 22, 36, 3); c.fillStyle = '#9ad0ff'; c.fill();
    P.txt(c, '1669', 0, -33, 11, '#103a63', 'center', '800');
    P.oval(c, 0, -16, 5, 5); c.fillStyle = '#2fbf71'; c.fill();
    c.strokeStyle = 'rgba(47,191,113,' + (0.8 - ((t * 1.5) % 1) * 0.8).toFixed(2) + ')'; c.lineWidth = 3; P.oval(c, 0, -26, 18 + ((t * 1.5) % 1) * 18, 18 + ((t * 1.5) % 1) * 18); c.stroke();
    c.restore();
  }
  const CPR_BG = (c) => {
    P.bgIndoor(c, { wall: ['#e7f0f6', '#d2e3ee'], wain: '#6f98b1', floor: ['#d8b27a', '#bc925a'], hz: 244 });
    rr(c, 40, 40, 170, 104, 6); P.fe(c, '#ffffff', 1.8);
    P.txt(c, 'ห่วงโซ่การรอดชีวิต', 125, 58, 15, '#1f5fa8');
    ['📞', '❤️', '⚡', '🚑'].forEach((e, i) => { P.oval(c, 66 + i * 36, 100, 15, 15); P.fe(c, ['#fde2e2', '#ffe4ec', '#fff3c4', '#dbeafe'][i], 1.2); P.txt(c, e, 66 + i * 36, 101, 16, '#000'); if (i) { c.fillStyle = '#8895a3'; c.fillRect(66 + i * 36 - 21, 99, 5, 2); } });
    rr(c, 470, 50, 130, 100, 6); P.fe(c, '#f6f6f1', 1.8); rr(c, 480, 60, 110, 80, 4); P.fe(c, '#22b565', 1.3);
    P.txt(c, 'AED', 535, 100, 34, '#ffffff', 'center', '800');
    c.fillStyle = 'rgba(0,0,0,.08)'; P.oval(c, 330, 352, 250, 42); c.fill();
  };
  Sc.register('CPR', T.make({
    title: '❤️ อบรมปฐมพยาบาลและ CPR',
    trainer: [468, 354, 3.0, 1], hold: null,
    slots: [[86, 276, 2.2, 0], [150, 272, 2.2, 0], [212, 270, 2.2, 0], [560, 280, 2.2, 0], [40, 332, 2.6, 2], [120, 340, 2.6, 2], [596, 332, 2.6, 1], [270, 268, 2.1, 0], [520, 270, 2.1, 0], [600, 276, 2.1, 0]],
    bg: CPR_BG,
    init(S) { S.tr.lean = 0; },
    caption(S, k) {
      const m = { ratio: 'กดหน้าอก 30 ครั้ง สลับช่วยหายใจ 2 ครั้ง', rate: 'กดเร็ว 100–120 ครั้ง/นาที ลึก 5–6 ซม.', call: 'โทร 1669 · เริ่ม CPR ทันที · ขอเครื่อง AED' }[S.demo];
      return S.res && m ? m : (S.demo === 'ratio' ? 'กดหน้าอกต่อการช่วยหายใจ เท่าไร' : S.demo === 'rate' ? 'ควรกดหน้าอกเร็วแค่ไหน' : S.demo === 'call' ? 'พบคนหมดสติ ไม่หายใจ ทำอะไรก่อน' : '');
    },
    items(S, t, k, push, c) {
      const d = S.demo, tr = S.tr;
      const run = S.res && (d === 'ratio' || d === 'rate') ? 1 : 0;
      const beat = run ? Math.abs(Math.sin(t * Math.PI * 1.85)) : 0;
      tr.lean = run ? -0.42 + beat * 0.06 : -0.1; tr.bobF = () => run ? -beat * 2.2 : 0;
      tr.state = run ? 'hold' : tr.state;
      tr.holdArm = [1.2, 0.05];
      push(330, () => { mannequin(c, 330, 346, 1.55, t, run ? beat : 0); });
      push(331, () => {
        if (d === 'ratio' && S.res) {
          const n = Math.floor((t - S.resT) * 3.7) % 32, rest = n > 29;
          P.txt(c, rest ? 'ช่วยหายใจ 2 ครั้ง' : String(Math.min(30, n + 1)) + ' / 30', 330, 258, 26, rest ? '#7cc4ff' : '#ffffff');
        }
        if (d === 'rate' && S.res) {
          P.oval(c, 330, 252, 18 + beat * 5, 18 + beat * 5); P.fe(c, '#ff5d7a', 1.6); P.txt(c, '❤', 330, 253, 20, '#fff');
          P.txt(c, '100–120/นาที', 330, 286, 20, '#ffffff');
        }
      });
      if (d === 'call') {
        push(332, () => { phone(c, 128, 354, 1.25, t); aed(c, 238, 352, 1.35, t, S.res && k > 0.4); });
        if (S.res && k > 0.5) push(333, () => T.tick(c, 188, 262, 13, true));
      }
    }
  }));

  // ------------------------------------------------------------------ LOTO
  function breaker(c, x, y, s, t, st) {
    c.save(); c.translate(x, y); c.scale(s, s);
    rr(c, -46, -124, 92, 124, 6); P.fe(c, '#8b97a3', 1.7);
    rr(c, -38, -116, 76, 100, 4); P.fe(c, '#a8b3be', 1.3);
    for (let i = 0; i < 6; i++) {
      const bx = -26 + (i % 3) * 26, by = -102 + Math.floor(i / 3) * 40;
      rr(c, bx - 9, by, 18, 30, 3); P.fe(c, '#e9edf1', 1.2);
      rr(c, bx - 5, by + (st.off ? 15 : 3), 10, 12, 2); P.fe(c, st.off ? '#ff5a5f' : '#2fbf71', 1.1);
    }
    P.txt(c, '⚡', 0, -9, 14, '#ffd23f');
    c.restore();
  }
  function padlock(c, x, y, s, col, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.strokeStyle = '#9aa3ad'; c.lineWidth = 3.4; c.beginPath(); c.arc(0, -7, 6, Math.PI, TAU); c.stroke();
    rr(c, -9, -8, 18, 15, 3); P.fe(c, col, 1.3);
    c.fillStyle = 'rgba(0,0,0,.45)'; P.oval(c, 0, -1.5, 2, 2); c.fill(); c.fillRect(-0.8, -1, 1.6, 5);
    c.restore();
  }
  function dangerTag(c, x, y, s, name) {
    c.save(); c.translate(x, y); c.scale(s, s); c.rotate(0.06);
    c.strokeStyle = '#6b7683'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -2); c.lineTo(0, 4); c.stroke();
    rr(c, -13, 4, 26, 34, 3); P.fe(c, '#fff4f2', 1.2); c.fillStyle = '#d6322e'; c.fillRect(-13, 4, 26, 11);
    P.txt(c, 'DANGER', 0, 9.8, 8.5, '#fff', 'center', '800');
    if (name) P.txt(c, name, 0, 27, 9, '#2b2b30', 'center', '700');
    c.restore();
  }
  function meter(c, x, y, s, t, show) {
    c.save(); c.translate(x, y); c.scale(s, s);
    rr(c, -22, -44, 44, 44, 6); P.fe(c, '#f2c21d', 1.5);
    rr(c, -16, -38, 32, 16, 3); P.fe(c, '#b8e0a8', 1.1); P.txt(c, show ? '0 V' : '--', 0, -30, 13, '#1d3a1d', 'center', '800');
    P.oval(c, 0, -10, 8, 8); P.fe(c, '#e9edf1', 1.2);
    c.strokeStyle = '#d6322e'; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, -4); c.bezierCurveTo(-40, 0, -50, -30, -70, -50); c.stroke();
    c.strokeStyle = '#1b1b1f'; c.beginPath(); c.moveTo(14, -4); c.bezierCurveTo(40, 2, 50, -30, 70, -52); c.stroke();
    c.restore();
  }
  Sc.register('LOTO', T.make({
    title: '🔒 อบรมการตัดแยกพลังงาน (LOTO)',
    trainer: [196, 354, 3.1, 0], holdArm: [1.9, 0.3],
    slots: [[86, 288, 2.3, 0], [140, 282, 2.2, 0], [520, 284, 2.2, 0], [580, 290, 2.3, 0], [46, 336, 2.6, 2], [600, 336, 2.6, 1], [430, 276, 2.1, 0], [560, 334, 2.6, 1], [100, 340, 2.6, 2], [380, 272, 2.1, 0]],
    bg(c) {
      P.bgIndoor(c, { wall: ['#e3e8ec', '#cdd6dd'], wain: '#58748a', floor: ['#a3abb2', '#8a939b'], hz: 250, tile: true });
      c.strokeStyle = '#98a4af'; c.lineWidth = 9; c.beginPath(); c.moveTo(0, 46); c.lineTo(640, 46); c.moveTo(0, 74); c.lineTo(640, 74); c.stroke();
      c.strokeStyle = '#c2ccd4'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 44); c.lineTo(640, 44); c.stroke();
      for (const x of [90, 240, 420, 580]) { rr(c, x - 7, 38, 14, 44, 3); P.fe(c, '#c2432f', 1.3); }
      T.sign(c, 60, 110, 116, 30, '#f2c21d', 'ห้องช่าง · ระวังไฟฟ้า', 14, '#3a2d00');
      c.fillStyle = '#f2c21d';
      for (let i = 0; i < 26; i++) { c.save(); c.beginPath(); c.rect(i * 26, 388, 26, 12); c.clip(); c.fillStyle = i % 2 ? '#f2c21d' : '#2b2b30'; c.fillRect(i * 26, 388, 26, 12); c.restore(); }
    },
    caption(S, k) {
      const m = { lockout: 'Lock Out / Tag Out — ล็อกและแขวนป้ายที่แหล่งพลังงาน', verify: 'ทดสอบยืนยันว่าไม่มีพลังงานเหลือก่อนลงมือ', keys: 'ช่างทุกคนล็อกด้วยกุญแจของตัวเองและเก็บไว้กับตัว' }[S.demo];
      return S.res && m ? m : (S.demo === 'lockout' ? 'ซ่อมเครื่องต้องทำอย่างไรไม่ให้ใครเปิดไฟ' : S.demo === 'verify' ? 'ล็อกแล้ว ก่อนลงมือซ่อมต้องทำอะไร' : S.demo === 'keys' ? 'กุญแจล็อกควรเป็นอย่างไร' : '');
    },
    items(S, t, k, push, c) {
      const d = S.demo, tr = S.tr;
      const locked = d === 'lockout' && S.res ? ease(k / 0.55) : (d === 'verify' || d === 'keys' ? 1 : 0);
      push(300, () => {
        breaker(c, 330, 318, 1.45, t, { off: locked > 0.5 || d === 'verify' || d === 'keys' });
        const hx = 330, hy = 190;
        if (d === 'keys') {
          const cols = ['#d6322e', '#1c7ed6', '#2b8a3e', '#e8590c'], names = ['ช่าง ก', 'ช่าง ข', 'ช่าง ค', 'ช่าง ง'];
          cols.forEach((cl, i) => { padlock(c, hx - 40 + i * 27, hy + (S.res ? 0 : -8 + (i % 2) * 4), 1.15, cl, t); if (S.res) dangerTag(c, hx - 40 + i * 27, hy + 8, 0.7, names[i]); });
        } else if (locked > 0.02) {
          const sl = (1 - ease(locked)) * 70;
          padlock(c, hx + sl, hy - sl * 0.4, 1.7, '#d6322e', t);
          if (locked > 0.8) dangerTag(c, hx + 6, hy + 12, 1.1, 'ห้ามเปิด');
        }
      });
      if (d === 'verify') push(340, () => { meter(c, 470, 350, 1.6, t, S.res && k > 0.3); if (S.res && k > 0.45) T.tick(c, 470, 238, 14, true); });
      if (d === 'lockout' && S.res && k > 0.75) push(341, () => T.tick(c, 400, 160, 14, true));
    }
  }));

  // ------------------------------------------------------------------ ทำงานบนที่สูง
  function scaffold(c, x, y, w, h) {
    c.strokeStyle = '#7e8c99'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + h); c.moveTo(x + w, y); c.lineTo(x + w, y + h); c.stroke();
    c.lineWidth = 3; c.beginPath();
    for (let yy = y + 30; yy < y + h; yy += 56) { c.moveTo(x, yy); c.lineTo(x + w, yy + 56); c.moveTo(x + w, yy); c.lineTo(x, yy + 56); }
    c.stroke();
    rr(c, x - 12, y - 8, w + 24, 10, 3); P.fe(c, '#c99a5b', 1.5);
    c.strokeStyle = '#d6322e'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 10, y - 46); c.lineTo(x - 10, y - 8); c.moveTo(x + w + 10, y - 46); c.lineTo(x + w + 10, y - 8); c.moveTo(x - 10, y - 44); c.lineTo(x + w + 10, y - 44); c.moveTo(x - 10, y - 26); c.lineTo(x + w + 10, y - 26); c.stroke();
  }
  function cone(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    rr(c, -13, -4, 26, 6, 2); P.fe(c, '#2b2b30', 1.2);
    c.beginPath(); c.moveTo(-9, -4); c.lineTo(-3, -34); c.lineTo(3, -34); c.lineTo(9, -4); c.closePath(); P.fe(c, '#ff7a1a', 1.3);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-6.4, -15); c.lineTo(6.4, -15); c.lineTo(5.2, -21); c.lineTo(-5.2, -21); c.closePath(); c.fill();
    c.restore();
  }
  function tape(c, x0, x1, y) {
    c.save(); c.beginPath(); c.rect(x0, y - 4, x1 - x0, 8); c.clip();
    for (let x = x0 - 8; x < x1; x += 14) { c.fillStyle = ((x - x0) / 14 | 0) % 2 ? '#2b2b30' : '#ffd23f'; c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x + 8, y - 4); c.lineTo(x + 22, y - 4); c.lineTo(x + 14, y + 4); c.closePath(); c.fill(); }
    c.restore();
  }
  Sc.register('HEIGHT', T.make({
    title: '🏗️ อบรมการทำงานบนที่สูง',
    trainer: [196, 232, 2.5, 0], holdArm: [0.5, 0.2],
    slots: [[330, 300, 2.3, 0], [392, 296, 2.3, 0], [454, 300, 2.3, 0], [516, 296, 2.3, 0], [580, 302, 2.3, 0], [360, 346, 2.7, 0], [430, 350, 2.7, 0], [500, 346, 2.7, 0], [570, 352, 2.7, 0], [300, 350, 2.7, 0]],
    bg(c) {
      T.bgOutdoor(c, { hz: 120, gy: 190, ground: ['#cbbf9d', '#b9ab86'], lines: false });
      P.spr(c, 'b_hv2', 480, 262, 0.82);
    },
    init(S) { S.tr.y = 232; },
    caption(S, k) {
      const m = { height2m: 'ทำงานสูงตั้งแต่ 2 เมตรขึ้นไป ต้องมีมาตรการป้องกันการตก', anchor: 'เกี่ยวขอเกี่ยวที่จุดยึดแข็งแรง อยู่สูงกว่าระดับเอว', barrier: 'กั้นพื้นที่ด้านล่างและติดป้ายเตือนก่อนเสมอ' }[S.demo];
      return S.res && m ? m : (S.demo === 'height2m' ? 'งานสูงแค่ไหนต้องมีมาตรการป้องกันการตก' : S.demo === 'anchor' ? 'ขอเกี่ยวเข็มขัดนิรภัยควรเกี่ยวที่ไหน' : S.demo === 'barrier' ? 'จะตัดกิ่งไม้สูงเหนือทางเดิน ต้องทำอะไรก่อน' : '');
    },
    items(S, t, k, push, c) {
      const d = S.demo, tr = S.tr;
      push(100, () => scaffold(c, 140, 236, 112, 126));
      push(233, () => {   // สายรัดนิรภัย + สายช่วยชีวิตไปยังจุดยึด
        const hx = tr.x, hy = tr.y;
        c.strokeStyle = '#f2c21d'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(hx - 13, hy - 62); c.lineTo(hx + 13, hy - 36); c.moveTo(hx + 13, hy - 62); c.lineTo(hx - 13, hy - 36); c.stroke();
        c.beginPath(); c.moveTo(hx, hy - 50); c.lineTo(hx + 16, hy - 70); c.stroke();
      });
      if (d === 'anchor') {
        const a = S.res ? ease(k / 0.6) : 0;
        push(232, () => {
          const ax = 170, ay = 122;
          rr(c, ax - 6, ay - 4, 12, 36, 3); P.fe(c, '#7e8c99', 1.4); P.oval(c, ax, ay, 8, 8); c.strokeStyle = '#d6322e'; c.lineWidth = 3; c.stroke();
          c.strokeStyle = a > 0 ? '#1c7ed6' : 'rgba(28,126,214,.0)'; c.lineWidth = 3; c.beginPath(); c.moveTo(tr.x + 8, tr.y - 70); c.quadraticCurveTo(ax + 30, 150, ax + 2, ay + 4); c.stroke();
          if (S.res && k > 0.6) T.tick(c, ax + 36, ay - 6, 13, true);
          else if (!S.res) { T.tick(c, 320, 240, 12, false); P.txt(c, 'ราวกันตกที่ผุ?', 320, 270, 15, '#fff'); }
        });
      }
      if (d === 'height2m') push(240, () => {
        const a = S.res ? ease(k / 0.5) : 0.3;
        c.strokeStyle = 'rgba(255,255,255,' + (0.4 + a * 0.6) + ')'; c.setLineDash([6, 5]); c.lineWidth = 3;
        c.beginPath(); c.moveTo(60, 236); c.lineTo(400, 236); c.stroke(); c.setLineDash([]);
        c.strokeStyle = '#ffd23f'; c.lineWidth = 4; c.beginPath(); c.moveTo(70, 236); c.lineTo(70, 362); c.stroke();
        c.beginPath(); c.moveTo(60, 236); c.lineTo(80, 236); c.moveTo(60, 362); c.lineTo(80, 362); c.stroke();
        P.txt(c, S.res ? '≥ 2 ม.' : '? ม.', 106, 300, 24, '#ffd23f', 'center', '800');
      });
      if (d === 'barrier') {
        const a = S.res ? ease(k / 0.5) : 0;
        push(345, () => {
          if (a > 0.05) {
            c.globalAlpha = a; cone(c, 270, 372, 1.2); cone(c, 620, 372, 1.2); tape(c, 270, 620, 346 - (1 - a) * 12);
            c.globalAlpha = 1;
            T.sign(c, 410, 286, 124, 34, '#ffd23f', 'ระวังของตกจากที่สูง', 14, '#3a2d00');
          } else { P.txt(c, 'คนเดินผ่านด้านล่าง ⚠', 440, 290, 18, '#ffd23f'); }
        });
      }
    }
  }));
})(window);
