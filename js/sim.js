// ============================================================================
// sim.js — ระบบเกม: เวลา/ฤดูกาล, NPC 204 คน + ความทรงจำ, จุดอันตราย, PTW, อุบัติเหตุ
// สถานะทั้งหมดอยู่ใน S (บันทึกลงฐานข้อมูลได้ทั้งก้อน)
// ============================================================================
(function (root) {
  'use strict';
  const G = root.GAME_DATA, C = G.config, M = G.map, D = G.dialogue;
  const A = root.Art, Wd = root.World;

  const DEPT = {}; G.departments.forEach(d => { DEPT[d.id] = d; });
  const LOC = {}; M.work_locations.forEach(l => { LOC[l.id] = l; });
  const HT = {}, HT_BY_CODE = {}; G.hazard_types.forEach(h => { HT[h.id] = h; HT_BY_CODE[h.code] = h; });
  const PLAYER = G.players[0];
  const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const NATIONS = ['ไทย', 'จีน', 'เยอรมนี', 'สหราชอาณาจักร', 'ออสเตรเลีย', 'เกาหลีใต้', 'ฝรั่งเศส', 'อินเดีย', 'สหรัฐอเมริกา', 'สวีเดน', 'ญี่ปุ่น', 'อิตาลี'];
  const STAY = M.buildings.filter(b => b.type === 'villa' || b.type === 'bungalow').map(b => b.label);
  const FOCUS = {}; (G.daily_focus || []).forEach(f => { FOCUS[f.code] = f; });
  const TOPIC = {}; (G.training_topics || []).forEach(t => { TOPIC[t.code] = t; });
  const KPO = G.kpo || { budget_per_month: 0, proposals: [], meeting_location: 'lobby', training_location: 'canteen' };
  const PROP = {}; KPO.proposals.forEach(p => { PROP[p.code] = p; });
  const AV = G.avatar_options || { vests: ['#ff7a00'], hair_colors: ['#1c1512'], hair_styles_m: [0], hair_styles_f: [1] };
  const INDOOR = { FO: 1, FB: 1, KIT: 1, HK: 1, LAU: 1, SPA: 1, ENG: 1 };

  const rnd = Math.random;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev, a, b) { (listeners[ev] || []).forEach(fn => fn(a, b)); }

  let S = null;
  let npcs = [], byId = {}, guests = [];
  let paused = true;
  // ผู้เล่น: PLS[0] = คนที่ 1 (P) ... สูงสุด MAX_PLAYERS คนในเครื่องเดียว
  // (ฐานข้อมูลรองรับกี่คนก็ได้ ผ่านตาราง players และ player_id)
  const MAX_PLAYERS = 4;
  const P = { id: 1, x: 1880, y: 822, dir: 0, phase: 0, moving: false, route: null, target: null };
  const PLS = [P];
  let actor = P;                     // ผู้เล่นที่กำลังทำรายการอยู่ (คุย/ตรวจ/อนุมัติ)
  const LEASH = 1150;                // ระยะห่างสูงสุดระหว่างผู้เล่นบนเครื่องเดียวกัน (กล้องยังเห็นทุกคน)
  let NET = null;                    // โหมดออนไลน์: null | 'host' (เจ้าของห้อง) | 'client' (ผู้ร่วมเล่น)
  function players() { return PLS; }
  function pinfo(id) {
    const list = (S && S.players) || [];
    return list.find(p => p.id === id) || { id: 1, name: PLAYER.character_name, call_young: PLAYER.call_name_young, call_senior: PLAYER.call_name_senior };
  }
  function freshStats() { return { found: 0, closed: 0, coach: 0, scold: 0, ptw: 0, talk: 0, inv: 0, kpo: 0, train: 0 }; }
  function credit(pid, key) {
    if (!S.by_player) S.by_player = {};
    if (!S.today_by) S.today_by = {};
    const a = S.by_player[pid] = S.by_player[pid] || freshStats();
    const b = S.today_by[pid] = S.today_by[pid] || freshStats();
    a[key] = (a[key] || 0) + 1; b[key] = (b[key] || 0) + 1;
  }

  // ------------------------------------------------------------------ ทางเดิน (กราฟ)
  const NODES = [], NKEY = {};
  function nodeOf(p) {
    const k = p[0] + ',' + p[1];
    if (NKEY[k] === undefined) { NKEY[k] = NODES.length; NODES.push({ x: p[0], y: p[1], e: [] }); }
    return NKEY[k];
  }
  M.paths.forEach(pl => {
    for (let i = 0; i < pl.length - 1; i++) {
      const a = nodeOf(pl[i]), b = nodeOf(pl[i + 1]);
      const d = Math.hypot(pl[i][0] - pl[i + 1][0], pl[i][1] - pl[i + 1][1]);
      NODES[a].e.push([b, d]); NODES[b].e.push([a, d]);
    }
  });
  function nearestNode(x, y) {
    let best = 0, bd = 1e9;
    NODES.forEach((n, i) => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function clearLine(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
    for (let i = 1; i <= n; i++) if (!Wd.walkable(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    return true;
  }
  function route(x0, y0, x1, y1) {
    if (clearLine(x0, y0, x1, y1)) return [{ x: x1, y: y1 }];
    const s = nearestNode(x0, y0), t = nearestNode(x1, y1);
    const dd = NODES.map(() => 1e12), prev = NODES.map(() => -1), done = NODES.map(() => false);
    dd[s] = 0;
    for (;;) {
      let u = -1, ub = 1e12;
      for (let i = 0; i < NODES.length; i++) if (!done[i] && dd[i] < ub) { ub = dd[i]; u = i; }
      if (u < 0 || u === t) break;
      done[u] = true;
      for (const [v, w] of NODES[u].e) if (dd[u] + w < dd[v]) { dd[v] = dd[u] + w; prev[v] = u; }
    }
    const chain = [];
    for (let v = t; v >= 0; v = prev[v]) { chain.unshift(v); if (v === s) break; }
    const pts = chain.map(i => ({ x: NODES[i].x, y: NODES[i].y }));
    // ตัดจุดแรกออกถ้าเดินตรงไปจุดที่สองได้เลย
    while (pts.length > 1 && clearLine(x0, y0, pts[1].x, pts[1].y)) pts.shift();
    pts.push({ x: x1, y: y1 });
    return pts;
  }

  // ------------------------------------------------------------------ เวลา/ฤดูกาล
  function dateOf(day) {
    const p = C.time.start_date.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2] + day);
  }
  function dateText(day) {
    const d = dateOf(day);
    return d.getDate() + ' ' + TH_MONTH[d.getMonth()] + ' ' + (d.getFullYear() + 543);
  }
  function timeText(h) {
    h = h === undefined ? S.hour : h;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  function season() {
    if (S && S.season_override) return C.tourist_seasons.find(s => s.season_name === S.season_override);
    const m = dateOf(S ? S.day : 0).getMonth();
    return C.tourist_seasons.find(s => s.months.indexOf(m) >= 0) || C.tourist_seasons[0];
  }
  function isStorm() { return season().weather_condition !== 'sunny'; }
  function isHigh() { return season().season_name === 'High_Season'; }

  // ------------------------------------------------------------------ helpers
  function pickSpot(loc, extra) {
    extra = extra || 0;
    for (let i = 0; i < 40; i++) {
      const x = loc.x + (rnd() * 2 - 1) * (loc.rx + extra), y = loc.y + (rnd() * 2 - 1) * ((loc.ry || 8) + extra * 0.5);
      if (Wd.walkable(x, y)) return { x, y };
    }
    return { x: loc.x, y: loc.y };
  }
  function weighted(list) {
    const tot = list.reduce((a, c) => a + Math.max(0, c.w), 0);
    if (tot <= 0) return null;
    let r = rnd() * tot;
    for (const c of list) { r -= Math.max(0, c.w); if (r <= 0) return c.t; }
    return list[list.length - 1].t;
  }
  function callName(n, pid) {
    const pi = pinfo(pid || actor.id);
    return n.age < 45 ? pi.call_young : pi.call_senior;
  }
  function shortTitle(t) { return t.title.split(' ')[0]; }
  function fmt(n, tpl, vars) {
    let s = tpl;
    if (n && n.gender === 'F') {
      s = s.replace(/นะครับ/g, 'นะคะ').replace(/ครับ/g, 'ค่ะ').replace(/ผม/g, n.age < 25 ? 'หนู' : 'ฉัน');
    }
    vars = Object.assign({ me: n ? callName(n) : pinfo(actor.id).name }, vars || {});
    return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : ''));
  }
  function avgTrust(list) {
    list = list || npcs;
    return list.length ? list.reduce((a, n) => a + n.trust, 0) / list.length : 0;
  }
  function onDuty(n) {
    if (n.away_until > S.day) return false;
    if (!isHigh() && !n.low_season_active) return false;
    const h = S.hour;
    return n.shift === 'M' ? h >= 6 && h < 15 : h >= 14 && h < 22;
  }
  function locName(t) { const l = LOC[t.location_id]; return l ? l.name : DEPT[t.department_id].short; }
  function relook(n) { n.L = A.npcLook(n, DEPT[n.department_id], n.ppe_missing); }

  // ------------------------------------------------------------------ ความทรงจำ
  function memScore(m) { return m.importance_level * 2 + Math.abs(m.emotional_impact) / 40 - (S.day - m.game_day) * 0.45; }
  function memoryText(type, o) {
    const me = pinfo(o.player_id || actor.id).name, d = o.detail || '';
    switch (type) {
      case 'coach': return me + ' มาสอนเรื่อง' + d + 'ที่หน้างาน';
      case 'stop': return me + ' สั่งหยุดงานเรื่อง' + d;
      case 'heroic': return me + ' หยุดงาน' + d + 'ไว้ทันก่อนเกิดเหตุ';
      case 'car': return me + ' ออกใบ CAR เรื่อง' + d;
      case 'car_ok': return 'CAR เรื่อง' + d + ' แก้ไขเสร็จแล้ว';
      case 'car_fail': return 'CAR เรื่อง' + d + ' ไม่เสร็จตามกำหนด';
      case 'ignored': return me + ' เห็นเรื่อง' + d + ' แต่ยังไม่แก้';
      case 'scold': return me + ' ตำหนิต่อหน้าเพื่อนร่วมงาน';
      case 'praise': return me + ' ชมเชยการทำงาน';
      case 'talk': return me + ' แวะมาคุยถามไถ่';
      case 'toolbox': return me + ' อบรมสั้นเรื่อง' + d;
      case 'incident': return 'เกิดอุบัติเหตุเรื่อง' + d;
      case 'ppe_ok': return me + ' ตรวจ PPE แล้วผ่าน';
      case 'ppe_remind': return me + ' เตือนเรื่องการสวม' + d;
      case 'ptw_ok': return me + ' ตรวจหน้างานและอนุมัติใบอนุญาต ' + d;
      case 'ptw_reject': return me + ' ไม่อนุมัติใบอนุญาต ' + d;
      case 'kpo_yes': return me + ' อนุมัติ' + d + ' ในที่ประชุม คปอ.';
      case 'kpo_no': return 'ข้อเสนอ' + d + ' ยังไม่ผ่านที่ประชุม คปอ.';
      case 'trained': return me + ' อบรมเรื่อง' + d;
      case 'missed': return me + ' นัด' + d + ' ไว้แต่ไม่ได้จัด';
      case 'rumor': {
        const ab = byId[o.about_npc_id];
        return 'ได้ยินจาก' + (ab ? ab.nickname : 'เพื่อน') + 'เรื่องที่ ' + me + ' ' + (RUMOR_VERB[o.rumor_of] || 'ทำ');
      }
      default: return o.memory_text || d;
    }
  }
  const RUMOR_VERB = { coach: 'สอนงานดี', scold: 'ดุต่อหน้าคนอื่น', stop: 'สั่งหยุดงาน', ignored: 'ปล่อยเรื่องอันตรายไว้',
    incident: 'เกิดอุบัติเหตุในทีม', praise: 'ชมเชย', heroic: 'ช่วยไว้ทัน' };

  function pushMem(n, row) {
    S.memories.push(row); n.mem.push(row);
    if (n.mem.length > 14) {
      let worst = 0;
      for (let i = 1; i < n.mem.length; i++) if (memScore(n.mem[i]) < memScore(n.mem[worst])) worst = i;
      const rm = n.mem.splice(worst, 1)[0];
      const k = S.memories.indexOf(rm); if (k >= 0) S.memories.splice(k, 1);
    }
  }
  function addMemory(n, type, o) {
    if (!n) return;
    o = o || {};
    const mt = G.memory_types[type] || G.memory_types.talk;
    const row = {
      id: S.next.memory++, npc_id: n.id, player_id: o.player_id || actor.id, type, memory_type: type, event_category: mt.event_category,
      memory_text: memoryText(type, o), emotional_impact: o.impact !== undefined ? o.impact : mt.emotional_impact,
      importance_level: o.importance || mt.importance_level, about_npc_id: o.about_npc_id || null,
      hazard_type_id: o.hazard_type_id || null, game_day: S.day, detail: o.detail || '', rumor_of: o.rumor_of || null
    };
    if (type === 'stop') row.emotional_impact = n.trust >= 45 ? 10 : -10;
    pushMem(n, row);
  }
  function addSeedMemory(m) {
    const n = byId[m.npc_id]; if (!n) return;
    pushMem(n, {
      id: S.next.memory++, npc_id: m.npc_id, player_id: m.player_id, type: 'seed', memory_type: 'seed', event_category: m.event_category,
      memory_text: m.memory_text, emotional_impact: m.emotional_impact, importance_level: m.importance_level,
      about_npc_id: null, hazard_type_id: null, game_day: m.game_day, detail: m.memory_text, rumor_of: null
    });
  }
  function adjustTrust(n, delta, type, ht, spread, extra) {
    if (!n) return;
    n.trust = clamp(n.trust + delta, 0, 100);
    if (type) addMemory(n, type, Object.assign({ detail: ht ? shortTitle(ht) : '', hazard_type_id: ht ? ht.id : null }, extra || {}));
    if (spread) {
      for (const m of npcs) if (m !== n && m.department_id === n.department_id) m.trust = clamp(m.trust + delta * 0.3, 0, 100);
      const fr = byId[n.friend_id];
      if (fr && rnd() < 0.7 && ['coach', 'scold', 'stop', 'ignored', 'praise', 'heroic', 'incident'].indexOf(type) >= 0) {
        addMemory(fr, 'rumor', { about_npc_id: n.id, rumor_of: type });
        fr.trust = clamp(fr.trust + Math.sign(delta) * 1.5, 0, 100);
      }
    }
  }
  function topMemory(n) {
    const list = n.mem.filter(m => S.day - m.game_day <= 12);
    if (!list.length) return null;
    list.sort((a, b) => memScore(b) - memScore(a));
    if (list.length > 1 && list[0].id === n.last_mem && rnd() < 0.6) return list[1];
    return list[0];
  }
  function memoryLine(n, m) {
    n.last_mem = m.id;
    const me = callName(n, m.player_id || 1);   // พูดถึง จป. คนที่ทำเรื่องนั้นจริง
    if (m.type === 'rumor') {
      const ab = byId[m.about_npc_id], tpl = D.rumor[m.rumor_of];
      return tpl ? fmt(n, tpl, { about: ab ? ab.nickname : 'เพื่อน', me }) : '';
    }
    if (m.type === 'seed') return fmt(n, D.memory.seed[0], { detail: m.memory_text, me });
    let key = m.type;
    if (key === 'stop') key = m.emotional_impact >= 0 ? 'stop_pos' : 'stop_neg';
    const arr = D.memory[key];
    return arr ? fmt(n, pick(arr), { detail: m.detail, me }) : '';
  }

  // ------------------------------------------------------------------ เริ่มเกม
  function freshToday() { return { found: 0, closed: 0, incidents: 0, lti: 0, coach: 0, scold: 0, ptw: 0 }; }

  function initNpcs(saved) {
    const st = {};
    if (saved) saved.forEach(s => { st[s.id] = s; });
    npcs = G.npcs.map(rec => {
      const s = st[rec.id] || {};
      const n = Object.assign({}, rec, {
        trust: s.trust_in_player !== undefined ? s.trust_in_player : rec.trust_in_player,
        comp: s.safety_compliance_score !== undefined ? s.safety_compliance_score : rec.safety_compliance_score,
        status: 'working', mem: [], ppe_missing: !!s.ppe_missing,
        praise_day: s.praise_day !== undefined ? s.praise_day : -1, toolbox_day: s.toolbox_day !== undefined ? s.toolbox_day : -1,
        talk_day: s.talk_day !== undefined ? s.talk_day : -1, story_known: !!s.story_known,
        away_until: s.away_until !== undefined ? s.away_until : -1, check_day: s.check_day !== undefined ? s.check_day : -1,
        hurt_t: 0, x: 0, y: 0, wx: 0, wy: 0, tx: 0, ty: 0, wait: rnd() * 3, dir: 0, phase: rnd() * 6,
        moving: false, on: false, lunch: false, route: null, last_mem: null
      });
      const p = pickSpot(LOC[rec.work_location_id], 0);
      n.x = n.wx = n.tx = p.x; n.y = n.wy = n.ty = p.y;
      relook(n);
      return n;
    });
    byId = {}; npcs.forEach(n => { byId[n.id] = n; });
  }

  function rollDailyPpe() {
    const f = S ? focusEff('ppe', 1) : 1;
    for (const n of npcs) {
      const k = f * (S ? upgradePpe(n.department_id) : 1);
      n.ppe_missing = !!DEPT[n.department_id].ppe && rnd() < ((100 - n.comp) / 250 + 0.03) * k;
      relook(n);
    }
  }

  function makeTourist(checkIn) {
    const r = rnd();
    const trait = r < 0.62 ? 'safe' : r < 0.84 ? 'careless' : r < 0.92 ? 'drunk_swimmer' : 'rule_breaker';
    const id = S.next.tourist++;
    return {
      id, tourist_code: 'TRS_' + String(id).padStart(5, '0'), nationality: pick(NATIONS), risk_behavior_trait: trait,
      stay_zone: pick(STAY), check_in_day: checkIn, check_out_day: checkIn + 2 + Math.floor(rnd() * 6), advised_day: -1
    };
  }
  function syncTourists(initial) {
    S.tourists = S.tourists.filter(t => t.check_out_day > S.day);
    const target = season().guests_in_house;
    while (S.tourists.length > target + 5) S.tourists.splice(Math.floor(rnd() * S.tourists.length), 1);
    while (S.tourists.length < target) S.tourists.push(makeTourist(initial ? S.day - Math.floor(rnd() * 3) : S.day));
    buildGuests();
  }
  function buildGuests() {
    const n = Math.min(season().guest_sprites, S.tourists.length);
    guests = S.tourists.slice(0, n).map(t => {
      const p = pickSpot(pick(M.guest_pois), 0);
      return { t, x: p.x, y: p.y, route: null, wait: rnd() * 8, dir: 0, phase: rnd() * 6, moving: false, L: A.guestLook(t.id) };
    });
  }
  function riskyShare() {
    if (!S.tourists.length) return 0;
    return S.tourists.filter(t => t.risk_behavior_trait !== 'safe').length / S.tourists.length;
  }

  // opts.names = ['จป.ซัน', 'จป.เพื่อน', ...] (คนแรกใช้ชื่อจาก data/players.js ถ้าว่าง)
  // หน้าตาเริ่มต้นของผู้เล่นแต่ละคน (เลือกเองได้ที่หน้าสร้างตัวละคร)
  const DEFAULT_LOOKS = [
    { gender: 'M', skin: 1, hair: 0, hair_style: 0, vest: 0 }, { gender: 'F', skin: 2, hair: 1, hair_style: 5, vest: 1 },
    { gender: 'M', skin: 0, hair: 2, hair_style: 4, vest: 2 }, { gender: 'F', skin: 3, hair: 0, hair_style: 2, vest: 3 }
  ];
  function cleanLook(l, i) {
    const d = DEFAULT_LOOKS[(i || 0) % DEFAULT_LOOKS.length];
    l = l && typeof l === 'object' ? l : d;
    const toI = (v, def) => { v = Math.round(+v); return isFinite(v) ? v : def; };
    const gender = l.gender === 'F' ? 'F' : 'M';
    const styles = gender === 'F' ? AV.hair_styles_f : AV.hair_styles_m;
    const hs = toI(l.hair_style, styles[0]);
    return {
      gender, skin: clamp(toI(l.skin, d.skin), 0, 3), hair: clamp(toI(l.hair, d.hair), 0, AV.hair_colors.length - 1),
      hair_style: styles.indexOf(hs) >= 0 ? hs : styles[0], vest: clamp(toI(l.vest, d.vest), 0, AV.vests.length - 1)
    };
  }
  function makePlayers(opts) {
    const names = (opts && opts.names) || [];
    const looks = (opts && opts.looks) || [];
    const n = Math.max(1, Math.min(MAX_PLAYERS, (opts && opts.count) || names.length || 1));
    const list = [];
    for (let i = 0; i < n; i++) {
      const look = cleanLook(looks[i], i);
      const n0 = (names[0] || '').trim();
      if (i === 0 && (!n0 || n0 === PLAYER.character_name)) {
        list.push({ id: 1, name: PLAYER.character_name, call_young: PLAYER.call_name_young, call_senior: PLAYER.call_name_senior, look });
        continue;
      }
      const name = cleanName(names[i], i === 0 ? PLAYER.character_name : 'จป.เพื่อน ' + i);
      const short = name.replace(/^จป\.?\s*/, '') || name;
      list.push({ id: i + 1, name, call_young: 'พี่' + short, call_senior: name, look });
    }
    return list;
  }
  function placePlayers() {
    PLS.length = 1;
    const saved = S.players_pos || [];
    for (let i = 1; i < S.players.length; i++) {
      const pl = { id: i + 1, x: P.x - 34 * i, y: P.y + 10, dir: 0, phase: 0, moving: false, route: null, target: null };
      const sp = saved[i - 1];
      if (sp) { pl.x = sp.x; pl.y = sp.y; pl.dir = sp.dir || 0; }
      if (!Wd.walkable(pl.x, pl.y)) { pl.x = P.x; pl.y = P.y; }
      PLS.push(pl);
    }
  }

  function newGame(opts) {
    S = {
      schema_version: 1, day: 0, hour: C.time.start_hour, t: 0, season_override: null, ending: false, over: false, over_reason: '',
      players: makePlayers(opts), by_player: {}, today_by: {}, players_pos: [],
      metrics: { ops: C.metrics_start.ops, guest_sat: C.metrics_start.guest_sat, reputation: PLAYER.current_reputation_score },
      totals: { found: 0, closed: 0, incidents: 0, lti: 0, serious: 0, coach: 0, scold: 0, ptw: 0 },
      today: freshToday(), days_safe: 0, dept_know: {},
      next: { incident: 1, ptw: 1, memory: 1, hazard: 1, tourist: 1, activity: 1 },
      hazards: [], incidents: [], ptw: [], memories: [], tourists: [], day_reports: [],
      activities: [], focus: null, focus_day: -1, upgrades: [], trained: {}, budget: null, kpo_last: null,
      spawn_in: 8, report_in: C.report_every_seconds, ptw_in: 40, warned_ops: -99,
      player: { x: 1880, y: 822, dir: 0 }
    };
    G.departments.forEach(d => { S.dept_know[d.id] = 10; });
    initNpcs(null);
    G.seed_memories.forEach(addSeedMemory);
    rollDailyPpe();
    syncTourists(true);
    S.coop = S.players.length > 1;
    P.x = S.player.x; P.y = S.player.y; P.dir = 0; P.route = null; P.target = null;
    placePlayers();
    actor = P;
    paused = false;
    emit('log', '☀️ เริ่มวันที่ 1 — ' + dateText(0) + ' (' + season().label + ')' + (S.coop ? ' · เล่น ' + S.players.length + ' คน: ' + S.players.map(p => p.name).join(' + ') : ''), 'info');
    // งานแรก: ลูกเรือแจ้งจุดเสี่ยงที่ท่าเรือ ให้ผู้เล่นเริ่มได้ทันที
    updateNpcs(0);
    const h0 = spawnHazard('MAR_SLIP', { x: 2010, y: 812 });
    const crew = npcs.find(n => n.on && n.department_id === 9 && n.id !== 2) || npcs.find(n => n.on && n.department_id === 9);
    if (h0 && crew) discover(h0, crew);
    // แผนงานตั้งต้น: อบรมดับเพลิงให้ครัววันนี้บ่ายโมง และประชุม คปอ. พรุ่งนี้ 10 โมง (เลื่อน/ยกเลิกได้ที่ 📅 แผนงาน)
    ensureBudget();
    schedule('training', { day: 0, hour: 13, department_id: 3, topic: 'FIRE' });
    schedule('kpo_meeting', { day: 1, hour: 10 });
  }

  function serialize() {
    S.player = { x: P.x, y: P.y, dir: P.dir };
    S.players_pos = PLS.slice(1).map(pl => ({ x: pl.x, y: pl.y, dir: pl.dir }));
    const state = {};
    Object.keys(S).forEach(k => {
      if (['hazards', 'incidents', 'ptw', 'memories', 'tourists', 'day_reports'].indexOf(k) < 0) state[k] = S[k];
    });
    state.season_name = season().season_name;
    return JSON.parse(JSON.stringify({
      schema_version: 1, saved_at: new Date().toISOString(), state,
      npcs: npcs.map(n => ({
        id: n.id, trust_in_player: Math.round(n.trust * 10) / 10, safety_compliance_score: Math.round(n.comp), current_status: n.status,
        ppe_missing: n.ppe_missing, praise_day: n.praise_day, toolbox_day: n.toolbox_day, talk_day: n.talk_day,
        story_known: n.story_known, away_until: n.away_until, check_day: n.check_day
      })),
      memories: S.memories, hazards: S.hazards, incidents: S.incidents, ptw: S.ptw, tourists: S.tourists, day_reports: S.day_reports
    }));
  }

  function restore(snap) {
    if (!snap || !snap.state) throw new Error('ไฟล์เซฟไม่ถูกต้อง');
    S = Object.assign({}, snap.state, {
      memories: [], hazards: snap.hazards || [], incidents: snap.incidents || [], ptw: snap.ptw || [],
      tourists: snap.tourists || [], day_reports: snap.day_reports || []
    });
    delete S.season_name;
    S.ending = false;
    initNpcs(snap.npcs);
    (snap.memories || []).forEach(m => { const n = byId[m.npc_id]; if (n) { S.memories.push(m); n.mem.push(m); } });
    npcs.forEach(relook);
    buildGuests();
    if (!S.players) S.players = makePlayers(null);
    if (!S.by_player) S.by_player = {};
    if (!S.today_by) S.today_by = {};
    if (!S.players_pos) S.players_pos = S.player2 ? [S.player2] : [];
    S.players.forEach((p, i) => { p.look = cleanLook(p.look, i); });
    if (!S.activities) S.activities = [];
    if (!S.next.activity) S.next.activity = S.activities.reduce((m, a) => Math.max(m, a.id), 0) + 1;
    if (!S.upgrades) S.upgrades = [];
    if (!S.trained) S.trained = {};
    if (S.focus_day === undefined) { S.focus = null; S.focus_day = -1; }
    ensureBudget();
    S.activities.forEach(a => { if (a.status === 'due') a.status = 'missed'; });   // ผู้เข้าร่วมไม่ได้ถูกบันทึกไว้
    S.coop = S.players.length > 1;
    P.x = S.player.x; P.y = S.player.y; P.dir = S.player.dir || 0; P.route = null; P.target = null;
    placePlayers();
    actor = P;
    paused = false;
    emit('log', '📂 โหลดเกม: วันที่ ' + (S.day + 1) + ' เวลา ' + timeText(), 'info');
  }

  // ------------------------------------------------------------------ การเคลื่อนที่
  function moveFree(e, tx, ty, sp, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d < 2) { e.moving = false; return true; }
    const st = Math.min(d, sp * dt);
    e.x += dx / d * st; e.y += dy / d * st; e.moving = true; e.phase += st * 0.35;
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
    return false;
  }
  function moveWalk(e, tx, ty, sp, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d < 1.5) { e.moving = false; return true; }
    const st = Math.min(d, sp * dt), nx = e.x + dx / d * st, ny = e.y + dy / d * st;
    if (Wd.walkable(nx, ny)) {
      e.x = nx; e.y = ny; e.moving = true; e.phase += st * 0.35;
      e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
    } else { e.moving = false; e.tx = e.x; e.ty = e.y; }
    return false;
  }

  function updatePlayer(pl, dt, input) {
    let vx = input.x || 0, vy = input.y || 0;
    if (vx || vy) { pl.route = null; pl.target = null; }
    else if (pl.route && pl.route.length) {
      const pt = pl.route[0], last = pl.route.length === 1;
      const reach = last && pl.target ? 40 : 5;
      const d = Math.hypot(pt.x - pl.x, pt.y - pl.y);
      if (d <= reach) {
        pl.route.shift();
        if (!pl.route.length) { const tg = pl.target; pl.route = null; pl.target = null; if (tg) emit('arrive', tg, pl); }
      } else { vx = (pt.x - pl.x) / d; vy = (pt.y - pl.y) / d; }
    }
    const l = Math.hypot(vx, vy);
    if (l > 0.01) {
      vx /= l; vy /= l;
      const sp = C.player_speed * (input.run ? 1.55 : 1) * dt;
      const ok = (x, y) => Wd.walkable(x, y) && (NET || PLS.every(o => o === pl || Math.hypot(x - o.x, y - o.y) < LEASH));
      const nx = pl.x + vx * sp, ny = pl.y + vy * sp;
      let moved = true;
      if (ok(nx, ny)) { pl.x = nx; pl.y = ny; }
      else if (Math.abs(vx) > 0.2 && ok(nx, pl.y)) pl.x = nx;
      else if (Math.abs(vy) > 0.2 && ok(pl.x, ny)) pl.y = ny;
      else { moved = false; if (pl.route) { pl.route = null; pl.target = null; } }
      pl.moving = moved; if (moved) pl.phase += sp * 0.33;
      pl.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : (vy < 0 ? 3 : 0);
    } else pl.moving = false;
  }

  function goTo(x, y, target, pl) {
    pl = pl || P;
    pl.route = route(pl.x, pl.y, x, y);
    pl.target = target || null;
  }

  function updateNpcs(dt) {
    for (const n of npcs) {
      const on = onDuty(n);
      if (on && !n.on) {
        const p = pickSpot(LOC[n.work_location_id], 0);
        n.x = n.wx = n.tx = p.x; n.y = n.wy = n.ty = p.y; n.route = null; n.lunch = false;
        n.inside_t = INDOOR[DEPT[n.department_id].code] && rnd() < 0.45 ? rnd() * 30 : 0;
      }
      n.on = on;
      if (!on) { n.status = n.away_until > S.day ? 'injured' : 'resting'; continue; }
      if (n.hurt_t > 0) { n.hurt_t -= dt; n.status = 'injured'; n.moving = false; continue; }
      if (n.event_id) {
        // ไปประชุม/อบรม: เดินไปจุดนัดแล้วยืนรอ
        if (n.route && n.route.length) {
          const pt = n.route[0];
          if (moveFree(n, pt.x, pt.y, C.npc_speed * 2.4, dt)) n.route.shift();
        } else { n.moving = false; n.dir = 3; }
        n.status = 'working';
        continue;
      }
      const lunch = n.shift === 'M' ? S.hour >= 11.5 && S.hour < 12.5 : S.hour >= 18 && S.hour < 19;
      if (lunch !== n.lunch) {
        n.lunch = lunch; n.inside_t = 0;
        const p = lunch ? pickSpot(LOC.canteen, 0) : { x: n.wx, y: n.wy };
        n.route = route(n.x, n.y, p.x, p.y);
      }
      if (n.route && n.route.length) {
        const pt = n.route[0];
        if (moveFree(n, pt.x, pt.y, C.npc_speed * 2.2, dt)) n.route.shift();
        if (!n.route.length) { n.route = null; n.tx = n.x; n.ty = n.y; n.wait = 1 + rnd() * 3; }
      } else if (n.inside_t > 0) {
        n.inside_t = Math.max(0, n.inside_t - dt);
        n.moving = false;
      } else {
        n.wait -= dt;
        if (n.wait <= 0) {
          n.wait = 2 + rnd() * 5;
          // แผนกในร่ม: บางช่วงเข้าไปทำงานในอาคาร (ไม่เห็นบนแผนที่)
          if (!lunch && INDOOR[DEPT[n.department_id].code] && rnd() < 0.32) { n.inside_t = 10 + rnd() * 30; continue; }
          const cx = lunch ? n.x : n.wx, cy = lunch ? n.y : n.wy;
          n.tx = cx + (rnd() * 2 - 1) * (lunch ? 10 : 26); n.ty = cy + (rnd() * 2 - 1) * (lunch ? 6 : 12);
        }
        moveWalk(n, n.tx, n.ty, C.npc_speed, dt);
      }
      n.status = n.ppe_missing ? 'violating_rule' : lunch ? 'resting' : 'working';
    }
  }

  function updateGuests(dt) {
    for (const g of guests) {
      if (g.route && g.route.length) {
        const pt = g.route[0];
        if (moveFree(g, pt.x, pt.y, C.guest_speed, dt)) g.route.shift();
      } else {
        g.moving = false; g.wait -= dt;
        if (g.wait <= 0) {
          const p = pickSpot(pick(M.guest_pois), 0);
          g.route = route(g.x, g.y, p.x, p.y); g.wait = 6 + rnd() * 16;
        }
      }
    }
  }

  // ------------------------------------------------------------------ จุดอันตราย
  function pickOwner(t) {
    const staff = npcs.filter(n => n.department_id === t.department_id && n.on && n.hurt_t <= 0);
    if (!staff.length) return npcs.find(n => n.department_id === t.department_id) || null;
    if (t.kind !== 'behav') return pick(staff);
    return weighted(staff.map(n => ({ t: n, w: 110 - n.comp })));
  }
  function spawnHazard(code, at, owner) {
    const open = S.hazards.filter(h => !h.done);
    let type;
    if (code) type = HT_BY_CODE[code];
    else {
      if (open.length >= C.max_open_hazards) return null;
      const hi = isHigh(), risky = riskyShare();
      type = weighted(G.hazard_types.filter(t => !open.some(h => h.type_id === t.id)).map(t => {
        let w = hi ? t.weight_high : t.weight_low;
        w *= 1 - (S.dept_know[t.department_id] || 0) / 220;
        if (t.involves_guest) w *= 1 + risky * 1.5;
        if (t.kind === 'equip') w *= focusEff('equip', 1);       // แผนงาน PM
        w *= upgradeWeight(t.code) * trainedWeight(t);          // มติ คปอ. และการอบรม
        return { t, w };
      }));
    }
    if (!type) return null;
    const p = at || pickSpot(LOC[type.location_id] || LOC[DEPT[type.department_id].work_location_id], 30);
    owner = owner || pickOwner(type);
    const fuse = C.fuse_by_severity[type.severity] * season().fuse_multiplier * (0.85 + rnd() * 0.3);
    const h = {
      id: S.next.hazard++, type_id: type.id, x: p.x, y: p.y, sev: type.severity, fuse, fuse_max: fuse,
      disc: false, rep: false, mit: false, car_due: null, owner_id: owner ? owner.id : null, reporter_id: null,
      done: false, result: null, ignored: 0, incident_row: null, born_day: S.day, born_time: timeText()
    };
    S.hazards.push(h);
    if (S.hazards.length > 160) S.hazards = S.hazards.filter(x => !x.done || x.born_day >= S.day - 1);
    return h;
  }
  function incidentRow(h) { return h.incident_row ? S.incidents.find(r => r.id === h.incident_row) : null; }
  function newIncidentRow(h, reporter) {
    const t = HT[h.type_id];
    const row = {
      id: S.next.incident++, location_zone: locName(t), location_id: t.location_id, hazard_type_id: t.id,
      incident_type: 'near_miss', severity: h.sev, reported_by_npc_id: reporter ? reporter.id : null,
      offender_npc_id: t.kind === 'behav' ? h.owner_id : null, injured_npc_id: null, injured_guest: false, injury_level: null,
      description: t.title + ' — ' + t.description, corrective_action_taken: null, root_cause: null,
      status: 'open', game_day: S.day, game_time: timeText()
    };
    S.incidents.push(row); h.incident_row = row.id;
    return row;
  }
  function discover(h, reporter, finder) {
    const t = HT[h.type_id];
    if (reporter) { if (h.rep) return; h.rep = true; h.reporter_id = reporter.id; }
    else { if (h.disc) return; h.disc = true; }
    if (!h.incident_row) {
      newIncidentRow(h, reporter); S.totals.found++; S.today.found++;
      if (finder) credit(finder.id, 'found');
    }
    if (reporter) emit('log', '📢 ' + reporter.nickname + ' (' + DEPT[reporter.department_id].short + ') แจ้ง: ' + t.title, 'report');
    else emit('log', '👀 ' + (S.coop && finder ? pinfo(finder.id).name + ' ' : '') + 'พบจุดเสี่ยง: ' + t.title + ' — ' + locName(t), 'warn');
  }
  function updateHazards(dt) {
    const radius = (S.hour >= 19 ? 130 : 190) * focusEff('see', 1);
    const pls = players();
    for (const h of S.hazards) {
      if (h.done) continue;
      h.fuse -= dt * (h.mit ? C.car_fuse_slowdown : 1);
      if (!h.disc) { const f = pls.find(pl => Math.hypot(pl.x - h.x, pl.y - h.y) < radius); if (f) discover(h, null, f); }
      if (h.fuse <= 0) expire(h);
      if (S.over) return;
    }
  }
  function updateReports(dt) {
    S.report_in -= dt;
    if (S.report_in > 0) return;
    S.report_in = C.report_every_seconds;
    for (const h of S.hazards) {
      if (h.done || h.disc || h.rep) continue;
      const t = HT[h.type_id];
      const staff = npcs.filter(n => n.department_id === t.department_id && n.on && n.hurt_t <= 0);
      if (!staff.length) continue;
      const p = clamp((avgTrust(staff) - 30) / 60 * focusEff('report', 1), 0, 0.7);
      if (rnd() < p) discover(h, staff.slice().sort((a, b) => b.trust - a.trust)[0]);
    }
  }
  function advanceTime(min, except) {
    if (S.coop) return;   // เล่นหลายคน: การกระทำของคนหนึ่งไม่เร่งนาฬิกาของทุกคน
    S.hour = Math.min(C.time.end_hour - 0.01, S.hour + min / 60);
    const sec = (min / C.time.game_minutes_per_second) * 0.5;
    for (const h of S.hazards) if (!h.done && h !== except) h.fuse -= sec * (h.mit ? C.car_fuse_slowdown : 1);
  }

  const ACTION_TEXT = { stop: 'หยุดงาน/ปิดพื้นที่และแก้ไขทันที', coach: 'คุยสอนหน้างาน', car: 'ออกใบ CAR พร้อมมาตรการชั่วคราว', ignore: 'ยังไม่ดำเนินการ' };

  function hazardAction(h, act) {
    const t = HT[h.type_id], s = season();
    const owner = byId[h.owner_id];
    const res = { act, best: act === t.best_action, best_action: t.best_action, why: t.why_text, resolved: false,
      trust: 0, ops: 0, rep: 0, minutes: 0, sev_before: h.sev };
    if (act === 'ignore') {
      h.ignored++; h.disc = true;
      res.trust = h.sev >= 3 ? -3 : -1;
      adjustTrust(owner, res.trust, 'ignored', t, true);
      const row = incidentRow(h); if (row) row.corrective_action_taken = ACTION_TEXT.ignore;
      return res;
    }
    const tab = C.actions[t.kind][act] || {};
    let trust = tab.trust || 0;
    if (h.sev >= 4 && act === 'stop') trust = Math.max(trust, 2);
    if (res.best) trust += 2;
    let resolved = !!tab.resolve;
    if (tab.resolve_if_sev_at_most !== undefined) resolved = h.sev <= tab.resolve_if_sev_at_most;
    const ops = (tab.ops || 0) * s.ops_cost_multiplier;
    S.metrics.ops = clamp(S.metrics.ops - ops, 0, 100);
    const minutes = act === 'stop' ? 20 : act === 'coach' ? 15 : 10;
    advanceTime(minutes, h);
    if (tab.know) S.dept_know[t.department_id] = clamp((S.dept_know[t.department_id] || 0) + tab.know, 0, 100);
    if (owner) {
      if (act === 'coach') owner.comp = clamp(owner.comp + 3, 0, 100);
      if (act === 'stop' && t.kind === 'behav') owner.comp = clamp(owner.comp + 1, 0, 100);
    }
    adjustTrust(owner, trust, act === 'stop' && h.sev >= 4 ? 'heroic' : act, t, true);
    let rep = res.best ? 2 : h.sev >= 3 ? -1 : 0;
    if (act === 'coach' && t.kind === 'equip' && h.sev >= 3) rep -= 2;
    S.metrics.reputation = clamp(S.metrics.reputation + rep, 0, 100);
    let row = incidentRow(h);
    if (!row) { row = newIncidentRow(h, null); S.totals.found++; S.today.found++; credit(actor.id, 'found'); }
    if (act === 'coach') credit(actor.id, 'coach');
    if (resolved) {
      h.done = true; h.result = act;
      S.totals.closed++; S.today.closed++;
      credit(actor.id, 'closed');
      if (act === 'coach') { S.totals.coach++; S.today.coach++; }
      row.status = 'resolved'; row.corrective_action_taken = ACTION_TEXT[act] + ': ' + t.why_text;
    } else {
      if (tab.sev_down) {
        h.sev = Math.max(1, h.sev - tab.sev_down);
        h.fuse = Math.max(h.fuse, C.fuse_by_severity[h.sev] * s.fuse_multiplier);
        h.fuse_max = Math.max(h.fuse_max, h.fuse);
      }
      if (tab.car) {
        h.mit = true; h.car_due = S.day + C.car_days;
        row.status = 'investigating';
        row.corrective_action_taken = ACTION_TEXT.car + ' ครบกำหนด ' + dateText(h.car_due);
      } else row.corrective_action_taken = ACTION_TEXT[act] + ' (ยังไม่จบที่ต้นเหตุ)';
    }
    Object.assign(res, { resolved, trust, ops, rep, minutes, sev_after: h.sev });
    return res;
  }

  function processCars() {
    for (const h of S.hazards) {
      if (h.done || !h.mit || h.car_due === null || h.car_due > S.day) continue;
      const t = HT[h.type_id], owner = byId[h.owner_id];
      const staff = npcs.filter(n => n.department_id === t.department_id);
      const p = 0.4 + avgTrust(staff) / 200 + (S.dept_know[t.department_id] || 0) / 300;
      const row = incidentRow(h);
      if (rnd() < p) {
        h.done = true; h.result = 'car';
        S.totals.closed++; S.today.closed++;
        if (row) { row.status = 'closed'; row.corrective_action_taken += ' — ปิด CAR แล้ว'; }
        adjustTrust(owner, 2, 'car_ok', t, false);
        S.metrics.reputation = clamp(S.metrics.reputation + 2, 0, 100);
        emit('log', '✅ ปิด CAR: ' + t.title, 'good');
      } else {
        h.mit = false; h.car_due = null; h.fuse = h.fuse_max * 0.6;
        if (row) { row.status = 'open'; row.corrective_action_taken += ' — ไม่เสร็จตามกำหนด'; }
        adjustTrust(owner, -3, 'car_fail', t, false);
        S.metrics.reputation = clamp(S.metrics.reputation - 3, 0, 100);
        emit('log', '⏰ CAR ไม่เสร็จตามกำหนด: ' + t.title + ' (กลับมาเสี่ยงอีกครั้ง)', 'bad');
      }
    }
  }

  // หมดเวลาครั้งแรก: อาจเป็นแค่ "เกือบเกิดเหตุ" ทุกคนรู้ และได้โอกาสแก้อีกรอบ
  function expire(h) {
    const t = HT[h.type_id];
    if (!h.near_missed && rnd() < (h.ignored ? C.near_miss_chance * 0.6 : C.near_miss_chance)) {
      h.near_missed = true; h.rep = true; h.fuse = h.fuse_max * 0.6;
      if (!h.incident_row) { newIncidentRow(h, null); S.totals.found++; S.today.found++; }
      emit('log', '😰 เกือบเกิดอุบัติเหตุ! ' + t.title + ' — ' + locName(t) + ' (รีบไปแก้ก่อนจะเกิดจริง)', 'bad');
      return;
    }
    incident(h);
  }

  function incident(h) {
    const t = HT[h.type_id];
    h.done = true; h.result = 'incident';
    let level = h.sev;
    if (level > 1 && rnd() < 0.35) level--;
    if (level > 1 && rnd() < focusEff('sev_down', 0)) level--;   // ซ้อมแผนฉุกเฉินไว้แล้ว
    if (level > 1 && rnd() < (S.dept_know[t.department_id] || 0) / 160) level--;
    let victim = null, guestV = false;
    if (t.involves_guest && rnd() < 0.55) guestV = true;
    else {
      victim = byId[h.owner_id];
      if (!victim || !victim.on) {
        const st = npcs.filter(n => n.department_id === t.department_id && n.on);
        victim = st.length ? pick(st) : victim;
      }
    }
    const knew = h.disc || h.rep;
    const lti = level >= 3;
    S.totals.incidents++; S.today.incidents++;
    if (lti) { S.totals.lti++; S.today.lti++; S.totals.serious++; S.days_safe = 0; }
    if (victim) {
      victim.hurt_t = 90;
      if (lti) victim.away_until = S.day + (level === 4 ? 5 : 2);
      adjustTrust(victim, -6, 'incident', t, false);
    }
    for (const m of npcs) if (m.department_id === t.department_id) m.trust = clamp(m.trust - (2 + level * 1.5) - (knew ? 2 : 0), 0, 100);
    const owner = byId[h.owner_id];
    if (owner && owner !== victim) addMemory(owner, 'incident', { detail: shortTitle(t), hazard_type_id: t.id });
    S.metrics.ops = clamp(S.metrics.ops - level * 4, 0, 100);
    S.metrics.reputation = clamp(S.metrics.reputation - (lti ? 14 : 4) - (knew ? 5 : 0), 0, 100);
    S.metrics.guest_sat = clamp(S.metrics.guest_sat - (guestV ? 10 + level * 3 : 2), 0, 100);
    const row = incidentRow(h) || newIncidentRow(h, null);
    Object.assign(row, {
      incident_type: t.incident_type, injured_npc_id: victim ? victim.id : null, injured_guest: guestV, injury_level: level,
      status: 'investigating', game_day: S.day, game_time: timeText(), severity: h.sev
    });
    const who = guestV ? 'แขกผู้เข้าพัก' : victim ? victim.nickname + ' (' + DEPT[victim.department_id].short + ')' : 'พนักงาน';
    emit('incident', { row, level, who, t, knew, lti, x: h.x, y: h.y });
    checkOver();
  }

  const CAUSES = {
    condition: 'สภาพการทำงานไม่ปลอดภัย (อุปกรณ์/เครื่องจักร/ระบบ)',
    act: 'การกระทำไม่ปลอดภัย (พฤติกรรม/ไม่ทำตามขั้นตอน)',
    env: 'การจัดการพื้นที่และสภาพแวดล้อมชั่วคราว'
  };
  const KIND_CAUSE = { equip: 'condition', behav: 'act', env: 'env' };
  function investigate(row, cause) {
    const t = HT[row.hazard_type_id];
    const right = KIND_CAUSE[t.kind] === cause;
    credit(actor.id, 'inv');
    row.root_cause = CAUSES[cause];
    row.status = 'closed';
    row.corrective_action_taken = (row.corrective_action_taken ? row.corrective_action_taken + ' | ' : '') + 'มาตรการหลังสอบสวน: ' + t.why_text;
    advanceTime(20);
    if (right) {
      S.metrics.reputation = clamp(S.metrics.reputation + 3, 0, 100);
      for (const m of npcs) if (m.department_id === t.department_id) m.trust = clamp(m.trust + 2, 0, 100);
      S.dept_know[t.department_id] = clamp((S.dept_know[t.department_id] || 0) + 6, 0, 100);
    } else S.metrics.reputation = clamp(S.metrics.reputation - 2, 0, 100);
    return { right, correct: CAUSES[KIND_CAUSE[t.kind]], why: t.why_text };
  }

  // ------------------------------------------------------------------ PTW
  function updatePtw(dt) {
    S.ptw_in -= dt;
    if (S.ptw_in <= 0) {
      S.ptw_in = C.ptw_every_seconds * (isHigh() ? 1.4 : 0.6) * (0.7 + rnd() * 0.6);
      spawnPtw();
    }
    for (const p of S.ptw) {
      if (p.status === 'pending' && p.game_day === S.day && S.hour - p.created_hour > 3) {
        p.status = 'completed';
        const w = byId[p.assigned_npc_id], tp = G.ptw_templates.find(x => x.id === p.template_id);
        S.metrics.reputation = clamp(S.metrics.reputation - 3, 0, 100);
        emit('log', '⚠️ ' + (w ? w.nickname : 'ช่าง') + ' เริ่มงาน "' + p.work_title + '" โดยไม่รอใบอนุญาต', 'bad');
        if (tp) spawnHazard(tp.hazard_code, { x: p.x, y: p.y }, w);
      }
      if (p.risk_in !== undefined && p.risk_in !== null) {
        p.risk_in -= dt;
        if (p.risk_in <= 0) {
          p.risk_in = null;
          const tp = G.ptw_templates.find(x => x.id === p.template_id);
          if (tp) spawnHazard(tp.hazard_code, { x: p.x, y: p.y }, byId[p.assigned_npc_id]);
        }
      }
      if (p.status === 'approved' && p.done_hour !== null && p.game_day === S.day && S.hour >= p.done_hour) p.status = 'completed';
    }
  }
  function spawnPtw() {
    if (S.ptw.filter(p => p.status === 'pending').length >= 3) return;
    const hi = isHigh();
    const tp = weighted(G.ptw_templates.map(t => ({ t, w: hi ? t.weight_high : t.weight_low })));
    if (!tp) return;
    const staff = npcs.filter(n => n.department_id === tp.department_id && n.on);
    const worker = staff.length ? pick(staff) : npcs.find(n => n.department_id === tp.department_id);
    const loc = LOC[tp.location_id], spot = pickSpot(loc, 10);
    const p = {
      id: S.next.ptw++, template_id: tp.id, work_title: tp.work_title, location: loc.name, location_id: tp.location_id,
      risk_level: tp.risk_level, assigned_npc_id: worker.id, approved_by_player_id: null, is_ppe_checked: false,
      status: 'pending', game_day: S.day, created_hour: S.hour, x: spot.x, y: spot.y, done_hour: null, risk_in: null
    };
    S.ptw.push(p);
    emit('log', '📝 คำขอใบอนุญาตทำงาน: ' + p.work_title + ' (' + worker.nickname + ')', 'ptw');
  }
  function ptwDecision(p, decision) {
    const w = byId[p.assigned_npc_id];
    const near = Math.hypot(actor.x - p.x, actor.y - p.y) < 170;
    if (decision !== 'reject' && (decision !== 'check' || near)) credit(actor.id, 'ptw');
    if (decision === 'check') {
      if (!near) return { ok: false };
      Object.assign(p, { status: 'approved', is_ppe_checked: true, approved_by_player_id: PLAYER.id, done_hour: S.hour + 2 });
      advanceTime(10);
      adjustTrust(w, 3, 'ptw_ok', null, true, { detail: p.work_title });
      if (w) w.comp = clamp(w.comp + 2, 0, 100);
      S.metrics.reputation = clamp(S.metrics.reputation + 1.5, 0, 100);
      S.totals.ptw++; S.today.ptw++;
      return { ok: true, kind: 'check' };
    }
    if (decision === 'approve') {
      Object.assign(p, { status: 'approved', approved_by_player_id: PLAYER.id, done_hour: S.hour + 2 });
      const risk = p.risk_level === 'extreme' ? 0.6 : p.risk_level === 'high' ? 0.45 : 0.3;
      if (rnd() < risk) p.risk_in = 20 + rnd() * 40;
      S.totals.ptw++; S.today.ptw++;
      return { ok: true, kind: 'approve', risk };
    }
    p.status = 'rejected';
    const cost = 3 * season().ops_cost_multiplier;
    S.metrics.ops = clamp(S.metrics.ops - cost, 0, 100);
    adjustTrust(w, -3, 'ptw_reject', null, false, { detail: p.work_title });
    return { ok: true, kind: 'reject', cost };
  }

  // ------------------------------------------------------------------ คุยกับ NPC
  function greetLine(n) {
    const band = n.trust < 35 ? 0 : n.trust < 65 ? 1 : 2;
    const parts = [fmt(n, pick(D.greet[band]))];
    if (n.trust >= 50) {
      const h = S.hazards.find(x => !x.done && !x.disc && !x.rep && HT[x.type_id].department_id === n.department_id);
      if (h) { parts.push(fmt(n, pick(D.hint), { hazard: HT[h.type_id].title })); discover(h, n); return parts.join(' '); }
    }
    const m = topMemory(n);
    if (m && rnd() < 0.85) parts.push(memoryLine(n, m));
    else if (rnd() < 0.6) parts.push(fmt(n, pick(D.season[season().season_name])));
    if (n.origin && n.origin.indexOf('เมียนมา') === 0 && rnd() < 0.35) parts.push(fmt(n, pick(D.migrant)));
    if (band >= 1 && rnd() < 0.45) { const tr = D.traits[n.personality_trait]; if (tr) parts.push(fmt(n, pick(tr)).trim()); }
    return parts.filter(Boolean).join(' ');
  }

  function talk(n, topic) {
    const dept = DEPT[n.department_id];
    if (n.hurt_t > 0) return { text: fmt(n, pick(D.hurt)) };
    advanceTime(3);
    credit(actor.id, topic === 'scold' ? 'scold' : 'talk');
    if (topic === 'greet') {
      if (n.talk_day !== S.day) { n.talk_day = S.day; n.trust = clamp(n.trust + 2, 0, 100); if (rnd() < 0.4) addMemory(n, 'talk'); }
      return { text: greetLine(n) };
    }
    if (topic === 'story') {
      if (n.trust < 40) return { text: fmt(n, D.story_locked) };
      const first = !n.story_known;
      n.story_known = true;
      if (first) { n.trust = clamp(n.trust + 3, 0, 100); addMemory(n, 'talk'); }
      return { text: fmt(n, D.story, { origin: n.origin, years: n.years_at_resort, motive: n.motive }) };
    }
    if (topic === 'ppe') {
      if (!dept.ppe) return { text: fmt(n, pick(D.ppe_none)) };
      if (n.ppe_missing) return { text: fmt(n, pick(D.ppe_missing), { ppe: dept.ppe }), ppe_missing: true };
      if (n.check_day !== S.day) { n.check_day = S.day; n.trust = clamp(n.trust + 1, 0, 100); addMemory(n, 'ppe_ok', { detail: dept.ppe }); }
      return { text: fmt(n, pick(D.ppe_ok), { ppe: dept.ppe }) };
    }
    if (topic === 'praise') {
      if (n.praise_day === S.day) { n.trust = clamp(n.trust - 1, 0, 100); return { text: fmt(n, pick(D.praise_again)) }; }
      n.praise_day = S.day;
      adjustTrust(n, 4, 'praise', null, true);
      return { text: fmt(n, pick(D.praise_first)) };
    }
    if (topic === 'toolbox') {
      if (n.toolbox_day === S.day) return { text: fmt(n, pick(D.toolbox_again)) };
      n.toolbox_day = S.day;
      advanceTime(17);
      S.metrics.ops = clamp(S.metrics.ops - 2 * season().ops_cost_multiplier, 0, 100);
      S.dept_know[n.department_id] = clamp((S.dept_know[n.department_id] || 0) + 3, 0, 100);
      n.comp = clamp(n.comp + 3, 0, 100);
      adjustTrust(n, 2, 'toolbox', null, false, { detail: dept.toolbox });
      return { text: fmt(n, pick(D.toolbox_ok), { topic: dept.toolbox }) };
    }
    if (topic === 'scold') {
      const band = n.trust < 35 ? 0 : n.trust < 65 ? 1 : 2;
      const fixes = n.ppe_missing;
      adjustTrust(n, fixes ? -5 : -8, 'scold', null, true);
      n.comp = clamp(n.comp + 1, 0, 100);
      if (fixes) { n.ppe_missing = false; relook(n); }
      S.totals.scold++; S.today.scold++;
      return { text: fmt(n, pick(D.scold[band])) };
    }
    return { text: '' };
  }

  function ppeChoice(n, kind) {
    const dept = DEPT[n.department_id];
    if (kind === 'scold') return talk(n, 'scold');
    n.ppe_missing = false; relook(n);
    advanceTime(3);
    if (kind === 'stop') {
      S.metrics.ops = clamp(S.metrics.ops - 1, 0, 100);
      adjustTrust(n, 1, 'ppe_remind', null, false, { detail: dept.ppe });
      n.comp = clamp(n.comp + 2, 0, 100);
      return { text: fmt(n, 'ครับ ผมไปหยิบ{ppe}มาใส่ก่อน แล้วค่อยทำต่อ', { ppe: dept.ppe }) };
    }
    adjustTrust(n, 3, 'ppe_remind', null, false, { detail: dept.ppe });
    n.comp = clamp(n.comp + 2, 0, 100);
    S.metrics.reputation = clamp(S.metrics.reputation + 0.5, 0, 100);
    return { text: fmt(n, 'ขอบคุณที่เตือนดีๆ นะครับ จะใส่{ppe}ทุกครั้ง', { ppe: dept.ppe }) };
  }

  function guestTalk(g, topic) {
    const t = g.t, Dg = D.guest;
    if (topic === 'advise') {
      if (t.advised_day === S.day) return { text: 'เข้าใจแล้วจ้า ขอบคุณ' };
      t.advised_day = S.day;
      advanceTime(3);
      if (t.risk_behavior_trait !== 'safe') {
        t.risk_behavior_trait = 'safe';
        S.metrics.guest_sat = clamp(S.metrics.guest_sat + 1, 0, 100);
      } else S.metrics.guest_sat = clamp(S.metrics.guest_sat + 0.5, 0, 100);
      return { text: pick(Dg.advised) };
    }
    const lines = Dg[t.risk_behavior_trait] && t.risk_behavior_trait !== 'safe' && rnd() < 0.7 ? Dg[t.risk_behavior_trait] : Dg.greet;
    return { text: pick(lines) };
  }

  // ------------------------------------------------------------------ ตัวชี้วัด / วัน
  function updateMetrics(dt) {
    const m = S.metrics;
    m.ops = Math.min(92, m.ops + dt * 0.45);
    const openGuest = S.hazards.filter(h => !h.done && HT[h.type_id].involves_guest).length;
    const target = clamp(m.ops + 8 - openGuest * 4, 0, 98);
    m.guest_sat += (target - m.guest_sat) * Math.min(1, dt * 0.03);
    if (m.ops < 35) {
      m.reputation = Math.max(0, m.reputation - dt * 0.2);
      if (S.t - S.warned_ops > 40) { S.warned_ops = S.t; emit('log', '📞 ผู้จัดการทั่วไปโทรมา: "งานบริการสะดุดหนักแล้วนะ ช่วยดูด้วย"', 'bad'); }
    }
    checkOver();
  }
  function checkOver() {
    if (S.over) return;
    let reason = '';
    if (S.totals.serious >= C.game_over.serious_incidents) reason = 'เกิดอุบัติเหตุร้ายแรงครบ ' + C.game_over.serious_incidents + ' ครั้ง ผู้บริหารสั่งทบทวนระบบความปลอดภัยทั้งหมด';
    else if (S.metrics.reputation <= 0) reason = 'ความน่าเชื่อถือของ จป. หมดลง ผู้บริหารไม่สนับสนุนงานความปลอดภัยอีกต่อไป';
    if (reason) { S.over = true; S.over_reason = reason; paused = true; emit('gameover', reason); }
  }
  function endDay() {
    if (S.ending) return;
    S.ending = true; paused = true;
    if (S.today.lti === 0) S.days_safe++;
    S.metrics.reputation = clamp(S.metrics.reputation + (S.today.lti === 0 ? 3 : 0), 0, 100);
    const report = {
      player_id: PLAYER.id, game_day: S.day, season_name: season().season_name,
      hazards_found: S.today.found, hazards_closed: S.today.closed, incidents: S.today.incidents,
      lost_time_injuries: S.today.lti, ops_score: Math.round(S.metrics.ops), guest_sat: Math.round(S.metrics.guest_sat),
      reputation: Math.round(S.metrics.reputation), avg_trust: Math.round(avgTrust())
    };
    S.day_reports.push(report);
    emit('dayend', report, Object.assign({}, S.today));
  }
  function nextDay() {
    const prev = season().season_name;
    S.day++; S.hour = C.time.start_hour; S.today = freshToday(); S.today_by = {}; S.ending = false;
    S.focus = null;
    ensureBudget();
    const dom = dateOf(S.day).getDate();
    const thisMonthKpo = S.activities.some(a => a.activity_type === 'kpo_meeting' && monthKey(a.scheduled_day) === monthKey(S.day) && a.status !== 'cancelled' && a.status !== 'missed');
    if (dom >= 20 && !thisMonthKpo) emit('log', '🏛️ เดือนนี้ยังไม่ได้นัดประชุม คปอ. (ต้องประชุมอย่างน้อยเดือนละครั้ง) นัดได้ที่ 📅 แผนงาน', 'warn');
    processCars();
    for (const n of npcs) { n.hurt_t = 0; n.on = false; n.route = null; n.event_id = null; }
    S.holds = [];
    rollDailyPpe();
    for (const p of S.ptw) {
      if (p.status === 'pending') { p.game_day = S.day; p.created_hour = S.hour; }
      if (p.status === 'approved') p.status = 'completed';
    }
    syncTourists(false);
    paused = false;
    const s = season();
    emit('log', '☀️ เริ่มวันที่ ' + (S.day + 1) + ' — ' + dateText(S.day) + ' (' + s.label + ')', 'info');
    if (s.season_name !== prev) emit('log', '🌦️ เข้าสู่' + s.label + ': ' + s.season_description, 'season');
  }
  function toggleSeason() {
    const cur = season().season_name;
    S.season_override = cur === 'High_Season' ? 'Low_Season' : 'High_Season';
    syncTourists(false);
    emit('log', '🌦️ (ทดลอง) เปลี่ยนเป็น' + season().label, 'season');
  }

  // ------------------------------------------------------------------ การโต้ตอบ
  function findInteract(pl) {
    pl = pl || P;
    let best = null, bd = 1e9;
    for (const a of S.activities || []) {
      if (a.status !== 'due' || a.x === undefined) continue;
      const d = Math.hypot(pl.x - a.x, pl.y - a.y);
      if (d < 80 && d < bd) { bd = d; best = { type: 'activity', obj: a }; }
    }
    if (best) return best;
    for (const h of S.hazards) {
      if (h.done || !(h.disc || h.rep)) continue;
      const d = Math.hypot(pl.x - h.x, pl.y - h.y);
      if (d < 62 && d < bd) { bd = d; best = { type: 'hazard', obj: h }; }
    }
    if (best) return best;
    for (const p of S.ptw) {
      if (p.status !== 'pending') continue;
      const d = Math.hypot(pl.x - p.x, pl.y - p.y);
      if (d < 62 && d < bd) { bd = d; best = { type: 'ptw', obj: p }; }
    }
    if (best) return best;
    for (const n of npcs) {
      if (!n.on || n.inside_t > 0) continue;
      const d = dist(pl, n);
      if (d < 46 && d < bd) { bd = d; best = { type: 'npc', obj: n }; }
    }
    for (const g of guests) {
      const d = dist(pl, g);
      if (d < 40 && d < bd) { bd = d; best = { type: 'guest', obj: g }; }
    }
    return best;
  }
  // scale > 1 บนมือถือ: เป้าหมายสำหรับนิ้วใหญ่กว่าเมาส์
  function pickAt(x, y, scale) {
    const k = scale || 1;
    for (const a of S.activities || []) if (a.status === 'due' && a.x !== undefined && Math.hypot(x - a.x, y - (a.y - 40)) < 26 * k) return { type: 'activity', obj: a };
    for (const h of S.hazards) if (!h.done && (h.disc || h.rep) && Math.hypot(x - h.x, y - (h.y - 30)) < 22 * k) return { type: 'hazard', obj: h };
    for (const p of S.ptw) if (p.status === 'pending' && Math.hypot(x - p.x, y - (p.y - 30)) < 22 * k) return { type: 'ptw', obj: p };
    let best = null, bd = 20 * k;
    for (const n of npcs) { if (!n.on || n.inside_t > 0) continue; const d = Math.hypot(x - n.x, y - (n.y - 18)); if (d < bd) { bd = d; best = { type: 'npc', obj: n }; } }
    for (const g of guests) { const d = Math.hypot(x - g.x, y - (g.y - 18)); if (d < bd) { bd = d; best = { type: 'guest', obj: g }; } }
    return best;
  }

  // ================================================================== แผนงาน / ประชุม คปอ. / อบรม
  function focusEff(key, d) { const f = S && S.focus && FOCUS[S.focus]; return f && f.effect[key] !== undefined ? f.effect[key] : d; }
  function upgradeWeight(code) {
    let w = 1;
    (S.upgrades || []).forEach(u => { const p = PROP[u]; if (p && p.effect.hazard_codes.indexOf(code) >= 0) w *= p.effect.weight; });
    return w;
  }
  function upgradePpe(deptId) {
    let w = 1;
    (S.upgrades || []).forEach(u => { const p = PROP[u]; if (p && p.department_id === deptId && p.effect.ppe) w *= p.effect.ppe; });
    return w;
  }
  function trainedWeight(t) {
    let w = 1;
    Object.keys(S.trained || {}).forEach(k => {
      const parts = k.split(':'), tp = TOPIC[parts[1]];
      if (+parts[0] !== t.department_id || !tp) return;
      if (tp.hazard_codes.indexOf(t.code) >= 0) w *= 0.7;
      if (tp.all) w *= tp.all;                       // หัวข้อทั่วไป (เช่น ความปลอดภัยทั่วไป) ลดจุดเสี่ยงทุกประเภทของแผนก
    });
    return w;
  }
  function monthKey(day) { const d = dateOf(day); return d.getFullYear() * 12 + d.getMonth(); }
  function ensureBudget() {
    const k = monthKey(S.day);
    if (!S.budget || S.budget.month !== k) {
      const isNew = !!S.budget;
      S.budget = { month: k, left: KPO.budget_per_month, total: KPO.budget_per_month };
      if (isNew) emit('log', '💰 งบความปลอดภัยเดือนใหม่ ' + KPO.budget_per_month.toLocaleString() + ' บาท', 'info');
    }
  }
  function addActivity(type, title, o) {
    const a = Object.assign({
      id: S.next.activity++, activity_type: type, title, department_id: null, topic_code: null, scheduled_day: S.day,
      scheduled_hour: Math.round(S.hour * 100) / 100, status: 'done', location_id: null, attendees: 0, score: null,
      budget_baht: 0, details: {}, player_id: actor.id
    }, o || {});
    S.activities.push(a);
    if (S.activities.length > 300) S.activities.splice(0, S.activities.length - 300);
    return a;
  }
  // แผนงานประจำวัน: เลือกได้วันละครั้ง
  function setFocus(code) {
    if (S.focus_day === S.day) return { err: 'วันนี้เลือกแผนงานไปแล้ว' };
    S.focus_day = S.day;
    const f = FOCUS[code];
    S.focus = f ? code : null;
    if (!f) return { ok: true };
    if (f.effect.ops) S.metrics.ops = clamp(S.metrics.ops + f.effect.ops, 0, 100);
    if (f.effect.ppe) rollDailyPpe();
    addActivity('daily_focus', f.title, { topic_code: code });
    emit('log', f.icon + ' แผนงานวันนี้: ' + f.title, 'info');
    return { ok: true };
  }
  function schedule(type, o) {
    o = o || {};
    const day = Math.max(S.day, Math.round(+o.day) || S.day);
    const tp0 = type === 'training' ? TOPIC[o.topic] : null;
    const span = tp0 && tp0.hours ? tp0.hours : 2;           // หลักสูตรยาว (เช่น 6 ชั่วโมง) ต้องเริ่มเร็วพอให้จบก่อนสิ้นวัน
    if (tp0 && tp0.hours && (+o.hour || 10) > C.time.end_hour - span) return { err: 'หลักสูตร ' + tp0.hours + ' ชั่วโมง ต้องเริ่มไม่เกิน ' + timeText(C.time.end_hour - span) + ' น.' };
    const hour = clamp(+o.hour || 10, C.time.start_hour + 1, C.time.end_hour - span);
    if (day === S.day && hour < S.hour + 0.25) return { err: 'เวลานี้ผ่านไปแล้ว เลือกเวลาที่ช้ากว่านี้' };
    if (S.activities.some(a => (a.status === 'planned' || a.status === 'due') && a.scheduled_day === day && Math.abs(a.scheduled_hour - hour) < 1.5)) {
      return { err: 'มีกิจกรรมอื่นนัดไว้ใกล้เวลานี้แล้ว' };
    }
    let title, dept = null, topic = null, loc;
    if (type === 'kpo_meeting') { title = 'ประชุม คปอ. ประจำเดือน'; loc = KPO.meeting_location; }
    else if (type === 'training') {
      topic = TOPIC[o.topic] ? o.topic : null;
      dept = DEPT[+o.department_id] ? +o.department_id : null;
      if (!topic || !dept) return { err: 'เลือกแผนกและหัวข้ออบรมก่อน' };
      title = 'อบรม' + TOPIC[topic].title + ' · ' + DEPT[dept].short; loc = KPO.training_location;
    } else return { err: 'ชนิดกิจกรรมไม่ถูกต้อง' };
    const a = addActivity(type, title, { department_id: dept, topic_code: topic, scheduled_day: day, scheduled_hour: hour, status: 'planned', location_id: loc });
    emit('log', '📅 นัดหมาย: ' + title + ' — ' + dateText(day) + ' ' + timeText(hour) + ' น.', 'info');
    return { ok: true, a };
  }
  function cancelActivity(id) {
    const a = S.activities.find(x => x.id === id && x.status === 'planned');
    if (!a) return false;
    a.status = 'cancelled';
    return true;
  }
  function attendeesFor(a) {
    const on = npcs.filter(n => n.on && n.hurt_t <= 0 && !n.event_id);
    if (a.activity_type === 'kpo_meeting') {
      const reps = [];
      G.departments.forEach(d => {
        const c = on.filter(n => n.department_id === d.id).sort((x, y) => y.trust - x.trust)[0];
        if (c) reps.push(c);
      });
      return reps;
    }
    return on.filter(n => n.department_id === a.department_id).sort((x, y) => x.comp - y.comp).slice(0, isHigh() ? 6 : 10);
  }
  function startDue(a) {
    a.status = 'due';
    const loc = LOC[a.location_id] || LOC.lobby;
    a.x = loc.x; a.y = loc.y + 4;
    const at = attendeesFor(a);
    a.attendee_ids = at.map(n => n.id);
    at.forEach((n, i) => {
      const ang = (i / Math.max(1, at.length)) * Math.PI * 2;
      let p = { x: loc.x + Math.cos(ang) * 52, y: loc.y + 20 + Math.sin(ang) * 16 };
      if (!Wd.walkable(p.x, p.y)) p = pickSpot(loc, 24);
      n.event_id = a.id; n.inside_t = 0; n.ex = p.x; n.ey = p.y;
      n.route = route(n.x, n.y, p.x, p.y);
    });
    emit('log', '📅 ถึงเวลา' + a.title + ' ที่' + (loc.name || '') + ' (มา ' + at.length + ' คน) เดินไปที่จุดนัดแล้วกดเริ่ม', 'ptw');
  }
  function releaseAttendees(a) {
    npcs.forEach(n => { if (n.event_id === a.id) { n.event_id = null; n.route = route(n.x, n.y, n.wx, n.wy); } });
  }
  function missActivity(a) {
    a.status = 'missed';
    releaseAttendees(a);
    const people = npcs.filter(n => (a.attendee_ids || []).indexOf(n.id) >= 0);
    if (a.activity_type === 'kpo_meeting') {
      S.metrics.reputation = clamp(S.metrics.reputation - 6, 0, 100);
      people.forEach(n => adjustTrust(n, -2, 'missed', null, false, { detail: 'ประชุม คปอ.' }));
    } else {
      npcs.filter(n => n.department_id === a.department_id).forEach(n => { n.trust = clamp(n.trust - 1.5, 0, 100); });
      if (people[0]) addMemory(people[0], 'missed', { detail: 'อบรม' + (TOPIC[a.topic_code] ? TOPIC[a.topic_code].title : '') });
      S.metrics.reputation = clamp(S.metrics.reputation - 2, 0, 100);
    }
    emit('log', '⏰ ไม่ได้จัด' + a.title + 'ตามนัด ' + (a.activity_type === 'kpo_meeting' ? 'ความน่าเชื่อถือลดลง' : 'พนักงานรอเก้อ'), 'bad');
  }
  function updateActivities(dt) {
    for (const a of S.activities) {
      if (a.status === 'planned') {
        if (a.scheduled_day < S.day) missActivity(a);
        else if (a.scheduled_day === S.day && S.hour >= a.scheduled_hour) startDue(a);
      } else if (a.status === 'due' && (a.scheduled_day < S.day || S.hour > a.scheduled_hour + 2)) missActivity(a);
    }
    // หลักสูตรยาว: ผู้เข้าอบรมยังอยู่ในห้องอบรม ทำให้งานบริการช้าลงจนกว่าจะครบเวลา
    if (S.holds && S.holds.length) {
      S.holds = S.holds.filter(h => {
        const a = S.activities.find(x => x.id === h.id);
        if (!a || S.hour >= h.until) {
          if (a) { releaseAttendees(a); emit('log', '📘 จบ' + a.title + ' พนักงานกลับเข้างานแล้ว', 'info'); }
          return false;
        }
        S.metrics.ops = clamp(S.metrics.ops - h.n * 0.06 * (dt || 0) * season().ops_cost_multiplier, 0, 100);
        return true;
      });
    }
  }
  function activityById(id) { return S.activities.find(a => a.id === id) || null; }
  // ผู้เข้าร่วมประชุม/อบรมนัดนี้ (ใช้วาดฉากประชุม/อบรม)
  function attendeesOf(a) {
    const ids = (a && a.attendee_ids) || [];
    return npcs.filter(n => ids.indexOf(n.id) >= 0).map(n => ({ name: n.name, department_id: n.department_id, L: n.L }));
  }

  // ---- ประชุม คปอ.
  function kpoAgenda(a) {
    const last = S.kpo_last || { day: -1, totals: { found: 0, closed: 0, incidents: 0, lti: 0 } };
    const T = S.totals;
    const stats = {
      since_day: last.day, found: T.found - last.totals.found, closed: T.closed - last.totals.closed,
      incidents: T.incidents - last.totals.incidents, lti: T.lti - last.totals.lti,
      open_car: S.hazards.filter(h => !h.done && h.mit).length, open_known: S.hazards.filter(h => !h.done && (h.disc || h.rep)).length
    };
    const risk = {};
    G.departments.forEach(d => { risk[d.id] = 1; });
    S.incidents.forEach(r => { const t = HT[r.hazard_type_id]; if (t && r.game_day >= last.day) risk[t.department_id] += r.injury_level ? 3 : 1; });
    S.hazards.forEach(h => { if (!h.done) risk[HT[h.type_id].department_id] += 1; });
    const pool = KPO.proposals.filter(p => (S.upgrades || []).indexOf(p.code) < 0);
    const props = [];
    while (props.length < 3 && pool.length) {
      const pk = weighted(pool.map(p => ({ t: p, w: risk[p.department_id] * (1 + (60 - avgTrust(npcs.filter(n => n.department_id === p.department_id))) / 60) })));
      if (!pk) break;
      props.push(pk); pool.splice(pool.indexOf(pk), 1);
    }
    a.proposal_codes = props.map(p => p.code);
    const top = Object.keys(risk).sort((x, y) => risk[y] - risk[x])[0];
    return { stats, proposals: props, budget_left: S.budget.left, budget_total: S.budget.total, top_dept: +top, attendees: (a.attendee_ids || []).length };
  }
  function finishKpo(a, approve, rushCar) {
    if (!a || a.status !== 'due' || a.activity_type !== 'kpo_meeting') return { err: 'การประชุมนี้จบไปแล้ว' };
    approve = (approve || []).filter(c => (a.proposal_codes || []).indexOf(c) >= 0 && PROP[c]);
    let spent = 0;
    const ok = [];
    for (const c of approve) { const p = PROP[c]; if (spent + p.cost <= S.budget.left) { spent += p.cost; ok.push(c); } }
    let cars = rushCar ? S.hazards.filter(h => !h.done && h.mit) : [];
    if (spent + cars.length * 5000 > S.budget.left) cars = [];
    spent += cars.length * 5000;
    S.budget.left -= spent;
    S.upgrades = (S.upgrades || []).concat(ok);
    const people = npcs.filter(n => (a.attendee_ids || []).indexOf(n.id) >= 0);
    for (const c of a.proposal_codes || []) {
      const p = PROP[c], yes = ok.indexOf(c) >= 0;
      for (const n of npcs) if (n.department_id === p.department_id) n.trust = clamp(n.trust + (yes ? p.effect.trust * 0.5 : -2), 0, 100);
      const rep = people.find(n => n.department_id === p.department_id) || npcs.find(n => n.department_id === p.department_id);
      addMemory(rep, yes ? 'kpo_yes' : 'kpo_no', { detail: p.title });
    }
    if (ok.some(c => PROP[c].effect.ppe)) rollDailyPpe();
    cars.forEach(h => {
      h.done = true; h.result = 'car'; S.totals.closed++; S.today.closed++;
      const row = incidentRow(h);
      if (row) { row.status = 'closed'; row.corrective_action_taken += ' — ปิดเร็วตามมติ คปอ.'; }
    });
    const rep = 3 + ok.length + (cars.length ? 1 : 0);
    S.metrics.reputation = clamp(S.metrics.reputation + rep, 0, 100);
    S.kpo_last = { day: S.day, totals: { found: S.totals.found, closed: S.totals.closed, incidents: S.totals.incidents, lti: S.totals.lti } };
    const deferred = (a.proposal_codes || []).filter(c => ok.indexOf(c) < 0);
    Object.assign(a, { status: 'done', score: ok.length, budget_baht: spent, attendees: people.length, details: { approved: ok, deferred, rushed_car: cars.length } });
    releaseAttendees(a);
    credit(actor.id, 'kpo');
    emit('log', '🏛️ ปิดประชุม คปอ.: อนุมัติ ' + ok.length + ' เรื่อง ใช้งบ ' + spent.toLocaleString() + ' บาท', 'good');
    return { ok: true, approved: ok.map(c => PROP[c].title), deferred: deferred.map(c => PROP[c].title), spent, budget_left: S.budget.left, rushed: cars.length, rep };
  }

  // ---- อบรมพนักงาน (ตอบคำถาม)
  function trainingQuiz(a) {
    const t = TOPIC[a.topic_code];
    if (!t) return null;
    const idx = t.questions.map((q, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp; }
    a.quiz = idx.slice(0, Math.min(t.ask || 3, idx.length));       // หลักสูตรยาวถามครบทุกหัวข้อย่อย (ask)
    return { topic: t, questions: a.quiz.map(i => t.questions[i]), attendees: (a.attendee_ids || []).length };
  }
  function finishTraining(a, correct) {
    if (!a || a.status !== 'due' || a.activity_type !== 'training') return { err: 'การอบรมนี้จบไปแล้ว' };
    const t = TOPIC[a.topic_code];
    const total = (a.quiz || []).length || 3;
    correct = clamp(Math.round(+correct) || 0, 0, total);
    const people = npcs.filter(x => (a.attendee_ids || []).indexOf(x.id) >= 0);
    const ratio = correct / total;
    const hrs = t.hours > 1 ? t.hours : 0, lg = hrs ? 1 + (hrs - 1) * 0.2 : 1;      // หลักสูตรยาว (เช่น 6 ชั่วโมง) ได้ผลมากกว่า แต่พนักงานหายจากหน้างานนาน
    const gain = Math.round((6 + ratio * 16) * lg * (people.length ? 1 : 0.3));
    S.dept_know[a.department_id] = clamp((S.dept_know[a.department_id] || 0) + gain, 0, 100);
    people.forEach(x => {
      x.comp = clamp(x.comp + (2 + ratio * 4) * lg, 0, 100);
      adjustTrust(x, (1 + ratio * 3) * lg, 'trained', null, false, { detail: t.title });
    });
    S.trained = S.trained || {};
    S.trained[a.department_id + ':' + a.topic_code] = true;
    const rep = 1 + Math.round(ratio * 2) + (hrs ? 2 : 0);
    S.metrics.reputation = clamp(S.metrics.reputation + rep, 0, 100);
    let until = null;
    if (hrs) {
      // ผู้เข้าอบรมอยู่ในห้องอบรมต่อจนครบเวลา งานบริการลดลงระหว่างนี้ (คิดใน updateActivities) แล้วจึงกลับเข้างาน
      until = Math.min(C.time.end_hour - 0.01, S.hour + hrs);
      S.holds = (S.holds || []).filter(h => h.id !== a.id).concat([{ id: a.id, until, n: people.length }]);
    } else {
      S.metrics.ops = clamp(S.metrics.ops - people.length * 0.5 * season().ops_cost_multiplier, 0, 100);
      releaseAttendees(a);
    }
    Object.assign(a, { status: 'done', score: correct, attendees: people.length, details: { questions: total, knowledge_gain: gain, hours: hrs || undefined } });
    credit(actor.id, 'train');
    emit('log', '📚 ' + a.title + ' ผู้เข้าร่วม ' + people.length + ' คน ตอบถูก ' + correct + '/' + total + (hrs ? ' · อบรมต่อจนถึง ' + timeText(until) + ' น.' : ''), 'good');
    return { ok: true, gain, correct, total, attendees: people.length, rep, topic: t.title, dept: DEPT[a.department_id].short, hours: hrs, until };
  }

  // ================================================================== ONLINE (ต่างเครื่อง)
  // เจ้าของห้องรันโลกทั้งหมด → ส่ง snapshot ให้ผู้ร่วมเล่น · ผู้ร่วมเล่นเดินเอง แล้วส่งตำแหน่งกลับ
  const r1 = v => Math.round(v * 10) / 10;
  function cleanName(s, fallback) { return String(s || '').replace(/[<>"&]/g, '').trim().slice(0, 20) || fallback; }

  function addRemotePlayer(name, look) {
    if (PLS.length >= MAX_PLAYERS) return null;
    const id = Math.max(...S.players.map(p => p.id), ...PLS.map(p => p.id)) + 1;
    name = cleanName(name, 'จป.เพื่อน ' + (id - 1));
    const short = name.replace(/^จป\.?\s*/, '') || name;
    S.players.push({ id, name, call_young: 'พี่' + short, call_senior: name, online: true, look: cleanLook(look, id - 1) });
    const pl = { id, x: P.x - 30, y: P.y + 14, dir: 0, phase: 0, moving: false, route: null, target: null, remote: true };
    if (!Wd.walkable(pl.x, pl.y)) { pl.x = P.x; pl.y = P.y; }
    PLS.push(pl);
    S.coop = true;
    emit('log', '🌐 ' + name + ' เข้าร่วมเกม', 'good');
    return pl;
  }
  function removeRemotePlayer(id) {
    const i = PLS.findIndex(p => p.id === id && p.remote);
    if (i < 0) return;
    PLS.splice(i, 1);
    const info = S.players.find(p => p.id === id);
    if (info) info.online = false;
    emit('log', '🌐 ' + (info ? info.name : 'ผู้เล่น') + ' ออกจากเกม', 'warn');
  }
  function netSetPos(id, x, y, dir, moving) {
    const pl = PLS.find(p => p.id === id && p.remote);
    if (!pl || !isFinite(x) || !isFinite(y) || !Wd.walkable(x, y)) return;
    pl.x = x; pl.y = y; pl.dir = (dir | 0) & 3; pl.moving = !!moving;
  }
  function npcModel(n) {
    return {
      id: n.id, trust: Math.round(n.trust), comp: Math.round(n.comp), ppe_missing: n.ppe_missing, hurt: n.hurt_t > 0,
      story_known: n.story_known, mem_count: n.mem.length,
      mem: n.mem.slice().sort((a, b) => b.game_day - a.game_day || b.id - a.id).slice(0, 6).map(m => ({
        id: m.id, type: m.type, memory_text: m.memory_text, game_day: m.game_day, emotional_impact: m.emotional_impact, player_id: m.player_id
      }))
    };
  }
  function netSnapshot(slow) {
    const snap = {
      t: 'snap', T: r1(S.t), hour: Math.round(S.hour * 1000) / 1000, day: S.day, so: S.season_override, ending: S.ending, over: S.over,
      m: { ops: r1(S.metrics.ops), guest_sat: r1(S.metrics.guest_sat), reputation: r1(S.metrics.reputation) },
      pls: PLS.map(p => [p.id, Math.round(p.x), Math.round(p.y), p.dir, p.moving ? 1 : 0]),
      players: S.players,
      hz: S.hazards.filter(h => !h.done && (h.disc || h.rep)).map(h => ({
        id: h.id, type_id: h.type_id, x: Math.round(h.x), y: Math.round(h.y), sev: h.sev, fuse: r1(h.fuse), fuse_max: r1(h.fuse_max),
        disc: h.disc, rep: h.rep, mit: h.mit, car_due: h.car_due, owner_id: h.owner_id
      })),
      ptw: S.ptw.slice(-16), n: [], g: []
    };
    for (const n of npcs) {
      if (n.on && !(n.inside_t > 0)) snap.n.push([n.id, Math.round(n.x), Math.round(n.y), n.dir, n.moving ? 1 : 0, (n.ppe_missing ? 1 : 0) | (n.hurt_t > 0 ? 2 : 0)]);
    }
    for (const g of guests) snap.g.push([g.t.id, Math.round(g.x), Math.round(g.y), g.dir, g.moving ? 1 : 0]);
    if (slow) {
      snap.slow = {
        trust: npcs.map(n => Math.round(n.trust)), comp: npcs.map(n => Math.round(n.comp)),
        on: npcs.filter(n => n.on).map(n => n.id), ppe: npcs.filter(n => n.ppe_missing).map(n => n.id),
        incidents: S.incidents.slice(-40), totals: S.totals, today: S.today, days_safe: S.days_safe,
        day_reports: S.day_reports.slice(-12), by_player: S.by_player, today_by: S.today_by, dept_know: S.dept_know,
        tc: S.tourists.length, gt: guests.map(g => g.t),
        acts: S.activities.filter(a => a.activity_type !== 'daily_focus').slice(-20).map(a => ({
          id: a.id, activity_type: a.activity_type, title: a.title, department_id: a.department_id, topic_code: a.topic_code,
          scheduled_day: a.scheduled_day, scheduled_hour: a.scheduled_hour, status: a.status, x: a.x, y: a.y, attendees: a.attendees, score: a.score
        })),
        focus: S.focus, budget: S.budget
      };
    }
    return snap;
  }

  function netStartClient(pid) {
    NET = 'client';
    S = {
      schema_version: 1, day: 0, hour: C.time.start_hour, t: 0, season_override: null, ending: false, over: false, mirror: true,
      metrics: { ops: 80, guest_sat: 85, reputation: 100 }, totals: { found: 0, closed: 0, incidents: 0, lti: 0, serious: 0, coach: 0, scold: 0, ptw: 0 },
      today: freshToday(), days_safe: 0, dept_know: {}, next: { incident: 1, ptw: 1, memory: 1, hazard: 1, tourist: 1 },
      hazards: [], incidents: [], ptw: [], memories: [], tourists: [], day_reports: [], players: [], by_player: {}, today_by: {},
      coop: true, player: { x: P.x, y: P.y, dir: 0 }, players_pos: [], tourist_count: 0, on_count: 0
    };
    initNpcs(null);
    npcs.forEach(n => { n.on = false; });
    guests = [];
    PLS.length = 1;
    P.id = pid; P.placed = false; P.route = null; P.target = null;
    actor = P;
    paused = false;
  }
  // ---- ตรวจและทำความสะอาดข้อมูลที่ได้รับจากเครื่องอื่น (ห้ามเชื่อข้อมูลจากเครือข่าย)
  const STATUS_OK = ['open', 'investigating', 'resolved', 'closed', 'pending', 'approved', 'rejected', 'completed'];
  const RISK_OK = ['low', 'medium', 'high', 'extreme'];
  const TRAIT_OK = ['safe', 'careless', 'drunk_swimmer', 'rule_breaker'];
  const INC_OK = ['near_miss', 'first_aid', 'property_damage', 'fire_hazard', 'chemical_spill', 'drowning_risk', 'electrical', 'fall_from_height', 'injury'];
  const num = (v, d) => { v = +v; return isFinite(v) ? v : (d || 0); };
  const int = (v, d) => Math.round(num(v, d));
  const str = (v, n) => String(v === null || v === undefined ? '' : v).slice(0, n || 200);
  const oneOf = (v, list, d) => (list.indexOf(v) >= 0 ? v : d);
  const numObj = o => { const r = {}; if (o && typeof o === 'object') Object.keys(o).slice(0, 40).forEach(k => { if (/^\w{1,30}$/.test(k)) r[k] = num(o[k]); }); return r; };
  function sanitizeSnap(sn) {
    if (!sn || typeof sn !== 'object' || !Array.isArray(sn.pls) || !Array.isArray(sn.n) || !Array.isArray(sn.g)) return null;
    const out = {
      T: num(sn.T), hour: Math.max(0, Math.min(24, num(sn.hour, 6))), day: Math.max(0, int(sn.day)),
      so: oneOf(sn.so, ['High_Season', 'Low_Season'], null), ending: !!sn.ending, over: !!sn.over,
      m: { ops: num(sn.m && sn.m.ops), guest_sat: num(sn.m && sn.m.guest_sat), reputation: num(sn.m && sn.m.reputation) },
      pls: sn.pls.slice(0, MAX_PLAYERS + 4).map(a => [int(a[0]), num(a[1]), num(a[2]), int(a[3]) & 3, a[4] ? 1 : 0]),
      players: (Array.isArray(sn.players) ? sn.players : []).slice(0, 32).map(p => {
        const name = cleanName(p && p.name, 'จป.');
        return { id: int(p && p.id), name, call_young: cleanName(p && p.call_young, name), call_senior: cleanName(p && p.call_senior, name), online: !!(p && p.online),
          look: cleanLook(p && p.look, int(p && p.id) - 1) };
      }),
      hz: (Array.isArray(sn.hz) ? sn.hz : []).slice(0, 60).filter(h => h && HT[int(h.type_id)]).map(h => ({
        id: int(h.id), type_id: int(h.type_id), x: num(h.x), y: num(h.y), sev: Math.max(1, Math.min(4, int(h.sev, 1))),
        fuse: num(h.fuse), fuse_max: Math.max(1, num(h.fuse_max, 1)), disc: !!h.disc, rep: !!h.rep, mit: !!h.mit,
        car_due: h.car_due === null || h.car_due === undefined ? null : int(h.car_due), owner_id: h.owner_id === null ? null : int(h.owner_id)
      })),
      ptw: (Array.isArray(sn.ptw) ? sn.ptw : []).slice(0, 40).map(p => ({
        id: int(p.id), template_id: int(p.template_id), work_title: str(p.work_title, 120), location: str(p.location, 80), location_id: str(p.location_id, 40),
        risk_level: oneOf(p.risk_level, RISK_OK, 'medium'), assigned_npc_id: int(p.assigned_npc_id), is_ppe_checked: !!p.is_ppe_checked,
        status: oneOf(p.status, STATUS_OK, 'pending'), game_day: int(p.game_day), created_hour: num(p.created_hour, 6), x: num(p.x), y: num(p.y)
      })),
      n: sn.n.slice(0, 400).map(a => [int(a[0]), num(a[1]), num(a[2]), int(a[3]) & 3, a[4] ? 1 : 0, int(a[5]) & 3]),
      g: sn.g.slice(0, 200).map(a => [int(a[0]), num(a[1]), num(a[2]), int(a[3]) & 3, a[4] ? 1 : 0])
    };
    const sl = sn.slow;
    if (sl && typeof sl === 'object') {
      out.slow = {
        trust: npcs.map((n, i) => Math.max(0, Math.min(100, num(sl.trust && sl.trust[i], n.trust)))),
        comp: npcs.map((n, i) => Math.max(0, Math.min(100, num(sl.comp && sl.comp[i], n.comp)))),
        on: (Array.isArray(sl.on) ? sl.on : []).slice(0, 400).map(v => int(v)),
        ppe: (Array.isArray(sl.ppe) ? sl.ppe : []).slice(0, 400).map(v => int(v)),
        incidents: (Array.isArray(sl.incidents) ? sl.incidents : []).slice(-60).map(r => ({
          id: int(r.id), location_zone: str(r.location_zone, 80), location_id: str(r.location_id, 40),
          hazard_type_id: HT[int(r.hazard_type_id)] ? int(r.hazard_type_id) : null, incident_type: oneOf(r.incident_type, INC_OK, 'near_miss'),
          severity: int(r.severity), reported_by_npc_id: r.reported_by_npc_id === null ? null : int(r.reported_by_npc_id),
          offender_npc_id: r.offender_npc_id === null ? null : int(r.offender_npc_id), injured_npc_id: r.injured_npc_id === null ? null : int(r.injured_npc_id),
          injured_guest: !!r.injured_guest, injury_level: r.injury_level === null || r.injury_level === undefined ? null : Math.max(1, Math.min(4, int(r.injury_level, 1))),
          description: str(r.description, 300), corrective_action_taken: str(r.corrective_action_taken, 400), root_cause: r.root_cause ? str(r.root_cause, 120) : null,
          status: oneOf(r.status, STATUS_OK, 'open'), game_day: int(r.game_day), game_time: str(r.game_time, 5)
        })),
        totals: numObj(sl.totals), today: numObj(sl.today), days_safe: int(sl.days_safe),
        day_reports: (Array.isArray(sl.day_reports) ? sl.day_reports : []).slice(-30).map(r => Object.assign(numObj(r), { season_name: oneOf(r.season_name, ['High_Season', 'Low_Season'], 'High_Season') })),
        by_player: {}, today_by: {}, dept_know: numObj(sl.dept_know), tc: int(sl.tc),
        gt: (Array.isArray(sl.gt) ? sl.gt : []).slice(0, 200).map(t => ({
          id: int(t.id), tourist_code: str(t.tourist_code, 20), nationality: str(t.nationality, 30), risk_behavior_trait: oneOf(t.risk_behavior_trait, TRAIT_OK, 'safe'),
          stay_zone: str(t.stay_zone, 40), check_in_day: int(t.check_in_day), check_out_day: int(t.check_out_day), advised_day: int(t.advised_day, -1)
        }))
      };
      ['by_player', 'today_by'].forEach(k => { const src = sl[k]; if (src && typeof src === 'object') Object.keys(src).slice(0, 32).forEach(pid => { if (/^\d{1,4}$/.test(pid)) out.slow[k][pid] = numObj(src[pid]); }); });
      out.slow.acts = (Array.isArray(sl.acts) ? sl.acts : []).slice(-30).map(a => ({
        id: int(a.id), activity_type: oneOf(a.activity_type, ['kpo_meeting', 'training'], 'training'), title: str(a.title, 120),
        department_id: DEPT[int(a.department_id)] ? int(a.department_id) : null, topic_code: TOPIC[a.topic_code] ? a.topic_code : null,
        scheduled_day: int(a.scheduled_day), scheduled_hour: num(a.scheduled_hour, 10), status: oneOf(a.status, ['planned', 'due', 'done', 'missed', 'cancelled'], 'planned'),
        x: a.x === undefined || a.x === null ? undefined : num(a.x), y: a.y === undefined || a.y === null ? undefined : num(a.y),
        attendees: int(a.attendees), score: a.score === null || a.score === undefined ? null : int(a.score)
      }));
      out.slow.focus = FOCUS[sl.focus] ? sl.focus : null;
      out.slow.budget = sl.budget && typeof sl.budget === 'object' ? { month: int(sl.budget.month), left: num(sl.budget.left), total: num(sl.budget.total) } : null;
    }
    return out;
  }
  function sanitizeNpcModel(m) {
    if (!m || typeof m !== 'object') return null;
    return {
      id: int(m.id), trust: Math.max(0, Math.min(100, num(m.trust))), comp: Math.max(0, Math.min(100, num(m.comp))), ppe_missing: !!m.ppe_missing, hurt: !!m.hurt,
      story_known: !!m.story_known, mem_count: int(m.mem_count),
      mem: (Array.isArray(m.mem) ? m.mem : []).slice(0, 12).map(r => ({
        id: int(r.id), type: str(r.type, 20), memory_text: str(r.memory_text, 300), game_day: int(r.game_day), emotional_impact: int(r.emotional_impact), player_id: int(r.player_id, 1)
      }))
    };
  }

  function netApply(raw) {
    if (!S || !S.mirror) return;
    const snap = sanitizeSnap(raw);
    if (!snap) return;
    Object.assign(S, { t: snap.T, hour: snap.hour, day: snap.day, season_override: snap.so, ending: snap.ending, over: snap.over,
      metrics: snap.m, hazards: snap.hz || [], ptw: snap.ptw || [], players: snap.players || S.players });
    const seenP = new Set();
    for (const [id, x, y, dir, mv] of snap.pls) {
      seenP.add(id);
      if (id === P.id) { if (!P.placed) { P.x = x; P.y = y; P.placed = true; } continue; }
      let pl = PLS.find(p => p.id === id);
      if (!pl) { pl = { id, x, y, dir, phase: 0, moving: false, remote: true }; PLS.push(pl); }
      pl.tx = x; pl.ty = y; pl.dir = dir; pl.moving = !!mv;
    }
    for (let i = PLS.length - 1; i > 0; i--) if (!seenP.has(PLS[i].id)) PLS.splice(i, 1);
    const seen = new Set();
    for (const [id, x, y, dir, mv, fl] of snap.n) {
      const n = byId[id];
      if (!n) continue;
      seen.add(id);
      if (!n.on) { n.x = x; n.y = y; }
      n.on = true; n.inside_t = 0; n.tx = x; n.ty = y; n.dir = dir; n.moving = !!mv;
      const ppe = !!(fl & 1);
      if (ppe !== n.ppe_missing) { n.ppe_missing = ppe; relook(n); }
      n.hurt_t = fl & 2 ? 1 : 0;
    }
    for (const n of npcs) if (!seen.has(n.id)) n.on = false;
    const sl = snap.slow;
    if (sl) {
      npcs.forEach((n, i) => { n.trust = sl.trust[i]; n.comp = sl.comp[i]; });
      const ppeSet = new Set(sl.ppe);
      npcs.forEach(n => { const v = ppeSet.has(n.id); if (v !== n.ppe_missing) { n.ppe_missing = v; relook(n); } });
      Object.assign(S, { incidents: sl.incidents, totals: sl.totals, today: sl.today, days_safe: sl.days_safe, day_reports: sl.day_reports,
        by_player: sl.by_player, today_by: sl.today_by, dept_know: sl.dept_know, tourist_count: sl.tc, on_count: sl.on.length, tourists: sl.gt,
        activities: sl.acts, focus: sl.focus, budget: sl.budget || S.budget });
      S.on_ids = new Set(sl.on);
    }
    const tmap = {};
    (S.tourists || []).forEach(t => { tmap[t.id] = t; });
    const gNow = {};
    guests.forEach(g => { gNow[g.t.id] = g; });
    guests = snap.g.map(([tid, x, y, dir, mv]) => {
      let g = gNow[tid];
      if (!g) g = { t: tmap[tid] || { id: tid, tourist_code: 'TRS_' + tid, nationality: '-', risk_behavior_trait: 'safe', stay_zone: '-' }, x, y, dir, phase: 0, moving: false, L: A.guestLook(tid) };
      else if (tmap[tid]) g.t = tmap[tid];
      g.tx = x; g.ty = y; g.dir = dir; g.moving = !!mv;
      return g;
    });
  }
  function applyNpcModel(raw) {
    const m = sanitizeNpcModel(raw);
    if (!m) return null;
    const n = byId[m.id];
    if (!n) return null;
    n.trust = m.trust; n.comp = m.comp; n.story_known = m.story_known; n.hurt_t = m.hurt ? 1 : 0; n.mem = m.mem; n.mem_count = m.mem_count;
    if (n.ppe_missing !== m.ppe_missing) { n.ppe_missing = m.ppe_missing; relook(n); }
    return n;
  }
  function clientUpdate(dt, input) {
    if (!S.ending && !S.over) S.hour = Math.min(C.time.end_hour, S.hour + dt * C.time.game_minutes_per_second / 60);
    updatePlayer(P, dt, input || {});
    const k = Math.min(1, dt * 9);
    const glide = e => {
      if (e.tx === undefined) return;
      e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k;
      if (e.moving) e.phase += dt * 9;
    };
    for (let i = 1; i < PLS.length; i++) glide(PLS[i]);
    for (const n of npcs) if (n.on) glide(n);
    for (const g of guests) glide(g);
  }

  function update(dt, inputs) {
    if (!Array.isArray(inputs)) inputs = [inputs || {}];
    if (NET === 'client') { if (S && !paused) clientUpdate(dt, inputs[0]); return; }
    if (!S || paused || S.over) return;
    S.t += dt;
    S.hour += dt * C.time.game_minutes_per_second / 60;
    if (S.hour >= C.time.end_hour) { S.hour = C.time.end_hour; endDay(); return; }
    PLS.forEach((pl, i) => { if (!pl.remote) updatePlayer(pl, dt, inputs[i] || {}); });
    updateNpcs(dt);
    updateGuests(dt);
    updateHazards(dt); if (S.over) return;
    updateReports(dt);
    updatePtw(dt);
    updateMetrics(dt);
    updateActivities(dt);
    S.spawn_in -= dt;
    if (S.spawn_in <= 0) { spawnHazard(); S.spawn_in = season().hazard_spawn_seconds * (0.7 + rnd() * 0.6) * focusEff('spawn', 1); }
  }

  function deptStats() {
    return G.departments.map(d => {
      const all = npcs.filter(n => n.department_id === d.id);
      const isOn = n => (S.on_ids ? S.on_ids.has(n.id) : n.on);
      return {
        d, total: all.length, on: all.filter(isOn).length, trust: avgTrust(all),
        comp: all.reduce((a, n) => a + n.comp, 0) / (all.length || 1), know: S.dept_know[d.id] || 0,
        open: S.hazards.filter(h => !h.done && HT[h.type_id].department_id === d.id && (h.disc || h.rep)).length,
        violating: all.filter(n => n.on && n.ppe_missing).length
      };
    });
  }

  root.Sim = {
    on, newGame, serialize, restore, update, season, isStorm, isHigh, dateText, timeText, avgTrust,
    findInteract, pickAt, goTo, talk, ppeChoice, guestTalk, hazardAction, ptwDecision, investigate,
    nextDay, toggleSeason, deptStats, callName, topMemory, spawnHazard, CAUSES,
    DEPT, HT, LOC, P, PLAYER, players, pinfo, freshStats,
    MAX_PLAYERS, get P2() { return PLS[1] || null; }, get actor() { return actor; }, setActor: pl => { actor = pl || P; },
    setFocus, schedule, cancelActivity, activityById, attendeesOf, kpoAgenda, finishKpo, trainingQuiz, finishTraining, cleanLook,
    FOCUS, TOPIC, KPO, PROP, AV,
    get net() { return NET; }, setNet: m => { NET = m; }, addRemotePlayer, removeRemotePlayer, netSetPos, netSnapshot,
    netStartClient, netApply, npcModel, applyNpcModel,
    get S() { return S; }, get npcs() { return npcs; }, get guests() { return guests; }, byId: id => byId[id],
    get paused() { return paused; }, set paused(v) { paused = !!v; }
  };
})(window);
