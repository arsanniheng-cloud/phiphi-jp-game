// ============================================================================
// art.js — วาดกราฟิกทั้งหมดด้วยโค้ด (ตัวละคร ต้นไม้ อาคารทรงไทย เรือหางยาว)
// อาคาร/ต้นไม้วาดครั้งเดียวเก็บเป็นภาพ (sprite) ความละเอียด 2 เท่าเพื่อให้คมชัด
// ============================================================================
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const RES = 2;
  const FONT = '"Leelawadee UI","Sarabun",Tahoma,sans-serif';

  const SKIN = ['#f5d3b8', '#e6b38f', '#c98f66', '#9a6746'];
  const HAIR = ['#1c1512', '#3a2618', '#6a4226', '#c69a5a', '#e7cf8b', '#9a9a9a'];

  // ------------------------------------------------------------------ helpers
  function rng(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(h, a) {
    let [r, g, b] = hexRgb(h);
    if (a < 0) { r *= 1 + a; g *= 1 + a; b *= 1 + a; }
    else { r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function ell(c, x, y, rx, ry, fill) {
    c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    if (fill) { c.fillStyle = fill; } c.fill();
  }
  function canvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * RES)); cv.height = Math.max(1, Math.ceil(h * RES));
    const c = cv.getContext('2d');
    c.scale(RES, RES);
    return { cv, c };
  }

  // =================================================================== PEOPLE
  // ตัวละครสไตล์ชิบิ (หัวโต ตากลม แก้มแดง มีเส้นขอบนุ่ม) วาดด้วยโค้ด จุดอ้างอิงอยู่กึ่งกลางเท้า สูงประมาณ 45 หน่วย
  // L = { skin, hair, hair_style, shirt, pants, apron, vest, trim, hat, hat_color, shorts, glasses, hat2, lashes, shoe }
  // dir: 0 ลง (หันหน้าเข้าหาจอ), 1 ซ้าย, 2 ขวา, 3 ขึ้น (เห็นหลัง)
  // o: { scale, alpha, clipboard, t, pose, hold }
  //   pose = { l:[ไหล่,ศอก], r:[ไหล่,ศอก] (เรเดียน 0 = ห้อยลง บวก = กางออกด้านนอก), eyes, mouth, brow, lean, look, blink }
  //   hold = { l: fn(c, ang), r: fn(c, ang) } วาดของในมือ (ศูนย์กลางอยู่ที่ฝ่ามือ ang = มุมที่แขนหมุนไปแล้ว)
  const HY = -30.4, EYY = HY + 1.7;
  const OUT = 'rgba(70,40,30,.62)';
  const hx6 = (s, fb) => (typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s) ? s : fb);
  function edge(c, w) { c.strokeStyle = OUT; c.lineWidth = w || 0.8; c.lineJoin = 'round'; c.stroke(); }
  function fillEdge(c, fill, w) { c.fillStyle = fill; c.fill(); edge(c, w); }

  // สีที่คำนวณจากหน้าตา เก็บไว้ไม่ต้องคิดซ้ำทุกเฟรม
  const KC = new WeakMap();
  function kit(L) {
    let K = KC.get(L);
    if (K) return K;
    const skin = hx6(L.skin, '#f5d3b8'), shirt = hx6(L.shirt, '#f7f7f2'), pants = hx6(L.pants, '#2c3a55'), hair = hx6(L.hair, '#1c1512');
    const hat = L.hat ? hx6(L.hat_color, '#ffffff') : null;
    K = {
      skin, shirt, pants, hair, shoe: hx6(L.shoe, '#2b2420'),
      skinD: shade(skin, -0.13), shirtD: shade(shirt, -0.16), pantsD: shade(pants, -0.18), hairD: shade(hair, -0.28), hairH: shade(hair, 0.45),
      vest: L.vest ? hx6(L.vest, '#ff7a00') : null, apron: L.apron ? hx6(L.apron, '#ffffff') : null,
      hat, hatD: hat ? shade(hat, -0.2) : null, hatH: hat ? shade(hat, 0.35) : null, hatB: hat ? shade(hat, -0.1) : null,
      hat2: hx6(L.hat2, '#e85d75'), trim: L.trim ? hx6(L.trim, '#ffffff') : null
    };
    KC.set(L, K);
    return K;
  }

  // แขน 2 ท่อน: ต้นแขนสีเสื้อ (แขนสั้น) + ท่อนล่างสีผิว + มือกลม
  function arm2(c, sx, sy, a, b, K, hold) {
    c.save(); c.translate(sx, sy); c.rotate(a);
    rr(c, -2.1, -1.4, 4.2, 5.8, 2.1); fillEdge(c, K.shirt);
    c.translate(0, 3.9); c.rotate(b);
    rr(c, -1.65, -0.8, 3.3, 5.4, 1.65); fillEdge(c, K.skin);
    c.translate(0, 4.4);
    c.beginPath(); c.arc(0, 0.5, 2.05, 0, TAU); fillEdge(c, K.skin);
    if (hold) { c.save(); c.translate(0, 0.5); hold(c, a + b); c.restore(); }
    c.restore();
  }
  function clipboardItem(c, ang) {
    c.rotate(-ang);
    c.fillStyle = '#a8743f'; rr(c, -3.2, -9.4, 6.8, 9, 1); c.fill(); edge(c, 0.6);
    c.fillStyle = '#ffffff'; c.fillRect(-2.5, -8.4, 5.4, 6.8);
    c.fillStyle = '#7d8da1'; c.fillRect(-1.8, -7.2, 4, 0.6); c.fillRect(-1.8, -5.8, 4, 0.6); c.fillRect(-1.8, -4.4, 2.6, 0.6);
  }

  // ใบหน้าด้านหน้า: แก้ม ตา คิ้ว ปาก แว่น
  function faceFront(c, L, K, P) {
    const ey = EYY, dk = '#2a1a16', eyes = P.eyes || (P.blink ? 'closed' : 'normal'), lk = (P.look || 0) * 0.7;
    c.save();
    c.lineCap = 'round';
    c.fillStyle = 'rgba(255,112,125,.42)';
    c.beginPath(); c.ellipse(-6.3, ey + 3.0, 2.2, 1.25, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(6.3, ey + 3.0, 2.2, 1.25, 0, 0, TAU); c.fill();
    for (const s of [-1, 1]) {
      const cx = s * 3.7;
      if (eyes === 'happy') {
        c.strokeStyle = dk; c.lineWidth = 1.2;
        c.beginPath(); c.arc(cx, ey + 1.0, 1.9, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
      } else if (eyes === 'closed') {
        c.strokeStyle = dk; c.lineWidth = 1.05;
        c.beginPath(); c.moveTo(cx - 1.8, ey + 0.2); c.quadraticCurveTo(cx, ey + 1.6, cx + 1.8, ey + 0.2); c.stroke();
      } else {
        const big = eyes === 'wow' ? 1.15 : 1;
        c.fillStyle = dk; c.beginPath(); c.ellipse(cx + lk, ey, 1.85 * big, 2.5 * big, 0, 0, TAU); c.fill();
        c.fillStyle = '#6a4a3e'; c.beginPath(); c.ellipse(cx + lk, ey + 1.1, 1.3 * big, 1.0 * big, 0, 0, TAU); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(cx + lk - 0.55, ey - 0.95, 0.88 * big, 0, TAU); c.fill();
        c.beginPath(); c.arc(cx + lk + 0.75, ey + 1.15, 0.4, 0, TAU); c.fill();
        if (L.lashes) {
          c.strokeStyle = dk; c.lineWidth = 0.95;
          c.beginPath(); c.arc(cx + lk, ey, 2.2, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
          c.beginPath(); c.moveTo(cx + s * 1.7, ey - 1.6); c.lineTo(cx + s * 3.2, ey - 2.7); c.stroke();
        }
      }
      // คิ้ว
      const by = ey - 4.0, brow = P.brow || (eyes === 'worry' ? 'worry' : eyes === 'wow' ? 'up' : 'normal');
      c.strokeStyle = K.hairD; c.lineWidth = L.lashes ? 0.8 : 1.0;
      c.beginPath();
      if (brow === 'worry') { c.moveTo(cx + s * 1.9, by + 0.5); c.lineTo(cx - s * 1.9, by - 0.9); }
      else if (brow === 'up') { c.moveTo(cx - 1.9, by - 1.0); c.quadraticCurveTo(cx, by - 2.4, cx + 1.9, by - 1.0); }
      else if (brow === 'angry') { c.moveTo(cx + s * 1.9, by - 0.9); c.lineTo(cx - s * 1.9, by + 0.6); }
      else { c.moveTo(cx - 1.9, by + 0.2); c.quadraticCurveTo(cx, by - 0.9, cx + 1.9, by + 0.1); }
      c.stroke();
    }
    // จมูก + ปาก
    c.fillStyle = K.skinD; c.beginPath(); c.ellipse(0, ey + 2.6, 0.75, 0.5, 0, 0, TAU); c.fill();
    const my = ey + 4.6, mouth = P.mouth || 'smile';
    if (mouth === 'grin' || mouth === 'open' || mouth === 'o') {
      c.fillStyle = '#8e2f35'; c.beginPath();
      if (mouth === 'grin') c.arc(0, my - 0.7, 2.2, 0, Math.PI); else if (mouth === 'o') c.ellipse(0, my, 1.1, 1.45, 0, 0, TAU); else c.ellipse(0, my, 1.7, 1.55, 0, 0, TAU);
      c.closePath(); c.fill();
      if (mouth !== 'o') { c.fillStyle = '#ff8c96'; c.beginPath(); c.ellipse(0, my + 0.55, 1.0, 0.55, 0, 0, TAU); c.fill(); }
    } else if (mouth === 'flat') {
      c.strokeStyle = '#a24a42'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-1.5, my); c.lineTo(1.5, my); c.stroke();
    } else {
      c.strokeStyle = L.lashes ? '#d4506a' : '#a24a42'; c.lineWidth = 0.95;
      c.beginPath(); c.arc(0, my - 0.9, 1.7, 0.16 * Math.PI, 0.84 * Math.PI); c.stroke();
    }
    if (L.glasses) {
      c.strokeStyle = '#26262b'; c.lineWidth = 0.95; c.fillStyle = 'rgba(205,232,255,.2)';
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 3.7, ey + 0.2, 3.1, 0, TAU); c.fill(); c.stroke(); }
      c.beginPath(); c.moveTo(-0.6, ey - 0.2); c.lineTo(0.6, ey - 0.2); c.stroke();
    }
    c.restore();
  }

  // ผมด้านหน้า: ปกศีรษะ + ผมม้าเฉียง + ทรงต่างๆ
  function hairFront(c, L, K, style) {
    const buzz = style === 4;
    c.beginPath();
    if (buzz) {
      c.moveTo(-10.1, HY + 1.0);
      c.bezierCurveTo(-10.6, HY - 8.2, -5.6, HY - 10.4, 0, HY - 10.4);
      c.bezierCurveTo(5.6, HY - 10.4, 10.6, HY - 8.2, 10.1, HY + 1.0);
      c.quadraticCurveTo(8.4, HY - 4.4, 0, HY - 4.6);
      c.quadraticCurveTo(-8.4, HY - 4.4, -10.1, HY + 1.0);
    } else {
      c.moveTo(-10.4, HY + 1.2);
      c.bezierCurveTo(-11.6, HY - 9.6, -5.8, HY - 11.8, 0, HY - 11.8);
      c.bezierCurveTo(5.8, HY - 11.8, 11.6, HY - 9.6, 10.4, HY + 1.2);
      c.lineTo(9.6, HY - 2.6);
      c.quadraticCurveTo(7.4, HY - 5.4, 3.8, HY - 3.8);
      c.quadraticCurveTo(1.8, HY - 2.4, 0.4, HY - 4.6);
      c.quadraticCurveTo(-3.2, HY - 6.8, -6.2, HY - 3.4);
      c.quadraticCurveTo(-8.8, HY - 1.4, -10.4, HY + 1.2);
    }
    c.closePath();
    if (buzz) c.globalAlpha *= 0.88;
    fillEdge(c, K.hair, 0.8);
    if (buzz) c.globalAlpha /= 0.88;
    c.strokeStyle = K.hairH; c.globalAlpha *= 0.6; c.lineWidth = 1.3; c.lineCap = 'round';
    c.beginPath(); c.arc(-1.2, HY - 1.0, 8.4, Math.PI * 1.16, Math.PI * 1.6); c.stroke();
    c.globalAlpha /= 0.6;
    if (style === 0) {                                                   // รองทรง: จอนสั้น
      c.fillStyle = K.hair; rr(c, -10.5, HY - 1.5, 2.2, 5, 1); c.fill(); rr(c, 8.3, HY - 1.5, 2.2, 5, 1); c.fill();
    } else if (style === 1 || style === 2) {                             // ประบ่า / ยาว: ผมด้านข้างปรกลงมา
      const ln = style === 2 ? 17 : 11.5;
      rr(c, -11.7, HY - 4, 4.3, ln, 2.1); fillEdge(c, K.hair, 0.8); rr(c, 7.4, HY - 4, 4.3, ln, 2.1); fillEdge(c, K.hair, 0.8);
    } else if (style === 3) {                                            // มวยผมสูง
      c.beginPath(); c.arc(0, HY - 12.6, 4.3, 0, TAU); fillEdge(c, K.hair, 0.8);
      c.fillStyle = K.hairH; c.globalAlpha *= 0.5; c.beginPath(); c.arc(-1.4, HY - 14, 1.5, 0, TAU); c.fill(); c.globalAlpha /= 0.5;
      c.fillStyle = '#ff8fa3'; c.fillRect(-4.6, HY - 9.2, 9.2, 1.5);
    } else if (style === 5) {                                            // รวบผมต่ำ: หางผมโผล่ข้างไหล่
      c.beginPath(); c.arc(9.6, HY + 6.4, 3.4, 0, TAU); fillEdge(c, K.hair, 0.8);
      c.fillStyle = '#ff8fa3'; c.fillRect(8.2, HY + 3.4, 2.8, 1.3);
    }
  }

  function hatFront(c, K, L, side, f) {
    const hat = L.hat;
    if (!hat) return;
    const hc = K.hat, ox = side ? f * 0.9 : 0;
    if (hat === 'hardhat') {
      c.beginPath(); c.ellipse(ox + (side ? f * 1.5 : 0), HY - 5.0, side ? 12.4 : 11.8, 2.5, 0, 0, TAU); fillEdge(c, K.hatB, 0.8);
      c.beginPath(); c.ellipse(ox, HY - 5.4, 10.8, 8.6, 0, Math.PI, TAU); c.closePath(); fillEdge(c, hc, 0.85);
      c.fillStyle = K.hatH; rr(c, ox - 1.6, HY - 14.0, 3.2, 8.6, 1.4); c.fill(); edge(c, 0.5);
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(ox - 4.6, HY - 10.2, 2.6, 1.25, -0.5, 0, TAU); c.fill();
    } else if (hat === 'cap') {
      c.beginPath(); c.ellipse(ox, HY - 4.4, 10.5, 7.8, 0, Math.PI, TAU); c.closePath(); fillEdge(c, hc, 0.85);
      c.fillStyle = K.hatD;
      if (side) { c.beginPath(); c.ellipse(ox + f * 8.6, HY - 4.0, 5.4, 1.8, 0, 0, TAU); fillEdge(c, K.hatD, 0.7); }
      else if (dirFlag !== 3) { c.beginPath(); c.ellipse(0, HY - 3.6, 8.6, 2.6, 0, 0, Math.PI); fillEdge(c, K.hatD, 0.7); }
    } else if (hat === 'chef') {
      c.fillStyle = '#ffffff';
      rr(c, -6.8, HY - 16.4, 13.6, 11.5, 3.4); fillEdge(c, '#ffffff', 0.8);
      c.beginPath(); c.arc(-4.2, HY - 16.4, 4.6, 0, TAU); fillEdge(c, '#ffffff', 0.8);
      c.beginPath(); c.arc(0.2, HY - 18.2, 5.2, 0, TAU); fillEdge(c, '#ffffff', 0.8);
      c.beginPath(); c.arc(4.6, HY - 16.2, 4.6, 0, TAU); fillEdge(c, '#ffffff', 0.8);
      rr(c, -7.6, HY - 7.2, 15.2, 3.4, 1.4); fillEdge(c, '#ececec', 0.8);
    } else if (hat === 'ngob') {
      c.beginPath(); c.ellipse(ox, HY - 4.6, 14.6, 4.4, 0, 0, TAU); fillEdge(c, hc, 0.8);
      c.beginPath(); c.moveTo(ox - 9.4, HY - 5.4); c.quadraticCurveTo(ox, HY - 17.8, ox + 9.4, HY - 5.4); c.closePath(); fillEdge(c, shade(hc, 0.12), 0.8);
      c.strokeStyle = K.hatD; c.lineWidth = 0.6; c.beginPath(); c.ellipse(ox, HY - 4.6, 11.4, 3.3, 0, 0, TAU); c.stroke();
    } else if (hat === 'sunhat') {
      c.beginPath(); c.ellipse(ox, HY - 4.2, 13.6, 4.2, 0, 0, TAU); fillEdge(c, hc, 0.8);
      c.beginPath(); c.ellipse(ox, HY - 6.2, 8.2, 5.8, 0, Math.PI, TAU); c.closePath(); fillEdge(c, hc, 0.8);
      c.fillStyle = K.hat2; c.fillRect(ox - 8.0, HY - 7.4, 16, 2.0);
    }
  }
  let dirFlag = 0;

  function person(c, x, y, L, dir, phase, moving, o) {
    o = o || {};
    const P = o.pose || {};
    const K = kit(L);
    const sw = moving ? Math.sin(phase) : 0;
    const bob = o.bob !== undefined ? o.bob : (moving ? Math.abs(Math.sin(phase)) * 1.2 : 0);
    const side = dir === 1 || dir === 2, back = dir === 3, f = dir === 1 ? -1 : 1;
    const style = L.hair_style | 0, tw = side ? 9.8 : 13.4;
    const sq = o.squat || 0, sqd = sq * 4.6;          // ย่อเข่า (ใช้ในฉากอบรมท่ายกของ)
    dirFlag = dir;
    const hold = o.hold || {};
    c.save();
    c.translate(x, y);
    if (o.scale) c.scale(o.scale, o.scale);
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    c.fillStyle = 'rgba(15,40,45,.26)';
    c.beginPath(); c.ellipse(0, 0, 9.8, 3.5, 0, 0, TAU); c.fill();
    if (P.lean) c.rotate(P.lean);
    c.translate(0, -bob);

    // ---- ผมยาวด้านหลัง (วาดก่อนลำตัว)
    if (!back && (style === 2 || style === 1)) {
      if (side) { rr(c, f > 0 ? -12.6 : 1.8, HY - 3.4, 10.8, style === 2 ? 22 : 14, 5); fillEdge(c, K.hairD, 0.8); }
      else { rr(c, -11.2, HY - 3.6, 22.4, style === 2 ? 22.5 : 15, 8); fillEdge(c, K.hairD, 0.8); }
    }

    // ---- ขา
    const legCol = L.shorts ? K.skin : K.pants;
    if (side) {
      for (const s of [-1, 1]) {
        const lx = s * sw * 3.5, lift = Math.max(0, s * sw) * 1.8;
        rr(c, lx - 2.3, -10, 4.6, 10 - lift, 1.9); fillEdge(c, s < 0 ? (L.shorts ? K.skinD : K.pantsD) : legCol);
        c.beginPath(); c.ellipse(lx + f * 1.2, -1.5 - lift, 3.3, 1.95, 0, 0, TAU); fillEdge(c, K.shoe);
      }
      if (L.shorts) { rr(c, -4.8, -12, 9.6, 5.6, 2); fillEdge(c, K.pants); }
    } else {
      for (const s of [-1, 1]) {
        const lift = Math.max(0, s * sw) * 2.1;
        rr(c, s * (3.3 + sq * 1.8) - 2.4, -10 + sqd, 4.8, 10 - sqd - lift, 1.9); fillEdge(c, legCol);
        c.beginPath(); c.ellipse(s * (3.4 + sq * 1.8), -1.5 - lift, 3.0, 1.95, 0, 0, TAU); fillEdge(c, K.shoe);
      }
      if (L.shorts) { rr(c, -7.4, -12.4 + sqd, 14.8, 5.8, 2.2); fillEdge(c, K.pants); }
    }
    if (sqd) c.translate(0, sqd);

    // ---- ลำตัว (แขนข้างไกลวาดก่อนในมุมมองด้านข้าง)
    const holdL = hold.l || null;
    let holdR = hold.r || null;
    let pl = P.l, pr = P.r;
    if (o.clipboard && !back) { holdR = holdR || clipboardItem; pr = pr || (side ? [0.45, 1.25] : [-0.1, -1.25]); }
    const fw = v => -f * v;                      // มุมมองด้านข้าง: ค่าบวก = แกว่งไปทางที่หันหน้า
    if (side) arm2(c, -f * 0.6, -19, fw(pl ? pl[0] : -sw * 0.55), fw(pl ? pl[1] : 0.12), { shirt: K.shirtD, skin: K.skinD }, holdL);
    rr(c, -tw / 2, -21.8, tw, 13.8, 5.2); fillEdge(c, K.shirt, 0.85);
    c.save(); rr(c, -tw / 2, -21.8, tw, 13.8, 5.2); c.clip();
    c.fillStyle = 'rgba(0,0,0,.09)'; c.fillRect(side ? 0 : 1.2, -22, tw, 15);
    c.restore();
    if (K.vest) {
      const stripe = 'rgba(245,252,200,.95)';
      if (side || back) {
        rr(c, -tw / 2, -21.8, tw, 13.8, 5.2); fillEdge(c, K.vest, 0.85);
        c.fillStyle = stripe; c.fillRect(-tw / 2 + 0.4, -16.6, tw - 0.8, 1.6); c.fillRect(-tw / 2 + 0.4, -12.8, tw - 0.8, 1.4);
      } else {
        rr(c, -tw / 2, -21.8, 4.9, 13.8, 2.4); fillEdge(c, K.vest, 0.85); rr(c, tw / 2 - 4.9, -21.8, 4.9, 13.8, 2.4); fillEdge(c, K.vest, 0.85);
        c.fillStyle = stripe; c.fillRect(-tw / 2 + 0.3, -16.6, 4.3, 1.6); c.fillRect(tw / 2 - 4.6, -16.6, 4.3, 1.6);
        c.fillRect(-tw / 2 + 0.3, -12.8, 4.3, 1.4); c.fillRect(tw / 2 - 4.6, -12.8, 4.3, 1.4);
      }
    }
    if (K.apron && !back) {
      if (side) { rr(c, f > 0 ? -0.6 : -4.6, -20.2, 5.2, 12.2, 2.2); fillEdge(c, K.apron, 0.8); }
      else {
        rr(c, -5.2, -20.4, 10.4, 12.4, 2.4); fillEdge(c, K.apron, 0.8);
        c.strokeStyle = shade(K.apron, -0.25); c.lineWidth = 0.9; c.beginPath(); c.moveTo(-3.8, -20.4); c.lineTo(-5.6, -22); c.moveTo(3.8, -20.4); c.lineTo(5.6, -22); c.stroke();
        c.fillStyle = 'rgba(0,0,0,.1)'; rr(c, -3.2, -16.6, 6.4, 3.6, 1); c.fill();
      }
    }
    c.fillStyle = K.pantsD; c.fillRect(-tw / 2 + 0.7, -9.6, tw - 1.4, 1.5);
    if (!back && !side) {
      if (K.trim) { c.strokeStyle = K.trim; c.lineWidth = 1.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-2.8, -21.4); c.lineTo(0, -18.2); c.lineTo(2.8, -21.4); c.stroke(); }
      else if (!K.vest && !K.apron) { c.fillStyle = K.shirtD; c.beginPath(); c.arc(0, -16.8, 0.6, 0, TAU); c.arc(0, -13.4, 0.6, 0, TAU); c.fill(); }
    }

    // ---- ผมยาวด้านหลัง (มุมมองหลัง วาดทับลำตัว)
    if (back && (style === 2 || style === 1)) { rr(c, -9.8, HY + 4, 19.6, style === 2 ? 17 : 8.4, 6); fillEdge(c, K.hair, 0.8); }

    // ---- แขน
    if (side) arm2(c, f * 0.8, -19, fw(pr ? pr[0] : sw * 0.55), fw(pr ? pr[1] : 0.12), K, holdR);
    else {
      const aL = pl ? pl[0] : 0.12 + sw * 0.32, bL = pl ? pl[1] : 0.08;
      const aR = pr ? pr[0] : 0.12 - sw * 0.32, bR = pr ? pr[1] : 0.08;
      arm2(c, -tw / 2 + 0.3, -19, aL, bL, K, holdL);
      arm2(c, tw / 2 - 0.3, -19, -aR, -bR, K, holdR);
    }

    // ---- ศีรษะ
    if (back) {
      c.beginPath(); c.ellipse(0, HY, 10.2, 9.7, 0, 0, TAU); fillEdge(c, K.hair, 0.9);
      c.strokeStyle = K.hairH; c.globalAlpha *= 0.5; c.lineWidth = 1.3; c.lineCap = 'round';
      c.beginPath(); c.arc(-1.4, HY - 1, 8.2, Math.PI * 1.15, Math.PI * 1.62); c.stroke(); c.globalAlpha /= 0.5;
      if (style === 3) { c.beginPath(); c.arc(0, HY - 11.8, 4.3, 0, TAU); fillEdge(c, K.hair, 0.8); }
      if (style === 5) { c.beginPath(); c.arc(0, HY + 5.2, 4.2, 0, TAU); fillEdge(c, K.hair, 0.8); c.fillStyle = '#ff8fa3'; c.fillRect(-1.6, HY + 1.4, 3.2, 1.3); }
      if (style === 4) { c.fillStyle = K.skinD; c.beginPath(); c.ellipse(0, HY + 9.0, 5.4, 1.2, 0, 0, TAU); c.fill(); }
      hatFront(c, K, L, false, 1);
    } else if (side) {
      const hx = f * 0.9;
      // ผมด้านหลังศีรษะ (หางม้า/มวย) วาดก่อนหน้า
      if (style === 5) { c.beginPath(); c.arc(hx - f * 10.4, HY + 3.6, 3.7, 0, TAU); fillEdge(c, K.hair, 0.8); }
      if (style === 3) { c.beginPath(); c.arc(hx - f * 3.4, HY - 11.8, 4.2, 0, TAU); fillEdge(c, K.hair, 0.8); }
      c.beginPath(); c.arc(hx - f * 1.8, HY + 1.4, 2.1, 0, TAU); fillEdge(c, K.skinD, 0.7);
      c.beginPath(); c.ellipse(hx, HY, 9.4, 9.2, 0, 0, TAU); fillEdge(c, K.skin, 0.9);
      c.beginPath(); c.arc(hx + f * 9.3, HY + 1.9, 1.35, 0, TAU); fillEdge(c, K.skin, 0.7);      // จมูก
      c.beginPath(); c.arc(hx - f * 1.9, HY + 1.7, 1.6, 0, TAU); fillEdge(c, K.skinD, 0.6);      // หู
      const ex = hx + f * 4.7, ey = EYY, eyes = P.eyes || (P.blink ? 'closed' : 'normal');
      c.fillStyle = 'rgba(255,112,125,.42)'; c.beginPath(); c.ellipse(hx + f * 5.3, ey + 3.1, 2.0, 1.2, 0, 0, TAU); c.fill();
      if (eyes === 'happy' || eyes === 'closed') {
        c.strokeStyle = '#2a1a16'; c.lineWidth = 1.15; c.lineCap = 'round'; c.beginPath();
        if (eyes === 'happy') c.arc(ex, ey + 1.0, 1.8, Math.PI * 1.12, Math.PI * 1.88); else { c.moveTo(ex - 1.7, ey + 0.2); c.quadraticCurveTo(ex, ey + 1.5, ex + 1.7, ey + 0.2); }
        c.stroke();
      } else {
        c.fillStyle = '#2a1a16'; c.beginPath(); c.ellipse(ex, ey, 1.75, 2.45, 0, 0, TAU); c.fill();
        c.fillStyle = '#6a4a3e'; c.beginPath(); c.ellipse(ex, ey + 1.1, 1.25, 0.95, 0, 0, TAU); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - f * 0.5, ey - 0.95, 0.85, 0, TAU); c.fill();
        c.beginPath(); c.arc(ex + f * 0.6, ey + 1.1, 0.38, 0, TAU); c.fill();
        if (L.lashes) { c.strokeStyle = '#2a1a16'; c.lineWidth = 0.95; c.beginPath(); c.moveTo(ex + f * 1.4, ey - 1.5); c.lineTo(ex + f * 3.0, ey - 2.6); c.stroke(); }
      }
      c.strokeStyle = K.hairD; c.lineWidth = 1.0; c.lineCap = 'round';
      c.beginPath(); c.moveTo(ex - f * 1.6, ey - 3.9); c.quadraticCurveTo(ex, ey - 5.0, ex + f * 1.8, ey - 3.9); c.stroke();
      const my = ey + 4.7;
      if (P.mouth === 'open' || P.mouth === 'grin') { c.fillStyle = '#8e2f35'; c.beginPath(); c.ellipse(hx + f * 6.6, my, 1.3, 1.3, 0, 0, TAU); c.fill(); }
      else { c.strokeStyle = L.lashes ? '#d4506a' : '#a24a42'; c.lineWidth = 0.95; c.beginPath(); c.arc(hx + f * 6.2, my - 0.8, 1.5, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); }
      if (L.glasses) { c.strokeStyle = '#26262b'; c.lineWidth = 0.95; c.fillStyle = 'rgba(205,232,255,.2)'; c.beginPath(); c.arc(ex, ey + 0.2, 3.0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.moveTo(ex - f * 3.0, ey); c.lineTo(hx - f * 3.0, ey - 0.4); c.stroke(); }
      // ผมด้านข้าง
      c.beginPath();
      if (style === 4) {
        c.moveTo(hx + f * 9.0, HY - 1.8);
        c.bezierCurveTo(hx + f * 8.4, HY - 8.6, hx + f * 2.4, HY - 10.4, hx - f * 2.4, HY - 10.2);
        c.bezierCurveTo(hx - f * 9.6, HY - 9.6, hx - f * 10.2, HY - 2.0, hx - f * 9.0, HY + 2.2);
        c.lineTo(hx - f * 5.4, HY + 0.2); c.lineTo(hx + f * 0.4, HY - 4.0);
        c.quadraticCurveTo(hx + f * 5.0, HY - 5.2, hx + f * 9.0, HY - 1.8);
      } else {
        c.moveTo(hx + f * 9.6, HY - 0.2);
        c.bezierCurveTo(hx + f * 10.4, HY - 9.4, hx + f * 4.0, HY - 11.9, hx - f * 2.0, HY - 11.6);
        c.bezierCurveTo(hx - f * 10.0, HY - 11.2, hx - f * 11.6, HY - 2.6, hx - f * 9.8, HY + 4.4);
        c.lineTo(hx - f * 6.2, HY + 3.0); c.lineTo(hx - f * 5.2, HY - 1.6); c.lineTo(hx + f * 0.8, HY - 3.8);
        c.quadraticCurveTo(hx + f * 5.6, HY - 4.4, hx + f * 8.6, HY - 2.0);
        c.lineTo(hx + f * 9.6, HY - 0.2);
      }
      c.closePath(); fillEdge(c, K.hair, 0.8);
      c.strokeStyle = K.hairH; c.globalAlpha *= 0.55; c.lineWidth = 1.2; c.lineCap = 'round';
      c.beginPath(); c.arc(hx - f * 1.0, HY - 1.2, 8.6, f > 0 ? Math.PI * 1.2 : Math.PI * 1.35, f > 0 ? Math.PI * 1.65 : Math.PI * 1.8); c.stroke(); c.globalAlpha /= 0.55;
      hatFront(c, K, L, true, f);
    } else {
      c.beginPath(); c.arc(-9.5, HY + 1.4, 2.0, 0, TAU); fillEdge(c, K.skin, 0.8);
      c.beginPath(); c.arc(9.5, HY + 1.4, 2.0, 0, TAU); fillEdge(c, K.skin, 0.8);
      c.beginPath(); c.ellipse(0, HY, 9.8, 9.2, 0, 0, TAU); fillEdge(c, K.skin, 0.9);
      c.save(); c.beginPath(); c.ellipse(0, HY, 9.8, 9.2, 0, 0, TAU); c.clip();
      c.fillStyle = 'rgba(120,60,40,.08)'; c.beginPath(); c.ellipse(0, HY + 9.8, 12.5, 5.2, 0, 0, TAU); c.fill();
      c.restore();
      faceFront(c, L, K, P);
      hairFront(c, L, K, style);
      hatFront(c, K, L, false, 1);
    }
    c.restore();
  }

  // ---- แคชภาพตัวละคร (สำคัญมากบนมือถือ)
  // การวาดตัวละครด้วยโค้ดใช้ ~60 คำสั่งต่อคนต่อเฟรม ถ้าในจอมี 100+ คนเครื่องช้าจะกระตุก
  // จึงวาดแต่ละแบบ (หน้าตา × ทิศ × ท่าเดิน) ลงแผ่นภาพรวม (atlas) ครั้งเดียว แล้วใช้ drawImage คำสั่งเดียวต่อคน
  // หน้าตาที่เหมือนกันใช้ภาพร่วมกัน · ช่องในแผ่นที่ไม่ได้ใช้นานที่สุดจะถูกแย่งไปใช้ต่อเมื่อเต็ม
  const PW = 44, PH = 66, PAX = 22, PAY = 58, PCOLS = 11, PROWS = 8, PPAGES = 9;
  const PA = { res: 2, gen: 1, pages: [], slots: [], tick: 0, made: 0, budget: 8, recs: new Map() };
  function personCacheInit(res) {
    if (PA.init && res === PA.res) return;
    PA.init = true; PA.res = res; PA.gen++; PA.pages.length = 0; PA.slots.length = 0; PA.recs.clear();
  }
  function personCacheFrame(budget) { PA.made = 0; PA.budget = budget === undefined ? 8 : budget; }
  function paRec(L) {
    let r = L._rec;
    if (r) return r;
    const sig = [L.skin, L.hair, L.hair_style, L.shirt, L.pants, L.apron, L.vest, L.trim, L.hat, L.hat_color, L.shorts ? 1 : 0, L.glasses ? 1 : 0, L.hat2, L.lashes ? 1 : 0, L.shoe].join('|');
    r = PA.recs.get(sig);
    if (!r) { r = { ps: [], gen: PA.gen }; PA.recs.set(sig, r); }
    Object.defineProperty(L, '_rec', { value: r, configurable: true });
    return r;
  }
  function paSlot() {
    const per = PCOLS * PROWS, sw = Math.ceil(PW * PA.res), sh = Math.ceil(PH * PA.res);
    if (PA.slots.length < per * PPAGES) {
      const i = PA.slots.length, pg = (i / per) | 0, k = i % per;
      if (!PA.pages[pg]) { const cv = document.createElement('canvas'); cv.width = PCOLS * sw; cv.height = PROWS * sh; PA.pages[pg] = { cv, c: cv.getContext('2d') }; }
      const s = { pg, x: (k % PCOLS) * sw, y: ((k / PCOLS) | 0) * sh, use: 0, rec: null, idx: 0, gen: PA.gen };
      PA.slots.push(s);
      return s;
    }
    let best = PA.slots[0];
    for (let i = 1; i < PA.slots.length; i++) if (PA.slots[i].use < best.use) best = PA.slots[i];
    if (best.rec) best.rec.ps[best.idx] = null;
    return best;
  }
  function drawPerson(c, x, y, L, dir, phase, moving, o) {
    o = o || {};
    if (o.pose || o.hold || o.bob !== undefined || o.squat) { person(c, x, y, L, dir, phase, moving, o); return; }
    const rec = paRec(L);
    if (rec.gen !== PA.gen) { rec.ps = []; rec.gen = PA.gen; }
    const fr = moving ? (((((phase / TAU) % 1) + 1) % 1) * 8) | 0 : 8;
    const idx = dir * 10 + fr + (o.clipboard ? 40 : 0);
    let s = rec.ps[idx];
    if (!s || s.gen !== PA.gen) {
      if (PA.made >= PA.budget) { person(c, x, y, L, dir, phase, moving, o); return; }   // เฟรมนี้สร้างภาพใหม่ครบโควตาแล้ว วาดด้วยโค้ดไปก่อน
      PA.made++;
      s = paSlot();
      const pc = PA.pages[s.pg].c, sw = Math.ceil(PW * PA.res), sh = Math.ceil(PH * PA.res);
      pc.save(); pc.beginPath(); pc.rect(s.x, s.y, sw, sh); pc.clip(); pc.clearRect(s.x, s.y, sw, sh);
      pc.translate(s.x, s.y); pc.scale(sw / PW, sh / PH);
      person(pc, PAX, PAY, L, dir, moving ? (fr + 0.5) / 8 * TAU : 0, moving, { clipboard: !!o.clipboard });
      pc.restore();
      s.rec = rec; s.idx = idx; s.gen = PA.gen; rec.ps[idx] = s;
    }
    s.use = ++PA.tick;
    const sc = o.scale || 1, sw = Math.ceil(PW * PA.res), sh = Math.ceil(PH * PA.res), pg = PA.pages[s.pg].cv;
    if (o.alpha !== undefined) {
      const a = c.globalAlpha; c.globalAlpha = a * o.alpha;
      c.drawImage(pg, s.x, s.y, sw, sh, x - PAX * sc, y - PAY * sc, PW * sc, PH * sc);
      c.globalAlpha = a;
    } else c.drawImage(pg, s.x, s.y, sw, sh, x - PAX * sc, y - PAY * sc, PW * sc, PH * sc);
  }

  function playerLook() {
    return { skin: SKIN[1], hair: HAIR[0], hair_style: 0, shirt: '#f7f7f2', pants: '#2c3a55', vest: '#ff7a00',
      trim: '#ffffff', hat: 'hardhat', hat_color: '#ffffff', shoe: '#3a2a1e' };
  }
  // หน้าตาผู้เล่นจากหน้าสร้างตัวละคร: a = { gender, skin, hair, hair_style, vest } (skin/hair/vest = ลำดับในตัวเลือก)
  function avatarLook(a) {
    const AVO = (root.GAME_DATA && root.GAME_DATA.avatar_options) || {};
    const L = playerLook();
    a = a || {};
    L.skin = SKIN[a.skin] || SKIN[1];
    L.hair = (AVO.hair_colors || HAIR)[a.hair] || HAIR[0];
    L.hair_style = +a.hair_style || 0;
    L.vest = (AVO.vests || [])[a.vest] || '#ff7a00';
    L.lashes = a.gender === 'F';
    return L;
  }

  // NPC: แต่งตัวตามแผนก
  function npcLook(n, dept, ppeMissing) {
    const u = dept.uniform, lk = n.look || {};
    const L = {
      skin: SKIN[lk.skin || 0], hair: HAIR[lk.hair || 0], hair_style: lk.hair_style || 0,
      shirt: u.shirt, pants: u.pants, apron: u.apron || null, vest: u.vest || null, trim: u.trim || null,
      hat: u.hat || null, hat_color: u.hat_color || '#ffffff'
    };
    if (n.gender === 'F' && L.hair_style === 4) L.hair_style = 1;
    // ทำผิดกฎที่มองเห็นได้: ไม่สวมหมวกนิรภัย / ไม่ใส่เสื้อชูชีพ
    if (ppeMissing) {
      if (L.hat === 'hardhat') L.hat = null;
      if (dept.code === 'MAR') L.vest = null;
    }
    return L;
  }

  const GUEST_TOPS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#f783ac', '#ffffff', '#ffa94d', '#9775fa', '#3bc9db', '#e9ecef'];
  const GUEST_BOTTOMS = ['#1c7ed6', '#f1f3f5', '#343a40', '#e8590c', '#2b8a3e', '#c2255c', '#e6c18a'];
  function guestLook(seed) {
    const R = rng(seed * 7919 + 13);
    const skin = SKIN[(R() * 4) | 0];
    const hairPick = R();
    const hair = hairPick < 0.35 ? HAIR[4] : hairPick < 0.55 ? HAIR[3] : hairPick < 0.8 ? HAIR[1] : HAIR[0];
    const f = R() < 0.5;
    return {
      skin, hair, hair_style: f ? [1, 2, 3][(R() * 3) | 0] : [0, 4][(R() * 2) | 0],
      shirt: GUEST_TOPS[(R() * GUEST_TOPS.length) | 0], pants: GUEST_BOTTOMS[(R() * GUEST_BOTTOMS.length) | 0],
      shorts: true, glasses: R() < 0.35,
      hat: R() < 0.3 ? 'sunhat' : null, hat_color: ['#f3e2b3', '#fff4d6', '#d8b98a'][(R() * 3) | 0], hat2: ['#e85d75', '#4dabf7', '#2b2b2b'][(R() * 3) | 0],
      shoe: ['#f1f3f5', '#e8590c', '#343a40'][(R() * 3) | 0]
    };
  }

  // =================================================================== TREES
  function palmSprite(seed) {
    const R = rng(seed);
    const W = 130, H = 175;
    const { cv, c } = canvas(W, H);
    const bx = W / 2, by = H - 10;
    const lean = (R() - 0.5) * 40, th = 98 + R() * 26;
    const tx = bx + lean, ty = by - th;
    const cx1 = bx + lean * 0.15 + (R() - 0.5) * 22, cy1 = by - th * 0.5;
    c.fillStyle = 'rgba(20,60,40,.22)'; c.beginPath(); c.ellipse(bx + 16, by - 1, 30, 8, 0, 0, TAU); c.fill();
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const px = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx1 + t * t * tx;
      const py = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * cy1 + t * t * ty;
      const w = 7.4 - 3.6 * t;
      c.fillStyle = i % 2 ? '#8b6240' : '#a57751';
      c.beginPath(); c.ellipse(px, py, w, 3.6, 0, 0, TAU); c.fill();
    }
    const n = 9 + ((R() * 3) | 0);
    const order = [];
    for (let i = 0; i < n; i++) order.push((i / n) * TAU + R() * 0.35);
    order.sort((a, b) => Math.sin(a) - Math.sin(b));
    for (const a of order) frond(c, tx, ty, a, 44 + R() * 16, R);
    c.fillStyle = '#6b4a22';
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(tx - 5 + k * 3.5, ty + 4 + (k % 2) * 2, 3.1, 0, TAU); c.fill(); }
    return { cv, w: W, h: H, ax: bx, ay: by };
  }
  function frond(c, x, y, a, len, R) {
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len * 0.5 + 16;
    const mx = x + Math.cos(a) * len * 0.5, my = y + Math.sin(a) * len * 0.25 - 10;
    const greens = ['#2e8b3a', '#3a9d45', '#4cb050', '#2a7a35', '#56bd57'];
    c.strokeStyle = greens[(R() * greens.length) | 0];
    c.lineWidth = 2.2; c.lineCap = 'round';
    for (let t = 0.1; t <= 1.0001; t += 0.065) {
      const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * ex;
      const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * my + t * t * ey;
      const dx = 2 * (1 - t) * (mx - x) + 2 * t * (ex - mx), dy = 2 * (1 - t) * (my - y) + 2 * t * (ey - my);
      const l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, ll = (1 - t) * 9 + 3;
      c.beginPath();
      c.moveTo(px, py); c.lineTo(px + nx * ll + dx / l * 3, py + ny * ll + dy / l * 3 + 2);
      c.moveTo(px, py); c.lineTo(px - nx * ll + dx / l * 3, py - ny * ll + dy / l * 3 + 2);
      c.stroke();
    }
    c.strokeStyle = '#7a9a40'; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
  }

  function canopySprite(seed, kind) {
    // kind: 'frangipani' | 'jungle' | 'bougain' | 'hibiscus'
    const R = rng(seed);
    const big = kind === 'jungle', bush = kind === 'bougain' || kind === 'hibiscus';
    const W = big ? 120 : bush ? 64 : 96, H = big ? 140 : bush ? 52 : 108;
    const { cv, c } = canvas(W, H);
    const bx = W / 2, by = H - 6;
    c.fillStyle = 'rgba(20,60,40,.22)'; c.beginPath(); c.ellipse(bx + 8, by - 1, W * 0.36, 7, 0, 0, TAU); c.fill();
    const cy = bush ? by - 18 : by - H * 0.55, rad = bush ? 22 : big ? 44 : 32;
    if (!bush) {
      c.strokeStyle = big ? '#6d5a45' : '#8c7a66'; c.lineCap = 'round';
      c.lineWidth = big ? 8 : 5; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + (R() - 0.5) * 6, cy + 10); c.stroke();
      c.lineWidth = big ? 4 : 3;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(bx, cy + 18); c.lineTo(bx + (R() - 0.5) * rad * 1.4, cy - R() * 10); c.stroke(); }
    }
    const greens = big ? ['#1f6b2c', '#2a7d34', '#358f3d', '#46a148'] : ['#2f8a3c', '#3f9e47', '#52b452', '#2a7a35'];
    const blobs = bush ? 14 : big ? 26 : 20;
    for (let i = 0; i < blobs; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * rad;
      const px = bx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.7;
      c.fillStyle = greens[(R() * greens.length) | 0];
      c.beginPath(); c.arc(px, py, (bush ? 8 : big ? 15 : 11) + R() * 5, 0, TAU); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(bx - rad * 0.4 + R() * rad * 0.5, cy - rad * 0.45 + R() * 8, 5 + R() * 4, 0, TAU); c.fill(); }
    if (kind === 'frangipani') {
      const pink = R() < 0.4;
      for (let i = 0; i < 22; i++) {
        const a = R() * TAU, d = Math.sqrt(R()) * rad;
        const px = bx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.7 - 3;
        for (let p = 0; p < 5; p++) {
          const pa = p / 5 * TAU;
          c.fillStyle = pink ? '#ff9ec7' : '#fffaf0';
          c.beginPath(); c.ellipse(px + Math.cos(pa) * 1.8, py + Math.sin(pa) * 1.8, 1.7, 1.1, pa, 0, TAU); c.fill();
        }
        c.fillStyle = '#ffd43b'; c.beginPath(); c.arc(px, py, 0.9, 0, TAU); c.fill();
      }
    } else if (kind === 'bougain' || kind === 'hibiscus') {
      const cols = kind === 'bougain' ? ['#e0218a', '#ff4fa3', '#c2186b', '#ff77b7'] : ['#e63946', '#ff6b6b', '#f08c00'];
      for (let i = 0; i < (kind === 'bougain' ? 40 : 14); i++) {
        const a = R() * TAU, d = Math.sqrt(R()) * rad;
        c.fillStyle = cols[(R() * cols.length) | 0];
        c.beginPath(); c.arc(bx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7 - 2, kind === 'bougain' ? 2.4 : 3.2, 0, TAU); c.fill();
      }
    }
    return { cv, w: W, h: H, ax: bx, ay: by };
  }

  // =================================================================== BUILDINGS
  // พิกัดภายใน: (0,0) = มุมซ้ายบนของพื้นที่ฐานอาคาร, (w,d) = มุมขวาล่าง (แนวพื้นด้านหน้า)
  function makeBuilding(b) {
    const P = 34;
    const rise = roofRise(b);
    const top = b.h + rise + P;
    const bottom = 30;
    const W = b.w + P * 2, H = top + b.d + bottom;
    const { cv, c } = canvas(W, H);
    c.translate(P, top);
    const fn = DRAW[b.type] || DRAW.boh;
    fn(c, b, rng(hashStr(b.id)));
    return { cv, dx: -b.w / 2 - P, dy: -b.d - top, dw: W, dh: H };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h; }
  function roofRise(b) {
    if (b.type === 'sala_big') return b.w * 0.55 + b.d * 0.6;
    if (b.type === 'sala' || b.type === 'hut') return b.w * 0.36 + b.d * 0.55;
    if (b.type === 'villa' || b.type === 'bungalow') return b.d * 0.7 + 14;
    if (b.type === 'tower') return 36;
    return b.d * 0.45 + 10;
  }
  function groundShadow(c, w, d) {
    c.fillStyle = 'rgba(25,55,40,.26)';
    c.beginPath(); c.ellipse(w / 2 + 12, d + 2, w / 2 + 16, 13, 0, 0, TAU); c.fill();
  }

  function thaiEaveRoof(c, x0, x1, yE, yR, col, thatch, R) {
    const ov = 10;
    c.beginPath();
    c.moveTo(x0 - ov, yE);
    c.quadraticCurveTo(x0 - ov - 3, yE - 3, x0 - ov - 6, yE - 8);
    c.lineTo(x0 + 6, yR);
    c.lineTo(x1 - 6, yR);
    c.lineTo(x1 + ov + 6, yE - 8);
    c.quadraticCurveTo(x1 + ov + 3, yE - 3, x1 + ov, yE);
    c.closePath();
    const g = c.createLinearGradient(0, yR, 0, yE);
    g.addColorStop(0, shade(col, 0.18)); g.addColorStop(1, shade(col, -0.18));
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    if (thatch) {
      for (let i = 0; i < 260; i++) {
        const px = x0 - ov + R() * (x1 - x0 + ov * 2), py = yR + R() * (yE - yR);
        c.strokeStyle = R() < 0.5 ? 'rgba(90,60,20,.35)' : 'rgba(255,240,190,.25)';
        c.lineWidth = 0.8; c.beginPath(); c.moveTo(px, py); c.lineTo(px + (R() - 0.5) * 2, py + 5 + R() * 4); c.stroke();
      }
      for (let y = yR + 8; y < yE; y += 9) { c.fillStyle = 'rgba(70,45,15,.18)'; c.fillRect(x0 - ov - 8, y, x1 - x0 + ov * 2 + 16, 1.6); }
    } else {
      let row = 0;
      for (let y = yR + 5; y < yE - 1; y += 5, row++) {
        c.fillStyle = 'rgba(0,0,0,.13)'; c.fillRect(x0 - ov - 8, y, x1 - x0 + ov * 2 + 16, 1.1);
        c.fillStyle = 'rgba(0,0,0,.07)';
        for (let x = x0 - ov + (row % 2) * 4; x < x1 + ov; x += 8) c.fillRect(x, y - 4, 0.9, 4);
      }
    }
    c.restore();
    c.fillStyle = shade(col, -0.38); c.fillRect(x0 - ov, yE - 2.4, x1 - x0 + ov * 2, 3.4);
    c.strokeStyle = shade(col, -0.32); c.lineWidth = 3;
    c.beginPath(); c.moveTo(x0 + 6, yR); c.lineTo(x1 - 6, yR); c.stroke();
    c.strokeStyle = '#d6a443'; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0 + 6, yR); c.lineTo(x0 - ov - 6, yE - 8); c.stroke();
    c.beginPath(); c.moveTo(x1 - 6, yR); c.lineTo(x1 + ov + 6, yE - 8); c.stroke();
    c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(x0 + 6, yR); c.quadraticCurveTo(x0 - 3, yR - 4, x0 + 1, yR - 13); c.stroke();
    c.beginPath(); c.moveTo(x1 - 6, yR); c.quadraticCurveTo(x1 + 3, yR - 4, x1 - 1, yR - 13); c.stroke();
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0 - ov - 6, yE - 8); c.quadraticCurveTo(x0 - ov - 12, yE - 10, x0 - ov - 11, yE - 16); c.stroke();
    c.beginPath(); c.moveTo(x1 + ov + 6, yE - 8); c.quadraticCurveTo(x1 + ov + 12, yE - 10, x1 + ov + 11, yE - 16); c.stroke();
  }

  // หลังคาจั่วหันหน้า (หน้าบันทรงไทย) ใช้กับศาลา ล็อบบี้ สปา
  function thaiGableRoof(c, x0, x1, yE, col, depth, R, ornate) {
    const w = x1 - x0, ov = 14, mid = (x0 + x1) / 2;
    const apex = yE - (w / 2 + ov) * 0.62;
    const back = depth;
    const L0 = x0 - ov, R0 = x1 + ov;
    c.fillStyle = shade(col, 0.1);
    c.beginPath(); c.moveTo(L0, yE); c.lineTo(mid, apex); c.lineTo(mid, apex - back); c.lineTo(L0, yE - back); c.closePath(); c.fill();
    c.fillStyle = shade(col, -0.12);
    c.beginPath(); c.moveTo(R0, yE); c.lineTo(mid, apex); c.lineTo(mid, apex - back); c.lineTo(R0, yE - back); c.closePath(); c.fill();
    c.save();
    c.beginPath(); c.moveTo(L0, yE); c.lineTo(mid, apex); c.lineTo(mid, apex - back); c.lineTo(L0, yE - back); c.closePath();
    c.moveTo(R0, yE); c.lineTo(mid, apex); c.lineTo(mid, apex - back); c.lineTo(R0, yE - back); c.closePath();
    c.clip();
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1;
    for (let k = 4; k < back; k += 5) {
      c.beginPath(); c.moveTo(L0, yE - k); c.lineTo(mid, apex - k); c.lineTo(R0, yE - k); c.stroke();
    }
    c.restore();
    c.strokeStyle = shade(col, -0.35); c.lineWidth = 3;
    c.beginPath(); c.moveTo(mid, apex); c.lineTo(mid, apex - back); c.stroke();
    // หน้าบัน
    c.fillStyle = '#c98a35';
    c.beginPath(); c.moveTo(L0 + 8, yE); c.lineTo(mid, apex + 5); c.lineTo(R0 - 8, yE); c.closePath(); c.fill();
    c.fillStyle = '#7d4521';
    c.beginPath(); c.moveTo(L0 + 18, yE - 2); c.lineTo(mid, apex + 13); c.lineTo(R0 - 18, yE - 2); c.closePath(); c.fill();
    if (ornate) {
      c.strokeStyle = 'rgba(240,200,110,.75)'; c.lineWidth = 1;
      const cy = yE - (yE - apex) * 0.38;
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        c.beginPath(); c.moveTo(mid, cy); c.lineTo(mid + Math.cos(a) * (w * 0.32), cy + Math.sin(a) * (yE - apex) * 0.45); c.stroke();
      }
      c.fillStyle = '#e9c46a'; c.beginPath(); c.arc(mid, cy, Math.min(10, w * 0.05), 0, TAU); c.fill();
      c.fillStyle = '#7d4521'; c.beginPath(); c.arc(mid, cy, Math.min(5, w * 0.025), 0, TAU); c.fill();
    }
    // ป้านลม + ใบระกา + ช่อฟ้า + หางหงส์
    c.strokeStyle = '#e0a83a'; c.lineWidth = 4.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(L0, yE); c.lineTo(mid, apex); c.lineTo(R0, yE); c.stroke();
    c.fillStyle = '#f0c75e';
    for (let t = 0.08; t < 0.95; t += 0.07) {
      for (const s of [-1, 1]) {
        const px = mid + s * (mid - L0) * (1 - t), py = apex + (yE - apex) * (1 - t);
        c.beginPath(); c.moveTo(px - 2, py - 1); c.lineTo(px + s * 1.5, py - 6); c.lineTo(px + 2, py - 1); c.closePath(); c.fill();
      }
    }
    c.strokeStyle = '#e0a83a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(mid, apex); c.quadraticCurveTo(mid + 3, apex - 14, mid - 7, apex - 20); c.stroke();
    c.beginPath(); c.arc(mid - 7, apex - 20, 2, 0, TAU); c.fillStyle = '#f0c75e'; c.fill();
    c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(L0, yE); c.quadraticCurveTo(L0 - 7, yE - 2, L0 - 6, yE - 11); c.stroke();
    c.beginPath(); c.moveTo(R0, yE); c.quadraticCurveTo(R0 + 7, yE - 2, R0 + 6, yE - 11); c.stroke();
    return apex;
  }

  function deck(c, x, y, w, h, R) {
    c.fillStyle = '#b98a5c'; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(80,50,25,.25)';
    for (let yy = y + 3; yy < y + h; yy += 3.4) c.fillRect(x, yy, w, 0.8);
    c.fillStyle = '#7d5634'; c.fillRect(x, y + h, w, 3.5);
  }

  const DRAW = {
    villa(c, b, R) { houseThai(c, b, R, false); },
    bungalow(c, b, R) { houseThai(c, b, R, true); },

    sala(c, b, R) { pavilion(c, b, R, false); },
    sala_big(c, b, R) { pavilion(c, b, R, true); },

    boh(c, b, R) {
      const w = b.w, d = b.d, h = b.h, roof = b.roof || '#6c8ead';
      groundShadow(c, w, d);
      c.fillStyle = '#e4e0d5'; c.fillRect(0, d - h, w, h);
      c.fillStyle = '#cfc8b8'; c.fillRect(0, d - 5, w, 5);
      c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(w * 0.55, d - h, w * 0.45, h);
      c.fillStyle = '#a7b1bc'; c.fillRect(w * 0.12, d - h + 11, w * 0.32, h - 11);
      c.fillStyle = 'rgba(0,0,0,.13)';
      for (let y = d - h + 13; y < d; y += 3) c.fillRect(w * 0.12, y, w * 0.32, 0.8);
      c.fillStyle = '#5d6b7a'; c.fillRect(w * 0.58, d - h + 13, 13, h - 13);
      c.fillStyle = '#d9d0b8'; c.beginPath(); c.arc(w * 0.58 + 10.5, d - h / 2 + 5, 1, 0, TAU); c.fill();
      c.fillStyle = '#9fbccb'; c.fillRect(w * 0.74, d - h + 12, 18, 11);
      c.fillStyle = 'rgba(40,60,70,.4)'; for (let i = 0; i < 4; i++) c.fillRect(w * 0.74, d - h + 13.5 + i * 2.6, 18, 0.9);
      c.fillStyle = '#f2f2f2'; c.fillRect(w - 18, d - h + 26, 13, 8);
      c.fillStyle = '#c8ccd0'; c.fillRect(w - 16, d - h + 28, 9, 4);
      c.fillStyle = '#2f4858'; c.fillRect(w * 0.12, d - h + 3, w * 0.32, 7);
      const yE = d - h + 4, yR = d - h - d * 0.45;
      c.beginPath(); c.moveTo(-7, yE); c.lineTo(w + 7, yE); c.lineTo(w + 4, yR); c.lineTo(-4, yR); c.closePath();
      c.fillStyle = roof; c.fill();
      c.save(); c.clip();
      for (let x = -8; x < w + 8; x += 5) { c.fillStyle = (x / 5) % 2 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'; c.fillRect(x, yR, 2.5, yE - yR); }
      c.restore();
      c.fillStyle = shade(roof, -0.35); c.fillRect(-7, yE - 2, w + 14, 3);
      c.strokeStyle = shade(roof, -0.3); c.lineWidth = 3; c.beginPath(); c.moveTo(-4, yR); c.lineTo(w + 4, yR); c.stroke();
    },

    shed(c, b, R) {
      const w = b.w, d = b.d, h = b.h, roof = b.roof || '#6c757d';
      groundShadow(c, w, d);
      c.fillStyle = '#3d3a35'; c.fillRect(2, d - h, w - 4, h);
      if (b.id === 'generator') {
        c.fillStyle = '#f2b705'; rr(c, w * 0.18, d - h + 10, w * 0.64, h - 12, 3); c.fill();
        c.fillStyle = '#333'; c.fillRect(w * 0.24, d - h + 15, w * 0.2, 7);
        c.fillStyle = '#8a8a8a'; c.fillRect(w * 0.6, d - h + 4, 4, 10);
      } else {
        for (let i = 0; i < 14; i++) {
          c.fillStyle = ['#2f9e44', '#40c057', '#e8590c', '#c2255c'][(R() * 4) | 0];
          c.beginPath(); c.arc(8 + R() * (w - 16), d - 6 - R() * (h - 14), 3 + R() * 2, 0, TAU); c.fill();
          c.fillStyle = '#9c6b3f'; c.fillRect(6 + R() * (w - 12), d - 5, 6, 4);
        }
      }
      for (const px of [2, w - 6]) { c.fillStyle = '#6d5a45'; c.fillRect(px, d - h, 4, h); }
      const yE = d - h + 4, yR = d - h - d * 0.45;
      c.beginPath(); c.moveTo(-6, yE); c.lineTo(w + 6, yE); c.lineTo(w + 3, yR); c.lineTo(-3, yR); c.closePath();
      c.fillStyle = roof; c.fill();
      c.save(); c.clip();
      for (let x = -8; x < w + 8; x += 5) { c.fillStyle = (x / 5) % 2 ? 'rgba(255,255,255,.13)' : 'rgba(0,0,0,.1)'; c.fillRect(x, yR, 2.5, yE - yR); }
      c.restore();
      c.fillStyle = shade(roof, -0.35); c.fillRect(-6, yE - 2, w + 12, 3);
    },

    booth(c, b, R) {
      const w = b.w, d = b.d, h = b.h;
      groundShadow(c, w, d);
      c.fillStyle = '#ecebe4'; c.fillRect(0, d - h, w, h);
      c.fillStyle = '#9fd0e0'; c.fillRect(5, d - h + 6, w - 10, h * 0.45);
      c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(7, d - h + 7, 6, h * 0.42);
      c.fillStyle = '#33465c'; c.fillRect(-6, d - h - 8, w + 12, 10);
      c.fillStyle = '#4a627d'; c.fillRect(-6, d - h - 10, w + 12, 3);
      c.fillStyle = '#ffd43b'; c.fillRect(w / 2 - 12, d - h - 6, 24, 5);
    },

    hut(c, b, R) {
      const w = b.w, d = b.d, h = b.h;
      groundShadow(c, w, d);
      c.fillStyle = '#4a3624'; c.fillRect(0, d - h, w, h);
      const cols = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c'];
      for (let i = 0; i < 4; i++) { c.fillStyle = cols[i]; rr(c, 8 + i * ((w - 20) / 4), d - h + 6, 7, h - 8, 3); c.fill(); }
      for (const px of [0, w / 2 - 2, w - 4]) { c.fillStyle = '#c9a26a'; c.fillRect(px, d - h, 4, h); }
      thaiGableRoof(c, 0, w, d - h + 6, '#c9a25e', b.d * 0.5, R, false);
      c.fillStyle = '#1971c2'; rr(c, w / 2 - 20, d - 8, 40, 9, 2); c.fill();
    },

    tower(c, b, R) {
      const w = b.w, d = b.d, h = b.h;
      groundShadow(c, w, d);
      c.strokeStyle = '#b98a5c'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(2, d); c.lineTo(6, d - h); c.moveTo(w - 2, d); c.lineTo(w - 6, d - h);
      c.moveTo(4, d - h * 0.45); c.lineTo(w - 4, d - h * 0.45); c.moveTo(4, d - 4); c.lineTo(w - 5, d - h * 0.45); c.stroke();
      c.fillStyle = '#b98a5c'; c.fillRect(-3, d - h - 3, w + 6, 6);
      c.fillStyle = '#ffffff'; c.fillRect(1, d - h - 18, w - 2, 15);
      c.fillStyle = '#e03131'; c.fillRect(1, d - h - 12, w - 2, 4);
      c.fillStyle = '#e03131'; c.beginPath(); c.moveTo(-5, d - h - 17); c.lineTo(w / 2, d - h - 32); c.lineTo(w + 5, d - h - 17); c.closePath(); c.fill();
      c.strokeStyle = '#555'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(w / 2, d - h - 32); c.lineTo(w / 2, d - h - 50); c.stroke();
      c.fillStyle = '#e03131'; c.fillRect(w / 2, d - h - 50, 10, 4); c.fillStyle = '#ffd43b'; c.fillRect(w / 2, d - h - 46, 10, 4);
      c.fillStyle = '#e03131'; rr(c, w + 2, d - 22, 6, 22, 3); c.fill();
    }
  };

  function houseThai(c, b, R, thatch) {
    const w = b.w, d = b.d, h = b.h;
    const roofCol = thatch ? '#c9a25e' : ['#7a4528', '#8e3b2b', '#6b4a30', '#7d3f28'][(R() * 4) | 0];
    const wall = thatch ? '#e9d4a4' : '#f4eadb';
    const wood = '#6a3f22';
    groundShadow(c, w, d + 12);
    const base = d - 8;
    c.fillStyle = '#5a3a22'; c.fillRect(2, base, w - 4, 8);
    for (let x = 6; x < w - 4; x += 16) { c.fillStyle = '#3f2814'; c.fillRect(x, base + 2, 3, 6); }
    c.fillStyle = wall; c.fillRect(4, base - h, w - 8, h);
    if (thatch) {
      c.strokeStyle = 'rgba(140,100,40,.35)'; c.lineWidth = 0.8;
      for (let y = base - h + 3; y < base; y += 3) { c.beginPath(); c.moveTo(4, y); c.lineTo(w - 4, y); c.stroke(); }
    }
    c.fillStyle = wood;
    c.fillRect(4, base - h, 3, h); c.fillRect(w - 7, base - h, 3, h); c.fillRect(w / 2 - 14, base - h, 2.5, h); c.fillRect(w / 2 + 11.5, base - h, 2.5, h);
    c.fillRect(4, base - h, w - 8, 3); c.fillRect(4, base - 3, w - 8, 3);
    c.fillStyle = '#6d4326'; c.fillRect(w / 2 - 8, base - h + 8, 16, h - 11);
    c.fillStyle = '#87552f'; c.fillRect(w / 2 - 6, base - h + 10, 5, h - 16); c.fillRect(w / 2 + 1, base - h + 10, 5, h - 16);
    c.fillStyle = '#e9c46a'; c.beginPath(); c.arc(w / 2 + 4.5, base - h / 2 + 2, 0.9, 0, TAU); c.fill();
    for (const wx of [12, w - 30]) {
      c.fillStyle = '#a9d7e6'; c.fillRect(wx, base - h + 9, 18, 12);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(wx + 2, base - h + 10, 4, 10);
      c.fillStyle = wood; c.fillRect(wx + 8.2, base - h + 9, 1.6, 12); c.fillRect(wx, base - h + 14.4, 18, 1.4);
      c.fillStyle = '#8a5530'; c.fillRect(wx - 5, base - h + 8, 4.5, 14); c.fillRect(wx + 18.5, base - h + 8, 4.5, 14);
    }
    c.fillStyle = 'rgba(255,214,120,.9)'; c.beginPath(); c.arc(w / 2 - 12, base - h + 9, 1.8, 0, TAU); c.fill();
    deck(c, -4, base, w + 8, 18, R);
    c.fillStyle = '#6a3f22';
    for (let x = -4; x <= w + 4; x += 11) {
      if (Math.abs(x - w / 2) < 12) continue;
      c.fillRect(x, base + 10, 2, 8);
    }
    c.fillRect(-4, base + 9, w / 2 - 8, 2); c.fillRect(w / 2 + 12, base + 9, w / 2 - 8, 2);
    c.fillStyle = '#c99a6b'; c.fillRect(w / 2 - 10, base + 21, 20, 4); c.fillStyle = '#b48555'; c.fillRect(w / 2 - 11, base + 25, 22, 4);
    if (!thatch) {
      c.fillStyle = '#2f9e44'; c.beginPath(); c.arc(-1, base + 6, 4, 0, TAU); c.fill();
      c.fillStyle = '#e0218a'; c.beginPath(); c.arc(-2, base + 4, 1.6, 0, TAU); c.fill();
    }
    thaiEaveRoof(c, 0, w, base - h + 5, base - h - d * 0.7 - 6, roofCol, thatch, R);
  }

  function pavilion(c, b, R, big) {
    const w = b.w, d = b.d, h = b.h;
    groundShadow(c, w, d);
    const base = d - 6;
    c.fillStyle = '#d6c8ab'; c.fillRect(-4, base, w + 8, 6);
    c.fillStyle = '#bfae8c'; c.fillRect(-4, base + 6, w + 8, 3);
    const iy = base - h;
    const g = c.createLinearGradient(0, iy, 0, base);
    g.addColorStop(0, '#3b2a1e'); g.addColorStop(0.45, '#6b4c34'); g.addColorStop(1, '#d9bb92');
    c.fillStyle = g; c.fillRect(0, iy, w, h);
    c.fillStyle = 'rgba(255,255,255,.12)';
    for (let x = 6; x < w; x += 14) c.fillRect(x, base - 10, 0.8, 10);
    if (b.id === 'restaurant') {
      for (let i = 0; i < 5; i++) {
        const tx = 22 + i * ((w - 44) / 4), ty = base - 9;
        c.fillStyle = '#6d4326'; c.fillRect(tx - 9, ty - 1, 4, 6); c.fillRect(tx + 5, ty - 1, 4, 6);
        c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(tx, ty - 2, 8, 3.6, 0, 0, TAU); c.fill();
        c.fillStyle = '#ff8787'; c.beginPath(); c.arc(tx, ty - 3, 1.4, 0, TAU); c.fill();
      }
      c.fillStyle = '#e9c46a';
      for (let x = 10; x < w - 6; x += 18) { c.beginPath(); c.arc(x, iy + 12, 2.4, 0, TAU); c.fill(); }
    } else if (b.id === 'spa') {
      for (let i = 0; i < 3; i++) {
        const tx = 32 + i * ((w - 64) / 2);
        c.fillStyle = '#f8f9fa'; rr(c, tx - 13, base - 12, 26, 7, 2); c.fill();
        c.fillStyle = '#8ce99a'; c.fillRect(tx - 13, base - 12, 26, 2);
      }
      c.fillStyle = '#2f9e44'; c.beginPath(); c.arc(10, base - 8, 6, 0, TAU); c.fill(); c.beginPath(); c.arc(w - 10, base - 8, 6, 0, TAU); c.fill();
    } else {
      c.fillStyle = '#6d4326'; rr(c, w / 2 - 34, base - 15, 68, 11, 2); c.fill();
      c.fillStyle = '#e9c46a'; c.fillRect(w / 2 - 34, base - 15, 68, 2);
      c.fillStyle = '#f1e3c8'; rr(c, 14, base - 12, 26, 8, 3); c.fill(); rr(c, w - 40, base - 12, 26, 8, 3); c.fill();
      c.fillStyle = '#c92a2a'; c.beginPath(); c.ellipse(w / 2, base - 22, 5, 7, 0, 0, TAU); c.fill();
      c.fillStyle = '#2f9e44'; c.beginPath(); c.arc(w / 2, base - 31, 8, 0, TAU); c.fill();
    }
    const nposts = big ? 7 : 5;
    for (let i = 0; i < nposts; i++) {
      const px = 2 + i * ((w - 9) / (nposts - 1));
      c.fillStyle = '#5b351e'; c.fillRect(px, iy, 5, h);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(px + 1, iy, 1.2, h);
      c.fillStyle = '#e0a83a'; c.fillRect(px - 0.5, iy, 6, 2.5);
    }
    c.fillStyle = '#e8dcc4'; c.fillRect(w / 2 - 28, base + 9, 56, 5); c.fillStyle = '#d6c8ab'; c.fillRect(w / 2 - 32, base + 14, 64, 5);
    if (big) {
      thaiGableRoof(c, -10, w + 10, iy + 10, '#8e3b2b', d * 0.55, R, true);
      const inner = w * 0.62;
      thaiGableRoof(c, (w - inner) / 2, (w + inner) / 2, iy + 10 - w * 0.25, '#7a3324', d * 0.5, R, true);
    } else {
      thaiGableRoof(c, 0, w, iy + 8, b.id === 'spa' ? '#6b4a30' : '#8e3b2b', d * 0.55, R, true);
    }
  }

  // =================================================================== PROPS
  function makeProp(p, idx) {
    const R = rng(idx * 97 + 11);
    let W = 40, H = 40, ax = 20, ay = 34;
    if (p.type === 'umbrella') { W = 48; H = 54; ax = 24; ay = 48; }
    if (p.type === 'lpg') { W = 40; H = 34; ax = 20; ay = 30; }
    if (p.type === 'sign') { W = 44; H = 40; ax = 22; ay = 36; }
    const { cv, c } = canvas(W, H);
    c.translate(ax, ay);
    if (p.type === 'lounger') {
      c.fillStyle = 'rgba(25,55,40,.22)'; c.beginPath(); c.ellipse(3, 1, 16, 4, 0, 0, TAU); c.fill();
      c.fillStyle = '#b07b4f'; c.fillRect(-14, -5, 28, 4); c.fillRect(-13, -1, 2, 3); c.fillRect(11, -1, 2, 3);
      c.fillStyle = '#f8f9fa'; rr(c, -12, -8, 18, 4, 1.5); c.fill();
      c.fillStyle = '#4dabf7'; for (let x = -11; x < 6; x += 4) c.fillRect(x, -8, 1.6, 4);
      c.save(); c.translate(7, -6); c.rotate(-0.7); c.fillStyle = '#f8f9fa'; rr(c, 0, -3, 9, 4, 1.5); c.fill(); c.restore();
    } else if (p.type === 'umbrella') {
      c.fillStyle = 'rgba(25,55,40,.2)'; c.beginPath(); c.ellipse(6, 0, 18, 6, 0, 0, TAU); c.fill();
      c.strokeStyle = '#8b6240'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -30); c.stroke();
      const thatchy = R() < 0.5;
      const segs = 10;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * TAU, a1 = ((i + 1) / segs) * TAU;
        c.fillStyle = thatchy ? (i % 2 ? '#d4a95a' : '#c39448') : (i % 2 ? '#ffffff' : ['#ff6b6b', '#4dabf7', '#ffa94d'][idx % 3]);
        c.beginPath(); c.moveTo(0, -36);
        c.lineTo(Math.cos(a0) * 19, -28 + Math.sin(a0) * 7); c.lineTo(Math.cos(a1) * 19, -28 + Math.sin(a1) * 7); c.closePath(); c.fill();
      }
    } else if (p.type === 'kayak') {
      c.fillStyle = 'rgba(25,55,40,.18)'; c.beginPath(); c.ellipse(2, 1, 17, 4, 0, 0, TAU); c.fill();
      c.fillStyle = idx % 2 ? '#ffd43b' : '#ff6b6b'; c.beginPath(); c.ellipse(0, -2, 17, 4.5, 0.05, 0, TAU); c.fill();
      c.fillStyle = '#343a40'; c.beginPath(); c.ellipse(-4, -2.5, 3, 1.6, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(5, -2.5, 3, 1.6, 0, 0, TAU); c.fill();
    } else if (p.type === 'lpg') {
      c.fillStyle = 'rgba(25,55,40,.22)'; c.fillRect(-15, -2, 32, 5);
      for (let i = 0; i < 3; i++) {
        c.fillStyle = ['#adb5bd', '#4dabf7', '#adb5bd'][i]; rr(c, -12 + i * 8, -20, 7, 20, 3); c.fill();
        c.fillStyle = '#495057'; c.fillRect(-10 + i * 8, -23, 3, 3);
      }
      c.strokeStyle = 'rgba(60,60,60,.8)'; c.lineWidth = 0.8;
      for (let x = -15; x <= 15; x += 3) { c.beginPath(); c.moveTo(x, -24); c.lineTo(x, 0); c.stroke(); }
      c.strokeRect(-15, -24, 30, 24);
      c.fillStyle = '#e03131'; c.fillRect(-7, -30, 14, 5);
    } else if (p.type === 'drums') {
      for (let i = 0; i < 2; i++) { c.fillStyle = '#1c7ed6'; rr(c, -10 + i * 10, -16, 9, 16, 2); c.fill(); c.fillStyle = '#74c0fc'; c.fillRect(-10 + i * 10, -16, 9, 2); }
    } else if (p.type === 'sign') {
      c.fillStyle = '#6d4326'; c.fillRect(-1.5, -24, 3, 24);
      c.fillStyle = '#b98a5c'; rr(c, -18, -34, 36, 12, 2); c.fill();
    }
    return { cv, w: W, h: H, ax, ay };
  }

  // =================================================================== BOATS
  function longtail(c, x, y, col, f, t, moving) {
    c.save(); c.translate(x, y); c.scale(f, 1);
    c.fillStyle = 'rgba(0,40,60,.25)'; c.beginPath(); c.ellipse(4, 8, 58, 8, 0, 0, TAU); c.fill();
    if (moving) {
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5;
      for (let k = 1; k <= 3; k++) { c.beginPath(); c.moveTo(-58 - k * 14, 4 - k * 4 + Math.sin(t * 4 + k)); c.lineTo(-48, 4); c.lineTo(-58 - k * 14, 6 + k * 4); c.stroke(); }
    }
    c.beginPath();
    c.moveTo(-50, -2); c.quadraticCurveTo(0, 8, 46, 0); c.quadraticCurveTo(56, -6, 58, -20);
    c.quadraticCurveTo(50, -10, 40, -8); c.quadraticCurveTo(0, -4, -50, -8); c.closePath();
    c.fillStyle = '#7a4a23'; c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(-50, -6); c.quadraticCurveTo(0, -2, 42, -6); c.lineTo(42, -3.5); c.quadraticCurveTo(0, 1, -50, -3); c.closePath(); c.fill();
    c.fillStyle = '#c9a26a'; c.beginPath(); c.ellipse(0, -6.5, 40, 3, 0, 0, TAU); c.fill();
    c.fillStyle = '#8b5a2b'; for (let i = -30; i <= 30; i += 15) c.fillRect(i - 1.5, -9, 3, 5);
    const rib = ['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#fb5607', '#06d6a0'];
    for (let i = 0; i < rib.length; i++) {
      c.strokeStyle = rib[i]; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(56 - i * 0.6, -18 + i * 1.2); c.quadraticCurveTo(60 + Math.sin(t * 3 + i) * 2, -10 + i, 57 + i * 0.4, -3 + i * 0.6); c.stroke();
    }
    c.fillStyle = '#495057'; rr(c, -56, -14, 12, 9, 2); c.fill();
    c.strokeStyle = '#343a40'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-52, -8); c.lineTo(-86, 6); c.stroke();
    c.restore();
  }
  function speedboat(c, x, y, t) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,40,60,.25)'; c.beginPath(); c.ellipse(2, 9, 44, 9, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-40, -4); c.lineTo(28, -6); c.quadraticCurveTo(46, -2, 44, 4); c.quadraticCurveTo(20, 10, -40, 8); c.closePath();
    c.fillStyle = '#f8f9fa'; c.fill();
    c.fillStyle = '#1864ab'; c.beginPath(); c.moveTo(-40, 3); c.lineTo(40, 1); c.lineTo(38, 4); c.lineTo(-40, 6); c.closePath(); c.fill();
    c.fillStyle = '#dee2e6'; rr(c, -30, -10, 46, 8, 3); c.fill();
    c.fillStyle = '#495057'; for (let i = -24; i < 12; i += 9) { rr(c, i, -9, 6, 5, 1.5); c.fill(); }
    c.fillStyle = 'rgba(30,60,90,.75)'; c.beginPath(); c.moveTo(14, -10); c.lineTo(22, -14); c.lineTo(24, -8); c.closePath(); c.fill();
    c.fillStyle = '#212529'; rr(c, -48, -6, 8, 10, 2); c.fill(); rr(c, -48, 3, 8, 7, 2); c.fill();
    c.restore();
  }

  // =================================================================== BLENDER SPRITES
  // assets/sprites/manifest.js (window.SPRITES) สร้างจาก tools/blender/render_assets.py
  const SP = {};
  function loadSprites() {
    const man = root.SPRITES && root.SPRITES.items;
    if (!man) return Promise.resolve(0);
    const keys = Object.keys(man);
    return Promise.all(keys.map(k => new Promise(res => {
      const it = man[k], img = new Image();
      img.onload = () => { SP[k] = { img, sw: it.sw, sh: it.sh, ax: it.ax, ay: it.ay }; res(); };
      img.onerror = () => res();
      img.src = it.src;
    }))).then(() => Object.keys(SP).length);
  }
  function sprite(key) { return SP[key] || null; }
  function spriteList(prefix) {
    return Object.keys(SP).filter(k => k.indexOf(prefix) === 0).sort().map(k => SP[k]);
  }

  root.Art = {
    loadSprites, sprite, spriteList,
    TAU, FONT, RES, SKIN, HAIR, rng, shade, rr, ell, canvas,
    person, drawPerson, personCacheInit, personCacheFrame, playerLook, avatarLook, npcLook, guestLook,
    palmSprite, canopySprite, makeBuilding, makeProp, longtail, speedboat, roofRise
  };
})(window);
