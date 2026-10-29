// ============================================================================
// db.js — ชั้นฐานข้อมูลของเกม
//  1) บันทึก/โหลดเกมใน IndexedDB ของเบราว์เซอร์ (ถ้าใช้ไม่ได้จะใช้ localStorage แทน)
//  2) ส่งออกข้อมูลเป็น JSON และเป็น SQL (INSERT) ตรงกับ db/schema.sql
// ไฟล์นี้ไม่แตะหน้าจอ จึงรันใน Node ได้ด้วย (ใช้สร้าง db/seed.sql)
// ============================================================================
(function (root) {
  'use strict';

  const DB_NAME = 'phiphi_ehs_game';
  const STORE = 'saves';
  const LS_PREFIX = DB_NAME + ':';

  // กลุ่มแผนกตาม ENUM เดิมของผู้ใช้
  const DEPT_GROUP = {
    FO: 'Front_Office', FB: 'F&B', KIT: 'F&B', HK: 'Housekeeping', LAU: 'Housekeeping',
    ENG: 'Engineering', LAND: 'Landscape', SEC: 'Security', MAR: 'Marine_Transport',
    SPA: 'Spa', EHS: 'Safety_EHS', ACT: 'Recreation'
  };

  // ---------------------------------------------------------------- IndexedDB
  function openIDB() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('IndexedDB ไม่พร้อมใช้งาน')); return; }
      let req;
      try { req = root.indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'slot' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbRun(mode, fn) {
    return openIDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const req = fn(store);
      tx.oncomplete = () => { resolve(req && req.result); db.close(); };
      tx.onerror = () => { reject(tx.error); db.close(); };
    }));
  }

  async function save(slot, snapshot) {
    const rec = { slot, saved_at: new Date().toISOString(), day: snapshot.state.day, data: snapshot };
    try {
      await idbRun('readwrite', s => s.put(rec));
      return 'IndexedDB';
    } catch (e) {
      try { root.localStorage.setItem(LS_PREFIX + slot, JSON.stringify(rec)); return 'localStorage'; }
      catch (e2) { return null; }
    }
  }

  async function load(slot) {
    try {
      const rec = await idbRun('readonly', s => s.get(slot));
      if (rec) return rec;
    } catch (e) { /* ลอง localStorage ต่อ */ }
    try {
      const txt = root.localStorage.getItem(LS_PREFIX + slot);
      return txt ? JSON.parse(txt) : null;
    } catch (e) { return null; }
  }

  async function remove(slot) {
    try { await idbRun('readwrite', s => s.delete(slot)); } catch (e) { /* ไม่เป็นไร */ }
    try { root.localStorage.removeItem(LS_PREFIX + slot); } catch (e) { /* ไม่เป็นไร */ }
  }

  // ---------------------------------------------------------------- SQL export
  function q(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (typeof v === 'number') return isFinite(v) ? String(Math.round(v * 1000) / 1000) : 'NULL';
    if (typeof v === 'object') v = JSON.stringify(v);
    return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\r?\n/g, '\\n') + "'";
  }

  function inserts(table, cols, rows) {
    if (!rows.length) return '-- (ไม่มีข้อมูลในตาราง ' + table + ')\n';
    let out = '';
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      out += 'INSERT INTO ' + table + ' (' + cols.join(', ') + ') VALUES\n' +
        chunk.map(r => '  (' + cols.map(c => q(r[c])).join(', ') + ')').join(',\n') + ';\n';
    }
    return out;
  }

  function dateForDay(startDate, day) {
    const p = startDate.split('-').map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + day));
    return d.toISOString().slice(0, 10);
  }

  // G = GAME_DATA, snap = Sim.serialize() หรือ null (ข้อมูลตั้งต้น)
  function toSQL(G, snap) {
    const C = G.config;
    const st = snap ? snap.state : null;
    const npcState = {};
    if (snap) snap.npcs.forEach(n => { npcState[n.id] = n; });
    const activeSeason = snap ? snap.state.season_name : 'High_Season';

    // ผู้เล่น: คนที่ 1 จาก data/players.js + คนที่ 2 (โหมดเล่นกับเพื่อน) จากสถานะเกม
    const players = G.players.map(p => Object.assign({}, p, {
      current_reputation_score: st ? Math.round(st.metrics.reputation) : p.current_reputation_score
    }));
    if (st && st.players) {
      st.players.filter(p => !players.some(x => x.id === p.id)).forEach(p => players.push({
        id: p.id, username: 'player_' + p.id, character_name: p.name, license_no: null,
        current_reputation_score: Math.round(st.metrics.reputation)
      }));
    }

    const departments = G.departments.map(d => ({
      id: d.id, code: d.code, name: d.name, short_name: d.short, department_group: DEPT_GROUP[d.code] || 'Merchant',
      headcount: d.headcount, work_location_id: d.work_location_id, ppe_required: d.ppe, toolbox_topic: d.toolbox, color: d.color
    })).concat([
      { id: 13, code: 'MER', name: 'ร้านค้าบนเกาะ (Merchant)', short_name: 'ร้านค้า', department_group: 'Merchant', headcount: 0 },
      { id: 14, code: 'LOC', name: 'ชาวบ้านในพื้นที่ (Local_Resident)', short_name: 'ชาวบ้าน', department_group: 'Local_Resident', headcount: 0 }
    ]);

    const npcs = G.npcs.map(n => {
      const s = npcState[n.id] || {};
      return Object.assign({}, n, {
        trust_in_player: s.trust_in_player !== undefined ? Math.round(s.trust_in_player) : n.trust_in_player,
        safety_compliance_score: s.safety_compliance_score !== undefined ? Math.round(s.safety_compliance_score) : n.safety_compliance_score,
        current_status: s.current_status || 'working',
        look_json: n.look
      });
    });

    const memories = snap ? snap.memories : G.seed_memories.map(m => Object.assign({ memory_type: m.type }, m));
    const memRows = memories.map(m => ({
      npc_id: m.npc_id, player_id: m.player_id || 1, event_category: m.event_category, memory_type: m.memory_type || m.type,
      memory_text: m.memory_text, emotional_impact: m.emotional_impact, importance_level: m.importance_level,
      about_npc_id: m.about_npc_id || null, hazard_type_id: m.hazard_type_id || null, game_day: m.game_day
    }));

    const seasons = C.tourist_seasons.map(s => ({
      id: s.id, season_name: s.season_name, season_description: s.season_description, months: s.months.join(','),
      tourist_density_multiplier: s.tourist_density_multiplier, weather_condition: s.weather_condition,
      sea_wave_height_meters: s.sea_wave_height_meters, guests_in_house: s.guests_in_house,
      staff_active_ratio: s.staff_active_ratio, is_active: s.season_name === activeSeason
    }));

    const tourists = (snap ? snap.tourists : []).map(t => ({
      id: t.id, tourist_code: t.tourist_code, nationality: t.nationality, risk_behavior_trait: t.risk_behavior_trait,
      stay_zone: t.stay_zone, check_in_date: dateForDay(C.time.start_date, t.check_in_day),
      check_out_date: dateForDay(C.time.start_date, t.check_out_day)
    }));

    const reports = (snap ? snap.day_reports : []).map(r => Object.assign({}, r, {
      game_date: dateForDay(C.time.start_date, r.game_day)
    }));

    let sql = '';
    sql += '-- ==============================================================\n';
    sql += '-- ข้อมูลเกม จป. เกาะพีพี  (สร้างเมื่อ ' + new Date().toISOString() + ')\n';
    sql += snap ? '-- ส่งออกจากการเล่น วันที่ ' + (st.day + 1) + ' ในเกม\n' : '-- ข้อมูลตั้งต้น (ยังไม่เริ่มเล่น)\n';
    sql += '-- นำเข้าหลังรัน db/schema.sql แล้ว\n';
    sql += '-- ==============================================================\n';
    sql += 'USE ehs_resort_island;\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n';
    ['day_reports', 'jsa_permitting_logs', 'safety_incidents', 'dynamic_tourists', 'tourist_seasons', 'npc_memories',
      'resort_npcs', 'hazard_types', 'buildings', 'locations', 'departments', 'players'].forEach(t => { sql += 'DELETE FROM ' + t + ';\n'; });
    sql += '\n';
    sql += inserts('players', ['id', 'username', 'character_name', 'license_no', 'current_reputation_score'], players);
    sql += inserts('departments', ['id', 'code', 'name', 'short_name', 'department_group', 'headcount', 'work_location_id', 'ppe_required', 'toolbox_topic', 'color'], departments);
    sql += inserts('locations', ['id', 'name', 'x', 'y', 'rx', 'ry'], G.map.work_locations);
    sql += inserts('buildings', ['id', 'building_type', 'label', 'x', 'y', 'w', 'd', 'h'],
      G.map.buildings.map(b => Object.assign({ building_type: b.type }, b)));
    sql += inserts('resort_npcs', ['id', 'npc_code', 'name', 'nickname', 'gender', 'age', 'job_role', 'department_id',
      'work_location_id', 'shift', 'personality_trait', 'personality_prompt', 'safety_compliance_score', 'trust_in_player',
      'current_status', 'origin', 'motive', 'years_at_resort', 'friend_id', 'low_season_active', 'look_json'], npcs);
    sql += inserts('npc_memories', ['npc_id', 'player_id', 'event_category', 'memory_type', 'memory_text', 'emotional_impact',
      'importance_level', 'about_npc_id', 'hazard_type_id', 'game_day'], memRows);
    sql += inserts('tourist_seasons', ['id', 'season_name', 'season_description', 'months', 'tourist_density_multiplier',
      'weather_condition', 'sea_wave_height_meters', 'guests_in_house', 'staff_active_ratio', 'is_active'], seasons);
    sql += inserts('dynamic_tourists', ['id', 'tourist_code', 'nationality', 'risk_behavior_trait', 'stay_zone', 'check_in_date', 'check_out_date'], tourists);
    sql += inserts('hazard_types', ['id', 'code', 'department_id', 'location_id', 'kind', 'severity', 'involves_guest', 'weight_high',
      'weight_low', 'incident_type', 'best_action', 'requires_ptw', 'title', 'description', 'why_text'],
      G.hazard_types.map(h => Object.assign({ requires_ptw: !!h.requires_ptw }, h)));
    sql += inserts('safety_incidents', ['id', 'location_zone', 'location_id', 'hazard_type_id', 'incident_type', 'severity',
      'reported_by_npc_id', 'offender_npc_id', 'injured_npc_id', 'injured_guest', 'injury_level', 'description',
      'corrective_action_taken', 'root_cause', 'status', 'game_day', 'game_time'], snap ? snap.incidents : []);
    sql += inserts('jsa_permitting_logs', ['id', 'work_title', 'location', 'location_id', 'risk_level', 'assigned_npc_id',
      'approved_by_player_id', 'is_ppe_checked', 'status', 'game_day'], snap ? snap.ptw : []);
    sql += inserts('day_reports', ['player_id', 'game_day', 'game_date', 'season_name', 'hazards_found', 'hazards_closed',
      'incidents', 'lost_time_injuries', 'ops_score', 'guest_sat', 'reputation', 'avg_trust'], reports);
    sql += 'SET FOREIGN_KEY_CHECKS = 1;\n';
    return sql;
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  root.GameDB = { save, load, remove, toSQL, download, dateForDay };
})(typeof window !== 'undefined' ? window : globalThis);
