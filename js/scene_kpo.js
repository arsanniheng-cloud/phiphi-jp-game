// ============================================================================
// scene_kpo.js — ฉากห้องประชุม คปอ.: กรรมการนั่งรอบโต๊ะ จป. (เลขานุการ) ยืนนำเสนอที่กระดาน
// ผู้แทนแผนกยกมือเมื่อมีข้อเสนอ · ลงมติยกมือพร้อมกันตอนปิดประชุม
// ============================================================================
(function (root) {
  'use strict';
  const Sc = root.Scene, P = Sc.P, A = root.Art;
  const rr = A.rr, shade = A.shade;
  const W = Sc.W, H = Sc.H, TAU = Math.PI * 2;
  const FAR_X = [332, 276, 388, 220, 444, 500, 556];     // ที่นั่งฝั่งไกล เรียงจากกลางออกข้างเพื่อให้คนน้อยก็ดูไม่โล่ง
  const NEAR_X = [248, 304, 360, 416, 472];

  function pointer(c, ang) {
    c.rotate(-ang);
    c.strokeStyle = '#6b4a2b'; c.lineWidth = 1.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-1, 1); c.lineTo(8, -17); c.stroke();
    c.fillStyle = '#e8590c'; c.beginPath(); c.arc(8.3, -17.6, 1.5, 0, TAU); c.fill();
  }
  P.pointer = pointer;                                    // ไม้ชี้ (ใช้ซ้ำในฉากอบรมแบบห้องเรียน)
  function laptop(c, x, y) {
    rr(c, x - 17, y, 34, 5, 2); P.fe(c, '#7c858f', 1.2);
    rr(c, x - 15, y - 21, 30, 21, 3); P.fe(c, '#aab2bb', 1.3);
    P.oval(c, x, y - 10.5, 3, 3); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
  }
  function nameCard(c, x, y, col) {
    c.beginPath(); c.moveTo(x - 14, y + 9); c.lineTo(x + 14, y + 9); c.lineTo(x + 11, y - 1); c.lineTo(x - 11, y - 1); c.closePath(); P.fe(c, '#ffffff', 1.1);
    c.fillStyle = col; c.fillRect(x - 12, y + 3, 24, 4);
  }
  function glass(c, x, y) {
    c.beginPath(); c.moveTo(x - 5, y - 11); c.lineTo(x + 5, y - 11); c.lineTo(x + 4, y); c.lineTo(x - 4, y); c.closePath();
    c.fillStyle = 'rgba(190,230,255,.75)'; c.fill(); P.ol(c, 1);
  }
  function drawTable(c, S) {
    c.beginPath();
    c.moveTo(206, 286); c.lineTo(556, 286); c.quadraticCurveTo(566, 286, 570, 294); c.lineTo(611, 325); c.quadraticCurveTo(618, 334, 606, 334);
    c.lineTo(158, 334); c.quadraticCurveTo(146, 334, 153, 325); c.lineTo(192, 294); c.quadraticCurveTo(196, 286, 206, 286); c.closePath();
    c.fillStyle = P.linear(c, 0, 286, 0, 334, ['#b07a46', '#8d5b30']); c.fill(); P.ol(c, 1.6);
    c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.moveTo(214, 289); c.lineTo(548, 289); c.lineTo(562, 301); c.lineTo(200, 301); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(153, 325); c.lineTo(611, 325); c.lineTo(607, 345); c.quadraticCurveTo(606, 352, 598, 352); c.lineTo(166, 352); c.quadraticCurveTo(158, 352, 157, 345); c.closePath(); P.fe(c, '#5c3a1e', 1.6);
    S.far.forEach((a, i) => {
      const col = (a.L && a.L.shirt) || '#cccccc';
      nameCard(c, a.x, 311, col);
      if (i % 3 === 0) laptop(c, a.x + 3, 322 - 6);
      if (i % 2 === 1) glass(c, a.x + 24, 318);
    });
    c.fillStyle = '#f2f2ee'; for (const [x, y, r] of [[300, 322, -0.1], [470, 320, 0.12], [250, 324, 0.2]]) { c.save(); c.translate(x, y); c.rotate(r); rr(c, -12, -8, 24, 16, 1); P.fe(c, '#f6f6f0', 1); c.restore(); }
    rr(c, 316, 318, 32, 11, 3); P.fe(c, '#d9ad32', 1.1); P.txt(c, 'ประธาน', 332, 324, 10, '#5b4200');
  }
  function drawChair(c, x, y, near) {
    rr(c, x - 28, y - 80, 56, near ? 96 : 72, 13); P.fe(c, '#2f6f84', 1.5);
    c.fillStyle = 'rgba(255,255,255,.12)'; rr(c, x - 21, y - 72, 42, near ? 78 : 56, 9); c.fill();
  }
  function board(c, S, t) {
    const b = S.extra.board || { mode: 'stats', found: 0, closed: 0, incidents: 0, lti: 0 };
    rr(c, 30, 30, 236, 150, 8); P.fe(c, '#d3d9df', 1.8);
    rr(c, 38, 38, 220, 134, 4); P.fe(c, '#fbfbf7', 1.2);
    rr(c, 62, 176, 172, 7, 3); P.fe(c, '#b9c1c9', 1.1);
    c.save(); c.beginPath(); c.rect(38, 38, 220, 134); c.clip();
    if (b.mode === 'props') {
      P.txt(c, 'วาระที่ 2 ข้อเสนอจากผู้แทน', 148, 52, 15, '#1f5fa8');
      (b.items || []).slice(0, 4).forEach((it, i) => {
        const y = 78 + i * 24;
        P.oval(c, 52, y, 5, 5); c.fillStyle = '#2b8a3e'; c.fill();
        const z = P.fitSize(c, P.cut(it.title, 22), 178, 14, '600');
        P.txt(c, P.cut(it.title, 22), 62, y, z, '#26323d', 'left', '600');
      });
      if (!(b.items || []).length) P.txt(c, 'เลือกข้อเสนอที่จะอนุมัติ', 148, 100, 15, '#7b8794', 'center', '600');
      P.txt(c, 'งบ ' + Math.round(b.total || 0).toLocaleString() + ' / ' + Math.round(b.budget || 0).toLocaleString(), 148, 158, 14, (b.total || 0) > (b.budget || 0) ? '#c92a2a' : '#1f5fa8');
    } else if (b.mode === 'result') {
      P.txt(c, 'มติที่ประชุม', 148, 54, 17, '#1f5fa8');
      const z = P.Sc_ease((t - (b.t || 0)) / 0.5);
      c.save(); c.translate(148, 110); c.scale(0.6 + 0.4 * z, 0.6 + 0.4 * z); c.rotate(-0.12);
      rr(c, -82, -26, 164, 52, 10); c.strokeStyle = b.n ? '#2b8a3e' : '#e8590c'; c.lineWidth = 4; c.stroke();
      P.txt(c, b.n ? 'อนุมัติ ' + b.n + ' เรื่อง' : 'เลื่อนไปก่อน', 0, 1, 26, b.n ? '#2b8a3e' : '#e8590c');
      c.restore();
    } else {
      P.txt(c, 'วาระที่ 1 ผลการดำเนินงาน', 148, 52, 15, '#1f5fa8');
      [['พบจุดเสี่ยง', b.found, '#e8590c'], ['แก้ไขแล้ว', b.closed, '#2b8a3e'], ['อุบัติเหตุ', b.incidents, '#c92a2a'], ['หยุดงาน', b.lti, '#7048e8']].forEach((cl, i) => {
        const x = 46 + (i % 2) * 108, y = 68 + Math.floor(i / 2) * 52;
        rr(c, x, y, 100, 46, 9); c.fillStyle = shade(cl[2], 0.86); c.fill();
        const gr = P.Sc_ease((t - 0.12 * i) / 0.7);
        P.txt(c, String(Math.round((cl[1] || 0) * gr)), x + 50, y + 19, 27, cl[2]);
        P.txt(c, cl[0], x + 50, y + 38, 13, '#37424d', 'center', '600');
      });
    }
    c.restore();
  }
  function clock(c, hour, t) {
    P.oval(c, 352, 64, 25, 25); P.fe(c, '#ffffff', 2);
    c.strokeStyle = '#37424d'; c.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.moveTo(352 + Math.sin(a) * 19, 64 - Math.cos(a) * 19); c.lineTo(352 + Math.sin(a) * 22, 64 - Math.cos(a) * 22); c.stroke(); }
    const h = (hour % 12) / 12 * TAU, m = (hour % 1) * TAU;
    c.lineCap = 'round'; c.lineWidth = 3; c.beginPath(); c.moveTo(352, 64); c.lineTo(352 + Math.sin(h) * 12, 64 - Math.cos(h) * 12); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(352, 64); c.lineTo(352 + Math.sin(m) * 18, 64 - Math.cos(m) * 18); c.stroke();
  }

  P.Sc_ease = Sc.ease;
  Sc.register('KPO', {
    title: '🏛️ ประชุม คปอ.',
    bg(c, S) {
      P.bgIndoor(c, { hz: 252 });
      P.windowView(c, 456, 38, 150, 132);
      c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 6; i++) c.fillRect(450, 32 + i * 5, 162, 2);      // มู่ลี่ด้านบน
      rr(c, 296, 92, 112, 72, 5); P.fe(c, '#f7f3ea', 1.8);
      rr(c, 304, 100, 96, 56, 3); P.fe(c, '#2f9e6b', 1.2);
      P.txt(c, 'SAFETY', 352, 118, 18, '#ffffff', 'center', '800'); P.txt(c, 'ปลอดภัยไว้ก่อน', 352, 138, 13, '#e8fff3', 'center', '600');
      P.plant(c, 616, 262, 0.8);
      c.fillStyle = 'rgba(52,86,110,.9)'; P.oval(c, 380, 342, 292, 58); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 3; P.oval(c, 380, 342, 280, 52); c.stroke();
    },
    setup(S) {
      const ppl = S.people.slice(0, 12);
      S.far = []; S.near = [];
      ppl.forEach((p, i) => {
        if (i < FAR_X.length) { const a = Sc.mkActor(p.L, FAR_X[i], 306, 2.35, 0, { sit: true, dept: p.department_id, name: p.name }); S.far.push(a); S.actors.push(a); }
        else { const a = Sc.mkActor(p.L, NEAR_X[i - FAR_X.length], 256, 1.95, 0, { dept: p.department_id, name: p.name }); S.near.push(a); S.actors.push(a); }   // แถวยืนด้านหลัง
      });
      S.far.sort((a, b) => a.x - b.x);
      S.sec = Sc.mkActor(S.trainer, 92, 376, 3.0, 0, { react: false, hold: { r: pointer }, state: 'point' });
      S.actors.push(S.sec);
      S.hour = S.o.hour || 10;
    },
    items(S, t, k, push, c) {
      const ex = S.extra, vote = ex.vote, foc = ex.focus;
      push(0, () => { board(c, S, t); clock(c, S.hour, t); });
      S.far.concat(S.near).forEach((a, i) => {
        let st = 'listen';
        if (foc && (a.dept === foc.dept)) st = 'raise';
        if (vote) { const d = t - vote.t - i * 0.11; st = d < 0 ? st : d < 2.3 ? 'raise' : (vote.n ? 'clap' : 'sorry'); }
        a.state = st; a.react = false;
      });
      S.sec.state = vote && t - vote.t > 2.3 ? (vote.n ? 'cheer' : 'sorry') : 'point';
      S.far.forEach(a => push(a.y - 1, () => drawChair(c, a.x, a.y - 4, false)));
      push(331, () => drawTable(c, S));
      push(600, () => {
        if (foc) {
          const a = S.far.find(x => x.dept === foc.dept) || S.far[0];
          if (a) { const h = Sc.headOf(a); P.bubble(c, h.x, h.y - 18, P.cut(foc.label, 24), 18); }
        }
        if (vote) {
          const d = t - vote.t;
          if (d > 0.4 && d < 2.4) { c.save(); P.txt(c, '✋ ลงมติ', 320, 206, 22, '#fff'); c.restore(); }
        }
      });
    },
    over(S, c, t) {
      // แสงแดดลอดหน้าต่าง
      const a = 0.09 + Math.sin(t * 0.7) * 0.02;
      c.fillStyle = 'rgba(255,248,214,' + a.toFixed(3) + ')';
      c.beginPath(); c.moveTo(456, 170); c.lineTo(606, 170); c.lineTo(580, 400); c.lineTo(330, 400); c.closePath(); c.fill();
    }
  });
})(window);
