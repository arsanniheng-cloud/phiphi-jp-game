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
    praise: '👏', talk: '💬', toolbox: '📚', incident: '🚑', ppe_ok: '🦺', ppe_remind: '🦺', ptw_ok: '📝', ptw_reject: '⛔', rumor: '👂', seed: '📌' };

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
    setTimeout(() => el.classList.add('fade'), 14000);
    setTimeout(() => el.remove(), 15500);
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
    const s = Sim.season();
    $('h-date').textContent = 'วันที่ ' + (S.day + 1) + ' · ' + Sim.dateText(S.day);
    $('h-time').textContent = '🕒 ' + Sim.timeText();
    $('h-season').textContent = (s.weather_condition === 'sunny' ? '☀️ ' : '🌧️ ') + s.label + ' · คลื่น ' + s.sea_wave_height_meters + ' ม.';
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
  }
  function promptText(tg) {
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
  function menuPanel(msg) {
    if (isClient()) {
      open(head('☰ เมนู') + (msg ? '<div class="note">' + esc(msg) + '</div>' : '') +
        '<div class="actions grid2"><button data-act="room">🌐 ข้อมูลห้อง</button><button data-act="m:help">❓ วิธีเล่น</button>' +
        '<button data-act="leave" class="danger">🚪 ออกจากห้อง</button></div>' +
        '<p class="muted">คุณเป็นผู้ร่วมเล่น การบันทึกและส่งออกข้อมูลทำที่เครื่องเจ้าของห้อง</p>');
      return;
    }
    open(head('☰ เมนู') + (msg ? '<div class="note">' + esc(msg) + '</div>' : '') +
      (NetX() ? '<div class="actions"><button data-act="room" class="primary">🌐 รหัสห้อง ' + esc(root.Net.room) + ' · ผู้เล่น ' + Sim.players().length + ' คน</button></div>' : '') +
      '<div class="actions grid2">' +
      '<button data-act="m:save">💾 บันทึกเกม</button><button data-act="m:load">📂 โหลดเกมที่บันทึก</button>' +
      '<button data-act="m:json">⬇️ ส่งออกข้อมูล JSON</button><button data-act="m:sql">🗄️ ส่งออก SQL (MySQL)</button>' +
      '<button data-act="m:import">⬆️ นำเข้าไฟล์ JSON</button><button data-act="m:season">🌦️ สลับฤดูกาล (ทดลอง)</button>' +
      '<button data-act="m:help">❓ วิธีเล่น</button><button data-act="m:new" class="danger">🔄 เริ่มเกมใหม่</button></div>' +
      '<p class="muted">ข้อมูลเซฟเก็บในเบราว์เซอร์เครื่องนี้ (IndexedDB) · ไฟล์ SQL ใช้กับ db/schema.sql ใน phpMyAdmin</p>');
  }
  const HELP =
    '<ul class="help">' +
    '<li><b>เดิน</b> W A S D / ปุ่มลูกศร (กด Shift วิ่ง) หรือคลิกที่พื้นเพื่อเดินไป · มือถือใช้จอยซ้ายล่าง</li>' +
    '<li><b>โต้ตอบ</b> เข้าใกล้แล้วกด <kbd>E</kbd> หรือคลิกที่ตัวละคร/ป้ายอันตราย</li>' +
    '<li><b>จุดเสี่ยง</b> ซ่อนอยู่จนกว่าคุณเดินไปเห็นเอง หรือมีพนักงานที่ไว้ใจคุณมาแจ้ง · วงสีขาวรอบป้ายคือเวลาก่อนเกิดเหตุ</li>' +
    '<li><b>ตัดสินใจ</b> หยุดงาน / คุยสอน / ออก CAR / ปล่อยไว้ แต่ละแบบเหมาะกับปัญหาต่างกัน ระบบจะบอกเหตุผลทุกครั้ง</li>' +
    '<li><b>ความทรงจำ NPC</b> พนักงานจำสิ่งที่คุณทำ เล่าต่อให้เพื่อน และกล้าแจ้งปัญหามากขึ้นเมื่อไว้ใจคุณ</li>' +
    '<li><b>PTW</b> งานร้อน งานที่สูง งานไฟฟ้า ต้องขอใบอนุญาต เดินไปตรวจหน้างานก่อนอนุมัติจะปลอดภัยที่สุด</li>' +
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
    open('<div class="intro"><div class="badge">เกมจำลองงาน จป.วิชาชีพ</div><h1>จป.ซัน แห่งเกาะพีพี</h1>' +
      (invite ? '<div class="note invite">🎟️ คุณได้รับเชิญเข้าห้อง <b>' + esc(invite) + '</b> — ใส่ชื่อของคุณ แล้วกด <b>เข้าร่วม</b> ในการ์ดเล่นออนไลน์</div>' : '') +
      (inApp ? '<div class="note">ℹ️ ถ้าเปิดจาก LINE แล้วเล่นออนไลน์ไม่ได้ ให้แตะ ⋮ หรือปุ่มแชร์ แล้วเลือก "เปิดในเบราว์เซอร์" (Chrome/Safari)</div>' : '') +
      '<p class="lead">คุณคือ <b>จป.วิชาชีพ</b> ของรีสอร์ตริมอ่าวบนเกาะพีพี ดูแลพนักงาน <b>204 คน</b> 12 แผนก และแขกที่หมุนเวียนตามฤดูกาล ' +
      'ทุกคนมีชื่อ มีเรื่องราว และ<b>จำได้</b>ว่าคุณเคยทำอะไรกับเขา</p>' +
      (autoRec ? '<div class="actions"><button data-act="intro:continue" class="primary">▶️ เล่นต่อจากที่บันทึกไว้ (วันที่ ' + (autoRec.day + 1) + (autoRec.players > 1 ? ' · ' + autoRec.players + ' คน' : '') + ')</button></div>' : '') +
      '<div class="modes">' +
      '<button data-act="intro:solo" class="mode"><span class="ic">👤</span><b>เล่นคนเดียว</b><small>เดินตรวจรีสอร์ตด้วยตัวเอง</small></button>' +
      '<div class="mode coop"><span class="ic">👥</span><b>เล่นกับเพื่อน</b><small>เครื่องเดียวกัน ช่วยกันดูแลเกาะ</small>' +
      '<div class="count">จำนวนผู้เล่น ' + [2, 3, 4].map(k => '<button data-act="cnt:' + k + '" class="' + (k === coopCount ? 'on' : '') + '">' + k + ' คน</button>').join('') + '</div>' +
      [1, 2, 3, 4].map(k => '<label class="pn" data-k="' + k + '"' + (k > coopCount ? ' hidden' : '') + '><span class="pl p' + k + '">P' + k + '</span> ' +
        '<input id="pname' + k + '" maxlength="20" value="' + (k === 1 ? esc(G.players[0].character_name) : 'จป.เพื่อน ' + (k - 1)) + '">' +
        '<small>' + ['W A S D + E', 'ลูกศร + Enter', 'จอยเกม 1', 'จอยเกม 2'][k - 1] + '</small></label>').join('') +
      '<button data-act="intro:coop" class="primary">เริ่มเล่นกับเพื่อน</button></div>' +
      '<div class="mode online"><span class="ic">🌐</span><b>เล่นออนไลน์ ต่างเครื่อง</b><small>คนละที่ คนละ WiFi สูงสุด ' + Sim.MAX_PLAYERS + ' คน ส่งรหัสห้องให้เพื่อนทาง LINE</small>' +
      '<label class="pn"><span>ชื่อ จป.</span><input id="oname" maxlength="20" value="' + esc(G.players[0].character_name) + '"></label>' +
      '<button data-act="online:host" class="' + (invite ? 'ghostbtn' : 'primary') + '">สร้างห้องใหม่ (เป็นเจ้าของห้อง)</button>' +
      '<div class="joinrow"><input id="ocode" maxlength="7" placeholder="รหัสห้อง 6 ตัว" autocomplete="off" autocapitalize="characters" value="' + esc(invite) + '"><button data-act="online:join"' + (invite ? ' class="primary"' : '') + '>เข้าร่วม</button></div>' +
      '<p id="onstatus" class="muted"></p></div></div>' +
      '<details class="helpbox"' + (touch ? '' : ' open') + '><summary>❓ วิธีเล่น</summary>' + HELP + '</details>' +
      '<p class="muted">ตัวละครและรีสอร์ตในเกมเป็นเรื่องสมมติ ผังรีสอร์ตอิงลักษณะอ่าวบนเกาะพีพี ไม่ใช่ผังจริง · ' +
      'การเล่นกับเพื่อนต่างเครื่องผ่านอินเทอร์เน็ตต้องมีเซิร์ฟเวอร์ (ยังไม่มีในเวอร์ชันนี้)</p></div>', { locked: true, wide: true });
  }

  // ------------------------------------------------------------------ online
  function onlineStatus(msg, bad) { const el = $('onstatus'); if (el) { el.textContent = msg; el.classList.toggle('bad', !!bad); } }
  function onlineAct(v) {
    const Net = root.Net;
    if (!Net || !Net.available()) { onlineStatus('โหลดระบบออนไลน์ไม่สำเร็จ ต้องต่ออินเทอร์เน็ต', true); return; }
    const name = ($('oname') && $('oname').value) || '';
    if (v === 'host') {
      onlineStatus('กำลังสร้างห้อง…');
      Sim.newGame({ count: 1, names: [name] });
      Sim.paused = true;
      Net.host().then(code => { Sim.paused = false; close(true); roomPanel(); log('🌐 สร้างห้อง ' + code + ' แล้ว ส่งรหัสให้เพื่อนได้เลย', 'good'); })
        .catch(e => onlineStatus(e.message, true));
    } else if (v === 'join') {
      const code = Net.cleanCode($('ocode') && $('ocode').value);
      if (code.length !== 6) { onlineStatus('ใส่รหัสห้อง 6 ตัวอักษร', true); return; }
      onlineStatus('กำลังเชื่อมต่อห้อง ' + code + '…');
      Net.join(code, name).then(r => { close(true); log('🌐 เข้าร่วมห้อง ' + r.room + ' แล้ว (คุณคือ P' + r.pid + ')', 'good'); })
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
        '</td><td>' + num(s.ptw) + '</td><td>' + num(s.inv) + '</td><td>' + num(s.talk) + '</td><td>' + num(s.scold) + '</td></tr>';
    }).join('');
    return '<h3 class="coop-h">👥 ' + esc(title) + '</h3><table class="tbl coop"><thead><tr><th>จป.</th><th>พบจุดเสี่ยง</th><th>แก้ไข</th><th>คุยสอน</th>' +
      '<th>PTW</th><th>สอบสวน</th><th>คุย</th><th>ตำหนิ</th></tr></thead><tbody>' + rows + '</tbody></table>';
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
      if (k === 'm' && ['save', 'load', 'json', 'sql', 'import', 'season', 'new', 'newconfirm'].indexOf(v) >= 0) {
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
      case 'day': if (v === 'next') { close(true); Sim.nextDay(); if (NetX()) root.Net.nextDay(); autosave(); } break;
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
      case 'intro':
        if (v === 'solo' || v === 'new') { Sim.newGame({ count: 1 }); close(true); }
        else if (v === 'coop') {
          const names = [];
          for (let k = 1; k <= coopCount; k++) { const inp = $('pname' + k); names.push(inp ? inp.value : ''); }
          Sim.newGame({ count: coopCount, names }); close(true);
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
      if (u === 'mapbtn') { document.body.classList.toggle('map-open'); return; }
      if (!Sim.S || Sim.S.over) return;
      if (u === 'staff') staffPanel(); else if (u === 'log') logbook(); else if (u === 'ptw') ptwList(); else menuPanel();
    }));
    // มือถือ: แตะแถบด้านบนเพื่อดู/ซ่อนรายละเอียด
    $('hud').addEventListener('click', e => {
      if (!document.body.classList.contains('touch') || e.target.closest('#h-net')) return;
      document.body.classList.toggle('hud-open');
    });
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
    logbook: () => logbook(), ptwList, helpPanel
  };
})(window);
