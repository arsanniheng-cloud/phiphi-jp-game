// ============================================================================
// main.js — วนลูปเกม: รับปุ่ม/เมาส์/จอสัมผัส แล้ววาดฉาก (เรียงลำดับความลึกตามแกน y)
// ============================================================================
(function () {
  'use strict';
  const G = window.GAME_DATA, A = window.Art, Wd = window.World, Sim = window.Sim, UI = window.UI, DB = window.GameDB;
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  const miniCv = document.getElementById('minimap'), mctx = miniCv.getContext('2d');
  let VW = 0, VH = 0, DPR = 1, Z = 1, zoomMul = 1, camX = 0, camY = 0, camInit = false;
  const keys = {};
  const joy = { active: false, x: 0, y: 0, id: null, cx: 0, cy: 0 };
  let last = performance.now(), hudT = 0, targets = [], flashT = 0, clickFx = null, curZ = 0;
  // หน้าตาและสีประจำตัวของผู้เล่นแต่ละคน (เสื้อกั๊ก/หมวก)
  const LOOKS = [
    A.playerLook(),
    Object.assign(A.playerLook(), { vest: '#00a6e0', hat_color: '#ffd23b', shirt: '#eef6ff', skin: A.SKIN[2], hair: A.HAIR[1], hair_style: 1 }),
    Object.assign(A.playerLook(), { vest: '#2fb344', hat_color: '#ff6b6b', shirt: '#fffbe8', skin: A.SKIN[0], hair: A.HAIR[2], hair_style: 4 }),
    Object.assign(A.playerLook(), { vest: '#9b5de5', hat_color: '#ffffff', shirt: '#f3f0ff', skin: A.SKIN[3], hair: A.HAIR[0], hair_style: 3 })
  ];
  const PCOL = ['rgba(255,190,40,.95)', 'rgba(0,175,240,.95)', 'rgba(47,179,68,.95)', 'rgba(155,93,229,.95)'];
  const PDOT = ['#ffd23b', '#22c7ff', '#40c057', '#b197fc'];
  const rain = [];
  const darkCv = document.createElement('canvas'), darkCtx = darkCv.getContext('2d');
  const SEV_COL = { 1: '#40c057', 2: '#f59f00', 3: '#fd7e14', 4: '#e03131' };
  const ICON = { fire_hazard: '🔥', electrical: '⚡', drowning_risk: '🌊', chemical_spill: '☣️', fall_from_height: '🏗️', injury: '⚠️', first_aid: '⚠️', near_miss: '⚠️' };
  const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

  // จอสัมผัส (มือถือ/แท็บเล็ต) · ทดสอบบนคอมด้วย #touch ต่อท้ายลิงก์
  const touch = /[#&]touch\b/.test(location.hash) || matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (touch) document.body.classList.add('touch');

  // ------------------------------------------------------------------ viewport
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, touch ? 1.75 : 2);   // มือถือ: จำกัดความละเอียดเพื่อให้ลื่น
    VW = window.innerWidth; VH = window.innerHeight;
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
    cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
    // มือถือ: ซูมใกล้กว่าคอม ตัวละครจะได้ไม่เล็กเกินไป
    Z = (touch ? Math.max(0.72, Math.min(1.4, Math.min(VW / 720, VH / 600)))
      : Math.max(0.6, Math.min(1.5, Math.min(VW / 1050, VH / 680)))) * zoomMul;
  }
  function setZoom(f) { zoomMul = Math.max(0.6, Math.min(2, zoomMul * f)); resize(); }
  // ขนาดตัวหนังสือ/ป้ายบนแผนที่: บนมือถือขยายตามการซูมให้อ่านออก
  const textScale = () => (touch ? Math.max(1, 0.95 / (curZ || Z)) : 1);
  function toWorld(cx, cy) { const z = curZ || Z; return { x: camX + cx / z, y: camY + cy / z }; }

  // ------------------------------------------------------------------ input
  // P1: W A S D (+ลูกศรเมื่อเล่นคนเดียว)  P2: ลูกศร (โหมดเล่นกับเพื่อน)
  const MOVE1 = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
  const MOVE2 = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const keys2 = {};
  const netOn = () => !!(window.Net && window.Net.active);
  // หลายคนบนเครื่องเดียวกัน (ไม่ใช่ออนไลน์ ซึ่งแต่ละเครื่องมีผู้เล่นคนเดียว)
  const coop = () => !!(Sim.S && Sim.S.coop && Sim.players().length > 1 && !netOn());
  window.addEventListener('keydown', e => {
    const code = e.code;
    if (UI.isOpen()) { if (code === 'Escape') UI.close(); return; }
    if (MOVE1[code]) { keys[MOVE1[code]] = true; e.preventDefault(); }
    if (MOVE2[code]) { (coop() ? keys2 : keys)[MOVE2[code]] = true; e.preventDefault(); }
    if (code === 'ShiftLeft') keys.run = true;
    if (code === 'ShiftRight') (coop() ? keys2 : keys).run = true;
    if (!Sim.S || Sim.S.over) return;
    if (code === 'KeyE' || code === 'Space') { e.preventDefault(); if (targets[0]) UI.interact(targets[0], Sim.P); }
    else if (code === 'Enter' || code === 'NumpadEnter') {
      e.preventDefault();
      if (coop()) { if (targets[1]) UI.interact(targets[1], Sim.players()[1]); }
      else if (targets[0]) UI.interact(targets[0], Sim.P);
    }
    else if (code === 'Escape' || code === 'KeyM') UI.menu();
    else if (code === 'Tab') { e.preventDefault(); UI.staff(); }
    else if (code === 'KeyL') UI.logbook();
    else if (code === 'KeyP') UI.ptwList();
    else if (code === 'Equal' || code === 'NumpadAdd') setZoom(1.12);
    else if (code === 'Minus' || code === 'NumpadSubtract') setZoom(1 / 1.12);
  });
  window.addEventListener('keyup', e => {
    if (MOVE1[e.code]) keys[MOVE1[e.code]] = false;
    if (MOVE2[e.code]) { keys[MOVE2[e.code]] = false; keys2[MOVE2[e.code]] = false; }
    if (e.code === 'ShiftLeft') keys.run = false;
    if (e.code === 'ShiftRight') { keys.run = false; keys2.run = false; }
  });
  window.addEventListener('blur', () => { [keys, keys2].forEach(o => Object.keys(o).forEach(k => { o[k] = false; })); });

  cv.addEventListener('wheel', e => { e.preventDefault(); setZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  // นิ้วใช้ touch events (แยกจากเมาส์) แล้วสั่ง preventDefault ทุกครั้ง:
  // เบราว์เซอร์ในแอป LINE/Facebook บางรุ่นแย่งท่าลากนิ้วไปเลื่อนหรือปิดหน้า ทำให้จอยหลุดและเดินไม่ได้
  const TOUCH_EV = 'ontouchstart' in window;
  const byFinger = e => TOUCH_EV && e.pointerType === 'touch';
  const NOPASS = { passive: false };
  const canPlay = () => !!(Sim.S && !UI.isOpen() && !Sim.S.over);
  // เมาส์/ปากกา: คลิกที่พื้นเพื่อเดินไป (ทำงานตอนปล่อยปุ่ม)
  const ptrs = new Map();
  let pinch = null, tapStart = null;
  cv.addEventListener('pointerdown', e => {
    if (byFinger(e)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoomMul };
      tapStart = null;
    } else if (ptrs.size === 1) tapStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  cv.addEventListener('pointermove', e => {
    if (byFinger(e) || !ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      zoomMul = Math.max(0.6, Math.min(2, pinch.z * (Math.hypot(a.x - b.x, a.y - b.y) || 1) / pinch.d));
      resize();
    } else if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 14) tapStart = null;
  });
  const ptrEnd = e => {
    if (byFinger(e)) return;
    const wasTap = e.type === 'pointerup' && tapStart && tapStart.id === e.pointerId && !pinch;
    ptrs.delete(e.pointerId);
    if (!ptrs.size) { pinch = null; tapStart = null; }
    if (wasTap) tapAt(e.clientX, e.clientY);
  };
  cv.addEventListener('pointerup', ptrEnd);
  cv.addEventListener('pointercancel', ptrEnd);
  function tapAt(cx, cy) {
    if (!Sim.S || UI.isOpen() || Sim.S.over) return;
    const w = toWorld(cx, cy);
    const tg = Sim.pickAt(w.x, w.y, touch ? 1.8 : 1);
    if (tg) {
      const o = tg.obj;
      if (Math.hypot(Sim.P.x - o.x, Sim.P.y - o.y) < 60) UI.interact(tg, Sim.P);
      else Sim.goTo(o.x, o.y + 6, tg, Sim.P);
    } else Sim.goTo(w.x, w.y, null, Sim.P);
    clickFx = { x: w.x, y: w.y, t: 0.6 };
  }
  miniCv.addEventListener('pointerdown', e => {
    if (!Sim.S || UI.isOpen()) return;
    const r = miniCv.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * Wd.W, y = (e.clientY - r.top) / r.height * Wd.H;
    if (Wd.walkable(x, y)) Sim.goTo(x, y);
  });

  // ---- จอยบังคับ: จอยมุมซ้ายล่าง หรือ "จอยลอย" ที่เกิดตรงจุดที่นิ้วเริ่มลากบนฉาก
  const joyEl = document.getElementById('joy'), stick = document.getElementById('stick');
  function startJoy(cx, cy, floating) {
    joy.active = true; joy.cx = cx; joy.cy = cy; joy.x = joy.y = 0;
    if (floating) {
      const s = joyEl.offsetWidth || 136;
      joyEl.classList.add('floating');
      joyEl.style.left = Math.round(cx - s / 2) + 'px'; joyEl.style.top = Math.round(cy - s / 2) + 'px'; joyEl.style.bottom = 'auto';
    }
  }
  function moveJoy(px, py) {
    let dx = px - joy.cx, dy = py - joy.cy;
    const l = Math.hypot(dx, dy), m = joyEl.offsetWidth * 0.36 || 46;
    if (l > m) { dx = dx / l * m; dy = dy / l * m; }
    joy.x = dx / m; joy.y = dy / m;
    stick.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }
  function endJoy() {
    joy.active = false; joy.x = joy.y = 0; joy.id = null; stick.style.transform = '';
    if (joyEl.classList.contains('floating')) { joyEl.classList.remove('floating'); joyEl.style.left = joyEl.style.top = joyEl.style.bottom = ''; }
  }
  const joyCenter = () => { const r = joyEl.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  // จอยมุมซ้ายล่าง: นิ้ว
  joyEl.addEventListener('touchstart', e => {
    e.preventDefault();
    if (joy.active) return;
    const t = e.changedTouches[0], c = joyCenter();
    joy.id = 't' + t.identifier;
    startJoy(c[0], c[1], false); moveJoy(t.clientX, t.clientY);
  }, NOPASS);
  joyEl.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (joy.id === 't' + t.identifier) moveJoy(t.clientX, t.clientY);
  }, NOPASS);
  const joyTouchEnd = e => { e.preventDefault(); for (const t of e.changedTouches) if (joy.id === 't' + t.identifier) endJoy(); };
  joyEl.addEventListener('touchend', joyTouchEnd, NOPASS);
  joyEl.addEventListener('touchcancel', joyTouchEnd, NOPASS);
  // จอยมุมซ้ายล่าง: เมาส์ (ทดสอบบนคอมด้วย #touch)
  joyEl.addEventListener('pointerdown', e => {
    if (byFinger(e) || joy.active) return;
    const c = joyCenter();
    joy.id = 'p' + e.pointerId;
    startJoy(c[0], c[1], false);
    try { joyEl.setPointerCapture(e.pointerId); } catch (err) { /* บางเบราว์เซอร์ไม่รองรับ */ }
    moveJoy(e.clientX, e.clientY);
  });
  joyEl.addEventListener('pointermove', e => { if (!byFinger(e) && joy.id === 'p' + e.pointerId) moveJoy(e.clientX, e.clientY); });
  const joyPtrEnd = e => { if (!byFinger(e) && joy.id === 'p' + e.pointerId) endJoy(); };
  joyEl.addEventListener('pointerup', joyPtrEnd);
  joyEl.addEventListener('pointercancel', joyPtrEnd);

  // ---- นิ้วบนฉาก: แตะ = เดินไปตรงนั้น/คุย · ลากนิ้ว = จอยลอย · สองนิ้วถ่าง/หุบ = ซูม
  const fingers = new Map();
  let fPinch = null, fTap = null, fFloat = null;
  cv.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) fingers.set(t.identifier, { x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY });
    if (fingers.size >= 2) {
      const [a, b] = [...fingers.values()];
      fPinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoomMul };
      fTap = null;
      if (fFloat !== null) { fFloat = null; endJoy(); }
    } else if (!fPinch) fTap = e.changedTouches[0].identifier;
  }, NOPASS);
  cv.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) { const f = fingers.get(t.identifier); if (f) { f.x = t.clientX; f.y = t.clientY; } }
    if (fPinch) {
      if (fingers.size >= 2) {
        const [a, b] = [...fingers.values()];
        zoomMul = Math.max(0.6, Math.min(2, fPinch.z * (Math.hypot(a.x - b.x, a.y - b.y) || 1) / fPinch.d));
        resize();
      }
      return;
    }
    if (fTap !== null) {
      const f = fingers.get(fTap);
      if (f && Math.hypot(f.x - f.x0, f.y - f.y0) > 14 && !joy.active && canPlay()) { fFloat = fTap; fTap = null; startJoy(f.x0, f.y0, true); }
    }
    if (fFloat !== null) { const f = fingers.get(fFloat); if (f) moveJoy(f.x, f.y); }
  }, NOPASS);
  const fingerEnd = e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const id = t.identifier;
      if (id === fTap) { fTap = null; if (e.type === 'touchend') tapAt(t.clientX, t.clientY); }
      if (id === fFloat) { fFloat = null; endJoy(); }
      fingers.delete(id);
    }
    if (!fingers.size) fPinch = null;
  };
  cv.addEventListener('touchend', fingerEnd, NOPASS);
  cv.addEventListener('touchcancel', fingerEnd, NOPASS);
  // สลับแอป/ล็อกจอระหว่างลากนิ้ว: ปล่อยจอยทันที ตัวละครจะได้ไม่เดินเอง
  const releaseAll = () => { fingers.clear(); fPinch = fTap = fFloat = null; if (joy.active) endJoy(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  window.addEventListener('blur', releaseAll);

  document.getElementById('act').addEventListener('click', () => { if (targets[0] && !UI.isOpen()) UI.interact(targets[0], Sim.P); });

  // ---- คำแนะนำบนมือถือตอนเริ่มเล่น (หายเมื่อเริ่มเดิน)
  let hintEl = null, hintT = 0, hintDone = !touch;
  function hint(dt) {
    if (hintDone || !Sim.S) return;
    if (!hintEl) {
      hintEl = document.createElement('div');
      hintEl.id = 'hint';
      hintEl.innerHTML = '👆 <b>ลากนิ้วบนจอ</b> เพื่อเดิน<br><small>แตะพื้น = เดินไปตรงนั้น · แตะคน/ป้าย = คุย/ตรวจ</small>';
      document.body.appendChild(hintEl);
    }
    if (UI.isOpen()) return;
    hintT += dt;
    if ((Sim.P.moving && hintT > 1.2) || hintT > 14) {
      hintDone = true;
      const el = hintEl;
      el.classList.add('fade');
      setTimeout(() => el.remove(), 900);
    }
  }

  // จอยเกม (Gamepad API): ก้านซ้าย/ปุ่มทิศเดิน, A โต้ตอบ, B วิ่ง
  const padPrev = {};
  function padInput(idx) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    const gp = pads && pads[idx];
    if (!gp) return null;
    let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
    if (Math.hypot(x, y) < 0.25) { x = 0; y = 0; }
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
    const a = b(0), was = padPrev[idx];
    padPrev[idx] = a;
    return { x, y, run: b(1) || b(7), act: a && !was };
  }
  // ผู้เล่น 1–2 คน: จอยที่ 1–2 ใช้แทนคีย์บอร์ดได้ · 3–4 คน: จอยที่ 1–2 เป็นของ P3–P4
  function playerInputs(pls) {
    if (netOn()) {
      // ออนไลน์: เครื่องนี้คุมตัวเองคนเดียว (คีย์บอร์ด จอยสัมผัส หรือจอยเกมตัวแรก)
      const v = inputVec(), pad = padInput(0);
      if (pad) {
        if (pad.x || pad.y) { v.x = pad.x; v.y = pad.y; }
        v.run = v.run || pad.run;
        if (pad.act && targets[0] && !UI.isOpen()) UI.interact(targets[0], Sim.P);
      }
      return [v];
    }
    const off = pls.length >= 3 ? 2 : 0;
    return pls.map((pl, i) => {
      const v = i === 0 ? inputVec() : i === 1 ? vec(keys2) : { x: 0, y: 0, run: false };
      const pad = i - off >= 0 ? padInput(i - off) : null;
      if (pad) {
        if (pad.x || pad.y) { v.x = pad.x; v.y = pad.y; }
        v.run = v.run || pad.run;
        if (pad.act && targets[i] && !UI.isOpen()) UI.interact(targets[i], pl);
      }
      return v;
    });
  }

  function vec(k) {
    let x = 0, y = 0;
    if (k.left) x -= 1; if (k.right) x += 1; if (k.up) y -= 1; if (k.down) y += 1;
    return { x, y, run: !!k.run };
  }
  function inputVec() {
    const a = vec(keys);
    if (joy.active && Math.hypot(joy.x, joy.y) > 0.15) { a.x = joy.x; a.y = joy.y; }
    return a;
  }

  // ------------------------------------------------------------------ render
  function inV(o, v, m) { m = m || 60; return o.x > v.x - m && o.x < v.x + v.w + m && o.y > v.y - m && o.y < v.y + v.h + m + 40; }

  function drawEntity(e, t, S) {
    if (e.kind === 'npc') {
      const n = e.n;
      A.person(ctx, n.x, n.y, n.L, n.dir, n.phase, n.moving, n.hurt_t > 0 ? { alpha: 0.8 } : null);
      const d = Math.hypot(Sim.P.x - n.x, Sim.P.y - n.y);
      if (n.hurt_t > 0) badge(n.x, n.y - 50, '#e03131', '✚');
      else if (n.ppe_missing && d < 170) warnTri(n.x, n.y - 50);
    } else if (e.kind === 'guest') {
      A.person(ctx, e.g.x, e.g.y, e.g.L, e.g.dir, e.g.phase, e.g.moving, { scale: 0.95 });
    } else if (e.kind === 'player') {
      const P = e.pl, k = (P.id - 1) % LOOKS.length;
      ctx.strokeStyle = PCOL[k]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(P.x, P.y, 13 + Math.sin(t * 4) * 1.5, 5.5, 0, 0, Math.PI * 2); ctx.stroke();
      A.person(ctx, P.x, P.y, LOOKS[k], P.dir, P.phase, P.moving, { clipboard: true, scale: 1.08 });
      if (coop()) {
        const txt = 'P' + P.id + ' ' + Sim.pinfo(P.id).name;
        ctx.font = '700 11px ' + A.FONT; ctx.textAlign = 'center';
        const w = ctx.measureText(txt).width + 12;
        ctx.fillStyle = PCOL[k];
        A.rr(ctx, P.x - w / 2, P.y - 66, w, 16, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(txt, P.x, P.y - 54.5);
      }
    } else {
      ctx.drawImage(e.spr.cv, e.sx, e.sy, e.sw, e.sh);
    }
    void S;
  }
  function badge(x, y, col, txt) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px ' + A.FONT; ctx.textAlign = 'center'; ctx.fillText(txt, x, y + 3.5);
  }
  function warnTri(x, y) {
    ctx.fillStyle = '#ffb020'; ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 7.5, y + 5); ctx.lineTo(x - 7.5, y + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3d2400'; ctx.font = 'bold 9px ' + A.FONT; ctx.textAlign = 'center'; ctx.fillText('!', x, y + 3.5);
  }

  function drawMarkers(t, view, S) {
    ctx.textAlign = 'center';
    const s = textScale();
    for (const h of S.hazards) {
      if (h.done || !(h.disc || h.rep) || !inV(h, view)) continue;
      const ht = Sim.HT[h.type_id], pct = Math.max(0, h.fuse / h.fuse_max), urgent = pct < 0.3;
      if (!ht) continue;
      const col = SEV_COL[h.sev];
      ctx.globalAlpha = 0.55 + Math.sin(t * (urgent ? 9 : 3)) * 0.25;
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, 20, 8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      const y = h.y - 40 * s + Math.sin(t * (urgent ? 8 : 2.5) + h.id) * 2.5;
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(h.x, h.y - 2); ctx.lineTo(h.x, y + 12 * s); ctx.stroke();
      ctx.save(); ctx.translate(h.x, y); ctx.scale(s, s);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, 16.5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, 16.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); ctx.stroke();
      ctx.font = '14px ' + EMOJI_FONT; ctx.fillStyle = '#fff';
      ctx.fillText(ICON[ht.incident_type] || '⚠️', 0, 5);
      if (h.mit) { ctx.font = '11px ' + EMOJI_FONT; ctx.fillText('📋', 15, -11); }
      else if (h.rep && !h.disc) { ctx.font = '11px ' + EMOJI_FONT; ctx.fillText('📢', 15, -11); }
      ctx.restore();
    }
    for (const p of S.ptw) {
      if (p.status !== 'pending' || !inV(p, view)) continue;
      const y = p.y - 38 * s + Math.sin(t * 2 + p.id) * 2;
      ctx.save(); ctx.translate(p.x, y); ctx.scale(s, s);
      ctx.fillStyle = '#1c7ed6'; A.rr(ctx, -13, -13, 26, 26, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; A.rr(ctx, -13, -13, 26, 26, 7); ctx.stroke();
      ctx.font = '14px ' + EMOJI_FONT; ctx.fillStyle = '#fff'; ctx.fillText('📝', 0, 5);
      ctx.restore();
    }
  }

  function drawLabels(view) {
    const s = textScale();
    ctx.font = '600 ' + (12 * s).toFixed(1) + 'px ' + A.FONT; ctx.textAlign = 'center';
    for (const l of Wd.labels) {
      if (l.x < view.x - 160 || l.x > view.x + view.w + 160 || l.y < view.y - 30 || l.y > view.y + view.h + 30) continue;
      const w = ctx.measureText(l.text).width + 14 * s;
      ctx.fillStyle = 'rgba(18,28,38,.62)'; A.rr(ctx, l.x - w / 2, l.y - 10 * s, w, 19 * s, 9.5 * s); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillText(l.text, l.x, l.y + 4 * s);
    }
  }

  function drawTags(S) {
    const s = textScale();
    ctx.font = '600 ' + (11 * s).toFixed(1) + 'px ' + A.FONT; ctx.textAlign = 'center';
    // ป้ายชื่อ: คนที่กำลังจะคุยด้วย + คนใกล้ที่สุดอีก 2 คนของผู้เล่นแต่ละคน และไม่ให้ป้ายซ้อนกัน
    const tgs = targets.filter(x => x && x.type === 'npc').map(x => x.obj);
    let show = tgs.slice();
    for (const P of Sim.players()) {
      const near = Sim.npcs.filter(n => n.on && !n.inside_t && Math.hypot(P.x - n.x, P.y - n.y) < 80)
        .sort((a, b) => Math.hypot(P.x - a.x, P.y - a.y) - Math.hypot(P.x - b.x, P.y - b.y));
      show = show.concat(near.filter(n => show.indexOf(n) < 0).slice(0, 2));
    }
    const boxes = [];
    for (const n of show) {
      const isT = tgs.indexOf(n) >= 0;
      const txt = n.nickname + ' · ' + Sim.DEPT[n.department_id].short;
      const w = ctx.measureText(txt).width + 10 * s, y = n.y - (n.L.hat === 'chef' ? 62 : 56) - (s - 1) * 6;
      if (boxes.some(b => Math.abs(b.x - n.x) < (b.w + w) / 2 && Math.abs(b.y - y) < 16 * s)) continue;
      boxes.push({ x: n.x, y, w });
      ctx.fillStyle = isT ? 'rgba(255,176,32,.95)' : 'rgba(18,28,38,.7)';
      A.rr(ctx, n.x - w / 2, y - 9 * s, w, 15 * s, 7.5 * s); ctx.fill();
      ctx.fillStyle = isT ? '#2b1a00' : '#fff'; ctx.fillText(txt, n.x, y + 2.5 * s);
    }
    targets.forEach((tg, i) => {
      if (!tg || (tg.type !== 'npc' && tg.type !== 'guest')) return;
      const o = tg.obj;
      ctx.strokeStyle = PCOL[i % PCOL.length]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(o.x, o.y, 12, 4.8, 0, 0, Math.PI * 2); ctx.stroke();
    });
    if (clickFx && clickFx.t > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + clickFx.t + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(clickFx.x, clickFx.y, 18 * (1 - clickFx.t) + 4, 7 * (1 - clickFx.t) + 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    void S;
  }

  function drawAtmosphere(t, dt, S) {
    const storm = Sim.isStorm(), h = S.hour, P = Sim.P;
    let col = null, a = 0;
    if (h < 7.5) { col = '255,170,90'; a = 0.16 * (7.5 - h) / 1.5; }
    else if (h > 16.5 && h < 19) { col = '255,140,60'; a = 0.18 * Math.min(1, (h - 16.5) / 2); }
    if (col) { ctx.fillStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH); }
    if (storm) { ctx.fillStyle = 'rgba(40,58,82,.3)'; ctx.fillRect(0, 0, VW, VH); }
    const night = h >= 18.5 ? Math.min(1, (h - 18.5) / 1.6) : 0;
    if (night > 0) {
      // ชั้นความมืด แล้วเจาะรูแสงรอบตัวผู้เล่น (ไฟฉาย) และโคมไฟของอาคาร
      if (darkCv.width !== cv.width || darkCv.height !== cv.height) { darkCv.width = cv.width; darkCv.height = cv.height; }
      const d = darkCtx;
      d.setTransform(DPR, 0, 0, DPR, 0, 0);
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, VW, VH);
      d.fillStyle = 'rgba(6,10,34,' + (0.74 * night).toFixed(3) + ')';
      d.fillRect(0, 0, VW, VH);
      d.globalCompositeOperation = 'destination-out';
      const holes = Sim.players().map(pl => ({ x: pl.x, y: pl.y - 16, r0: 46, r1: 210, a: 1 }));
      for (const L of Wd.lights) holes.push({ x: L.x, y: L.y, r0: 6, r1: L.r * 1.25, a: 0.72 });
      for (const o of holes) {
        const sx = (o.x - camX) * curZ, sy = (o.y - camY) * curZ, r1 = o.r1 * curZ;
        if (sx < -r1 || sx > VW + r1 || sy < -r1 || sy > VH + r1) continue;
        const g = d.createRadialGradient(sx, sy, o.r0 * curZ, sx, sy, r1);
        g.addColorStop(0, 'rgba(0,0,0,' + o.a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = g; d.fillRect(sx - r1, sy - r1, r1 * 2, r1 * 2);
      }
      ctx.drawImage(darkCv, 0, 0, VW, VH);
      ctx.globalCompositeOperation = 'lighter';
      for (const L of Wd.lights) {
        const sx = (L.x - camX) * curZ, sy = (L.y - camY) * curZ, r = L.r * 0.8 * curZ;
        if (sx < -r || sx > VW + r || sy < -r || sy > VH + r) continue;
        const lg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        lg.addColorStop(0, 'rgba(255,170,80,' + (0.16 * night).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = lg; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (storm) {
      if (!rain.length) for (let i = 0; i < 240; i++) rain.push({ x: Math.random() * VW, y: Math.random() * VH, s: 0.6 + Math.random() * 0.6 });
      ctx.strokeStyle = 'rgba(215,230,255,.55)'; ctx.lineWidth = 1.4; ctx.beginPath();
      for (const d of rain) {
        if (!Sim.paused) { d.y += 760 * d.s * dt; d.x += 160 * d.s * dt; }
        if (d.y > VH) { d.y = -20; d.x = Math.random() * VW; }
        if (d.x > VW) d.x -= VW;
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 4 * d.s, d.y - 16 * d.s);
      }
      ctx.stroke();
      if (!Sim.paused && Math.random() < dt * 0.025) flashT = 0.22;
    } else rain.length = 0;
    if (flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + flashT.toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH); flashT -= dt; }
  }

  function drawMini(view, S) {
    mctx.drawImage(Wd.mini, 0, 0);
    const k = 240 / Wd.W;
    mctx.strokeStyle = 'rgba(255,255,255,.9)'; mctx.lineWidth = 1.5;
    mctx.strokeRect(view.x * k, view.y * k, view.w * k, view.h * k);
    if (!S) return;
    for (const h of S.hazards) {
      if (h.done || !(h.disc || h.rep)) continue;
      mctx.fillStyle = SEV_COL[h.sev]; mctx.beginPath(); mctx.arc(h.x * k, h.y * k, 3.6, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#fff'; mctx.lineWidth = 1; mctx.stroke();
    }
    for (const p of S.ptw) {
      if (p.status !== 'pending') continue;
      mctx.fillStyle = '#1c7ed6'; mctx.fillRect(p.x * k - 3, p.y * k - 3, 6, 6);
    }
    for (const pl of Sim.players()) {
      mctx.fillStyle = PDOT[(pl.id - 1) % PDOT.length];
      mctx.beginPath(); mctx.arc(pl.x * k, pl.y * k, 4, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#3d2400'; mctx.lineWidth = 1.2; mctx.stroke();
    }
  }

  function render(t, dt) {
    const S = Sim.S;
    const pls = Sim.players();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#0a5c98'; ctx.fillRect(0, 0, VW, VH);
    // กล้อง: เล่นเครื่องเดียวกันหลายคน = จับกึ่งกลางทุกคนและซูมออกให้เห็นครบ · ออนไลน์ = ตามตัวเราเอง
    const camPls = netOn() ? [Sim.P] : pls;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const pl of camPls) { x0 = Math.min(x0, pl.x); x1 = Math.max(x1, pl.x); y0 = Math.min(y0, pl.y); y1 = Math.max(y1, pl.y); }
    let zWant = Z;
    if (camPls.length > 1) zWant = Math.max(0.42, Math.min(Z, VW / (x1 - x0 + 420), VH / (y1 - y0 + 360)));
    if (!curZ) curZ = zWant;
    curZ += (zWant - curZ) * Math.min(1, dt * 3);
    const z = curZ;
    const vw = VW / z, vh = VH / z;
    let tx = (x0 + x1) / 2 - vw / 2, ty = (y0 + y1) / 2 - vh / 2 - 20;
    tx = vw >= Wd.W ? (Wd.W - vw) / 2 : Math.max(0, Math.min(Wd.W - vw, tx));
    ty = vh >= Wd.H ? (Wd.H - vh) / 2 : Math.max(0, Math.min(Wd.H - vh, ty));
    if (!camInit) { camX = tx; camY = ty; camInit = true; }
    const k = Math.min(1, dt * 6);
    camX += (tx - camX) * k; camY += (ty - camY) * k;
    const view = { x: camX, y: camY, w: vw, h: vh };
    ctx.setTransform(DPR * z, 0, 0, DPR * z, -camX * z * DPR, -camY * z * DPR);
    const sx = Math.max(0, Math.floor(camX)), sy = Math.max(0, Math.floor(camY));
    const sw = Math.min(Wd.W - sx, Math.ceil(vw) + 2), sh = Math.min(Wd.H - sy, Math.ceil(vh) + 2);
    ctx.drawImage(Wd.ground, sx, sy, sw, sh, sx, sy, sw, sh);
    Wd.drawWater(ctx, t, view, S ? Sim.isStorm() : false);

    const list = [];
    for (const o of Wd.objects) if (Wd.inView(o, view)) list.push(o);
    if (S) {
      for (const n of Sim.npcs) if (n.on && !n.inside_t && inV(n, view)) list.push({ kind: 'npc', y: n.y, n });
      for (const g of Sim.guests) if (inV(g, view)) list.push({ kind: 'guest', y: g.y, g });
      for (const pl of pls) list.push({ kind: 'player', y: pl.y, pl });
    }
    list.sort((a, b) => a.y - b.y);
    for (const e of list) drawEntity(e, t, S);
    drawLabels(view);
    if (S) { drawTags(S); drawMarkers(t, view, S); }
    if (clickFx) { clickFx.t -= dt; if (clickFx.t <= 0) clickFx = null; }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (S) drawAtmosphere(t, dt, S);
    return view;
  }

  let lastView = null;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    if (Sim.S) {
      const pls = Sim.players();
      Sim.update(dt, playerInputs(pls));
      if (UI.isOpen() || (Sim.paused && !netOn())) targets = [];
      else targets = netOn() ? [Sim.findInteract(Sim.P)] : pls.map(pl => Sim.findInteract(pl));
    }
    if (window.Net) window.Net.tick(dt);
    hint(dt);
    lastView = render(t, dt);
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.2; UI.hud(); UI.prompt(targets); drawMini(lastView, Sim.S); }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ boot
  function boot() {
    resize();
    window.addEventListener('resize', resize);
    // โหลดภาพ 3 มิติจาก Blender ก่อน (ถ้าไม่มีจะใช้ภาพที่วาดด้วยโค้ดแทน)
    A.loadSprites().then(spriteCount => {
      const t0 = performance.now();
      Wd.build();
      const buildMs = Math.round(performance.now() - t0);
      document.getElementById('loading').remove();
      UI.init();
      const test = location.hash.match(/test(?:=(\w+))?/);
      if (test) {
        const m = test[1] || 'day';
        const n = m === 'coop2' ? 2 : /coop/.test(m) ? 3 : 1;
        Sim.newGame({ count: n, names: n > 1 ? ['', 'จป.ปลา', 'จป.ต้น'] : [] });
        window.__test = { buildMs, spriteCount };
        runTest(m);
      } else {
        // แสดงหน้าแรกทันที แล้วค่อยเติมปุ่ม "เล่นต่อ" ถ้าพบเกมที่บันทึกไว้ (มือถือบางรุ่นเปิดฐานข้อมูลช้า)
        UI.intro(null);
        DB.load('auto').then(rec => {
          if (rec && rec.data && !Sim.S) UI.intro({ day: rec.data.state.day, players: (rec.data.state.players || []).length });
        }).catch(() => {});
      }
      requestAnimationFrame(frame);
    });
  }

  // ทดสอบอัตโนมัติ (เปิดด้วย index.html#test หรือ #test=night / #test=storm / #test=npc / #test=hz)
  function runTest(mode) {
    const S = Sim.S;
    S.hour = mode === 'night' ? 20.2 : 9.5;
    if (mode === 'storm') Sim.toggleSeason();
    Sim.P.x = 1690; Sim.P.y = 930;
    if (mode === 'lobby') { Sim.P.x = 1160; Sim.P.y = 730; }
    if (mode === 'boh') { Sim.P.x = 720; Sim.P.y = 880; }
    if (mode === 'pier') { Sim.P.x = 2000; Sim.P.y = 818; }
    if (mode === 'coop' || mode === 'coop2') {
      const pls = Sim.players();
      [[1160, 730], [1690, 930], [1520, 1180]].forEach((p, i) => { if (pls[i]) { pls[i].x = p[0]; pls[i].y = p[1]; } });
    }
    if (mode === 'og') {
      // ภาพปกสำหรับแชร์ลิงก์: ซ่อนแถบต่างๆ แล้วแสดงชื่อเกมบนฉาก
      document.body.classList.add('og');
      S.hazards.forEach(h => { h.done = true; });
      Sim.P.x = 1560; Sim.P.y = 960;
      const t = document.createElement('div');
      t.id = 'ogtitle';
      t.innerHTML = '<b>จป.ซัน แห่งเกาะพีพี</b><span>เกมจำลองงาน จป.วิชาชีพ · เล่นออนไลน์กับเพื่อนได้</span>';
      document.body.appendChild(t);
      Sim.update(0.016, { x: 0, y: 0 });
      return;
    }
    for (const code of ['KIT_LPG', 'FB_GLASS', 'MAR_OVERLOAD', 'EHS_POOL']) { const h = Sim.spawnHazard(code); if (h) h.disc = true; }
    Sim.update(0.016, { x: 0, y: 0 });
    const n = Sim.npcs.find(x => x.on && x.department_id === 2);
    if (mode === 'npc' && n) { Sim.P.x = n.x; Sim.P.y = n.y + 20; UI.interact({ type: 'npc', obj: n }); }
    if (mode === 'hz') { const h = S.hazards[0]; Sim.P.x = h.x; Sim.P.y = h.y + 20; UI.interact({ type: 'hazard', obj: h }); }
    if (mode === 'sql') { window.__test.sql = DB.toSQL(G, Sim.serialize()).length; }
    // ทดสอบออนไลน์: เปิด 2 หน้า #test=nethost&room=XXXXXX และ #test=netjoin&room=XXXXXX
    const room = (location.hash.match(/room=(\w{6})/) || [])[1];
    if (mode === 'nethost' && room) {
      window.Net.host(room).then(c => console.log('NETHOST open ' + c)).catch(e => console.log('NETHOST error ' + e.message));
      setInterval(() => console.log('NETHOST players ' + JSON.stringify(Sim.players().map(p => [p.id, Math.round(p.x), Math.round(p.y), p.remote ? 'remote' : 'local'])) +
        ' memP2 ' + Sim.S.memories.filter(m => m.player_id === 2).length), 3000);
    }
    if (mode === 'netjoin' && room) {
      window.Net.join(room, 'จป.ทดสอบ').then(r => {
        console.log('NETJOIN welcome ' + JSON.stringify(r));
        setTimeout(() => {
          const S2 = Sim.S;
          console.log('NETJOIN mirror npcsVisible ' + Sim.npcs.filter(x => x.on).length + ' hazards ' + S2.hazards.length + ' players ' + Sim.players().length +
            ' hour ' + S2.hour.toFixed(2) + ' guests ' + Sim.guests.length + ' incidents ' + S2.incidents.length);
          const n = Sim.npcs.find(x => x.on);
          if (n) window.Net.request({ k: 'npc', id: n.id, topic: 'greet' })
            .then(res => console.log('NETJOIN talk ok: ' + res.reply.text.slice(0, 60) + ' | trust ' + res.npc.trust + ' mem ' + res.npc.mem_count))
            .catch(e => console.log('NETJOIN talk error ' + e.message));
          const h = S2.hazards[0];
          if (h) window.Net.request({ k: 'hz', id: h.id, act: 'stop' })
            .then(res => console.log('NETJOIN hazard ok resolved=' + res.r.resolved + ' best=' + res.r.best))
            .catch(e => console.log('NETJOIN hazard error ' + e.message));
          window.Net.request({ k: 'npc', id: 1, topic: '<script>' }).then(() => console.log('NETJOIN badreq ACCEPTED (bad)'))
            .catch(e => console.log('NETJOIN badreq rejected ok: ' + e.message));
          Sim.P.x += 60;
        }, 5000);
      }).catch(e => console.log('NETJOIN error ' + e.message));
    }
    if (mode === 'sim' || mode === 'simcoop') {
      // เร่งเวลา 3 วัน: สุ่มตัดสินใจทุกแบบเพื่อหาข้อผิดพลาดของระบบ
      const acts = ['stop', 'coach', 'car', 'ignore'], topics = ['greet', 'story', 'ppe', 'praise', 'toolbox', 'scold'];
      let steps = 0, panels = 0;
      while (S.day < 3 && steps < 200000 && !S.over) {
        steps++;
        Sim.paused = false;
        if (S.ending) { UI.close(true); Sim.nextDay(); continue; }
        Sim.update(0.1, { x: 0, y: 0 });
        if (UI.isOpen()) { panels++; UI.close(true); }
        if (steps % 150 === 0) {
          const h = S.hazards.find(x => !x.done);
          if (h) { h.disc = true; Sim.hazardAction(h, acts[Math.floor(Math.random() * 4)]); }
        }
        if (steps % 25 === 0) {
          const n = Sim.npcs.find(x => x.on && Math.random() < 0.05);
          if (n) { const r = Sim.talk(n, topics[steps % 6]); if (r.ppe_missing) Sim.ppeChoice(n, ['gentle', 'stop', 'scold'][steps % 3]); }
        }
        if (steps % 60 === 0) {
          const p = S.ptw.find(x => x.status === 'pending');
          if (p) { Sim.P.x = p.x; Sim.P.y = p.y; Sim.ptwDecision(p, ['check', 'approve', 'reject'][steps % 3]); }
          const r = S.incidents.find(x => x.status === 'investigating' && x.injury_level);
          if (r) Sim.investigate(r, ['condition', 'act', 'env'][steps % 3]);
          const g = Sim.guests[steps % Math.max(1, Sim.guests.length)];
          if (g) Sim.guestTalk(g, steps % 2 ? 'advise' : 'greet');
        }
        if (steps === 3000) Sim.toggleSeason();
      }
      const snap = Sim.serialize();
      const sql = DB.toSQL(G, snap);
      Sim.restore(JSON.parse(JSON.stringify(snap)));
      Object.assign(window.__test, {
        steps, panels, day: S.day, over: S.over, totals: S.totals, memories: S.memories.length, incidents: S.incidents.length,
        ptw: S.ptw.length, reports: S.day_reports.length, sqlKB: Math.round(sql.length / 1024), restoredDay: Sim.S.day,
        metrics: Sim.S.metrics, avgTrust: Math.round(Sim.avgTrust())
      });
      console.log('SIMTEST ' + JSON.stringify(window.__test));
      if (/dump/.test(location.hash)) (sql.match(/[\s\S]{1,2500}/g) || []).forEach((c, i) => console.log('SQLCHUNK ' + i + ' ' + JSON.stringify(c)));
      UI.close(true);
    }
    window.__test.ok = true;
    window.__test.onDuty = Sim.npcs.filter(x => x.on).length;
    document.title = 'TEST-OK ' + JSON.stringify(window.__test);
  }

  window.addEventListener('error', e => {
    document.title = 'TEST-ERROR ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno;
    const box = document.getElementById('errbox');
    if (box) { box.textContent = 'เกิดข้อผิดพลาด: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')'; box.style.display = 'block'; }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 30));
  else setTimeout(boot, 30);
})();
