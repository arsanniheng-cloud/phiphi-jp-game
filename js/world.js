// ============================================================================
// world.js — สร้างแผนที่: ทะเล หาดทราย หน้าผาหินปูน ทางเดิน สระ ท่าเรือ
// และพื้นที่ที่เดินได้ (mask) + วัตถุที่ต้องเรียงลำดับความลึก (อาคาร ต้นไม้ ของตกแต่ง)
// ============================================================================
(function (root) {
  'use strict';
  const G = root.GAME_DATA, M = G.map, C = G.config;
  const W = C.world.width, H = C.world.height, MS = C.world.mask_scale;
  const A = root.Art, TAU = Math.PI * 2;

  const objects = [];
  const labels = [];
  const lights = [];
  let ground = null, mini = null, maskCv = null, maskData = null;
  let sparkles = [];
  const seaPts = M.coast.concat([[W, H]]);
  const BOAT_COLOR = { '#2b9348': 'green', '#d00000': 'red', '#3a86ff': 'blue' };
  let seaPath = null;

  function poly(c, pts, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    c.beginPath();
    pts.forEach((p, i) => i ? c.lineTo(p[0] + dx, p[1] + dy) : c.moveTo(p[0] + dx, p[1] + dy));
    c.closePath();
  }
  function line(c, pts) {
    c.beginPath();
    pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
  }
  function plain(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function distPolyline(px, py, pts) {
    let m = 1e9;
    for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, distSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
    return m;
  }
  function distCoast(px, py) { return distPolyline(px, py, M.coast); }
  function nearPath(px, py, margin) {
    for (const p of M.paths) if (distPolyline(px, py, p) < margin) return true;
    return false;
  }
  function nearBuilding(px, py, mx, mFront) {
    for (const b of M.buildings) {
      if (px > b.x - b.w / 2 - mx && px < b.x + b.w / 2 + mx && py > b.y - b.d - mx && py < b.y + mFront) return true;
    }
    return false;
  }
  function nearWork(px, py, m) {
    for (const l of M.work_locations) if (Math.abs(px - l.x) < l.rx + m && Math.abs(py - l.y) < l.ry + m) return true;
    return false;
  }

  // ------------------------------------------------------------------ mask
  function buildMask(trees) {
    const mw = W / MS, mh = H / MS;
    maskCv = plain(mw, mh);
    const c = maskCv.getContext('2d');
    c.scale(1 / MS, 1 / MS);
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'destination-out';
    poly(c, seaPts); c.fill();
    for (const h of M.hills) { poly(c, h.pts); c.fill(); poly(c, h.pts, 0, -M.cliff_height); c.fill(); }
    const pl = M.pool; c.fillRect(pl.x, pl.y, pl.w, pl.h);
    for (const b of M.buildings) c.fillRect(b.x - b.w / 2 + 2, b.y - b.d, b.w - 4, b.d - 2);
    if (trees) for (const t of trees) { c.beginPath(); c.arc(t.x, t.y - 2, t.r, 0, TAU); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    const p = M.pier;
    c.fillRect(p.x, p.y, p.w, p.h); c.fillRect(p.head.x, p.head.y, p.head.w, p.head.h);
    c.globalCompositeOperation = 'destination-out';
    for (const pr of M.props) if (pr.type === 'lpg' || pr.type === 'drums') c.fillRect(pr.x - 14, pr.y - 6, 28, 8);
    c.globalCompositeOperation = 'source-over';
    maskData = c.getImageData(0, 0, mw, mh).data;
  }
  function walkable(x, y) {
    if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4) return false;
    const i = ((y / MS) | 0) * (W / MS) + ((x / MS) | 0);
    return maskData[i * 4 + 3] > 120;
  }

  // ------------------------------------------------------------------ ground
  function buildGround() {
    ground = plain(W, H);
    const c = ground.getContext('2d');
    const R = A.rng(424242);

    let g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#6fc456'); g.addColorStop(0.5, '#62b64e'); g.addColorStop(1, '#76c95c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = R() * W, y = R() * H, r = 60 + R() * 140;
      const rg = c.createRadialGradient(x, y, 0, x, y, r);
      const light = R() < 0.5;
      rg.addColorStop(0, light ? 'rgba(170,225,110,.35)' : 'rgba(40,120,50,.28)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.lineWidth = 1;
    for (let i = 0; i < 11000; i++) {
      const x = R() * W, y = R() * H;
      c.strokeStyle = R() < 0.6 ? 'rgba(40,110,40,.35)' : 'rgba(190,240,140,.3)';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 2, y - 3 - R() * 3); c.stroke();
    }
    for (let i = 0; i < 260; i++) {
      const x = R() * W, y = R() * H;
      c.fillStyle = ['#fff3bf', '#ffd6e7', '#ffffff', '#ffe066'][(R() * 4) | 0];
      c.beginPath(); c.arc(x, y, 1.3, 0, TAU); c.fill();
    }

    // หาดทราย
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = 'rgba(214,196,130,.55)'; c.lineWidth = M.beach_width * 2 + 26; line(c, M.coast); c.stroke();
    c.strokeStyle = '#f2deac'; c.lineWidth = M.beach_width * 2; line(c, M.coast); c.stroke();
    c.strokeStyle = '#f8ead0'; c.lineWidth = M.beach_width * 1.1; line(c, M.coast); c.stroke();
    for (let i = 0; i < 2500; i++) {
      const s = M.coast[(R() * (M.coast.length - 1)) | 0], e = M.coast[Math.min(M.coast.length - 1, ((R() * (M.coast.length - 1)) | 0) + 1)];
      const t = R(), x = s[0] + (e[0] - s[0]) * t + (R() - 0.5) * 260, y = s[1] + (e[1] - s[1]) * t + (R() - 0.5) * 260;
      if (distCoast(x, y) > M.beach_width) continue;
      c.fillStyle = R() < 0.5 ? 'rgba(200,170,110,.35)' : 'rgba(255,255,255,.5)';
      c.fillRect(x, y, 1.4, 1.4);
    }

    // ทะเล
    seaPath = new Path2D();
    seaPts.forEach((p, i) => i ? seaPath.lineTo(p[0], p[1]) : seaPath.moveTo(p[0], p[1]));
    seaPath.closePath();
    g = c.createLinearGradient(1700, 500, 2400, 1600);
    g.addColorStop(0, '#16aac9'); g.addColorStop(0.5, '#0d83ba'); g.addColorStop(1, '#0a5c98');
    c.fillStyle = g; c.fill(seaPath);
    c.save(); c.clip(seaPath);
    const bands = [[980, 'rgba(18,120,180,.35)'], [700, 'rgba(22,150,195,.4)'], [460, 'rgba(32,180,200,.5)'],
      [290, 'rgba(60,210,205,.55)'], [170, 'rgba(110,232,212,.6)'], [90, 'rgba(170,244,222,.6)'], [40, 'rgba(225,250,235,.55)']];
    for (const [w, col] of bands) { c.strokeStyle = col; c.lineWidth = w; line(c, M.coast); c.stroke(); }
    for (const h of M.hills) { c.strokeStyle = 'rgba(0,45,70,.28)'; c.lineWidth = 70; poly(c, h.pts); c.stroke(); }
    // ปะการังและแนวหญ้าทะเล
    for (let i = 0; i < 520; i++) {
      const k = (R() * (M.coast.length - 1)) | 0;
      const a = M.coast[k], b = M.coast[k + 1], t = R();
      const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const dist = 50 + Math.pow(R(), 1.4) * 260;
      const x = px + dy * dist, y = py - dx * dist;
      if (x > M.pier.x - 10 && x < M.pier.x + M.pier.w + 60 && y > M.pier.y - 90 && y < M.pier.y + 130) continue;
      if (R() < 0.35) {
        c.fillStyle = 'rgba(10,90,110,.22)';
        c.beginPath(); c.ellipse(x, y, 14 + R() * 22, 7 + R() * 9, R() * 3, 0, TAU); c.fill();
      } else {
        const cols = ['#ff7eb3', '#ff9f68', '#c39bff', '#ffe066', '#ff6b6b', '#7ee8a8', '#5fd3f3'];
        const n = 3 + ((R() * 5) | 0);
        for (let j = 0; j < n; j++) {
          c.globalAlpha = 0.45 * Math.max(0.35, 1 - dist / 330);
          c.fillStyle = cols[(R() * cols.length) | 0];
          const r = 2.5 + R() * 6;
          c.beginPath(); c.arc(x + (R() - 0.5) * 18, y + (R() - 0.5) * 10, r, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(x + (R() - 0.5) * 16, y + (R() - 0.5) * 8, r * 0.35, 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
      }
    }
    c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 2;
    for (let i = 0; i < 260; i++) {
      const x = 1800 + R() * 700, y = 450 + R() * 1200;
      c.beginPath(); c.arc(x, y, 18 + R() * 30, 3.6, 5.8); c.stroke();
    }
    c.restore();
    c.strokeStyle = 'rgba(190,160,100,.45)'; c.lineWidth = 22; line(c, M.coast); c.stroke();

    // ทางเดินปูหิน
    for (const p of M.paths) {
      c.strokeStyle = '#c9b287'; c.lineWidth = M.path_width + 6; line(c, p); c.stroke();
      c.strokeStyle = '#e9d8b3'; c.lineWidth = M.path_width; line(c, p); c.stroke();
    }
    for (const p of M.paths) {
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = 0; s < len; s += 11) {
          const t = s / len;
          for (const off of [-8, 8]) {
            const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
            const x = a[0] + (b[0] - a[0]) * t + nx * off + (R() - 0.5) * 3, y = a[1] + (b[1] - a[1]) * t + ny * off + (R() - 0.5) * 3;
            c.fillStyle = R() < 0.5 ? '#f3e7cd' : '#dccba5';
            c.beginPath(); c.ellipse(x, y, 5.5 + R() * 2, 3.8 + R() * 1.5, R() * 3, 0, TAU); c.fill();
          }
        }
      }
    }

    // สระว่ายน้ำ
    const pl = M.pool;
    c.fillStyle = '#e9dfca'; A.rr(c, pl.x - 22, pl.y - 18, pl.w + 44, pl.h + 40, 10); c.fill();
    c.strokeStyle = 'rgba(160,140,110,.35)'; c.lineWidth = 1;
    for (let x = pl.x - 22; x < pl.x + pl.w + 22; x += 14) { c.beginPath(); c.moveTo(x, pl.y - 18); c.lineTo(x, pl.y + pl.h + 22); c.stroke(); }
    g = c.createLinearGradient(0, pl.y, 0, pl.y + pl.h);
    g.addColorStop(0, '#2aa6d0'); g.addColorStop(1, '#5fe0ef');
    c.fillStyle = g; A.rr(c, pl.x, pl.y, pl.w, pl.h, 14); c.fill();
    c.fillStyle = 'rgba(0,60,90,.22)'; A.rr(c, pl.x, pl.y, pl.w, 12, 8); c.fill();
    c.strokeStyle = '#dff6fa'; c.lineWidth = 4; A.rr(c, pl.x, pl.y, pl.w, pl.h, 14); c.stroke();
    c.save(); A.rr(c, pl.x, pl.y, pl.w, pl.h, 14); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.4;
    for (let i = 0; i < 40; i++) {
      const x = pl.x + R() * pl.w, y = pl.y + 10 + R() * (pl.h - 10);
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y - 4, x + 16, y + 1); c.stroke();
    }
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(pl.x + 10, pl.y + 14, 24, 3); c.fillRect(pl.x + 10, pl.y + 22, 24, 3);
    c.strokeStyle = '#c0c8cc'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(pl.x + pl.w - 26, pl.y - 6); c.lineTo(pl.x + pl.w - 26, pl.y + 14); c.moveTo(pl.x + pl.w - 18, pl.y - 6); c.lineTo(pl.x + pl.w - 18, pl.y + 14); c.stroke();

    // ท่าเรือ
    const p = M.pier, hd = p.head;
    c.fillStyle = 'rgba(0,40,60,.3)'; c.fillRect(p.x + 8, p.y + 14, p.w, p.h); c.fillRect(hd.x + 8, hd.y + 14, hd.w, hd.h);
    c.fillStyle = '#4d331d';
    for (let x = p.x + 8; x < p.x + p.w; x += 30) c.fillRect(x, p.y + p.h, 5, 10);
    for (let y = hd.y + 10; y < hd.y + hd.h; y += 30) { c.fillRect(hd.x - 2, y, 5, 10); c.fillRect(hd.x + hd.w - 3, y, 5, 10); }
    for (const r of [[p.x, p.y, p.w, p.h], [hd.x, hd.y, hd.w, hd.h]]) {
      c.fillStyle = '#a8774a'; c.fillRect(r[0], r[1], r[2], r[3]);
      c.fillStyle = 'rgba(80,50,25,.35)';
      for (let x = r[0]; x < r[0] + r[2]; x += 6) c.fillRect(x, r[1], 1, r[3]);
      c.fillStyle = '#7d5634'; c.fillRect(r[0], r[1], r[2], 3); c.fillRect(r[0], r[1] + r[3] - 3, r[2], 3);
    }
    c.fillStyle = '#343a40';
    for (let x = p.x + 40; x < p.x + p.w; x += 90) { c.beginPath(); c.arc(x, p.y + 3, 3, 0, TAU); c.arc(x, p.y + p.h - 3, 3, 0, TAU); c.fill(); }
    c.fillStyle = '#ffd43b'; c.fillRect(hd.x + 4, hd.y + 4, hd.w - 8, 3); c.fillRect(hd.x + 4, hd.y + hd.h - 7, hd.w - 8, 3);

    // ภูเขาหินปูน
    for (const h of M.hills) drawHill(c, h, R);
  }

  function drawHill(c, h, R) {
    const ch = M.cliff_height;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    h.pts.forEach(p => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    let g = c.createLinearGradient(0, minY, 0, maxY);
    g.addColorStop(0, '#cbbba0'); g.addColorStop(1, '#a3907a');
    c.fillStyle = g; poly(c, h.pts); c.fill();
    c.save(); poly(c, h.pts); c.clip();
    for (let i = 0; i < (maxX - minX) * 0.9; i++) {
      const x = minX + R() * (maxX - minX), y = minY + R() * (maxY - minY), len = 20 + R() * 80;
      const k = R();
      c.strokeStyle = k < 0.35 ? 'rgba(150,85,35,.35)' : k < 0.7 ? 'rgba(60,60,60,.28)' : 'rgba(255,255,255,.16)';
      c.lineWidth = 1 + R() * 3;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 6, y + len); c.stroke();
    }
    c.restore();
    c.save();
    poly(c, h.pts); c.clip();
    c.strokeStyle = 'rgba(45,40,30,.35)'; c.lineWidth = 10; poly(c, h.pts); c.stroke();
    c.restore();

    // ยอดเขา ป่าดิบชื้น
    c.fillStyle = '#2d7a37'; poly(c, h.pts, 0, -ch); c.fill();
    c.save(); poly(c, h.pts, 0, -ch); c.clip();
    const greens = ['#24662d', '#2e7d36', '#3a8f40', '#4aa34a', '#5cb85a', '#1f5a27'];
    const n = ((maxX - minX) * (maxY - minY)) / 650;
    for (let i = 0; i < n; i++) {
      const x = minX + R() * (maxX - minX), y = minY - ch + R() * (maxY - minY);
      c.fillStyle = greens[(R() * greens.length) | 0];
      c.beginPath(); c.arc(x, y, 12 + R() * 26, 0, TAU); c.fill();
    }
    for (let i = 0; i < n / 3; i++) {
      const x = minX + R() * (maxX - minX), y = minY - ch + R() * (maxY - minY);
      c.fillStyle = 'rgba(200,240,150,.18)'; c.beginPath(); c.arc(x, y, 6 + R() * 8, 0, TAU); c.fill();
    }
    for (let i = 0; i < n / 40; i++) {
      const x = minX + R() * (maxX - minX), y = minY - ch + R() * (maxY - minY);
      c.fillStyle = 'rgba(205,195,175,.9)';
      c.beginPath(); c.ellipse(x, y, 10 + R() * 18, 6 + R() * 10, R() * 3, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(120,80,40,.4)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 4, y - 3); c.lineTo(x - 2, y + 7); c.stroke();
    }
    c.restore();
    // ขอบป่าห้อยลงหน้าผา
    const pts = h.pts;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s < len; s += 16) {
        const t = s / len, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - ch;
        if (x <= 2 || x >= W - 2 || y <= 2 || y >= H - 2) continue;
        c.fillStyle = greens[(R() * greens.length) | 0];
        c.beginPath(); c.arc(x, y, 10 + R() * 12, 0, TAU); c.fill();
        if (R() < 0.6) {
          c.strokeStyle = 'rgba(40,110,45,.75)'; c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(x, y + 6); c.quadraticCurveTo(x + (R() - 0.5) * 6, y + 18, x + (R() - 0.5) * 4, y + 12 + R() * 34); c.stroke();
        }
      }
    }
  }

  // ------------------------------------------------------------------ objects
  function placeObjects() {
    const R = A.rng(777);
    // ใช้ภาพ 3 มิติจาก Blender ถ้ามี ไม่งั้นใช้ภาพที่วาดด้วยโค้ด
    const fromBlender = kind => A.spriteList('tree_' + kind + '_').map(s => ({ cv: s.img, w: s.sw, h: s.sh, ax: s.ax, ay: s.ay }));
    const pickSet = (kind, fallback) => { const b = fromBlender(kind); return b.length ? b : fallback(); };
    const sprites = {
      palm: pickSet('palm', () => [1, 2, 3, 4, 5, 6].map(s => A.palmSprite(s * 31))),
      frangipani: pickSet('frangipani', () => [1, 2, 3, 4].map(s => A.canopySprite(s * 17, 'frangipani'))),
      jungle: pickSet('jungle', () => [1, 2, 3].map(s => A.canopySprite(s * 23, 'jungle'))),
      bougain: pickSet('bougain', () => [1, 2, 3].map(s => A.canopySprite(s * 29, 'bougain'))),
      hibiscus: pickSet('hibiscus', () => [1, 2].map(s => A.canopySprite(s * 37, 'hibiscus')))
    };
    const trees = [];
    function addTree(kind, x, y) {
      const list = sprites[kind], spr = list[(R() * list.length) | 0];
      trees.push({ x, y, r: kind === 'jungle' ? 7 : kind === 'palm' || kind === 'frangipani' ? 5 : 8 });
      objects.push({ kind: 'tree', spr, x, y, sx: x - spr.ax, sy: y - spr.ay, sw: spr.w, sh: spr.h });
    }
    function freeSpot(x, y, beachOk) {
      if (!walkable(x, y) || !walkable(x + 10, y) || !walkable(x - 10, y) || !walkable(x, y - 10)) return false;
      if (nearPath(x, y, 36) || nearBuilding(x, y, 34, 95) || nearWork(x, y, 40)) return false;
      const pl = M.pool; if (x > pl.x - 40 && x < pl.x + pl.w + 40 && y > pl.y - 34 && y < pl.y + pl.h + 50) return false;
      if (!beachOk && distCoast(x, y) < M.beach_width + 10) return false;
      for (const pr of M.props) if (Math.abs(pr.x - x) < 30 && Math.abs(pr.y - y) < 24) return false;
      for (const t of trees) if (Math.hypot(t.x - x, t.y - y) < 46) return false;
      return true;
    }
    // มะพร้าวเรียงตามหาด
    for (let i = 0; i < M.coast.length - 1; i++) {
      const a = M.coast[i], b = M.coast[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
      for (let s = 0; s < len; s += 44) {
        const inland = 55 + R() * 85;
        const x = a[0] + ux * s - uy * inland, y = a[1] + uy * s + ux * inland;
        if (freeSpot(x, y, true)) addTree('palm', x, y);
      }
    }
    // ต้นไม้ตามแนวเชิงเขา
    for (let i = 0; i < 2600; i++) {
      const x = 260 + R() * 1800, y = 230 + R() * 1150;
      if (walkable(x, y - 46)) continue;
      if (freeSpot(x, y, false)) addTree(R() < 0.55 ? 'jungle' : R() < 0.6 ? 'palm' : 'bougain', x, y);
    }
    // สวนในรีสอร์ต
    for (let i = 0; i < 5200 && trees.length < 230; i++) {
      const x = 300 + R() * 1650, y = 300 + R() * 1060;
      if (!freeSpot(x, y, false)) continue;
      const k = R();
      addTree(k < 0.3 ? 'frangipani' : k < 0.52 ? 'bougain' : k < 0.66 ? 'hibiscus' : k < 0.9 ? 'palm' : 'jungle', x, y);
    }
    buildMask(trees);

    for (const b of M.buildings) {
      const bs = A.sprite('b_' + b.id);
      const spr = bs ? { cv: bs.img, dx: -bs.ax, dy: -bs.ay, dw: bs.sw, dh: bs.sh } : A.makeBuilding(b);
      objects.push({ kind: 'building', b, spr, x: b.x, y: b.y, sx: b.x + spr.dx, sy: b.y + spr.dy, sw: spr.dw, sh: spr.dh });
      const rise = A.roofRise(b);
      labels.push({ x: b.x, y: bs ? b.y - bs.ay + 12 : b.y - b.d * 0.5 - b.h - rise * 0.55, text: b.label, id: b.id });
      lights.push({ x: b.x, y: b.y + 6, r: Math.max(60, b.w * 0.55) });
    }
    const propCount = {};
    M.props.forEach((p, i) => {
      const n = propCount[p.type] = (propCount[p.type] || 0) + 1;
      const variants = A.spriteList('prop_' + p.type + '_');
      const ps = variants.length ? variants[(n - 1) % variants.length] : null;
      const spr = ps ? { cv: ps.img, w: ps.sw, h: ps.sh, ax: ps.ax, ay: ps.ay } : A.makeProp(p, i);
      objects.push({ kind: 'prop', p, spr, x: p.x, y: p.y, sx: p.x - spr.ax, sy: p.y - spr.ay, sw: spr.w, sh: spr.h });
      if (p.text) labels.push({ x: p.x, y: p.y - (ps ? ps.ay - 8 : 28), text: p.text, small: true });
    });
  }

  function buildMini() {
    mini = plain(240, 160);
    const c = mini.getContext('2d');
    c.drawImage(ground, 0, 0, W, H, 0, 0, 240, 160);
    c.fillStyle = 'rgba(120,60,30,.85)';
    for (const b of M.buildings) c.fillRect((b.x - b.w / 2) / 10, (b.y - b.d) / 10, Math.max(2, b.w / 10), Math.max(2, b.d / 10));
  }

  function buildSparkles() {
    const R = A.rng(99);
    const c = ground.getContext('2d');
    sparkles = [];
    for (let i = 0; i < 4000 && sparkles.length < 420; i++) {
      const x = 1000 + R() * 1400, y = 420 + R() * 1180;
      if (!c.isPointInPath(seaPath, x, y)) continue;
      if (distCoast(x, y) < 30) continue;
      sparkles.push({ x, y, ph: R() * TAU, s: 1 + R() * 2 });
    }
  }

  function build() {
    buildMask(null);
    buildGround();
    placeObjects();
    buildMini();
    buildSparkles();
  }

  // ------------------------------------------------------------------ dynamic water
  function drawWater(c, t, view, storm) {
    c.save();
    c.lineJoin = 'round'; c.lineCap = 'round';
    const sp = storm ? 22 : 10;
    c.setLineDash([22, 30]); c.lineDashOffset = -t * sp;
    c.strokeStyle = storm ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.7)'; c.lineWidth = storm ? 6 : 3.5;
    line(c, M.coast); c.stroke();
    c.setLineDash([12, 40]); c.lineDashOffset = t * sp * 0.7;
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = storm ? 4 : 2;
    c.save(); c.translate(storm ? 14 : 9, storm ? 10 : 6); line(c, M.coast); c.stroke(); c.restore();
    c.setLineDash([]);
    for (const s of sparkles) {
      if (s.x < view.x - 10 || s.x > view.x + view.w + 10 || s.y < view.y - 10 || s.y > view.y + view.h + 10) continue;
      const a = Math.sin(t * 1.7 + s.ph);
      if (a < 0.55) continue;
      c.fillStyle = 'rgba(255,255,255,' + ((a - 0.55) * 1.8).toFixed(2) + ')';
      const z = s.s * (storm ? 1.5 : 1);
      c.beginPath(); c.moveTo(s.x - z * 2, s.y); c.lineTo(s.x, s.y - z * 0.7); c.lineTo(s.x + z * 2, s.y); c.lineTo(s.x, s.y + z * 0.7); c.closePath(); c.fill();
    }
    const pl = M.pool;
    c.save(); A.rr(c, pl.x, pl.y, pl.w, pl.h, 14); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = pl.y + 16 + i * 15, off = (t * 18 + i * 37) % 60;
      c.beginPath();
      for (let x = pl.x - 60 + off; x < pl.x + pl.w; x += 30) { c.moveTo(x, y); c.quadraticCurveTo(x + 7, y - 4, x + 15, y); }
      c.stroke();
    }
    c.restore();
    const amp = storm ? 3.5 : 1.4;
    M.boats.forEach((b, i) => {
      const bob = Math.sin(t * (storm ? 2.6 : 1.5) + i * 1.7) * amp;
      const spr = A.sprite(b.type === 'speedboat' ? 'boat_speedboat' : 'boat_longtail_' + (BOAT_COLOR[b.color] || 'green'));
      let x = b.x, y = b.y, f = b.type === 'speedboat' ? 1 : -1, moving = false;
      if (b.moving) {
        const s = (t * 0.018 + i * 0.3) % 2, u = s < 1 ? s : 2 - s;
        x = 2330 - u * 260; y = 640 + u * 620; f = s < 1 ? -1 : 1; moving = true;
      }
      if (spr) {
        c.save(); c.translate(x, y + bob);
        c.fillStyle = 'rgba(0,40,60,.22)'; c.beginPath(); c.ellipse(0, 6, spr.sw * 0.28, 7, 0, 0, TAU); c.fill();
        if (moving) {
          c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.6;
          for (let k = 1; k <= 3; k++) {
            c.beginPath(); c.moveTo(-f * (60 + k * 14), -k * 4 + Math.sin(t * 4 + k)); c.lineTo(-f * 48, 2); c.lineTo(-f * (60 + k * 14), 6 + k * 4); c.stroke();
          }
        }
        c.scale(f, 1);
        c.drawImage(spr.img, -spr.ax, -spr.ay, spr.sw, spr.sh);
        c.restore();
      } else if (b.type === 'longtail') {
        A.longtail(c, x, y + bob, b.color, f, t, moving);
      } else {
        A.speedboat(c, x, y + bob, t);
      }
    });
    c.restore();
  }

  function inView(o, v) {
    return o.sx < v.x + v.w && o.sx + o.sw > v.x && o.sy < v.y + v.h && o.sy + o.sh > v.y;
  }

  root.World = {
    W, H, build, walkable, drawWater, inView, objects, labels, lights,
    get ground() { return ground; }, get mini() { return mini; }, distCoast
  };
})(window);
