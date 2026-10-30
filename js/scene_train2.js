// ============================================================================
// scene_train2.js — ฉากอบรม (2/2): สารเคมี · ความปลอดภัยทางน้ำ · ยกเคลื่อนย้ายของ · ลื่นล้มและทางหนีไฟ
// ============================================================================
(function (root) {
  'use strict';
  const Sc = root.Scene, P = Sc.P, T = Sc.T, A = root.Art;
  const rr = A.rr, shade = A.shade, ease = Sc.ease;
  const W = Sc.W, H = Sc.H, TAU = Math.PI * 2;
  const lerp = (a, b, k) => a + (b - a) * k;

  // ------------------------------------------------------------------ ของประกอบ
  function bottle(c, x, y, s, col, label, tilt) {
    c.save(); c.translate(x, y); c.rotate(tilt || 0); c.scale(s, s);
    rr(c, -9, -30, 18, 30, 5); P.fe(c, col, 1.3);
    rr(c, -4, -40, 8, 11, 2); P.fe(c, '#2b2b30', 1.2);
    c.fillStyle = 'rgba(255,255,255,.88)'; rr(c, -9, -23, 18, 13, 1); c.fill(); P.ol(c, 0.9);
    if (label) P.txt(c, label, 0, -16.5, 8, '#1d2b36', 'center', '800');
    c.fillStyle = 'rgba(255,255,255,.3)'; rr(c, -6.5, -28, 3, 22, 1.5); c.fill();
    c.restore();
  }
  function ghs(c, x, y, s, icon) {
    c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
    rr(c, -17 * s, -17 * s, 34 * s, 34 * s, 3 * s); P.fe(c, '#ffffff', 1.5);
    c.strokeStyle = '#d6322e'; c.lineWidth = 4 * s; rr(c, -14.5 * s, -14.5 * s, 29 * s, 29 * s, 2 * s); c.stroke();
    c.rotate(-Math.PI / 4); P.txt(c, icon, 0, 1, 19 * s, '#000'); c.restore();
  }
  function cloud(c, x, y, s, t, col, k) {
    for (let i = 0; i < 7; i++) {
      const u = ((t * 0.5 + i / 7) % 1);
      c.fillStyle = col.replace('A', (0.55 * (1 - u) * k).toFixed(3));
      P.oval(c, x + Math.sin(t * 2 + i * 2.1) * 16 * s * u + (i - 3) * 6 * s, y - u * 70 * s, (11 + u * 18) * s, (9 + u * 14) * s); c.fill();
    }
  }
  function binder(c, x, y, s, open, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    if (!open) { rr(c, -22, -48, 44, 52, 4); P.fe(c, '#2f6fd0', 1.5); P.txt(c, 'SDS', 0, -22, 16, '#fff', 'center', '800'); rr(c, -16, -44, 4, 44, 2); c.fillStyle = 'rgba(255,255,255,.3)'; c.fill(); }
    else {
      rr(c, -52, -54, 50, 58, 3); P.fe(c, '#ffffff', 1.4); rr(c, 2, -54, 50, 58, 3); P.fe(c, '#ffffff', 1.4);
      c.fillStyle = '#2f6fd0'; c.fillRect(-52, -54, 50, 9); c.fillRect(2, -54, 50, 9);
      P.txt(c, 'อันตราย', -27, -49.5, 8, '#fff'); P.txt(c, 'การเก็บ · PPE', 27, -49.5, 8, '#fff');
      c.fillStyle = '#9aa7b4'; for (let i = 0; i < 5; i++) { c.fillRect(-46, -38 + i * 9, 38, 2.4); c.fillRect(8, -38 + i * 9, 38, 2.4); }
      c.fillStyle = 'rgba(255,214,60,' + (0.3 + 0.2 * Math.sin(t * 6)).toFixed(2) + ')'; c.fillRect(-46, -20, 38, 7);
    }
    c.restore();
  }
  function ringBuoy(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(0, 0, 17, i * Math.PI / 2, (i + 1) * Math.PI / 2); c.arc(0, 0, 8, (i + 1) * Math.PI / 2, i * Math.PI / 2, true); c.closePath(); P.fe(c, i % 2 ? '#ffffff' : '#e0342f', 1.3); }
    c.restore();
  }
  function flagPole(c, x, y, s, t, col) {
    c.save(); c.translate(x, y); c.scale(s, s);
    P.oval(c, 0, 0, 10, 3.5); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
    c.fillStyle = '#6b4a2b'; rr(c, -2.5, -96, 5, 96, 2); c.fill(); P.ol(c, 1);
    c.beginPath(); c.moveTo(2, -94);
    for (let i = 0; i <= 8; i++) c.lineTo(2 + i * 6, -94 + Math.sin(t * 6 - i * 0.8) * 3 * (i / 8) + i * 0.4);
    for (let i = 8; i >= 0; i--) c.lineTo(2 + i * 6, -68 + Math.sin(t * 6 - i * 0.8) * 3 * (i / 8) + i * 0.4);
    c.closePath(); P.fe(c, col, 1.4);
    c.restore();
  }
  function crate(c, x, y, s, col, tag) {
    c.save(); c.translate(x, y); c.scale(s, s);
    rr(c, -24, -36, 48, 36, 3); P.fe(c, col, 1.6);
    c.strokeStyle = shade(col, -0.25); c.lineWidth = 2.4; c.beginPath(); c.moveTo(-24, -24); c.lineTo(24, -24); c.moveTo(-24, -12); c.lineTo(24, -12); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-22, -34, 44, 5);
    if (tag) { rr(c, -15, -27, 30, 14, 2); P.fe(c, '#fff8d6', 1); P.txt(c, tag, 0, -20, 10, '#3a2d00', 'center', '800'); }
    c.restore();
  }
  function trolley(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.strokeStyle = '#4a5560'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-18, -4); c.lineTo(-18, -62); c.lineTo(-30, -66); c.moveTo(-18, -8); c.lineTo(26, -8); c.stroke();
    rr(c, -22, -12, 52, 6, 2); P.fe(c, '#e8590c', 1.3);
    P.oval(c, -4, 0, 9, 9); P.fe(c, '#2b2b30', 1.3); P.oval(c, -4, 0, 3, 3); c.fillStyle = '#9aa3ad'; c.fill();
    c.restore();
  }
  function puddle(c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    P.oval(c, 0, 0, 46, 13); c.fillStyle = 'rgba(70,160,225,.55)'; c.fill(); P.ol(c, 1.2);
    P.oval(c, 0, 0, 36, 9); c.fillStyle = 'rgba(160,215,255,.5)'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(-12 + Math.sin(t * 2) * 4, -1, 6, 3.6, 5.4); c.stroke();
    c.restore();
  }
  function wetSign(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    P.oval(c, 0, 1, 18, 5); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
    c.beginPath(); c.moveTo(-17, 0); c.lineTo(-9, -52); c.lineTo(9, -52); c.lineTo(17, 0); c.closePath(); P.fe(c, '#ffd23f', 1.6);
    c.fillStyle = '#26323d'; c.beginPath(); c.moveTo(-3, -42); c.lineTo(3, -42); c.lineTo(2, -24); c.lineTo(-2, -24); c.closePath(); c.fill(); P.oval(c, 0, -18, 2.4, 2.4); c.fill();
    P.txt(c, 'ระวังลื่น', 0, -8, 9, '#26323d', 'center', '800');
    c.restore();
  }
  function mop(c, x, y, s, ang) {
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
    c.strokeStyle = '#8a6a43'; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -70); c.stroke();
    c.beginPath(); c.moveTo(-12, 2); c.quadraticCurveTo(0, 14, 12, 2); c.lineTo(8, -4); c.lineTo(-8, -4); c.closePath(); P.fe(c, '#e9e3d3', 1.3);
    c.restore();
  }
  function exitDoor(c, x, y, s, open, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    rr(c, -34, -112, 68, 112, 4); P.fe(c, '#27a566', 1.8);
    rr(c, -26, -104, 52, 96, 3); P.fe(c, open ? '#fff6c8' : '#1f8a54', 1.3);
    if (open) { c.fillStyle = 'rgba(255,246,200,.5)'; c.beginPath(); c.moveTo(-26, -8); c.lineTo(26, -8); c.lineTo(52, 34); c.lineTo(-52, 34); c.closePath(); c.fill(); }
    rr(c, -24, -142, 48, 22, 4); P.fe(c, '#27a566', 1.5); P.txt(c, 'ทางออก', 0, -131, 13, '#fff', 'center', '800');
    P.oval(c, 17, -56, 3.5, 3.5); c.fillStyle = '#e8c02a'; c.fill();
    c.restore();
  }
  function jacket(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath(); c.moveTo(-14, 0); c.lineTo(-14, -30); c.quadraticCurveTo(-8, -38, -4, -34); c.lineTo(0, -28); c.lineTo(4, -34); c.quadraticCurveTo(8, -38, 14, -30); c.lineTo(14, 0); c.closePath(); P.fe(c, col, 1.4);
    c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(-14, -14, 28, 3);
    c.restore();
  }
  function resetPos(S) { S.actors.forEach(a => { if (a.bx === undefined) { a.bx = a.x; a.by = a.y; } a.x = a.bx; a.y = a.by; a.squat = 0; }); }

  // ------------------------------------------------------------------ ความปลอดภัยทั่วไป (หลักสูตร 6 ชั่วโมง) ห้องเรียนมีจอฉาย
  function helmetIcon(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath(); c.ellipse(0, 0, 17, 14, 0, Math.PI, TAU); c.closePath(); P.fe(c, col, 1.5);
    rr(c, -22, -1, 44, 7, 3.5); P.fe(c, shade(col, -0.14), 1.3);
    c.fillStyle = 'rgba(255,255,255,.5)'; rr(c, -3, -14, 6, 13, 2); c.fill();
    c.restore();
  }
  function gogglesIcon(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.strokeStyle = '#4a5560'; c.lineWidth = 3; c.beginPath(); c.moveTo(-26, 0); c.lineTo(26, 0); c.stroke();
    for (const dx of [-10, 10]) { P.oval(c, dx, 0, 10, 8); c.fillStyle = 'rgba(150,210,255,.8)'; c.fill(); P.ol(c, 1.6); }
    c.restore();
  }
  function gloveIcon(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    rr(c, -11, -4, 22, 20, 6); P.fe(c, '#f2c21d', 1.4);
    for (let i = 0; i < 4; i++) { rr(c, -11 + i * 6, -22 + (i === 1 || i === 2 ? -3 : 0), 5, 20, 2.5); P.fe(c, '#f2c21d', 1.2); }
    rr(c, -18, 2, 9, 5, 2.5); P.fe(c, '#f2c21d', 1.2);
    c.restore();
  }
  function bootIcon(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath(); c.moveTo(-9, -26); c.lineTo(7, -26); c.lineTo(7, -6); c.lineTo(20, -4); c.quadraticCurveTo(24, 0, 20, 5); c.lineTo(-9, 5); c.closePath(); P.fe(c, '#8a5a2b', 1.5);
    rr(c, -10, 2, 33, 5, 2); P.fe(c, '#2b2b30', 1.2);
    c.restore();
  }
  function signIcon(c, kind, x, y, s, t, hot) {
    c.save(); c.translate(x, y); c.scale(s, s);
    if (hot) { c.strokeStyle = 'rgba(255,214,60,' + (0.5 + 0.4 * Math.sin(t * 6)).toFixed(2) + ')'; c.lineWidth = 5; P.oval(c, 0, 0, 30, 30); c.stroke(); }
    if (kind === 'ban') { P.oval(c, 0, 0, 22, 22); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#d6322e'; c.lineWidth = 6; c.stroke(); c.beginPath(); c.moveTo(-15, 15); c.lineTo(15, -15); c.stroke(); P.txt(c, '✋', 0, 1, 18, '#000'); }
    else if (kind === 'must') { P.oval(c, 0, 0, 23, 23); P.fe(c, '#1c6fd1', 1.6); c.save(); c.translate(0, 4); c.beginPath(); c.ellipse(0, 0, 11, 9, 0, Math.PI, TAU); c.closePath(); c.fillStyle = '#fff'; c.fill(); rr(c, -14, 0, 28, 4, 2); c.fill(); c.restore(); }
    else if (kind === 'warn') { c.beginPath(); c.moveTo(0, -24); c.lineTo(25, 20); c.lineTo(-25, 20); c.closePath(); P.fe(c, '#ffd23f', 1.8); P.txt(c, '!', 0, 8, 26, '#26323d', 'center', '800'); }
    else { rr(c, -22, -22, 44, 44, 6); P.fe(c, '#27a566', 1.6); c.fillStyle = '#fff'; c.fillRect(-4, -14, 8, 28); c.fillRect(-14, -4, 28, 8); }
    c.restore();
  }
  function screenFrame(c) {
    rr(c, 186, 30, 268, 150, 8); P.fe(c, '#c9d2da', 1.8);
    rr(c, 194, 38, 252, 134, 4); P.fe(c, '#fbfbf7', 1.2);
  }
  function generalScreen(c, S, t, k, res) {
    const d = S.demo;
    c.save(); c.beginPath(); c.rect(194, 38, 252, 134); c.clip();
    const cx = 320, a = n => ease((k - n) / 0.3);
    if (!d) {
      P.txt(c, 'ความปลอดภัยทั่วไป', cx, 80, 22, '#1f5fa8', 'center', '800'); P.txt(c, 'หลักสูตร 6 ชั่วโมง', cx, 112, 18, '#37424d', 'center', '700');
      helmetIcon(c, 270, 150, 0.7, '#f2c21d'); gogglesIcon(c, 320, 148, 0.7); gloveIcon(c, 366, 152, 0.7);
    } else if (d === 'signs') {
      [['ban', 'ห้าม'], ['must', 'บังคับ'], ['warn', 'เตือน'], ['safe', 'ปลอดภัย']].forEach((s, i) => {
        const x = 232 + i * 56;
        signIcon(c, s[0], x, 98, 0.95, t, !res && s[0] === 'must');
        if (res) P.txt(c, s[1], x, 142, 15, s[0] === 'must' ? '#1c6fd1' : '#37424d', 'center', s[0] === 'must' ? '800' : '600'); else P.txt(c, '?', x, 142, 20, '#9aa7b4');
      });
      if (res && k > 0.5) T.tick(c, 232 + 56, 60, 11, true);
    } else if (d === 'hierarchy') {
      const L = [['กำจัดอันตราย', '#2fbf71'], ['ใช้สิ่งที่อันตรายน้อยกว่า', '#7ccf4a'], ['แก้ที่เครื่องจักร/สถานที่', '#f2c21d'], ['จัดการงาน/กฎระเบียบ', '#ff9f43'], ['อุปกรณ์ PPE', '#e8590c']];
      L.forEach((l, i) => {
        const w = 230 - i * 34, y = 48 + i * 24;
        rr(c, cx - w / 2, y, w, 21, 6); c.fillStyle = res && a(i * 0.08) > 0.3 ? l[1] : '#d5dbe1'; c.fill(); P.ol(c, 1.1);
        P.txt(c, res ? l[0] : '?', cx, y + 11, P.fitSize(c, l[0], w - 12, 14, '700'), res ? '#26323d' : '#8895a3');
      });
      if (res && k > 0.5) { T.tick(c, 214, 59, 10, true); P.txt(c, 'ด่านสุดท้าย', 402, 156, 13, '#c2410c'); }
    } else if (d === 'ppe') {
      helmetIcon(c, 226, 100, 0.8, '#ffffff'); gogglesIcon(c, 276, 98, 0.7); gloveIcon(c, 322, 100, 0.8); bootIcon(c, 366, 106, 0.75); jacket(c, 414, 118, 1.0, '#ff7a1a');
      [226, 276, 322, 366, 414].forEach((x, i) => { if (res && a(i * 0.1) > 0.3) T.tick(c, x, 136, 9, true); else if (!res) P.txt(c, '?', x, 136, 16, '#9aa7b4'); });
      P.txt(c, res ? 'เหมาะกับงาน · พอดีตัว · สภาพดี' : 'ใช้ให้ถูกต้องอย่างไร', cx, 158, 14, res ? '#2b8a3e' : '#7b8794', 'center', '700');
    } else if (d === 'report') {
      const B = ['เกือบเกิดเหตุ', 'แจ้ง จป./หัวหน้า', 'หาสาเหตุ', 'แก้ไข ไม่เกิดซ้ำ'];
      B.forEach((b, i) => {
        const y = 46 + i * 31, on = i === 0 || (res && a((i - 1) * 0.2) > 0.3);
        rr(c, cx - 98, y, 196, 25, 8); c.fillStyle = on ? (i === 0 ? '#ffe3a3' : '#cdeed7') : '#e1e6ea'; c.fill(); P.ol(c, 1.1);
        P.txt(c, on ? b : '?', cx, y + 13, 15, on ? '#26323d' : '#8895a3');
        if (i < 3) { c.fillStyle = on ? '#2b8a3e' : '#b4bec8'; c.beginPath(); c.moveTo(cx - 6, y + 26); c.lineTo(cx + 6, y + 26); c.lineTo(cx, y + 31); c.closePath(); c.fill(); }
      });
    } else if (d === 'risk') {
      const cols = [['#ffd23f', '#ff5a5f', '#ff5a5f'], ['#7ccf4a', '#ffd23f', '#ff5a5f'], ['#7ccf4a', '#7ccf4a', '#ffd23f']];
      for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) { rr(c, 250 + q * 46, 50 + r * 34, 42, 30, 5); c.fillStyle = res ? cols[r][q] : '#d5dbe1'; c.fill(); P.ol(c, 1); }
      P.txt(c, 'โอกาสเกิด', 226, 100, 13, '#37424d', 'center', '700');
      P.txt(c, 'ความรุนแรง →', 320, 158, 14, '#37424d', 'center', '700');
      if (res) { const u = ease(k / 0.6); P.oval(c, lerp(262, 380, u), lerp(142 - 0, 66, u) - 0, 7, 7); P.fe(c, '#26323d', 1.2); if (k > 0.7) P.txt(c, '× = เสี่ยงสูง', 402, 66, 13, '#c2410c', 'center', '800'); }
    } else if (d === 'duty') {
      P.txt(c, 'หน้าที่ของลูกจ้าง', cx, 54, 17, '#1f5fa8', 'center', '800');
      ['ปฏิบัติตามกฎความปลอดภัย', 'ใช้ PPE ที่จัดให้', 'แจ้งอันตรายที่พบ'].forEach((s, i) => {
        const y = 86 + i * 28;
        rr(c, 222, y - 10, 20, 20, 4); P.fe(c, '#fff', 1.2);
        if (res && a(i * 0.18) > 0.3) T.tick(c, 232, y, 9, true);
        P.txt(c, res ? s : '…', 254, y, P.fitSize(c, s, 180, 15, '700'), res ? '#26323d' : '#9aa7b4', 'left');
      });
    }
    c.restore();
  }
  Sc.register('GENERAL', T.make({
    title: '📘 ความปลอดภัยทั่วไป · หลักสูตร 6 ชั่วโมง',
    trainer: [96, 374, 3.0, 0], hold: { r: P.pointer }, holdArm: [2.2, 0.25],
    slots: [[332, 306, 2.35, 0, { sit: true }], [276, 306, 2.35, 0, { sit: true }], [388, 306, 2.35, 0, { sit: true }], [220, 306, 2.35, 0, { sit: true }], [444, 306, 2.35, 0, { sit: true }],
      [500, 306, 2.35, 0, { sit: true }], [556, 306, 2.35, 0, { sit: true }], [248, 256, 1.95, 0], [360, 256, 1.95, 0], [472, 256, 1.95, 0]],
    bg(c) {
      P.bgIndoor(c, { wall: ['#eef4f8', '#dbe7ee'], wain: '#4f7d9a', floor: ['#d9b98a', '#bf9c6a'], hz: 252 });
      rr(c, 300, 8, 40, 14, 4); P.fe(c, '#8895a3', 1.2);
      rr(c, 36, 62, 112, 90, 5); P.fe(c, '#f7f3ea', 1.6); rr(c, 44, 70, 96, 74, 3); P.fe(c, '#2f9e6b', 1.2);
      P.txt(c, 'SAFETY', 92, 92, 18, '#fff', 'center', '800'); P.txt(c, 'ปลอดภัยไว้ก่อน', 92, 118, 13, '#e8fff3', 'center', '600');
      P.windowView(c, 484, 52, 112, 100);
      P.plant(c, 618, 262, 0.75);
    },
    caption(S, k) {
      const m = { signs: 'วงกลมสีน้ำเงิน = บังคับให้ปฏิบัติ เช่น ต้องสวม PPE', hierarchy: 'กำจัดที่ต้นเหตุก่อน PPE เป็นด่านสุดท้าย', ppe: 'เลือกให้เหมาะกับงาน พอดีตัว ตรวจสภาพก่อนใช้ทุกครั้ง', report: 'รายงานทันที จะได้แก้ไขก่อนมีคนเจ็บ', risk: 'ความเสี่ยง = โอกาสเกิดเหตุ × ความรุนแรง', duty: 'ความปลอดภัยเป็นหน้าที่ของทุกคน' }[S.demo];
      return S.res && m ? m : ({ signs: 'ป้ายวงกลมสีน้ำเงินหมายถึงอะไร', hierarchy: 'ควบคุมอันตรายอย่างไรให้ได้ผลที่สุด', ppe: 'ใช้ PPE อย่างไรจึงถูกต้อง', report: 'เกือบเกิดอุบัติเหตุ ทำอย่างไรดี', risk: 'ความเสี่ยงมาจากอะไร', duty: 'ด้านความปลอดภัย ลูกจ้างมีหน้าที่อะไร' }[S.demo] || '');
    },
    items(S, t, k, push, c) {
      S.aud.filter(a => a.sit).forEach(a => push(a.y - 1, () => { rr(c, a.x - 28, a.y - 80, 56, 72, 13); P.fe(c, '#5c7a8a', 1.5); c.fillStyle = 'rgba(255,255,255,.12)'; rr(c, a.x - 21, a.y - 72, 42, 56, 9); c.fill(); }));
      push(0, () => { screenFrame(c); generalScreen(c, S, t, k, !!S.res); });
      push(331, () => {
        c.beginPath(); c.moveTo(196, 284); c.lineTo(590, 284); c.lineTo(622, 312); c.lineTo(166, 312); c.closePath();
        c.fillStyle = P.linear(c, 0, 284, 0, 312, ['#d9b384', '#b98c58']); c.fill(); P.ol(c, 1.6);
        c.beginPath(); c.moveTo(166, 312); c.lineTo(622, 312); c.lineTo(618, 330); c.lineTo(170, 330); c.closePath(); P.fe(c, '#8a6238', 1.5);
        for (const x of [236, 300, 364, 428, 492, 556]) { rr(c, x - 12, 290, 24, 14, 2); P.fe(c, ['#ffffff', '#cde6ff'][(x / 64 | 0) % 2], 1.1); c.fillStyle = '#9aa7b4'; c.fillRect(x - 8, 295, 16, 1.5); c.fillRect(x - 8, 299, 12, 1.5); }
      });
    }
  }));

  // ------------------------------------------------------------------ สารเคมี
  Sc.register('CHEM', T.make({
    title: '🧪 อบรมการใช้สารเคมีอย่างปลอดภัย',
    trainer: [250, 356, 3.1, 0], holdArm: [1.1, 0.5],
    slots: [[86, 276, 2.2, 0], [150, 272, 2.2, 0], [210, 270, 2.2, 0], [572, 278, 2.2, 0], [512, 274, 2.2, 0], [44, 332, 2.6, 2], [598, 332, 2.6, 1], [120, 336, 2.6, 2], [546, 336, 2.6, 1], [440, 268, 2.1, 0]],
    bg(c) {
      P.bgIndoor(c, { wall: ['#eaf0ee', '#d5e0dc'], wain: '#5d8a7c', floor: ['#c4beaf', '#aaa493'], hz: 246, tile: true });
      for (const x0 of [40, 350]) {
        for (let r = 0; r < 3; r++) {
          const y = 80 + r * 52;
          rr(c, x0, y, 250, 7, 2); P.fe(c, '#8a6a43', 1.2);
          for (let i = 0; i < 9; i++) { const cols = ['#e0603a', '#2f9ed6', '#f2c21d', '#4bb36b', '#9a6fd6', '#ffffff']; bottle(c, x0 + 16 + i * 27 + (r % 2) * 5, y, 0.82, cols[(i * 3 + r * 2 + (x0 > 100 ? 1 : 0)) % cols.length], '', 0); }
        }
      }
      [['🔥', 0], ['☠️', 1], ['⚠️', 2], ['🧪', 3], ['🌿', 4]].forEach(a => ghs(c, 330 + a[1] * 46, 44, 0.78, a[0]));
    },
    caption(S, k) {
      const m = { sds: 'SDS บอกอันตราย วิธีเก็บ PPE และการปฐมพยาบาล', mix: 'ห้ามผสมน้ำยาต่างชนิดกันเอง อาจเกิดก๊าซพิษ', label: 'ภาชนะทุกใบต้องมีฉลาก ห้ามใช้ขวดน้ำดื่ม' }[S.demo];
      return S.res && m ? m : (S.demo === 'sds' ? 'เอกสารบอกอันตรายของสารเคมีคืออะไร' : S.demo === 'mix' ? 'ผสมน้ำยาฟอกขาวกับน้ำยาอื่น จะเกิดอะไร' : S.demo === 'label' ? 'แบ่งสารเคมีใส่ภาชนะใหม่ ต้องทำอย่างไร' : '');
    },
    items(S, t, k, push, c) {
      const d = S.demo, r = !!S.res;
      push(330, () => { rr(c, 372, 318, 190, 14, 4); P.fe(c, '#a8743f', 1.5); rr(c, 380, 332, 8, 40, 2); P.fe(c, '#8a6a43', 1.2); rr(c, 546, 332, 8, 40, 2); P.fe(c, '#8a6a43', 1.2); });
      if (d === 'sds') push(331, () => {
        binder(c, 470, 318, 1.5, r && k > 0.25, t);
        if (r && k > 0.6) T.tick(c, 550, 232, 14, true);
      });
      if (d === 'mix') push(331, () => {
        const pour = r ? ease(k / 0.45) : 0;
        c.save(); P.oval(c, 470, 310, 24, 8); P.fe(c, '#bfc7cf', 1.3); c.restore();
        bottle(c, 428 + pour * 18, 318 - pour * 28, 1.4, '#2f9ed6', 'กรด', pour * 0.9);
        bottle(c, 520 - pour * 18, 318 - pour * 28, 1.4, '#f2c21d', 'คลอรีน', -pour * 0.9);
        if (r && k > 0.35) { cloud(c, 474, 300, 1.4, t, 'rgba(120,200,60,A)', ease((k - 0.35) / 0.3)); P.txt(c, '☠️', 474, 214, 34, '#000'); T.tick(c, 540, 238, 14, false); }
      });
      if (d === 'label') push(331, () => {
        bottle(c, 440, 318, 1.6, 'rgba(70,160,230,.95)', r && k > 0.3 ? 'น้ำยา' : '', 0);
        bottle(c, 500, 318, 1.6, '#cfe8ff', '', 0);
        if (r && k > 0.3) { ghs(c, 440, 262, 0.7, '⚠️'); T.tick(c, 440, 232, 12, true); T.tick(c, 500, 232, 12, false); }
        else P.txt(c, '?', 440, 262, 26, '#ffd23f');
      });
    }
  }));

  // ------------------------------------------------------------------ ทางน้ำ
  Sc.register('WATER', T.make({
    title: '🌊 อบรมความปลอดภัยทางน้ำ',
    trainer: [226, 354, 3.1, 0], holdArm: [1.0, 0.6],
    slots: [[70, 318, 2.4, 0], [128, 314, 2.4, 0], [186, 310, 2.3, 0], [330, 316, 2.4, 0], [384, 312, 2.3, 0], [34, 362, 2.7, 2], [96, 376, 2.7, 0], [330, 368, 2.7, 0], [392, 366, 2.7, 1], [20, 322, 2.2, 0]],
    bg(c) {
      T.bgOutdoor(c, { hz: 120, gy: 184, lines: false });
      c.fillStyle = P.linear(c, 0, 190, 0, 300, ['#1bb8d6', '#0b86b8']); c.fillRect(0, 190, W, 130);
      c.fillStyle = P.linear(c, 0, 300, 0, H, ['#0c8cbc', '#0a6fa3']); c.fillRect(430, 300, 210, 100);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
      for (let i = 0; i < 12; i++) { const x = 20 + i * 54, y = 215 + (i % 4) * 22; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 12, y - 5, x + 26, y); c.stroke(); }
      rr(c, 0, 292, 430, 120, 6); P.fe(c, '#c99a5b', 1.6);
      c.strokeStyle = 'rgba(80,50,20,.35)'; c.lineWidth = 1.6;
      for (let y = 318; y < 400; y += 26) { c.beginPath(); c.moveTo(0, y); c.lineTo(430, y); c.stroke(); }
      for (let x = 40; x < 430; x += 90) { c.beginPath(); c.moveTo(x, 292); c.lineTo(x - 10, 400); c.stroke(); }
      for (const x of [20, 214, 410]) { rr(c, x - 7, 276, 14, 28, 3); P.fe(c, '#6b4a2b', 1.4); }
    },
    caption(S, k) {
      const m = { rescue: 'ตะโกน · โยน · ยื่น — ไม่กระโดดลงไปช่วยเอง', boat: 'ผู้โดยสารไม่เกินพิกัด · ชูชีพครบ · ดูคลื่นลมก่อนออกเรือ', flag: 'ธงแดง = อันตราย ห้ามลงเล่นน้ำ' }[S.demo];
      return S.res && m ? m : (S.demo === 'rescue' ? 'มีคนตกน้ำ! ช่วยอย่างไรให้ปลอดภัย' : S.demo === 'boat' ? 'ก่อนออกเรือรับส่งแขก ต้องตรวจอะไร' : S.demo === 'flag' ? 'ธงสีแดงบนชายหาดหมายถึงอะไร' : '');
    },
    items(S, t, k, push, c) {
      const d = S.demo, r = !!S.res, tr = S.tr;
      push(230, () => { P.spr(c, 'boat_longtail_green', 540, 262 + Math.sin(t * 1.5) * 2, 0.78, true); });
      if (d === 'flag' || !d) push(330, () => flagPole(c, 410, 300, 1.2, t, '#e0342f'));
      if (d === 'flag') push(400, () => {
        if (r && k > 0.3) { rr(c, 470, 330, 128, 40, 8); P.fe(c, '#ffffff', 1.5); P.oval(c, 490, 350, 12, 12); c.strokeStyle = '#e0342f'; c.lineWidth = 4; c.stroke(); c.beginPath(); c.moveTo(482, 358); c.lineTo(498, 342); c.stroke(); P.txt(c, 'ห้ามลงน้ำ', 548, 350, 16, '#e0342f'); T.tick(c, 590, 322, 12, true); }
      });
      if (d === 'rescue') {
        const sw = { x: 520, y: 292 }, throwK = r ? ease(k / 0.5) : 0, pullK = r ? ease((k - 0.5) / 0.5) : 0;
        push(293, () => {
          const x = lerp(sw.x, 440, pullK), y = sw.y + Math.sin(t * 3) * 2;
          c.save(); c.fillStyle = 'rgba(255,255,255,.5)'; P.oval(c, x, y + 12, 26, 7); c.fill(); c.restore();
          A.person(c, x, y + 8, S.swimmer || (S.swimmer = A.guestLook(7)), 0, 0, false, { scale: 1.8, pose: { l: [2.8 + Math.sin(t * 7) * 0.2, 0.2], r: [r && throwK > 0.9 ? 1.0 : 2.8 + Math.cos(t * 7) * 0.2, 0.3], eyes: r && throwK > 0.9 ? 'happy' : 'worry', mouth: r ? 'grin' : 'o', brow: 'worry' } });
          c.fillStyle = 'rgba(30,150,200,.9)'; P.oval(c, x, y + 20, 30, 9); c.fill();
          if (!r) P.bubble(c, x, y - 70, 'ช่วยด้วย!', 18);
        });
        if (r) push(500, () => {
          const bx = lerp(tr.x + 40, lerp(sw.x, 440, pullK), throwK), by = lerp(tr.y - 70, sw.y, throwK) - Math.sin(throwK * Math.PI) * 70;
          c.strokeStyle = '#f1e8c8'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(tr.x + 34, tr.y - 56); c.quadraticCurveTo((tr.x + bx) / 2, Math.min(by, tr.y - 56) + 30, bx, by); c.stroke();
          ringBuoy(c, bx, by, 1.2);
          if (k > 0.9) T.tick(c, 400, 250, 13, true);
        });
      }
      if (d === 'boat') push(231, () => {
        const ok = r && k > 0.3;
        c.save(); rr(c, 470, 200, 150, 54, 8); P.fe(c, '#ffffff', 1.5); P.txt(c, 'พิกัด 10 คน', 545, 217, 16, '#1f5fa8'); P.txt(c, ok ? '8 คน ✓' : '? คน', 545, 240, 20, ok ? '#2b8a3e' : '#7b8794'); c.restore();
        [0, 1, 2, 3].forEach(i => jacket(c, 456 + i * 34, 372, 1.2, ['#ff7a1a', '#ff7a1a', '#ff7a1a', '#ff7a1a'][i]));
        if (ok) { T.tick(c, 596, 372, 12, true); P.txt(c, 'ชูชีพครบ', 530, 330, 16, '#ffffff'); }
      });
    }
  }));

  // ------------------------------------------------------------------ ยกของ
  Sc.register('LIFT', T.make({
    title: '📦 อบรมการยกเคลื่อนย้ายของ',
    trainer: [250, 356, 3.1, 0], holdArm: [0.5, 0.2],
    slots: [[86, 276, 2.2, 0], [150, 272, 2.2, 0], [208, 270, 2.2, 0], [572, 278, 2.2, 0], [512, 274, 2.2, 0], [44, 334, 2.6, 2], [598, 334, 2.6, 1], [120, 338, 2.6, 2], [546, 338, 2.6, 1], [450, 270, 2.1, 0]],
    bg(c) {
      P.bgIndoor(c, { wall: ['#eee7d6', '#ddd3bc'], wain: '#8a7a60', floor: ['#c2bcad', '#aaa493'], hz: 248, tile: true });
      for (const [x, y, col] of [[70, 192, '#c9945a'], [124, 192, '#d4a266'], [97, 156, '#c28a4f'], [520, 192, '#c9945a'], [574, 192, '#d4a266'], [547, 156, '#c28a4f'], [300, 192, '#c9945a'], [352, 192, '#d4a266']]) crate(c, x, y + 56, 1.1, col, '');
      c.fillStyle = '#f2c21d'; c.fillRect(0, 246, W, 6);
      T.sign(c, 250, 52, 140, 30, '#2f6fd0', 'คลังพัสดุ', 17, '#fff');
    },
    caption(S, k) {
      const m = { squat: 'ย่อเข่า หลังตรง ยกของชิดตัว ให้ขาออกแรง', team: 'หนักเกินไป ขอคนช่วยยก หรือใช้รถเข็น' }[S.demo];
      return S.res && m ? m : (S.demo === 'squat' ? 'ท่ายกของหนักจากพื้นที่ถูกต้องคือ' : S.demo === 'team' ? 'ของหนักเกินกว่าจะยกคนเดียว ทำอย่างไร' : '');
    },
    items(S, t, k, push, c) {
      resetPos(S);
      const d = S.demo, r = !!S.res, tr = S.tr;
      if (d === 'squat') {
        const a = r ? ease(k / 0.7) : 0, sq = r ? 1 - a * (1 - 0.15) : 0.4;       // ย่อ → ยืน
        tr.squat = r ? Math.max(0, 1 - ease((k - 0.15) / 0.7) * 0.85) : 0.0;
        tr.holdArm = r ? [0.75, -0.4] : [0.4, 0.1];
        const lf = r ? ease((k - 0.25) / 0.55) : 0;
        push(358, () => { crate(c, tr.x + lerp(78, 0, lf), tr.y - 2 - lf * 24, 1.15, '#d4a266', ''); });
        if (r) push(359, () => { c.strokeStyle = 'rgba(47,191,113,.9)'; c.setLineDash([6, 5]); c.lineWidth = 3; c.beginPath(); c.moveTo(tr.x - 44, tr.y - 120); c.lineTo(tr.x - 44, tr.y - 36); c.stroke(); c.setLineDash([]); if (k > 0.8) T.tick(c, tr.x - 70, tr.y - 130, 13, true); });
        void sq;
      }
      if (d === 'team') {
        const helpA = S.aud[2], helpB = S.aud[5];
        if (r) {
          const m = ease(k / 0.45);
          if (helpA) { helpA.x = lerp(helpA.bx, 330, m); helpA.y = lerp(helpA.by, 350, m); helpA.dir = 2; }
          tr.x = lerp(tr.bx, 300, m);
        }
        const lift = r ? ease((k - 0.45) / 0.4) : 0;
        push(357, () => { crate(c, 340, 356 - lift * 40, 1.6, '#c28a4f', '50 กก.'); if (!r) emoteSweat(c, tr, t); });
        if (r) push(358, () => { trolley(c, 470 - (1 - ease((k - 0.7) / 0.3)) * 80, 360, 1.5); if (k > 0.85) T.tick(c, 470, 252, 13, true); });
        void helpB;
      }
    }
  }));
  function emoteSweat(c, tr, t) { P.emote(c, tr.x + 34, tr.y - 132, 'sweat', t); }

  // ------------------------------------------------------------------ ลื่นล้ม / ทางหนีไฟ
  Sc.register('SLIP', T.make({
    title: '⚠️ อบรมป้องกันลื่นล้มและทางหนีไฟ',
    trainer: [226, 356, 3.1, 0], holdArm: [0.5, 0.2],
    slots: [[86, 276, 2.2, 0], [150, 272, 2.2, 0], [208, 270, 2.2, 0], [44, 334, 2.6, 2], [120, 338, 2.6, 2], [340, 274, 2.1, 0], [598, 336, 2.6, 1], [440, 268, 2.1, 0], [300, 270, 2.1, 0], [64, 280, 2.0, 0]],
    bg(c) {
      P.bgIndoor(c, { wall: ['#f3eee3', '#e4dccb'], wain: '#6fa7a0', floor: ['#dfe1dc', '#c9cdc7'], hz: 250, tile: true });
      for (const x of [110, 330, 540]) { P.oval(c, x, 30, 36, 8); c.fillStyle = 'rgba(255,255,230,.95)'; c.fill(); c.fillStyle = 'rgba(255,255,220,.12)'; c.beginPath(); c.moveTo(x - 30, 34); c.lineTo(x + 30, 34); c.lineTo(x + 70, 250); c.lineTo(x - 70, 250); c.closePath(); c.fill(); }
      T.sign(c, 60, 80, 126, 30, '#27a566', 'ระวังพื้นลื่น', 16, '#fff');
    },
    caption(S, k) {
      const m = { spill: 'วางป้ายเตือนหรือกั้นพื้นที่ก่อน แล้วเช็ดทันที', exit: 'ทางหนีไฟต้องโล่ง เปิดออกได้จากด้านในเสมอ' }[S.demo];
      return S.res && m ? m : (S.demo === 'spill' ? 'พบน้ำมันหกบนพื้นทางเดิน ทำอะไรก่อน' : S.demo === 'exit' ? 'ทางหนีไฟควรเป็นอย่างไรตลอดเวลา' : '');
    },
    items(S, t, k, push, c) {
      const d = S.demo, r = !!S.res;
      if (d === 'exit') {
        const slide = r ? ease(k / 0.6) : 0;
        push(300, () => { exitDoor(c, 540, 316, 1.5, slide > 0.9, t); });
        push(344, () => {
          crate(c, 500 - slide * 330, 352, 1.5, '#c9945a', ''); crate(c, 556 - slide * 330, 352, 1.5, '#d4a266', ''); crate(c, 528 - slide * 330, 312, 1.5, '#c28a4f', '');
          if (r && k > 0.65) { T.tick(c, 540, 168, 14, true); P.txt(c, '← โล่ง', 440, 360, 18, '#2b8a3e'); }
          else if (!r) { P.emote(c, 528, 228, 'q', t); }
        });
      } else {
        const wipe = d === 'spill' && r ? ease((k - 0.35) / 0.6) : 0, sign = d === 'spill' && r ? ease(k / 0.3) : 0;
        push(330, () => { c.globalAlpha = 1 - wipe; puddle(c, 350, 326, 1.5, t); c.globalAlpha = 1; });
        if (d === 'spill') {
          if (!r) push(345, () => P.emote(c, 350, 276, 'q', t));
          if (sign > 0.02) push(346, () => { c.save(); c.globalAlpha = Math.min(1, sign * 2); wetSign(c, 430, 336 - (1 - sign) * 30, 1.6); c.restore(); });
          if (r && k > 0.3) push(347, () => { mop(c, 330 + Math.sin(t * 7) * 36 * (1 - wipe), 338, 1.8, Math.sin(t * 7) * 0.18); if (k > 0.95) T.tick(c, 350, 262, 14, true); });
        }
      }
    }
  }));
})(window);
