// ============================================================================
// ui.js — หน้าจอ: แถบสถานะ, ข่าว, หน้าต่างคุย/ตรวจ/PTW/สมุดบันทึก/เมนู
// ============================================================================
(function (root) {
  'use strict';
  const G = root.GAME_DATA, C = G.config, Sim = root.Sim, DB = root.GameDB;
  const $ = id => document.getElementById(id);
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // ค่าที่จะแทรกลง HTML: ตัวเลขต้องเป็นตัวเลขจริง · ชื่อคลาสสถานะต้องเป็นค่าที่รู้จัก (กันข้อมูลแปลกปลอมจากเครือข่าย)
  const num = v => { v = +v; return isFinite(v) ? v : 0; };
  const cls = s => (/^[a-z_]{1,20}$/.test(s) ? s : 'unknown');

  let ctx = null, locked = false, coopCount = 2;
  const SEV_CLS = { 1: 's1', 2: 's2', 3: 's3', 4: 's4' };
  const KIND_TXT = { equip: 'สภาพ/อุปกรณ์ไม่ปลอดภัย', behav: 'พฤติกรรมไม่ปลอดภัย', env: 'สภาพพื้นที่ชั่วคราว' };
  const ACT_NAME = { stop: 'หยุดงาน/ปิดพื้นที่แล้วแก้ทันที', coach: 'คุยสอนหน้างาน', car: 'ออกใบ CAR ให้แผนกแก้เชิงระบบ', ignore: 'ปล่อยไว้' };
  const RISK_TH = { low: 'ต่ำ', medium: 'ปานกลาง', high: 'สูง', extreme: 'สูงมาก' };
  const STATUS_TH = { pending: 'รอพิจารณา', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', completed: 'เสร็จสิ้น',
    open: 'เปิด', investigating: 'รอสอบสวน/CAR', resolved: 'แก้แล้ว', closed: 'ปิดแล้ว' };
  const MEM_ICON = { coach: '🗣️', stop: '🛑', heroic: '🦸', car: '📋', car_ok: '✅', car_fail: '⏰', ignored: '🙈', scold: '😤',
    praise: '👏', talk: '💬', toolbox: '📚', incident: '🚑', ppe_ok: '🦺', ppe_remind: '🦺', ptw_ok: '📝', ptw_reject: '⛔', rumor: '👂', seed: '📌',
    kpo_yes: '🏛️', kpo_no: '🏛️', trained: '🎓', missed: '⏰' };
  const ACT_ICON = { kpo_meeting: '🏛️', training: '📚', daily_focus: '🎯' };
  const ACT_STATUS = { planned: 'นัดไว้', due: 'ถึงเวลาแล้ว', done: 'จัดแล้ว', missed: 'ไม่ได้จัด', cancelled: 'ยกเลิก' };
  const AVO = G.avatar_options || { skins: [], vests: [], hair_colors: [], hair_styles_m: [0], hair_styles_f: [1], hair_style_names: {} };

  // ------------------------------------------------------------------ panel
  const NetX = () => root.Net && root.Net.active ? root.Net : null;   // โหมดออนไลน์ (ถ้ามี)
  const isClient = () => !!(NetX() && root.Net.isClient);
  function open(html, opts) {
    opts = opts || {};
    $('card').innerHTML = html;
    $('card').classList.remove('busy');
    $('panel').classList.remove('hidden');
    $('panel').classList.toggle('wide', !!opts.wide);
    locked = !!opts.locked;
    if (!NetX()) Sim.paused = true;          // เล่นออนไลน์: เปิดหน้าต่างแล้วโลกยังเดินต่อ
    $('card').scrollTop = 0;
  }
  function close(force) {
    if (locked && !force) return;
    $('panel').classList.add('hidden');
    locked = false; ctx = null;
    if (root.Scene) root.Scene.stop();              // หยุดวาดฉากประชุม/อบรม
    const S = Sim.S;
    if (S && !S.over && !S.ending && !isClient()) Sim.paused = false;
  }
  // ส่งคำขอไปเครื่องเจ้าของห้อง (ผู้ร่วมเล่น) ระหว่างรอ ปุ่มจะกดซ้ำไม่ได้
  function ask(q, then) {
    $('card').classList.add('busy');
    root.Net.request(q).then(r => { $('card').classList.remove('busy'); then(r); })
      .catch(e => { $('card').classList.remove('busy'); close(true); log('⚠️ ' + e.message, 'warn'); });
  }
  function isOpen() { return !$('panel').classList.contains('hidden'); }

  function bar(v, cls) { return '<span class="bar ' + (cls || '') + '"><i style="width:' + Math.max(0, Math.min(100, v)).toFixed(0) + '%"></i></span>'; }
  function trustFace(v) { return v < 25 ? '😠' : v < 45 ? '😐' : v < 65 ? '🙂' : v < 85 ? '😊' : '🤝'; }
  function chip(label, v) {
    const r = Math.round(v * 10) / 10;
    return '<span class="eff ' + (v > 0 ? 'up' : 'down') + '">' + label + ' ' + (v > 0 ? '+' : '') + r + '</span>';
  }
  function stat(label, v) { return '<div class="stat"><b>' + num(v) + '</b><span>' + label + '</span></div>'; }
  function dayAgo(d) { const k = Sim.S.day - d; return k <= 0 ? 'วันนี้' : k === 1 ? 'เมื่อวาน' : k + ' วันก่อน'; }
  function head(title, extra) { return '<div class="head">' + (extra || '') + '<h2>' + title + '</h2>' + actorTag() + '<button class="x" data-act="close" aria-label="ปิด">✕</button></div>'; }
  // ป้ายบอกว่า จป. คนไหนกำลังทำรายการ (เฉพาะโหมดเล่นกับเพื่อน)
  function actorTag() {
    const S = Sim.S;
    if (!S || !S.coop) return '';
    const a = Sim.actor, pi = Sim.pinfo(a.id);
    return '<span class="pl p' + a.id + '">P' + a.id + ' ' + esc(pi.name) + '</span>';
  }

  // ------------------------------------------------------------------ feed + HUD
  function log(msg, type) {
    const feed = $('feed');
    const el = document.createElement('div');
    el.className = 'feed-item ' + (type || 'info');
    el.textContent = msg;
    feed.prepend(el);
    while (feed.children.length > 6) feed.lastChild.remove();
    // มือถือจอเล็ก: ข่าวหายเร็วขึ้น ฉากจะได้โล่ง
    const life = document.body.classList.contains('touch') ? 9000 : 14000;
    setTimeout(() => el.classList.add('fade'), life);
    setTimeout(() => el.remove(), life + 1500);
  }
  function meter(id, v) {
    const el = $(id);
    el.querySelector('i').style.width = Math.max(0, Math.min(100, v)).toFixed(0) + '%';
    el.querySelector('b').textContent = v.toFixed(0);
    el.classList.toggle('low', v < 35);
  }
  function hud() {
    const S = Sim.S;
    document.body.classList.toggle('playing', !!S);
    if (!S) return;
    const s = Sim.season(), bc = document.body.classList;
    // มือถือแนวตั้ง: ข้อความแถบบนสั้นลง (แตะแถบเพื่อดูเต็ม)
    const compact = bc.contains('touch') && !bc.contains('lands') && !bc.contains('hud-open');
    $('h-date').textContent = 'วันที่ ' + (S.day + 1) + ' · ' + (compact ? Sim.dateText(S.day).replace(/ \d{4}$/, '') : Sim.dateText(S.day));
    $('h-time').textContent = '🕒 ' + Sim.timeText();
    $('h-season').textContent = (s.weather_condition === 'sunny' ? '☀️ ' : '🌧️ ') + s.label + (compact ? '' : ' · คลื่น ' + s.sea_wave_height_meters + ' ม.');
    $('h-season').className = 'chip ' + (Sim.isHigh() ? 'high' : 'low');
    $('h-guests').textContent = '🧳 แขก ' + (S.tourist_count !== undefined ? S.tourist_count : S.tourists.length) + ' คน';
    const onCount = S.on_count !== undefined ? S.on_count : Sim.npcs.filter(n => n.on).length;
    const nPl = Sim.players().length;
    $('h-staff').textContent = (nPl > 1 && !NetX() ? '👥 ' + nPl + ' คน · ' : '') + '👷 ในกะ ' + onCount + '/' + Sim.npcs.length;
    const net = $('h-net');
    if (NetX()) {
      net.hidden = false;
      net.textContent = '🌐 ห้อง ' + root.Net.room + ' · ' + nPl + '/' + Sim.MAX_PLAYERS + ' คน' + (root.Net.isHost ? ' (เจ้าของห้อง)' : '');
    } else net.hidden = true;
    $('h-safe').textContent = '🛡️ ปลอดอุบัติเหตุ ' + S.days_safe + ' วัน';
    meter('m-ops', S.metrics.ops); meter('m-guest', S.metrics.guest_sat);
    meter('m-rep', S.metrics.reputation); meter('m-trust', Sim.avgTrust());
    const pend = S.ptw.filter(p => p.status === 'pending').length;
    $('badge-ptw').textContent = pend ? String(pend) : '';
    const inv = S.incidents.filter(r => r.status === 'investigating' && r.injury_level).length;
    $('badge-log').textContent = inv ? String(inv) : '';
    // แผนงานวันนี้ + นัดที่ถึงเวลาแล้ว
    const f = S.focus && Sim.FOCUS[S.focus], noFocus = !isClient() && S.focus_day !== S.day;
    const fc = $('h-focus');
    if (fc) {
      fc.hidden = isClient() && !f;
      fc.textContent = f ? f.icon + ' ' + f.title : noFocus ? '🎯 เลือกแผนงานวันนี้' : '🎯 วันนี้ไม่มีแผนงาน';
      fc.classList.toggle('todo', noFocus);
    }
    const due = (S.activities || []).filter(a => a.status === 'due').length;
    const bp = $('badge-plan');
    if (bp) bp.textContent = due ? String(due) : noFocus ? '!' : '';
  }
  function promptText(tg) {
    if (tg.type === 'activity') {
      const a = tg.obj, n = (a.attendee_ids || []).length || num(a.attendees);
      return (a.activity_type === 'kpo_meeting' ? '🏛️ เริ่มประชุม คปอ.' : '📚 เริ่มอบรม: ' + (Sim.TOPIC[a.topic_code] ? Sim.TOPIC[a.topic_code].title : '')) + (n ? ' (มา ' + n + ' คน)' : '');
    }
    if (tg.type === 'hazard') return (tg.obj.mit ? '📋 ติดตาม CAR: ' : '⚠️ ตรวจ: ') + Sim.HT[tg.obj.type_id].title;
    if (tg.type === 'ptw') return '📝 พิจารณาใบอนุญาต: ' + tg.obj.work_title;
    if (tg.type === 'npc') return '💬 คุยกับ ' + tg.obj.nickname + ' (' + Sim.DEPT[tg.obj.department_id].short + ')';
    return '🙂 ทักทายแขก (' + tg.obj.t.nationality + ')';
  }
  // ปุ่มโต้ตอบของผู้เล่นแต่ละคน: P1 = E, P2 = Enter, P3-P4 = ปุ่ม A บนจอยเกม
  const ACT_KEY = ['E', 'Enter', 'Ⓐ', 'Ⓐ'];
  // ปุ่มโต้ตอบบนมือถือ: เปลี่ยนไอคอนและคำตามสิ่งที่อยู่ตรงหน้า
  const ACT_LABEL = { npc: ['💬', 'คุย'], hazard: ['⚠️', 'ตรวจ'], ptw: ['📝', 'PTW'], guest: ['🙂', 'ทักทาย'] };
  let lastAct = '';
  function setActButton(tg) {
    const btn = $('act');
    let ic = '✋', tx = 'แตะคน/ป้าย';
    if (tg) {
      [ic, tx] = ACT_LABEL[tg.type] || ['✋', 'ใช้'];
      if (tg.type === 'npc') tx = tg.obj.nickname;
      if (tg.type === 'hazard' && tg.obj.mit) [ic, tx] = ['📋', 'ติดตาม CAR'];
      if (tg.type === 'activity') [ic, tx] = tg.obj.activity_type === 'kpo_meeting' ? ['🏛️', 'เริ่มประชุม'] : ['📚', 'เริ่มอบรม'];
    }
    const key = ic + tx + !!tg;
    if (key === lastAct) return;
    lastAct = key;
    btn.querySelector('.ic').textContent = ic;
    btn.querySelector('.tx').textContent = tx;
    btn.classList.toggle('ready', !!tg);
  }
  function prompt(tgs) {
    const el = $('prompt');
    tgs = tgs || [];
    const coop = !!(Sim.S && Sim.S.coop);
    if (!tgs.some(Boolean) || isOpen()) { el.classList.remove('show'); setActButton(null); return; }
    el.innerHTML = tgs.map((tg, i) => tg ? '<div>' + (coop ? '<span class="pl p' + (i + 1) + '">P' + (i + 1) + '</span>' : '') +
      '<kbd>' + ACT_KEY[i] + '</kbd> ' + esc(promptText(tg)) + '</div>' : '').join('');
    el.classList.add('show');
    setActButton(tgs[0]);
  }

  // ------------------------------------------------------------------ interactions
  function interact(tg, pl) {
    if (!tg || !Sim.S || Sim.S.over) return;
    Sim.setActor(pl || Sim.P);
    ctx = tg;
    if (isClient() && tg.type === 'npc') {
      ctx = { type: 'npc', obj: tg.obj };
      ask({ k: 'npc', id: tg.obj.id, topic: 'greet' }, r => npcPanel(Sim.applyNpcModel(r.npc) || tg.obj, r.reply));
      return;
    }
    if (tg.type === 'npc') npcPanel(tg.obj, Sim.talk(tg.obj, 'greet'));
    else if (tg.type === 'hazard') hazardPanel(tg.obj);
    else if (tg.type === 'ptw') ptwPanel(tg.obj);
    else if (tg.type === 'guest') guestPanel(tg.obj, Sim.guestTalk(tg.obj, 'greet'));
    else if (tg.type === 'activity') activityPanel(tg.obj);
  }

  function npcPanel(n, reply) {
    ctx = { type: 'npc', obj: n };
    const d = Sim.DEPT[n.department_id];
    const mems = n.mem.slice().sort((a, b) => b.game_day - a.game_day || b.id - a.id).slice(0, 6);
    const ppe = reply && reply.ppe_missing && n.ppe_missing;
    let html = '<div class="head npc"><span class="avatar" style="background:' + d.color + '">' + esc(n.nickname.slice(0, 3)) + '</span>' +
      '<div class="who"><h2>' + esc(n.nickname) + ' <small>' + esc(n.name) + '</small></h2>' +
      '<div class="sub">' + esc(n.job_role) + ' · ' + esc(d.short) + ' · กะ' + (n.shift === 'M' ? 'เช้า' : 'บ่าย') + ' · อายุ ' + n.age + ' · ' + esc(n.npc_code) + '</div></div>' +
      actorTag() + '<button class="x" data-act="close" aria-label="ปิด">✕</button></div>' +
      '<div class="stats"><div><span>ความไว้ใจ ' + trustFace(n.trust) + '</span>' + bar(n.trust) + '<b>' + Math.round(n.trust) + '</b></div>' +
      '<div><span>ปฏิบัติตามกฎ</span>' + bar(n.comp, 'blue') + '<b>' + Math.round(n.comp) + '</b></div>' +
      (n.ppe_missing ? '<span class="tag bad">ไม่สวม PPE</span>' : '') + (n.hurt_t > 0 ? '<span class="tag bad">บาดเจ็บ</span>' : '') + '</div>' +
      '<div class="bubble">' + esc(reply ? reply.text : '') + '</div>';
    if (n.story_known) html += '<div class="story">🏠 บ้าน' + esc(n.origin) + ' · ทำงานมา ' + n.years_at_resort + ' ปี · ' + esc(n.motive) + ' · นิสัย' + esc(n.personality_trait) + '</div>';
    if (ppe) {
      html += '<div class="choices"><p>พบว่าไม่สวม <b>' + esc(d.ppe) + '</b> จะจัดการอย่างไร?</p><div class="actions">' +
        '<button data-act="ppe:gentle">🙂 เตือนดีๆ และให้ใส่ทันที</button>' +
        '<button data-act="ppe:stop">🛑 ให้หยุดไปเอามาใส่ก่อน</button>' +
        '<button data-act="ppe:scold" class="danger">😤 ตำหนิต่อหน้าเพื่อน</button></div></div>';
    } else {
      html += '<div class="actions grid3">' +
        '<button data-act="npc:greet">💬 ถามงาน</button>' +
        '<button data-act="npc:story">🏠 ถามเรื่องส่วนตัว</button>' +
        '<button data-act="npc:ppe">🦺 ตรวจ PPE</button>' +
        '<button data-act="npc:praise">👏 ชมเชย</button>' +
        '<button data-act="npc:toolbox">📚 อบรมสั้น 20 นาที</button>' +
        '<button data-act="npc:scold" class="danger">😤 ตำหนิ</button></div>';
    }
    html += '<details class="mem" open><summary>🧠 ' + esc(n.nickname) + ' จำอะไรเกี่ยวกับคุณได้บ้าง (' + (n.mem_count !== undefined ? n.mem_count : n.mem.length) + ')</summary>' +
      (mems.length ? '<ul>' + mems.map(m => '<li>' + (MEM_ICON[m.type] || '•') + ' ' +
        (Sim.S.coop ? '<span class="pl p' + (m.player_id || 1) + ' mini">P' + (m.player_id || 1) + '</span> ' : '') + esc(m.memory_text) +
        ' <em>' + dayAgo(num(m.game_day)) + ' · ' + (num(m.emotional_impact) > 0 ? '+' : '') + num(m.emotional_impact) + '</em></li>').join('') + '</ul>'
        : '<p class="muted">ยังไม่มีความทรงจำเกี่ยวกับคุณ</p>') + '</details>';
    open(html);
  }

  function hazardPanel(h) {
    ctx = { type: 'hazard', obj: h };
    const t = Sim.HT[h.type_id], d = Sim.DEPT[t.department_id], owner = Sim.byId(h.owner_id);
    const loc = Sim.LOC[t.location_id];
    const pct = Math.max(0, h.fuse / h.fuse_max * 100);
    let html = head('⚠️ ' + esc(t.title), '<span class="sev ' + SEV_CLS[h.sev] + '">ความเสี่ยง' + C.severity_names[h.sev] + '</span>') +
      '<div class="sub">📍 ' + esc(loc ? loc.name : d.short) + ' · แผนก' + esc(d.short) + ' · ' + KIND_TXT[t.kind] + (t.involves_guest ? ' · เกี่ยวข้องกับแขก' : '') + '</div>' +
      '<p>' + esc(t.description) + '</p>' +
      (owner ? '<p class="muted">ผู้เกี่ยวข้อง: ' + esc(owner.nickname) + ' (' + esc(owner.job_role) + ') · ความไว้ใจ ' + Math.round(owner.trust) + '</p>' : '') +
      '<div class="fuse"><span>เวลาก่อนเกิดเหตุ</span>' + bar(pct, pct < 30 ? 'red' : 'amber') + '</div>';
    if (h.mit) {
      html += '<div class="note">📋 ออก CAR แล้วและมีมาตรการชั่วคราว ครบกำหนด ' + esc(Sim.dateText(h.car_due)) + ' — ความเสี่ยงลดลงแต่ยังไม่หมด</div>' +
        '<div class="actions"><button data-act="hz:stop"><b>🛑 ไม่รอ หยุดงานและแก้ทันที</b></button>' +
        '<button data-act="close" class="ghost"><b>⏳ รอตามกำหนด CAR</b></button></div>';
    } else {
      html += '<div class="actions big">' +
        '<button data-act="hz:stop"><b>🛑 หยุดงาน/ปิดพื้นที่ แล้วแก้ทันที</b><small>จบที่ต้นเหตุ แต่บริการสะดุด · 20 นาที</small></button>' +
        '<button data-act="hz:coach"><b>🗣️ คุยสอนหน้างาน</b><small>ให้คนทำงานเข้าใจและแก้เอง · 15 นาที</small></button>' +
        '<button data-act="hz:car"><b>📋 ออกใบ CAR + มาตรการชั่วคราว</b><small>ให้แผนกแก้เชิงระบบภายใน ' + C.car_days + ' วัน</small></button>' +
        '<button data-act="hz:ignore" class="ghost"><b>⏭️ ปล่อยไว้ก่อน</b><small>ไม่เสียเวลา แต่ความเสี่ยงยังอยู่</small></button></div>';
    }
    open(html);
  }

  function resultPanel(r) {
    let title, cls;
    if (r.act === 'ignore') { title = '⏭️ ปล่อยไว้ก่อน — นาฬิกายังเดินต่อ'; cls = 'warn'; }
    else if (r.resolved) { title = '✅ แก้ไขเรียบร้อย'; cls = 'good'; }
    else if (r.act === 'car') { title = '📋 ออก CAR แล้ว — ความเสี่ยงลดลงชั่วคราว'; cls = 'info'; }
    else { title = '⚠️ ยังไม่จบที่ต้นเหตุ — ความเสี่ยงลดลงบางส่วน'; cls = 'warn'; }
    const verdict = r.act === 'ignore' ? '' : r.best ? '<div class="verdict good">👍 เป็นทางเลือกที่ดีที่สุดสำหรับกรณีนี้</div>'
      : '<div class="verdict">💡 กรณีนี้ทางที่ดีที่สุดคือ <b>' + ACT_NAME[r.best_action] + '</b></div>';
    const chips = [];
    if (r.trust) chips.push(chip('ความไว้ใจ', r.trust));
    if (r.ops) chips.push(chip('ความพร้อมบริการ', -r.ops));
    if (r.rep) chips.push(chip('ความน่าเชื่อถือ', r.rep));
    if (r.minutes && !(Sim.S && Sim.S.coop)) chips.push('<span class="eff">🕒 +' + num(r.minutes) + ' นาที</span>');
    open('<div class="result ' + cls + '">' + head(title) + verdict + '<p class="why">📘 ' + esc(r.why) + '</p>' +
      '<div class="effects">' + chips.join('') + '</div>' +
      '<div class="actions"><button data-act="close" class="primary">ไปทำงานต่อ</button></div></div>');
  }

  function ptwPanel(p) {
    ctx = { type: 'ptw', obj: p };
    const tp = G.ptw_templates.find(t => t.id === p.template_id), w = Sim.byId(p.assigned_npc_id);
    const dist = Math.round(Math.hypot(Sim.P.x - p.x, Sim.P.y - p.y));
    const near = dist < 170;
    const sev = p.risk_level === 'extreme' ? 's4' : p.risk_level === 'high' ? 's3' : 's2';
    open(head('📝 ' + esc(p.work_title), '<span class="sev ' + sev + '">ความเสี่ยง' + RISK_TH[p.risk_level] + '</span>') +
      '<div class="sub">📍 ' + esc(p.location) + ' · ผู้ขอ: ' + (w ? esc(w.nickname) + ' (' + esc(w.job_role) + ')' : '-') + ' · ขอเมื่อ ' + Sim.timeText(p.created_hour) + ' น.</div>' +
      '<div class="note">ต้องตรวจก่อนอนุมัติ: ' + esc(tp ? tp.checks : '') + '</div>' +
      '<p class="muted">' + (near ? 'คุณอยู่ที่หน้างานแล้ว ตรวจได้ทันที' : 'คุณอยู่ห่างจากหน้างาน ' + dist + ' หน่วย ต้องไปตรวจที่หน้างานก่อนจึงอนุมัติแบบตรวจได้ (ถ้ารอเกิน 3 ชั่วโมง ช่างอาจเริ่มงานเอง)') + '</p>' +
      '<div class="actions big">' +
      '<button data-act="ptw:check" ' + (near ? '' : 'disabled') + '><b>🔍 ตรวจหน้างาน + PPE แล้วอนุมัติ</b><small>ปลอดภัยที่สุด · 10 นาที</small></button>' +
      (near ? '' : '<button data-act="ptw:nav"><b>🧭 นำทางไปหน้างาน</b><small>เดินไปที่จุดทำงาน แล้วกด E อีกครั้ง</small></button>') +
      '<button data-act="ptw:approve"><b>✍️ อนุมัติโดยไม่ตรวจ</b><small>เร็ว แต่อาจเกิดอันตรายระหว่างทำงาน</small></button>' +
      '<button data-act="ptw:reject" class="ghost"><b>⛔ ไม่อนุมัติ</b><small>งานเลื่อน บริการสะดุด</small></button></div>');
  }
  function ptwResult(r) {
    let html;
    if (r.kind === 'check') html = '<div class="result good">' + head('✅ ตรวจหน้างานและอนุมัติแล้ว') + '<p class="why">📘 การตรวจที่หน้างานก่อนอนุมัติ PTW ทำให้แน่ใจว่ามาตรการควบคุมพร้อมจริง ไม่ใช่แค่เซ็นเอกสาร</p>';
    else if (r.kind === 'approve') html = '<div class="result warn">' + head('✍️ อนุมัติแล้ว (ไม่ได้ตรวจหน้างาน)') + '<p class="why">📘 เซ็นอนุมัติโดยไม่เห็นหน้างาน มีโอกาสประมาณ ' + Math.round(r.risk * 100) + '% ที่มาตรการไม่ครบและเกิดจุดอันตรายระหว่างทำงาน</p>';
    else html = '<div class="result info">' + head('⛔ ไม่อนุมัติ') + '<p class="why">📘 งานถูกเลื่อน ช่างอาจไม่พอใจ ควรอธิบายเหตุผลและบอกสิ่งที่ต้องเตรียมให้ครบ</p>';
    open(html + '<div class="actions"><button data-act="close" class="primary">ตกลง</button></div></div>');
  }
  function ptwList() {
    const S = Sim.S; if (!S) return;
    const rows = S.ptw.slice().reverse().slice(0, 16);
    open(head('📝 ใบอนุญาตทำงาน (jsa_permitting_logs)') +
      (rows.length ? '<ul class="list">' + rows.map(p => '<li><span class="tag ' + cls(p.status) + '">' + esc(STATUS_TH[p.status] || '-') + '</span> ' +
        esc(p.work_title) + ' <small>' + esc(p.location) + ' · วันที่ ' + (num(p.game_day) + 1) + (p.is_ppe_checked ? ' · ตรวจหน้างานแล้ว' : '') + '</small>' +
        (p.status === 'pending' ? ' <span class="row-btns"><button data-act="ptwopen:' + num(p.id) + '">พิจารณา</button><button data-act="nav:' + Math.round(num(p.x)) + ',' + Math.round(num(p.y)) + '">🧭 นำทาง</button></span>' : '') +
        '</li>').join('') + '</ul>' : '<p class="muted">ยังไม่มีคำขอใบอนุญาต ช่วงโลว์ซีซันจะมีงานซ่อมบำรุงมากขึ้น</p>'), { wide: true });
  }

  function guestPanel(g, reply) {
    ctx = { type: 'guest', obj: g };
    const t = g.t;
    const trait = { safe: 'ระมัดระวังดี', careless: 'ประมาท', drunk_swimmer: 'ชอบดื่มแล้วลงน้ำ', rule_breaker: 'ชอบฝ่าฝืนกฎ' }[t.risk_behavior_trait];
    open(head('🙂 แขกผู้เข้าพัก <small>' + esc(t.tourist_code) + '</small>') +
      '<div class="sub">สัญชาติ ' + esc(t.nationality) + ' · พักที่ ' + esc(t.stay_zone) + ' · พฤติกรรม: ' + trait + '</div>' +
      '<div class="bubble">' + esc(reply.text) + '</div>' +
      '<div class="actions"><button data-act="g:advise">🦺 แนะนำความปลอดภัย (ธงเตือน เสื้อชูชีพ เวลาเล่นน้ำ)</button>' +
      '<button data-act="close" class="ghost">ลาก่อน</button></div>');
  }

  // ------------------------------------------------------------------ logbook / investigate
  function logbook(tab) {
    const S = Sim.S; if (!S) return;
    tab = tab || 'inc';
    let body;
    if (tab === 'inc') {
      const rows = S.incidents.slice().reverse().slice(0, 40);
      body = rows.length ? '<ul class="list">' + rows.map(r => {
        const inj = r.injury_level ? '<span class="tag bad">🚑 ' + esc(C.injury_names[r.injury_level]) + '</span>' : '<span class="tag">เกือบเกิดเหตุ</span>';
        const btn = r.injury_level && r.status === 'investigating' ? ' <span class="row-btns"><button data-act="inv:' + num(r.id) + '">🔎 สอบสวน</button></span>' : '';
        return '<li><span class="tag ' + cls(r.status) + '">' + esc(STATUS_TH[r.status] || '-') + '</span> ' + inj + ' ' + esc(String(r.description || '').split(' — ')[0]) +
          ' <small>' + esc(r.location_zone) + ' · วันที่ ' + (num(r.game_day) + 1) + ' ' + esc(r.game_time) + (r.root_cause ? ' · สาเหตุ: ' + esc(r.root_cause) : '') + '</small>' + btn + '</li>';
      }).join('') + '</ul>' : '<p class="muted">ยังไม่มีบันทึก เดินตรวจพื้นที่เพื่อค้นหาจุดเสี่ยง</p>';
    } else if (tab === 'car') {
      const hs = S.hazards.filter(h => !h.done && (h.disc || h.rep));
      body = hs.length ? '<ul class="list">' + hs.map(h => {
        const t = Sim.HT[h.type_id];
        return '<li><span class="sev ' + SEV_CLS[h.sev] + '">' + C.severity_names[h.sev] + '</span> ' + esc(t.title) +
          ' <small>' + (h.mit ? 'CAR ครบกำหนด ' + esc(Sim.dateText(h.car_due)) : 'ยังไม่แก้') + ' · ' + esc(Sim.LOC[t.location_id].name) + '</small>' +
          ' <span class="row-btns"><button data-act="nav:' + Math.round(h.x) + ',' + Math.round(h.y) + '">🧭 นำทาง</button></span></li>';
      }).join('') + '</ul>' : '<p class="muted">ไม่มีจุดเสี่ยงค้างที่รู้อยู่ 👍</p>';
    } else {
      const T = S.totals;
      body = '<div class="grid-stats">' + stat('พบจุดเสี่ยง', T.found) + stat('แก้ไขแล้ว', T.closed) + stat('อุบัติเหตุ', T.incidents) +
        stat('บาดเจ็บถึงหยุดงาน', T.lti) + stat('คุยสอนหน้างาน', T.coach) + stat('ตำหนิ', T.scold) + stat('อนุมัติ PTW', T.ptw) + stat('วันปลอดอุบัติเหตุ', S.days_safe) + '</div>' +
        coopTable(S.by_player, 'ผลงานรวมแยกรายคน') + dayChart(S.day_reports);
    }
    open(head('📋 สมุดบันทึกความปลอดภัย') +
      '<div class="tabs"><button data-act="lb:inc" class="' + (tab === 'inc' ? 'on' : '') + '">เหตุการณ์</button>' +
      '<button data-act="lb:car" class="' + (tab === 'car' ? 'on' : '') + '">จุดเสี่ยงค้าง / CAR</button>' +
      '<button data-act="lb:stat" class="' + (tab === 'stat' ? 'on' : '') + '">สถิติ</button></div>' + body, { wide: true });
  }
  function dayChart(reps) {
    if (!reps.length) return '<p class="muted">กราฟรายวันจะแสดงหลังจบวันแรก</p>';
    const last = reps.slice(-10);
    const mx = Math.max(4, ...last.map(r => Math.max(num(r.hazards_found), num(r.incidents))));
    return '<div class="chart"><div class="legend"><span class="k found"></span>พบจุดเสี่ยง <span class="k inc"></span>อุบัติเหตุ</div><div class="bars">' +
      last.map(r => '<div class="col"><div class="pair"><i class="found" style="height:' + (num(r.hazards_found) / mx * 100) + '%"></i><i class="inc" style="height:' + (num(r.incidents) / mx * 100) + '%"></i></div><span>ว.' + (num(r.game_day) + 1) + '</span></div>').join('') +
      '</div></div>';
  }
  function invPanel(row) {
    const who = row.injured_guest ? 'แขกผู้เข้าพัก' : ((Sim.byId(row.injured_npc_id) || {}).nickname || '-');
    open(head('🔎 สอบสวนอุบัติเหตุ') + '<p><b>' + esc(row.description) + '</b></p>' +
      '<p class="muted">ผู้บาดเจ็บ: ' + esc(who) + ' · ระดับ: ' + esc(C.injury_names[row.injury_level]) + ' · ' + esc(row.location_zone) + '</p>' +
      '<p>สาเหตุหลักของเหตุนี้คืออะไร?</p><div class="actions big">' +
      Object.keys(Sim.CAUSES).map(k => '<button data-act="cause:' + row.id + ':' + k + '"><b>' + esc(Sim.CAUSES[k]) + '</b></button>').join('') + '</div>');
  }
  function invResult(r) {
    open('<div class="result ' + (r.right ? 'good' : 'warn') + '">' + head(r.right ? '✅ วิเคราะห์สาเหตุถูกต้อง' : '❌ ยังไม่ตรงสาเหตุหลัก') +
      '<p>สาเหตุหลัก: <b>' + esc(r.correct) + '</b></p><p class="why">📘 มาตรการป้องกันการเกิดซ้ำ: ' + esc(r.why) + '</p>' +
      '<div class="actions"><button data-act="lb:inc" class="primary">กลับสมุดบันทึก</button></div></div>');
  }

  // ------------------------------------------------------------------ staff
  function staffPanel(deptId) {
    const S = Sim.S; if (!S) return;
    if (deptId) {
      const d = Sim.DEPT[deptId];
      const list = Sim.npcs.filter(n => n.department_id === deptId).sort((a, b) => (b.on - a.on) || b.trust - a.trust);
      open(head('👥 ' + esc(d.name) + ' <small>' + list.length + ' คน</small>') +
        '<div class="sub">PPE: ' + esc(d.ppe || 'ไม่มีเฉพาะ') + ' · หัวข้ออบรม: ' + esc(d.toolbox) + '</div>' +
        '<ul class="list staff">' + list.map(n => '<li class="' + (n.on ? '' : 'off') + '"><b>' + esc(n.nickname) + '</b> <small>' + esc(n.name) + ' · ' + esc(n.job_role) + ' · กะ' + (n.shift === 'M' ? 'เช้า' : 'บ่าย') + '</small>' +
          '<span class="mini">' + trustFace(n.trust) + ' ' + bar(n.trust) + '</span>' +
          (n.ppe_missing && n.on ? '<span class="tag bad">ไม่สวม PPE</span>' : '') +
          (n.status === 'injured' ? '<span class="tag bad">บาดเจ็บ</span>' : n.on ? '<span class="tag on">ในกะ</span>' : '<span class="tag">นอกกะ</span>') +
          (n.on ? ' <span class="row-btns"><button data-act="nav:' + Math.round(n.x) + ',' + Math.round(n.y) + '">🧭</button></span>' : '') + '</li>').join('') + '</ul>' +
        '<div class="actions"><button data-act="staff" class="ghost">← ทุกแผนก</button></div>', { wide: true });
      return;
    }
    const st = Sim.deptStats();
    open(head('👥 พนักงาน 204 คน แยกตามแผนก') +
      '<table class="tbl"><thead><tr><th>แผนก</th><th>คน</th><th>ในกะ</th><th>ความไว้ใจ</th><th>ความรู้</th><th>จุดเสี่ยง</th></tr></thead><tbody>' +
      st.map(r => '<tr data-act="staff:' + r.d.id + '"><td><span class="dot" style="background:' + r.d.color + '"></span>' + esc(r.d.short) + '</td><td>' + r.total + '</td><td>' + r.on +
        (r.violating ? ' <span class="tag bad">' + r.violating + ' ผิดกฎ</span>' : '') + '</td><td>' + bar(r.trust) + ' ' + Math.round(r.trust) + '</td><td>' + bar(r.know, 'blue') + '</td><td>' + (r.open || '-') + '</td></tr>').join('') +
      '</tbody></table><p class="muted">แตะชื่อแผนกเพื่อดูรายชื่อ · จำนวนคนต่อแผนกเป็นตัวเลขสมมติ แก้ได้ที่ data/departments.js</p>', { wide: true });
  }

  // ------------------------------------------------------------------ menu / intro / help
  // มือถือ: ปุ่มหน้าจอ (เต็มจอ / แนวนอน) อยู่บนสุดของเมนู
  const screenRow = () => (document.body.classList.contains('touch')
    ? '<div class="actions grid2"><button data-act="m:full">⛶ เต็มจอ</button><button data-act="land">' + landLabel() + '</button></div>' : '');
  function menuPanel(msg) {
    if (isClient()) {
      open(head('☰ เมนู') + (msg ? '<div class="note">' + esc(msg) + '</div>' : '') + screenRow() +
        '<div class="actions grid2"><button data-act="room">🌐 ข้อมูลห้อง</button><button data-act="m:help">❓ วิธีเล่น</button>' +
        '<button data-act="leave" class="danger">🚪 ออกจากห้อง</button></div>' +
        '<p class="muted">คุณเป็นผู้ร่วมเล่น การบันทึกและส่งออกข้อมูลทำที่เครื่องเจ้าของห้อง</p>');
      return;
    }
    open(head('☰ เมนู') + (msg ? '<div class="note">' + esc(msg) + '</div>' : '') + screenRow() +
      (NetX() ? '<div class="actions"><button data-act="room" class="primary">🌐 รหัสห้อง ' + esc(root.Net.room) + ' · ผู้เล่น ' + Sim.players().length + ' คน</button></div>' : '') +
      '<div class="actions grid2">' +
      '<button data-act="m:save">💾 บันทึกเกม</button><button data-act="m:load">📂 โหลดเกมที่บันทึก</button>' +
      '<button data-act="m:json">⬇️ ส่งออกข้อมูล JSON</button><button data-act="m:sql">🗄️ ส่งออก SQL (MySQL)</button>' +
      '<button data-act="m:import">⬆️ นำเข้าไฟล์ JSON</button><button data-act="m:season">🌦️ สลับฤดูกาล (ทดลอง)</button>' +
      '<button data-act="m:look">👕 เปลี่ยนหน้าตาตัวละคร</button><button data-act="m:plan">📅 แผนงาน / นัดหมาย</button>' +
      '<button data-act="m:help">❓ วิธีเล่น</button><button data-act="m:new" class="danger">🔄 เริ่มเกมใหม่</button></div>' +
      '<p class="muted">ข้อมูลเซฟเก็บในเบราว์เซอร์เครื่องนี้ (IndexedDB) · ไฟล์ SQL ใช้กับ db/schema.sql ใน phpMyAdmin</p>');
  }
  const HELP =
    '<ul class="help">' +
    '<li><b>เดิน</b> W A S D / ปุ่มลูกศร (กด Shift วิ่ง) หรือคลิกที่พื้นเพื่อเดินไป · <b>มือถือ</b> ลากนิ้วตรงไหนก็ได้บนจอ (หรือจอยซ้ายล่าง) แล้วตัวละครจะเดินตาม แตะพื้นเพื่อเดินไปตรงนั้น</li>' +
    '<li><b>โต้ตอบ</b> เข้าใกล้แล้วกด <kbd>E</kbd> หรือคลิกที่ตัวละคร/ป้ายอันตราย</li>' +
    '<li><b>จุดเสี่ยง</b> ซ่อนอยู่จนกว่าคุณเดินไปเห็นเอง หรือมีพนักงานที่ไว้ใจคุณมาแจ้ง · วงสีขาวรอบป้ายคือเวลาก่อนเกิดเหตุ</li>' +
    '<li><b>ตัดสินใจ</b> หยุดงาน / คุยสอน / ออก CAR / ปล่อยไว้ แต่ละแบบเหมาะกับปัญหาต่างกัน ระบบจะบอกเหตุผลทุกครั้ง</li>' +
    '<li><b>ความทรงจำ NPC</b> พนักงานจำสิ่งที่คุณทำ เล่าต่อให้เพื่อน และกล้าแจ้งปัญหามากขึ้นเมื่อไว้ใจคุณ</li>' +
    '<li><b>PTW</b> งานร้อน งานที่สูง งานไฟฟ้า ต้องขอใบอนุญาต เดินไปตรวจหน้างานก่อนอนุมัติจะปลอดภัยที่สุด</li>' +
    '<li><b>📅 แผนงาน</b> ทุกเช้าเลือกแผนงานประจำวัน 1 แผน · นัด<b>ประชุม คปอ.</b> (อย่างน้อยเดือนละครั้ง) และ<b>อบรมพนักงาน</b>รายแผนก ' +
    'ถึงเวลาให้เดินไปที่ป้ายสีม่วงแล้วกดเริ่ม ถ้าไม่ไปตามนัด พนักงานจะจำได้</li>' +
    '<li><b>ตัวละคร</b> เลือกเพศ ทรงผม สีผิว สีผม และสีเสื้อกั๊กได้ที่หน้าแรก หรือ เมนู → เปลี่ยนหน้าตาตัวละคร</li>' +
    '<li><b>ฤดูกาล</b> ไฮซีซันแขกเต็ม งานบริการเร่ง · โลว์ซีซันมรสุม คลื่นแรง งานซ่อมบำรุงเยอะ</li>' +
    '<li><b>กลางคืน</b> มองเห็นจุดเสี่ยงได้ใกล้ลง ต้องเดินตรวจใกล้ขึ้น</li>' +
    '<li><b>แพ้</b> เมื่อเกิดอุบัติเหตุร้ายแรง 3 ครั้ง หรือความน่าเชื่อถือ จป. เหลือ 0</li>' +
    '<li>ปุ่มลัด: <kbd>Tab</kbd> พนักงาน · <kbd>L</kbd> สมุดบันทึก · <kbd>P</kbd> PTW · <kbd>M</kbd> เมนู · <kbd>+</kbd>/<kbd>-</kbd> ซูม</li>' +
    '<li><b>เล่นกับเพื่อน (2–4 คน เครื่องเดียวกัน)</b> P1 ใช้ <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> + <kbd>E</kbd> (Shift ซ้ายวิ่ง) · P2 ใช้ลูกศร + <kbd>Enter</kbd> (Shift ขวาวิ่ง) · ' +
    'P3–P4 ใช้จอยเกม (ก้านซ้ายเดิน ปุ่ม A โต้ตอบ ปุ่ม B วิ่ง) · กล้องจะซูมให้เห็นทุกคน</li></ul>';
  function helpPanel() { open(head('❓ วิธีเล่น') + HELP + '<div class="actions"><button data-act="close" class="primary">เข้าใจแล้ว</button></div>'); }
  function intro(autoRec) {
    const touch = document.body.classList.contains('touch');
    const invite = root.Net ? root.Net.cleanCode((location.hash.match(/join=(\w{6})/) || [])[1]) : '';
    const inApp = /\bLine\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent);
    open('<div class="intro"><div class="topline"><div class="badge">เกมจำลองงาน จป.วิชาชีพ</div>' +
      (touch ? '<button data-act="land" class="landbtn">' + landLabel(true) + '</button>' : '') + '</div><h1>จป.ซัน แห่งเกาะพีพี</h1>' +
      (invite ? '<div class="note invite">🎟️ คุณได้รับเชิญเข้าห้อง <b>' + esc(invite) + '</b> — ตั้งชื่อและหน้าตาของคุณ แล้วกด <b>เข้าร่วม</b> ในการ์ดเล่นออนไลน์</div>' : '') +
      (inApp ? '<div class="note">ℹ️ ถ้าเปิดจาก LINE แล้วเล่นออนไลน์ไม่ได้ ให้แตะ ⋮ หรือปุ่มแชร์ แล้วเลือก "เปิดในเบราว์เซอร์" (Chrome/Safari)</div>' : '') +
      '<p class="lead">คุณคือ <b>จป.วิชาชีพ</b> ของรีสอร์ตริมอ่าวบนเกาะพีพี ดูแลพนักงาน <b>204 คน</b> 12 แผนก และแขกที่หมุนเวียนตามฤดูกาล ' +
      'ทุกคนมีชื่อ มีเรื่องราว และ<b>จำได้</b>ว่าคุณเคยทำอะไรกับเขา</p>' +
      '<h3 class="sec">🧑 ตัวละครของคุณ</h3>' + creatorHtml(false) +
      (autoRec ? '<div class="actions"><button data-act="intro:continue" class="primary">▶️ เล่นต่อจากที่บันทึกไว้ (วันที่ ' + (autoRec.day + 1) + (autoRec.players > 1 ? ' · ' + autoRec.players + ' คน' : '') + ')</button></div>' : '') +
      '<div class="modes' + (invite ? ' invited' : '') + '">' +
      '<button data-act="intro:solo" class="mode solo"><span class="ic">👤</span><b>เล่นคนเดียว</b><small>เดินตรวจรีสอร์ตด้วยตัวเอง</small><span class="go">▶️ เริ่มเล่นเลย</span></button>' +
      '<div class="mode coop"><span class="ic">👥</span><b>เล่นกับเพื่อน</b><small>เครื่องเดียวกัน ช่วยกันดูแลเกาะ</small>' +
      '<div class="count">จำนวนผู้เล่น ' + [2, 3, 4].map(k => '<button data-act="cnt:' + k + '" class="' + (k === coopCount ? 'on' : '') + '">' + k + ' คน</button>').join('') + '</div>' +
      [1, 2, 3, 4].map(k => '<label class="pn" data-k="' + k + '"' + (k > coopCount ? ' hidden' : '') + '><span class="pl p' + k + '">P' + k + '</span> ' +
        '<input id="pname' + k + '" maxlength="20" value="' + (k === 1 ? esc(me.name) : 'จป.เพื่อน ' + (k - 1)) + '">' +
        '<small>' + ['W A S D + E', 'ลูกศร + Enter', 'จอยเกม 1', 'จอยเกม 2'][k - 1] + '</small></label>').join('') +
      '<button data-act="intro:coop" class="primary">เริ่มเล่นกับเพื่อน</button></div>' +
      '<div class="mode online"><span class="ic">🌐</span><b>เล่นออนไลน์ ต่างเครื่อง</b><small>คนละที่ คนละ WiFi สูงสุด ' + Sim.MAX_PLAYERS + ' คน ส่งรหัสห้องให้เพื่อนทาง LINE</small>' +
      '<small class="muted">ใช้ชื่อและหน้าตาจาก “ตัวละครของคุณ” ด้านบน</small>' +
      '<button data-act="online:host" class="' + (invite ? 'ghostbtn' : 'primary') + '">สร้างห้องใหม่ (เป็นเจ้าของห้อง)</button>' +
      '<div class="joinrow"><input id="ocode" maxlength="7" placeholder="รหัสห้อง 6 ตัว" autocomplete="off" autocapitalize="characters" value="' + esc(invite) + '"><button data-act="online:join"' + (invite ? ' class="primary"' : '') + '>เข้าร่วม</button></div>' +
      '<p id="onstatus" class="muted"></p></div></div>' +
      '<details class="helpbox"' + (touch ? '' : ' open') + '><summary>❓ วิธีเล่น</summary>' + HELP + '</details>' +
      '<p class="muted">ตัวละครและรีสอร์ตในเกมเป็นเรื่องสมมติ ผังรีสอร์ตอิงลักษณะอ่าวบนเกาะพีพี ไม่ใช่ผังจริง</p></div>', { locked: true, wide: true });
    startPreview();
  }

  // ------------------------------------------------------------------ ตัวละครของผู้เล่น (เพศ หน้าตา ชื่อ)
  // จำไว้ในเครื่อง (localStorage) ใช้กับเล่นคนเดียว / P1 เล่นกับเพื่อน / เล่นออนไลน์
  let me = loadMe();
  function loadMe() {
    let v = null;
    try { v = JSON.parse(localStorage.getItem('jp_me') || 'null'); } catch (e) { /* ไม่มีข้อมูล */ }
    v = v && typeof v === 'object' ? v : {};
    const name = String(v.name || '').replace(/[<>"&]/g, '').trim().slice(0, 20) || G.players[0].character_name;
    return { name, look: Sim.cleanLook(v.look, 0) };
  }
  function saveMe() { try { localStorage.setItem('jp_me', JSON.stringify(me)); } catch (e) { /* โหมดส่วนตัว */ } }
  function readMe() {
    const nm = $('myname');
    if (nm) me.name = nm.value.replace(/[<>"&]/g, '').trim().slice(0, 20) || G.players[0].character_name;
    saveMe();
    return me;
  }
  function swatch(key, i, color, on, label) {
    return '<button data-act="av:' + key + ':' + i + '" class="sw' + (on ? ' on' : '') + '" style="background:' + color + '" aria-label="' + label + '"></button>';
  }
  function creatorHtml(noName) {
    const L = me.look, F = L.gender === 'F';
    const styles = F ? AVO.hair_styles_f : AVO.hair_styles_m;
    return '<div class="creator' + (noName ? ' noname' : '') + '"><canvas id="avprev" width="220" height="270" aria-label="ตัวอย่างตัวละคร"></canvas><div class="cr-ctrls">' +
      (noName ? '' : '<label class="cr-row"><span>ชื่อ</span><input id="myname" maxlength="20" value="' + esc(me.name) + '"></label>') +
      '<div class="cr-row"><span>เพศ</span><div class="seg"><button data-act="av:gender:M" class="' + (F ? '' : 'on') + '">👨 ชาย</button>' +
      '<button data-act="av:gender:F" class="' + (F ? 'on' : '') + '">👩 หญิง</button></div></div>' +
      '<div class="cr-row"><span>ทรงผม</span><div class="seg">' + styles.map(s => '<button data-act="av:style:' + s + '" class="' + (L.hair_style === s ? 'on' : '') + '">' +
        esc(AVO.hair_style_names[s] || String(s)) + '</button>').join('') + '</div></div>' +
      '<div class="cr-row"><span>สีผิว</span><div class="sws">' + AVO.skins.map((c, i) => swatch('skin', i, c, L.skin === i, 'สีผิวแบบที่ ' + (i + 1))).join('') + '</div></div>' +
      '<div class="cr-row"><span>สีผม</span><div class="sws">' + AVO.hair_colors.map((c, i) => swatch('hair', i, c, L.hair === i, 'สีผมแบบที่ ' + (i + 1))).join('') + '</div></div>' +
      '<div class="cr-row"><span>เสื้อกั๊ก</span><div class="sws">' + AVO.vests.map((c, i) => swatch('vest', i, c, L.vest === i, 'สีเสื้อกั๊กแบบที่ ' + (i + 1))).join('') + '</div></div>' +
      '</div></div>';
  }
  function avChange(key, val) {
    const L = Object.assign({}, me.look);
    if (key === 'gender') { L.gender = val === 'F' ? 'F' : 'M'; L.hair_style = (L.gender === 'F' ? AVO.hair_styles_f : AVO.hair_styles_m)[0]; }
    else if (key === 'style') L.hair_style = +val;
    else if (key === 'skin' || key === 'hair' || key === 'vest') L[key] = +val;
    readMe();
    me.look = Sim.cleanLook(L, 0);
    saveMe();
    const box = document.querySelector('.creator');
    if (box) { box.outerHTML = creatorHtml(!$('myname')); startPreview(); }
  }
  // ตัวอย่างตัวละคร: เดินอยู่กับที่และหันรอบตัวช้าๆ ให้เห็นทุกด้าน (หยุดเองเมื่อปิดหน้าต่าง)
  let avRaf = 0, avT = 0;
  function drawPreview() {
    const cv = $('avprev');
    if (!cv) { avRaf = 0; return; }
    avT += 1 / 60;
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const g = c.createRadialGradient(110, 236, 6, 110, 236, 90);
    g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
    const dir = [0, 2, 3, 1][Math.floor(avT / 1.8) % 4];
    c.setTransform(4.6, 0, 0, 4.6, 110, 246);
    root.Art.person(c, 0, 0, root.Art.avatarLook(me.look), dir, avT * 8, true, { clipboard: true });
    avRaf = requestAnimationFrame(drawPreview);
  }
  function startPreview() { if (!avRaf && $('avprev')) avRaf = requestAnimationFrame(drawPreview); }
  // เปลี่ยนหน้าตาระหว่างเล่น (ชื่อคงเดิม เพราะพนักงานจำชื่อไว้แล้ว)
  function lookPanel() {
    ctx = { type: 'look' };
    open(head('👕 เปลี่ยนหน้าตาตัวละคร') + creatorHtml(true) +
      '<div class="actions"><button data-act="m:lookdone" class="primary">✅ ใช้หน้าตานี้</button><button data-act="m:menu" class="ghost">ยกเลิก</button></div>');
    startPreview();
  }

  // ------------------------------------------------------------------ 📅 แผนงาน / นัดประชุม คปอ. / นัดอบรม
  function dayOpts(sel) {
    const S = Sim.S;
    let o = '';
    for (let d = S.day; d <= S.day + 6; d++) {
      o += '<option value="' + d + '"' + (d === sel ? ' selected' : '') + '>' + (d === S.day ? 'วันนี้' : d === S.day + 1 ? 'พรุ่งนี้' : 'วันที่ ' + (d + 1)) +
        ' · ' + esc(Sim.dateText(d)) + '</option>';
    }
    return o;
  }
  function hourOpts(sel) {
    let o = '';
    for (let h = C.time.start_hour + 1; h <= C.time.end_hour - 2; h += 0.5) o += '<option value="' + h + '"' + (h === sel ? ' selected' : '') + '>' + Sim.timeText(h) + ' น.</option>';
    return o;
  }
  function focusButtons() {
    return '<div class="actions big focus-list">' + G.daily_focus.map(f => '<button data-act="focus:' + f.code + '"><b>' + f.icon + ' ' + esc(f.title) + '</b><small>' + esc(f.desc) + '</small></button>').join('') + '</div>';
  }
  function actRow(a, ro) {
    const S = Sim.S;
    const when = (a.scheduled_day === S.day ? 'วันนี้' : a.scheduled_day === S.day + 1 ? 'พรุ่งนี้' : esc(Sim.dateText(a.scheduled_day))) + ' ' + Sim.timeText(a.scheduled_hour) + ' น.';
    let extra = '';
    if (a.status === 'done') extra = a.activity_type === 'training' ? ' · ตอบถูก ' + num(a.score) + ' ข้อ · ผู้เข้าอบรม ' + num(a.attendees) + ' คน' : ' · อนุมัติ ' + num(a.score) + ' เรื่อง · งบ ' + num(a.budget_baht).toLocaleString() + ' บาท';
    return '<li><span>' + (ACT_ICON[a.activity_type] || '•') + ' ' + esc(a.title) + '</span> <span class="tag ' + cls(a.status) + '">' + (ACT_STATUS[a.status] || '') + '</span>' +
      (!ro && a.status === 'planned' ? '<span class="row-btns"><button data-act="plan:cancel:' + num(a.id) + '">ยกเลิก</button></span>' : '') +
      (a.status === 'due' && a.x !== undefined ? '<span class="row-btns"><button data-act="nav:' + num(a.x) + ',' + num(a.y) + '">🚶 ไปที่จุดนัด</button></span>' : '') +
      '<small>' + when + extra + '</small></li>';
  }
  function planPanel(msg) {
    const S = Sim.S;
    if (!S) return;
    const ro = isClient();
    const f = S.focus && Sim.FOCUS[S.focus];
    let html = head('📅 แผนงาน จป.') + (msg ? '<div class="note' + (msg.bad ? ' bad' : '') + '">' + esc(msg.text) + '</div>' : '') +
      '<h3 class="sec">🎯 แผนงานวันนี้</h3>';
    if (f) html += '<div class="focus-now"><b>' + f.icon + ' ' + esc(f.title) + '</b><small>' + esc(f.desc) + '</small></div>';
    else if (ro || S.focus_day === S.day) html += '<p class="muted">วันนี้ไม่ได้เลือกแผนงาน</p>';
    else html += '<p class="muted">เลือกได้วันละ 1 แผน มีผลทั้งวัน</p>' + focusButtons();
    const upcoming = (S.activities || []).filter(a => a.status === 'planned' || a.status === 'due')
      .sort((a, b) => a.scheduled_day - b.scheduled_day || a.scheduled_hour - b.scheduled_hour);
    html += '<h3 class="sec">🗓️ นัดหมาย</h3>' + (upcoming.length ? '<ul class="list acts">' + upcoming.map(a => actRow(a, ro)).join('') + '</ul>' : '<p class="muted">ยังไม่มีนัด</p>');
    if (!ro) {
      html += '<h3 class="sec">➕ นัดหมายใหม่</h3>' +
        '<div class="plan-form"><b>🏛️ ประชุม คปอ.</b><div class="frow"><select id="pk-day" aria-label="วันประชุม">' + dayOpts(S.day + 1) + '</select>' +
        '<select id="pk-hour" aria-label="เวลาประชุม">' + hourOpts(10) + '</select><button data-act="plan:kpo" class="primary">นัดประชุม</button></div>' +
        '<small class="muted">ต้องประชุมอย่างน้อยเดือนละครั้ง ผู้แทนทุกแผนกมาที่ล็อบบี้ พิจารณาข้อเสนอและงบความปลอดภัย</small></div>' +
        '<div class="plan-form"><b>📚 อบรมพนักงาน</b><div class="frow"><select id="pt-dept" aria-label="แผนก">' +
        G.departments.map(d => '<option value="' + d.id + '">' + esc(d.short) + '</option>').join('') + '</select>' +
        '<select id="pt-topic" aria-label="หัวข้ออบรม">' + G.training_topics.map(t => '<option value="' + t.code + '">' + t.icon + ' ' + esc(t.title) + '</option>').join('') + '</select></div>' +
        '<div class="frow"><select id="pt-day" aria-label="วันอบรม">' + dayOpts(S.day) + '</select><select id="pt-hour" aria-label="เวลาอบรม">' + hourOpts(14) + '</select>' +
        '<button data-act="plan:train" class="primary">นัดอบรม</button></div>' +
        '<small class="muted">พนักงานแผนกนั้นที่อยู่ในกะจะมาที่โรงอาหาร คุณเป็นวิทยากร ตอบคำถามทบทวนให้ถูกเพื่อให้การอบรมได้ผล</small></div>';
    }
    html += '<h3 class="sec">💰 งบความปลอดภัยเดือนนี้</h3><div class="budget">' + bar(S.budget ? S.budget.left / S.budget.total * 100 : 0, 'amber') +
      ' <b>' + num(S.budget && S.budget.left).toLocaleString() + '</b> / ' + num(S.budget && S.budget.total).toLocaleString() + ' บาท</div>' +
      ((S.upgrades || []).length ? '<p class="muted">มติ คปอ. ที่ทำแล้ว: ' + S.upgrades.map(c => Sim.PROP[c] ? esc(Sim.PROP[c].title) : '').filter(Boolean).join(' · ') + '</p>' : '');
    const past = (S.activities || []).filter(a => (a.status === 'done' || a.status === 'missed') && a.activity_type !== 'daily_focus').slice(-6).reverse();
    if (past.length) html += '<h3 class="sec">🧾 ที่ผ่านมา</h3><ul class="list acts">' + past.map(a => actRow(a, true)).join('') + '</ul>';
    open(html);
  }
  // ตอนเช้าของแต่ละวัน: ถามว่าจะเน้นงานอะไร
  function focusPanel() {
    const S = Sim.S;
    if (!S || isClient() || S.focus_day === S.day) return;
    ctx = { type: 'focuspick' };
    const today = (S.activities || []).filter(a => a.status === 'planned' && a.scheduled_day === S.day);
    open(head('🎯 เช้านี้จะเน้นงานอะไร?') + '<p class="muted">เลือกได้วันละ 1 แผน มีผลทั้งวัน</p>' + focusButtons() +
      (today.length ? '<div class="note">📅 นัดวันนี้: ' + today.map(a => esc(a.title) + ' ' + Sim.timeText(a.scheduled_hour) + ' น.').join(' · ') + '</div>' : '') +
      '<div class="actions"><button data-act="close" class="ghost">ข้ามไปก่อน (เลือกทีหลังได้ที่ 📅 แผนงาน)</button></div>');
  }
  // ฉากประชุม/อบรม (js/scene*.js): ภาพจำลองอยู่ด้านบนของหน้าต่าง ผลการตอบสั่งให้ตัวละครในฉากขยับ
  // ถ้าไฟล์ฉากโหลดไม่สำเร็จ หน้าต่างยังใช้งานได้ตามปกติ (แค่ไม่มีภาพ)
  const STAGE = '<div class="stagebox" id="stage-slot"></div>';
  let stageCtl = null;
  function stageMount(kind, a, fresh) {
    const SC = root.Scene;
    stageCtl = SC && SC.KINDS && SC.KINDS[kind] && $('stage-slot') ? SC.open(kind, { act: a, hour: a && a.scheduled_hour, fresh: !!fresh }, $('stage-slot')) : null;
    return stageCtl;
  }
  function activityPanel(a) {
    if (!a || a.status !== 'due') return;
    if (isClient()) {
      const kind = a.activity_type === 'kpo_meeting' ? 'KPO' : a.topic_code;
      open(head(ACT_ICON[a.activity_type] + ' ' + esc(a.title)) + '<div class="actv">' + STAGE + '<div class="actv-body"><p>เจ้าของห้องเป็นผู้เปิด' + (a.activity_type === 'kpo_meeting' ? 'ประชุม' : 'อบรม') +
        ' คุณยืนร่วมฟังที่นี่ได้</p><div class="actions"><button data-act="close" class="primary">ตกลง</button></div></div></div>', { wide: true });
      const ctl = stageMount(kind, a, true);
      if (ctl) ctl.caption(a.activity_type === 'kpo_meeting' ? 'เจ้าของห้องกำลังเปิดประชุม' : 'เจ้าของห้องกำลังสอน');
      return;
    }
    if (a.activity_type === 'kpo_meeting') kpoPanel(a); else quizStart(a);
  }

  // ---- ประชุม คปอ.
  function propEffect(p) {
    const names = p.effect.hazard_codes.map(c => { const t = G.hazard_types.find(h => h.code === c); return t ? t.title : ''; }).filter(Boolean);
    return 'ลดโอกาสเกิด: ' + names.join(' / ') + (p.effect.ppe ? ' · พนักงานสวม PPE ดีขึ้น' : '');
  }
  let kpoSt = null;
  function kpoPanel(a) {
    ctx = { type: 'activity', obj: a };
    const g = Sim.kpoAgenda(a), st = g.stats, top = Sim.DEPT[g.top_dept];
    kpoSt = st;
    open(head('🏛️ ประชุม คปอ. ประจำเดือน') + '<div class="actv">' + STAGE + '<div class="actv-body">' +
      '<div class="sub">ผู้แทนมาประชุม ' + num(g.attendees) + ' คน · ' + esc(Sim.dateText(Sim.S.day)) + ' · คุณเป็นกรรมการและเลขานุการ คปอ. (จป.วิชาชีพ) นำเสนอวาระ</div>' +
      '<h3 class="sec">วาระที่ 1 ผลการดำเนินงาน' + (st.since_day >= 0 ? 'ตั้งแต่ประชุมครั้งก่อน' : '') + '</h3>' +
      '<div class="grid-stats">' + stat('พบจุดเสี่ยง', st.found) + stat('แก้ไขแล้ว', st.closed) + stat('อุบัติเหตุ', st.incidents) + stat('หยุดงาน (LTI)', st.lti) + '</div>' +
      '<p class="muted">ยังเปิดอยู่ ' + num(st.open_known) + ' จุด (ออก CAR แล้ว ' + num(st.open_car) + ') · แผนกที่ต้องเฝ้าระวังมากที่สุด: <b>' + esc(top ? top.short : '-') + '</b></p>' +
      '<h3 class="sec">วาระที่ 2 ข้อเสนอจากผู้แทนลูกจ้าง</h3><p class="muted">เลือกเรื่องที่จะเสนอให้ที่ประชุมอนุมัติ (ใช้งบความปลอดภัยของเดือนนี้)</p><div class="kpo-props">' +
      g.proposals.map(p => '<label class="prop"><input type="checkbox" data-kpo="' + esc(p.code) + '" data-cost="' + num(p.cost) + '" data-dept="' + num(p.department_id) + '">' +
        '<span><b>' + esc(p.title) + '</b><small>' + esc(Sim.DEPT[p.department_id].short) + ' · <b>' + num(p.cost).toLocaleString() + ' บาท</b> · ' + esc(propEffect(p)) + '</small></span></label>').join('') +
      (st.open_car ? '<label class="prop"><input type="checkbox" data-kpo="RUSH" data-cost="' + num(st.open_car * 5000) + '"><span><b>เร่งปิด CAR ที่ค้าง ' + num(st.open_car) + ' เรื่อง</b>' +
        '<small><b>' + num(st.open_car * 5000).toLocaleString() + ' บาท</b> · แก้จุดเสี่ยงที่ออก CAR ไว้ให้เสร็จทันที</small></span></label>' : '') +
      '</div><div id="kpo-total" class="kpo-total"></div>' +
      '<p class="muted">ข้อที่ไม่อนุมัติ ผู้แทนแผนกนั้นจะผิดหวังและจำไว้ · ข้อที่อนุมัติจะลดโอกาสเกิดจุดเสี่ยงนั้นตลอดเกม</p>' +
      '<div class="actions"><button data-act="kpo:done" class="primary">✅ ปิดประชุมและบันทึกมติ</button></div></div></div>', { wide: true });
    const ctl = stageMount('KPO', a, true);
    if (ctl) { ctl.board({ mode: 'stats', found: st.found, closed: st.closed, incidents: st.incidents, lti: st.lti }); ctl.caption('วาระที่ 1 · ผลการดำเนินงาน'); }
    kpoTotal();
  }
  // ติ๊กข้อเสนอ → ผู้แทนแผนกนั้นยกมือเสนอในห้องประชุม และกระดานแสดงรายการที่เลือก
  function kpoStageSync(inp) {
    const ctl = stageCtl, S = Sim.S;
    if (!ctl || !S || !S.budget) return;
    const items = [];
    let total = 0;
    document.querySelectorAll('.kpo-props input[data-kpo]').forEach(i => {
      if (!i.checked) return;
      total += +i.dataset.cost || 0;
      const b = i.closest('label').querySelector('b');
      items.push({ title: b ? b.textContent : '' });
    });
    const st = kpoSt || { found: 0, closed: 0, incidents: 0, lti: 0 };
    ctl.board(items.length ? { mode: 'props', items, total, budget: S.budget.left } : { mode: 'stats', found: st.found, closed: st.closed, incidents: st.incidents, lti: st.lti });
    ctl.caption(items.length ? 'วาระที่ 2 · ข้อเสนอจากผู้แทนลูกจ้าง' : 'วาระที่ 1 · ผลการดำเนินงาน');
    if (inp && inp.checked) { const b = inp.closest('label').querySelector('b'); ctl.focus(+inp.dataset.dept || 0, b ? b.textContent : ''); }
    else ctl.clearFocus();
  }
  function kpoTotal() {
    const S = Sim.S, el = $('kpo-total');
    if (!el || !S || !S.budget) return;
    let sum = 0;
    document.querySelectorAll('.kpo-props input[data-kpo]').forEach(i => { if (i.checked) sum += +i.dataset.cost || 0; });
    const over = sum > S.budget.left;
    el.classList.toggle('over', over);
    el.innerHTML = 'รวม <b>' + num(sum).toLocaleString() + '</b> บาท · งบเหลือ ' + num(S.budget.left).toLocaleString() + ' บาท' + (over ? ' — <b>เกินงบ</b> เลือกให้น้อยลง' : '');
    const btn = document.querySelector('[data-act="kpo:done"]');
    if (btn) btn.disabled = over;
  }
  function kpoResult(r, a) {
    open('<div class="result good">' + head('🏛️ บันทึกมติ คปอ. แล้ว') + '<div class="actv">' + STAGE + '<div class="actv-body">' +
      (r.approved.length ? '<p>✅ อนุมัติ: ' + r.approved.map(esc).join(' · ') + '</p>' : '<p>รอบนี้ไม่มีข้อเสนอที่อนุมัติ</p>') +
      (r.deferred.length ? '<p class="muted">⏳ เลื่อนไปก่อน: ' + r.deferred.map(esc).join(' · ') + '</p>' : '') +
      (r.rushed ? '<p>📋 เร่งปิด CAR แล้ว ' + num(r.rushed) + ' เรื่อง</p>' : '') +
      '<div class="effects"><span class="eff up">ความน่าเชื่อถือ +' + num(r.rep) + '</span><span class="eff">ใช้งบ ' + num(r.spent).toLocaleString() + ' บาท</span>' +
      '<span class="eff">งบเหลือ ' + num(r.budget_left).toLocaleString() + ' บาท</span></div>' +
      '<p class="why">📘 สถานประกอบกิจการที่มีลูกจ้าง 50 คนขึ้นไปต้องมี คปอ. และต้องประชุมอย่างน้อยเดือนละครั้ง การอนุมัติงบตามข้อเสนอของผู้แทนลูกจ้างทำให้พนักงานเชื่อมั่นว่าเรื่องที่แจ้งได้รับการแก้จริง</p>' +
      '<div class="actions"><button data-act="close" class="primary">กลับไปทำงาน</button></div></div></div></div>', { wide: true });
    const ctl = stageMount('KPO', a, false);
    if (ctl) ctl.caption(r.approved.length ? 'มติที่ประชุม: อนุมัติ ' + r.approved.length + ' เรื่อง' : 'มติที่ประชุม: เลื่อนไปก่อน');
  }

  // ---- อบรมพนักงาน: จป. เป็นวิทยากร ตอบคำถามทบทวนให้ถูกเพื่ออธิบายให้พนักงานเข้าใจ
  let quiz = null;
  function quizStart(a) {
    const r = Sim.trainingQuiz(a);
    if (!r) return;
    quiz = { a, qs: r.questions, i: -1, correct: 0, answered: -1, n: r.attendees, first: true };      // i = -1: ฉากเปิดอบรม (ยังไม่ถามข้อแรก)
    ctx = { type: 'activity', obj: a };
    quizPanel();
  }
  function quizPanel() {
    const intro = quiz.i < 0, q = intro ? null : quiz.qs[quiz.i], done = !intro && quiz.answered >= 0, right = done && quiz.answered === q.answer;
    let body;
    if (intro) {
      body = '<div class="sub">ผู้เข้าอบรม ' + num(quiz.n) + ' คน · คำถามทบทวน ' + quiz.qs.length + ' ข้อ</div>' +
        '<p>คุณเป็นวิทยากร ดูฉากสาธิตแล้วเลือกคำตอบที่ถูกต้องในแต่ละข้อ ผู้เข้าอบรมจะตอบรับตามคำตอบของคุณ และหลังตอบจะมีสาธิตวิธีที่ถูกให้ดู</p>' +
        '<div class="actions"><button data-act="quiz:start" class="primary">▶ เริ่มอบรม</button></div>';
    } else {
      body = '<div class="sub">ผู้เข้าอบรม ' + num(quiz.n) + ' คน · คำถามทบทวนข้อ ' + (quiz.i + 1) + '/' + quiz.qs.length + ' · ตอบถูกแล้ว ' + quiz.correct + ' ข้อ</div>' +
        '<p class="muted">คุณเป็นวิทยากร เลือกคำตอบที่จะอธิบายให้พนักงานฟัง</p>' +
        '<div class="bubble">🙋 ' + esc(q.q) + '</div><div class="actions quiz">' +
        q.choices.map((c, i) => '<button data-act="quiz:ans:' + i + '"' + (done ? ' disabled' : '') +
          ' class="' + (done ? (i === q.answer ? 'right' : i === quiz.answered ? 'wrong' : '') : '') + '">' + ['ก', 'ข', 'ค', 'ง'][i] + '. ' + esc(c) + '</button>').join('') + '</div>';
      if (done) {
        body += '<div class="verdict' + (right ? ' good' : '') + '">' + (right ? '✅ ถูกต้อง' : '❌ ยังไม่ถูก') + ' — ' + esc(q.explain) + '</div>' +
          '<div class="actions"><button data-act="quiz:next" class="primary">' + (quiz.i + 1 < quiz.qs.length ? 'ข้อต่อไป ▶' : '🎓 สรุปผลการอบรม') + '</button></div>';
      }
    }
    open(head('📚 ' + esc(quiz.a.title)) + '<div class="actv">' + STAGE + '<div class="actv-body">' + body + '</div></div>', { wide: true });
    const ctl = stageMount(quiz.a.topic_code, quiz.a, quiz.first);
    quiz.first = false;
    if (ctl) { if (intro) ctl.caption((Sim.TOPIC[quiz.a.topic_code] || {}).title || ''); else if (done) ctl.reveal(right); else ctl.demo(q.show); }
    if (done) { const nb = document.querySelector('[data-act="quiz:next"]'); if (nb && nb.scrollIntoView) nb.scrollIntoView({ block: 'nearest' }); }
  }
  function trainResult(r, kind, a) {
    const good = r.correct * 2 >= r.total;
    const grade = r.correct === r.total ? 'ดีเยี่ยม' : good ? 'ดี' : 'ควรทบทวนเนื้อหาก่อนสอนครั้งหน้า';
    open('<div class="result good">' + head('🎓 อบรมเสร็จแล้ว: ' + esc(r.topic)) + '<div class="actv">' + STAGE + '<div class="actv-body">' +
      '<p>แผนก' + esc(r.dept) + ' · ผู้เข้าอบรม ' + num(r.attendees) + ' คน · ตอบถูก ' + num(r.correct) + '/' + num(r.total) + ' ข้อ (' + grade + ')</p>' +
      '<div class="effects"><span class="eff up">ความรู้ของแผนก +' + num(r.gain) + '</span><span class="eff up">ความน่าเชื่อถือ +' + num(r.rep) + '</span>' +
      '<span class="eff up">ผู้เข้าอบรมไว้ใจและทำตามกฎมากขึ้น</span></div>' +
      '<p class="why">📘 จุดเสี่ยงที่เกี่ยวกับหัวข้อนี้ในแผนก' + esc(r.dept) + 'จะเกิดน้อยลงตลอดเกม และพนักงานที่มาอบรมจะจำได้ว่าคุณสอนเรื่องนี้</p>' +
      '<div class="actions"><button data-act="close" class="primary">กลับไปทำงาน</button></div></div></div></div>', { wide: true });
    const ctl = stageMount(kind, a, false);
    if (ctl) { ctl.finish(good); ctl.caption(good ? '🎓 ผ่านการอบรม' : 'ควรทบทวนเนื้อหาอีกครั้ง'); }
  }

  // ------------------------------------------------------------------ online
  function onlineStatus(msg, bad) { const el = $('onstatus'); if (el) { el.textContent = msg; el.classList.toggle('bad', !!bad); } }
  function onlineAct(v) {
    const Net = root.Net;
    if (!Net || !Net.available()) { onlineStatus('โหลดระบบออนไลน์ไม่สำเร็จ ต้องต่ออินเทอร์เน็ต', true); return; }
    const my = readMe(), name = my.name;
    if (v === 'host') {
      onlineStatus('กำลังสร้างห้อง…');
      Sim.newGame({ count: 1, names: [name], looks: [my.look] });
      Sim.paused = true;
      Net.host().then(code => { Sim.paused = false; close(true); roomPanel(); log('🌐 สร้างห้อง ' + code + ' แล้ว ส่งรหัสให้เพื่อนได้เลย', 'good'); })
        .catch(e => onlineStatus(e.message, true));
    } else if (v === 'join') {
      const code = Net.cleanCode($('ocode') && $('ocode').value);
      if (code.length !== 6) { onlineStatus('ใส่รหัสห้อง 6 ตัวอักษร', true); return; }
      onlineStatus('กำลังเชื่อมต่อห้อง ' + code + '…');
      Net.join(code, name, my.look).then(r => { close(true); log('🌐 เข้าร่วมห้อง ' + r.room + ' แล้ว (คุณคือ P' + r.pid + ')', 'good'); })
        .catch(e => onlineStatus(e.message, true));
    }
  }
  function roomPanel() {
    const Net = root.Net;
    if (!Net || !Net.active) return;
    const list = Sim.players().map(p => '<li><span class="pl p' + (((p.id - 1) % 4) + 1) + '">P' + p.id + '</span> ' + esc(Sim.pinfo(p.id).name) +
      (p.id === Sim.P.id ? ' <small>(คุณ)</small>' : '') + '</li>').join('');
    open(head('🌐 ห้องออนไลน์') +
      '<div class="roomcode">' + esc(Net.room) + '</div>' +
      '<div class="actions"><button data-act="copylink" class="primary">🔗 คัดลอกลิงก์เชิญ (แนะนำ)</button><button data-act="copy">📋 คัดลอกเฉพาะรหัส</button>' +
      (navigator.share ? '<button data-act="share">📤 แชร์ไป LINE</button>' : '') + '</div>' +
      (Net.isHost ? '<p>ส่ง<b>ลิงก์เชิญ</b>ให้เพื่อน เพื่อนแตะลิงก์แล้วกด <b>เข้าร่วม</b> ได้เลย (หรือส่งรหัสห้อง ให้เพื่อนใส่เองในการ์ด <b>เล่นออนไลน์ ต่างเครื่อง</b>)</p>' +
        '<p class="muted">เครื่องของคุณเป็นเจ้าของห้อง ต้องเปิดเกมค้างไว้ ถ้าปิดหน้านี้ ห้องจะปิดและทุกคนจะหลุด · บันทึกเกมเก็บที่เครื่องคุณ</p>'
        : '<p class="muted">คุณเชื่อมต่อกับเจ้าของห้องอยู่ ความคืบหน้าบันทึกที่เครื่องเจ้าของห้อง</p>') +
      '<h3 class="coop-h">ผู้เล่นในห้อง (' + Sim.players().length + '/' + Sim.MAX_PLAYERS + ')</h3><ul class="list">' + list + '</ul>' +
      '<div class="actions"><button data-act="close">ไปเล่นต่อ</button></div>');
  }
  function hostLostPanel() {
    open('<div class="result bad"><h2>🔌 การเชื่อมต่อกับเจ้าของห้องหลุด</h2>' +
      '<p>เจ้าของห้องอาจปิดเกม หรืออินเทอร์เน็ตไม่เสถียร</p>' +
      '<div class="actions"><button data-act="leave" class="primary">กลับหน้าแรก</button></div></div>', { locked: true });
  }

  function dayEndPanel(rep, today) {
    let stars = 3;
    stars -= today.lti * 1.5 + Math.max(0, today.incidents - today.lti) * 0.5;
    if (today.found > 0 && today.closed >= today.found * 0.8) stars += 1;
    if (rep.guest_sat >= 80) stars += 0.5;
    if (rep.avg_trust >= 55) stars += 0.5;
    stars = Math.max(1, Math.min(5, Math.round(stars)));
    let tip = 'การคุยกับพนักงานบ่อยๆ ทำให้เขากล้าแจ้งจุดเสี่ยงก่อนที่คุณจะเดินไปเจอเอง';
    if (today.incidents > 0) tip = 'อุบัติเหตุส่วนใหญ่มาจากจุดที่ยังไม่มีใครเห็น ลองเดินตรวจให้ทั่ว และสร้างความไว้ใจให้พนักงานกล้าแจ้ง';
    else if (today.scold > 0) tip = 'การตำหนิต่อหน้าคนอื่นทำให้ความไว้ใจลดลง และข่าวลือแพร่ไปทั้งแผนก';
    else if (rep.ops_score < 50) tip = 'หยุดงานบ่อยเกินไปทำให้บริการสะดุด ลองใช้การคุยสอนหรือ CAR กับปัญหาที่ไม่เร่งด่วน';
    open('<div class="dayend">' + '<h2>🌙 สรุปผลวันที่ ' + (rep.game_day + 1) + '</h2><div class="sub">' + esc(Sim.dateText(rep.game_day)) + ' · ' + esc(Sim.season().label) + '</div>' +
      '<div class="stars">' + '★'.repeat(stars) + '<span>' + '☆'.repeat(5 - stars) + '</span></div>' +
      '<div class="grid-stats">' + stat('พบจุดเสี่ยง', today.found) + stat('แก้ไขแล้ว', today.closed) + stat('อุบัติเหตุ', today.incidents) +
      stat('หยุดงาน (LTI)', today.lti) + stat('คุยสอน', today.coach) + stat('PTW', today.ptw) + '</div>' +
      '<div class="sum">ความพร้อมบริการ <b>' + num(rep.ops_score) + '</b> · ความพึงพอใจแขก <b>' + num(rep.guest_sat) + '</b> · ความน่าเชื่อถือ <b>' + num(rep.reputation) + '</b> · ความไว้ใจเฉลี่ย <b>' + num(rep.avg_trust) + '</b></div>' +
      coopTable(Sim.S.today_by, 'ผลงานวันนี้แยกรายคน') +
      '<div class="note">💡 ' + esc(tip) + '</div>' +
      (isClient() ? '<p class="muted">⏳ รอเจ้าของห้องกดเริ่มวันถัดไป…</p>'
        : '<div class="actions"><button data-act="day:next" class="primary">☀️ เริ่มวันถัดไป (บันทึกอัตโนมัติ)</button></div>') + '</div>', { locked: true });
  }
  function coopTable(by, title) {
    const S = Sim.S;
    if (!S || !S.coop) return '';
    const rows = S.players.map(p => {
      const s = (by && by[p.id]) || Sim.freshStats();
      const k = ((num(p.id) - 1) % 4 + 4) % 4 + 1;
      return '<tr><td><span class="pl p' + k + '">P' + num(p.id) + '</span> ' + esc(p.name) + '</td><td>' + num(s.found) + '</td><td>' + num(s.closed) + '</td><td>' + num(s.coach) +
        '</td><td>' + num(s.ptw) + '</td><td>' + num(s.inv) + '</td><td>' + (num(s.kpo) + num(s.train)) + '</td><td>' + num(s.talk) + '</td><td>' + num(s.scold) + '</td></tr>';
    }).join('');
    return '<h3 class="coop-h">👥 ' + esc(title) + '</h3><table class="tbl coop"><thead><tr><th>จป.</th><th>พบจุดเสี่ยง</th><th>แก้ไข</th><th>คุยสอน</th>' +
      '<th>PTW</th><th>สอบสวน</th><th>ประชุม/อบรม</th><th>คุย</th><th>ตำหนิ</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function overPanel(reason) {
    const S = Sim.S, T = S.totals;
    open('<div class="result bad">' + '<h2>⛔ จบเกม</h2><p><b>' + esc(reason) + '</b></p>' +
      '<div class="grid-stats">' + stat('ทำงานมา (วัน)', S.day + 1) + stat('พบจุดเสี่ยง', T.found) + stat('แก้ไขแล้ว', T.closed) + stat('อุบัติเหตุ', T.incidents) + '</div>' +
      coopTable(S.by_player, 'ผลงานรวมแยกรายคน') +
      (isClient() ? '<div class="actions"><button data-act="leave" class="primary">🔄 กลับหน้าแรก</button></div></div>'
        : '<p class="why">📘 ส่งออกข้อมูลเก็บไว้วิเคราะห์ได้ เช่น ดูว่าอุบัติเหตุเกิดกับแผนกไหน และตัดสินใจแบบไหนบ่อย</p>' +
        '<div class="actions grid2"><button data-act="m:sql">🗄️ ส่งออก SQL</button><button data-act="m:json">⬇️ ส่งออก JSON</button>' +
        '<button data-act="m:newconfirm" class="primary">🔄 เริ่มใหม่</button></div></div>'), { locked: true });
  }
  function incidentPanel(info) {
    const row = info.row;
    $('flash').classList.remove('on'); void $('flash').offsetWidth; $('flash').classList.add('on');
    log('🚑 อุบัติเหตุ: ' + info.t.title + ' — ' + info.who + ' (' + C.injury_names[info.level] + ')', 'bad');
    if (!info.lti || isOpen()) return;
    open('<div class="result bad">' + head('🚑 เกิดอุบัติเหตุ') + '<p><b>' + esc(info.t.title) + '</b></p>' +
      '<p>ผู้บาดเจ็บ: ' + esc(info.who) + ' · ระดับ: <b>' + esc(C.injury_names[info.level]) + '</b> · ' + esc(row.location_zone) + '</p>' +
      (info.knew ? '<p class="why">⚠️ จุดนี้มีคนรู้อยู่แล้วแต่ยังไม่ถูกแก้ ความน่าเชื่อถือลดลงมากกว่าปกติ</p>' : '<p class="why">จุดนี้ยังไม่มีใครพบมาก่อน การเดินตรวจและความไว้ใจของพนักงานช่วยให้เจอเร็วขึ้น</p>') +
      '<div class="actions"><button data-act="inv:' + row.id + '" class="primary">🔎 สอบสวนทันที</button><button data-act="close" class="ghost">ไว้ทีหลัง</button></div></div>');
  }

  // ------------------------------------------------------------------ save helpers
  function autosave() {
    DB.save('auto', Sim.serialize()).then(w => { if (w) log('💾 บันทึกอัตโนมัติแล้ว', 'info'); });
  }
  function fileStamp() { return 'day' + (Sim.S.day + 1) + '-' + new Date().toISOString().slice(0, 10); }

  function menuAction(v) {
    const S = Sim.S;
    if (v === 'save') { DB.save('manual', Sim.serialize()).then(w => menuPanel(w ? 'บันทึกแล้ว (' + w + ')' : 'บันทึกไม่สำเร็จ — ลองส่งออก JSON แทน')); }
    else if (v === 'load') {
      DB.load('manual').then(rec => {
        if (!rec) { menuPanel('ยังไม่มีเกมที่บันทึกไว้'); return; }
        Sim.restore(rec.data); close(true);
      });
    } else if (v === 'json') DB.download('phiphi-ehs-save-' + fileStamp() + '.json', JSON.stringify(Sim.serialize(), null, 1), 'application/json');
    else if (v === 'sql') DB.download('phiphi-ehs-data-' + fileStamp() + '.sql', DB.toSQL(G, Sim.serialize()), 'application/sql');
    else if (v === 'import') $('file-import').click();
    else if (v === 'season') { Sim.toggleSeason(); close(true); }
    else if (v === 'help') helpPanel();
    else if (v === 'full') { close(true); toggleFullscreen(); }
    else if (v === 'plan') planPanel();
    else if (v === 'look') lookPanel();
    else if (v === 'lookdone') {
      // ใช้กับ P1 (คนที่เล่นเครื่องนี้) · ออนไลน์: ผู้เล่นอื่นเห็นผ่านข้อมูลที่เจ้าของห้องส่งให้
      if (S && S.players && S.players[0]) S.players[0].look = Sim.cleanLook(me.look, 0);
      close(true);
      log('👕 เปลี่ยนหน้าตาตัวละครแล้ว', 'good');
    }
    else if (v === 'new') open(head('🔄 เริ่มเกมใหม่?') + '<p>ความคืบหน้าที่ยังไม่บันทึกจะหายไป</p><div class="actions"><button data-act="m:newconfirm" class="danger">ยืนยัน เริ่มใหม่</button><button data-act="m:menu" class="ghost">ยกเลิก</button></div>');
    else if (v === 'newconfirm') { close(true); intro(null); }
    else if (v === 'menu') menuPanel();
    void S;
  }

  function onAct(a) {
    const parts = a.split(':'), k = parts[0], v = parts[1], w = parts[2];
    const S = Sim.S;
    // ผู้ร่วมเล่นออนไลน์: การกระทำที่เปลี่ยนโลกของเกมต้องส่งให้เจ้าของห้องตัดสิน
    if (isClient()) {
      const o = ctx && ctx.obj;
      if (k === 'npc' && o) { ask({ k: 'npc', id: o.id, topic: v }, r => npcPanel(Sim.applyNpcModel(r.npc) || o, r.reply)); return; }
      if (k === 'ppe' && o) { ask({ k: 'ppe', id: o.id, choice: v }, r => npcPanel(Sim.applyNpcModel(r.npc) || o, r.reply)); return; }
      if (k === 'hz' && o) { ask({ k: 'hz', id: o.id, act: v }, r => resultPanel(r.r)); return; }
      if (k === 'ptw' && o && v !== 'nav') { ask({ k: 'ptw', id: o.id, decision: v }, r => { if (r.r.ok) ptwResult(r.r); else ptwPanel(o); }); return; }
      if (k === 'g' && o) { ask({ k: 'guest', id: o.t.id, topic: v }, r => guestPanel(o, r.reply)); return; }
      if (k === 'cause') { ask({ k: 'inv', id: +v, cause: w }, r => invResult(r.r)); return; }
      if (k === 'm' && ['save', 'load', 'json', 'sql', 'import', 'season', 'new', 'newconfirm', 'look', 'lookdone'].indexOf(v) >= 0) {
        menuPanel('เมนูนี้ใช้ได้เฉพาะเจ้าของห้อง'); return;
      }
    }
    switch (k) {
      case 'close': close(); break;
      case 'npc': if (ctx && ctx.type === 'npc') npcPanel(ctx.obj, Sim.talk(ctx.obj, v)); break;
      case 'ppe': if (ctx && ctx.type === 'npc') npcPanel(ctx.obj, Sim.ppeChoice(ctx.obj, v)); break;
      case 'hz': if (ctx && ctx.type === 'hazard') resultPanel(Sim.hazardAction(ctx.obj, v)); break;
      case 'ptw':
        if (!ctx || ctx.type !== 'ptw') break;
        if (v === 'nav') { const p = ctx.obj, who = Sim.actor; close(true); Sim.goTo(p.x, p.y, { type: 'ptw', obj: p }, who); break; }
        { const r = Sim.ptwDecision(ctx.obj, v); if (r.ok) ptwResult(r); }
        break;
      case 'ptwopen': { const p = S.ptw.find(x => x.id === +v); if (p) ptwPanel(p); break; }
      case 'nav': { const xy = v.split(',').map(Number); close(true); Sim.goTo(xy[0], xy[1] + 4); break; }
      case 'lb': logbook(v); break;
      case 'inv': { const r = S.incidents.find(x => x.id === +v); if (r) invPanel(r); break; }
      case 'cause': { const r = S.incidents.find(x => x.id === +v); if (r) invResult(Sim.investigate(r, w)); break; }
      case 'staff': staffPanel(v ? +v : null); break;
      case 'm': menuAction(v); break;
      case 'g': if (ctx && ctx.type === 'guest') guestPanel(ctx.obj, Sim.guestTalk(ctx.obj, v)); break;
      case 'day': if (v === 'next') { close(true); Sim.nextDay(); if (NetX()) root.Net.nextDay(); autosave(); focusPanel(); } break;
      case 'room': roomPanel(); break;
      case 'leave': location.reload(); break;
      case 'copy': case 'copylink': case 'share': {
        const code = root.Net && root.Net.room;
        if (!code) break;
        const link = location.origin + location.pathname + '#join=' + code;
        const text = k === 'copy' ? code : link;
        if (k === 'share' && navigator.share) {
          navigator.share({ title: 'จป.ซัน แห่งเกาะพีพี', text: 'มาเล่นเกม จป. ด้วยกัน รหัสห้อง ' + code, url: link }).catch(() => {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => log(k === 'copy' ? '📋 คัดลอกรหัสห้อง ' + code + ' แล้ว' : '🔗 คัดลอกลิงก์เชิญแล้ว วางในแชต LINE ได้เลย', 'good'),
            () => log('คัดลอกไม่สำเร็จ ให้จดรหัส ' + code + ' ส่งเพื่อนแทน', 'warn'));
        }
        break;
      }
      case 'online': onlineAct(v); break;
      case 'land': toggleLand(); break;
      case 'av': avChange(v, w); break;
      case 'plan': {
        if (isClient() || !S) break;
        let r;
        if (v === 'kpo') r = Sim.schedule('kpo_meeting', { day: +$('pk-day').value, hour: +$('pk-hour').value });
        else if (v === 'train') r = Sim.schedule('training', { day: +$('pt-day').value, hour: +$('pt-hour').value, department_id: +$('pt-dept').value, topic: $('pt-topic').value });
        else if (v === 'cancel') r = Sim.cancelActivity(+w) ? { ok: true, msg: 'ยกเลิกนัดแล้ว' } : { err: 'ยกเลิกไม่ได้ (เริ่มไปแล้วหรือไม่มีนัดนี้)' };
        if (!r) break;
        planPanel(r.err ? { text: r.err, bad: true } : { text: r.msg || '📅 บันทึกนัดหมายแล้ว ถึงเวลาจะมีป้ายสีม่วงที่จุดนัด' });
        break;
      }
      case 'focus': {
        if (isClient() || !S) break;
        const fromMorning = ctx && ctx.type === 'focuspick';
        const r = Sim.setFocus(v);
        if (fromMorning && !r.err) close(true);
        else planPanel(r.err ? { text: r.err, bad: true } : null);
        break;
      }
      case 'kpo': {
        if (!ctx || ctx.type !== 'activity' || v !== 'done') break;
        const pick = [];
        let rush = false;
        document.querySelectorAll('.kpo-props input[data-kpo]').forEach(i => { if (i.checked) { if (i.dataset.kpo === 'RUSH') rush = true; else pick.push(i.dataset.kpo); } });
        const kpoAct = ctx.obj;
        const r = Sim.finishKpo(kpoAct, pick, rush);
        if (r.err) { close(true); log(r.err, 'warn'); break; }
        const ctl = stageCtl;
        if (!ctl) { kpoResult(r, kpoAct); break; }
        // ลงมติยกมือในห้องประชุม (ราว 2.6 วินาที) แล้วจึงแสดงสรุปมติ
        document.querySelectorAll('#card button').forEach(b => { b.disabled = true; });
        locked = true;
        ctl.board({ mode: 'result', n: r.approved.length, t: ctl.now() });
        ctl.caption('ที่ประชุมลงมติ…');
        ctl.vote(r.approved.length, r.approved.length + r.deferred.length).then(() => {
          locked = false;
          if (isOpen() && ctx && ctx.obj === kpoAct) kpoResult(r, kpoAct);
        });
        break;
      }
      case 'quiz': {
        if (!quiz || !ctx || ctx.type !== 'activity') break;
        if (v === 'start' && quiz.i < 0) { quiz.i = 0; quiz.answered = -1; quizPanel(); }
        else if (v === 'ans' && quiz.i >= 0 && quiz.answered < 0) {
          quiz.answered = +w;
          if (quiz.answered === quiz.qs[quiz.i].answer) quiz.correct++;
          quizPanel();
        } else if (v === 'next' && quiz.answered >= 0) {
          if (quiz.i + 1 < quiz.qs.length) { quiz.i++; quiz.answered = -1; quizPanel(); }
          else {
            const act = quiz.a, kind = act.topic_code;
            const r = Sim.finishTraining(act, quiz.correct);
            quiz = null;
            if (r.err) { close(true); log(r.err, 'warn'); } else trainResult(r, kind, act);
          }
        }
        break;
      }
      case 'intro':
        if (v === 'solo' || v === 'new') { const my = readMe(); Sim.newGame({ count: 1, names: [my.name], looks: [my.look] }); close(true); }
        else if (v === 'coop') {
          const names = [], my = readMe();
          for (let k = 1; k <= coopCount; k++) { const inp = $('pname' + k); names.push(inp ? inp.value : ''); }
          Sim.newGame({ count: coopCount, names, looks: [my.look] }); close(true);
          log('👥 เล่น ' + coopCount + ' คน: P1 W A S D + E · P2 ลูกศร + Enter' + (coopCount > 2 ? ' · P3–P4 จอยเกม' : ''), 'info');
        } else DB.load('auto').then(rec => { if (rec) { Sim.restore(rec.data); close(true); } else { Sim.newGame({ count: 1 }); close(true); } });
        break;
      case 'cnt':
        coopCount = +v;
        document.querySelectorAll('.count button').forEach(b => b.classList.toggle('on', b.dataset.act === 'cnt:' + v));
        document.querySelectorAll('label.pn').forEach(l => { l.hidden = +l.dataset.k > coopCount; });
        break;
      default: break;
    }
  }

  function toggleFullscreen() {
    const d = document, el = d.documentElement;
    const isFull = d.fullscreenElement || d.webkitFullscreenElement;
    try {
      if (isFull) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => fullscreenHint());
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else fullscreenHint();
    } catch (e) { fullscreenHint(); }
  }
  // สลับเล่นแนวนอน/แนวตั้ง (main.js เป็นคนหมุนหน้าเกม)
  const landOn = () => !!(root.GameView && root.GameView.isLand());
  const landLabel = short => (landOn() ? '📱 กลับเป็นแนวตั้ง' : short ? '🔄 เล่นแนวนอน' : '🔄 เล่นแนวนอน (ตะแคงมือถือ)');
  function toggleLand() {
    if (!root.GameView) return;
    root.GameView.toggleLand();
    document.querySelectorAll('[data-act="land"]').forEach(b => { b.textContent = landLabel(b.classList.contains('landbtn')); });
    log(landOn() ? '🔄 แนวนอน: ตะแคงมือถือได้เลย (ไม่ต้องเปิดหมุนจออัตโนมัติ) · กดปุ่ม 🔄 อีกครั้งเพื่อกลับแนวตั้ง' : '📱 กลับเป็นแนวตั้งแล้ว', 'info');
  }
  function fullscreenHint() {
    log('📱 iPhone: แตะปุ่มแชร์ของ Safari → "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดเกมจากไอคอน จะเล่นเต็มจอเหมือนแอป', 'info');
  }

  function init() {
    $('panel').addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) onAct(b.dataset.act);
      else if (e.target === $('panel')) close();
    });
    document.querySelectorAll('[data-ui]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const u = b.dataset.ui;
      if (u === 'full') { toggleFullscreen(); return; }
      if (u === 'land') { toggleLand(); return; }
      if (u === 'mapbtn') { document.body.classList.toggle('map-open'); return; }
      if (!Sim.S || Sim.S.over) return;
      if (u === 'staff') staffPanel(); else if (u === 'log') logbook(); else if (u === 'ptw') ptwList(); else if (u === 'plan') planPanel(); else menuPanel();
    }));
    // มือถือ: แตะแถบด้านบนเพื่อดู/ซ่อนรายละเอียด
    $('hud').addEventListener('click', e => {
      if (!document.body.classList.contains('touch') || e.target.closest('#h-net, #h-focus')) return;
      document.body.classList.toggle('hud-open');
    });
    $('h-focus').addEventListener('click', () => { if (Sim.S && !Sim.S.over && !isOpen()) planPanel(); });
    // ประชุม คปอ.: ติ๊กเลือกข้อเสนอแล้วคำนวณงบรวมทันที
    $('panel').addEventListener('change', e => { if (e.target.closest('.kpo-props')) { kpoTotal(); kpoStageSync(e.target.closest('input')); } });
    $('file-import').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { const data = JSON.parse(rd.result); Sim.restore(data.state ? data : data.data); close(true); }
        catch (err) { menuPanel('นำเข้าไม่สำเร็จ: ' + err.message); }
        e.target.value = '';
      };
      rd.readAsText(f, 'utf-8');
    });
    Sim.on('log', log);
    Sim.on('incident', incidentPanel);
    Sim.on('dayend', dayEndPanel);
    Sim.on('gameover', overPanel);
    Sim.on('arrive', (tg, pl) => { if (!isOpen()) interact(tg, pl); });
    $('h-net').addEventListener('click', () => roomPanel());
    // เหตุการณ์จากเจ้าของห้อง (ฝั่งผู้ร่วมเล่น)
    if (root.Net) {
      const N = root.Net;
      N.on('log', d => log(d.msg, d.type));
      N.on('incident', d => {
        $('flash').classList.remove('on'); void $('flash').offsetWidth; $('flash').classList.add('on');
        log('🚑 อุบัติเหตุ: ' + d.title + ' — ' + d.who + ' (' + (C.injury_names[d.level] || '') + ')', 'bad');
      });
      N.on('dayend', d => { if (Sim.S) Sim.S.today_by = d.today_by || {}; dayEndPanel(d.report, d.today); });
      N.on('nextday', () => close(true));
      N.on('over', d => { if (Sim.S) { Sim.S.over = true; Sim.S.by_player = d.by_player || Sim.S.by_player; } overPanel(d.reason); });
      N.on('hostlost', hostLostPanel);
      N.on('error', msg => log('🌐 ' + msg, 'warn'));
    }
  }

  root.UI = {
    init, hud, prompt, interact, log, close, isOpen, intro, menu: () => menuPanel(), staff: () => staffPanel(),
    logbook: () => logbook(), ptwList, helpPanel, plan: () => planPanel(), focus: focusPanel
  };
})(window);
