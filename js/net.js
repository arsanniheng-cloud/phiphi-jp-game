// ============================================================================
// net.js — เล่นออนไลน์ต่างเครื่อง (WebRTC ผ่าน PeerJS)
//  - เจ้าของห้อง (host) รันโลกของเกมทั้งหมด แล้วส่ง snapshot ให้ทุกคน 8 ครั้ง/วินาที
//  - ผู้ร่วมเล่น (client) เดินเองบนเครื่องตัวเอง ส่งตำแหน่งกลับ และส่ง "คำขอ" เมื่อคุย/ตรวจ/อนุมัติ
//  - บริการนัดพบ (signaling) ของ PeerJS ช่วยให้เครื่องเจอกัน ข้อมูลเกมวิ่งตรงระหว่างเครื่อง
// ============================================================================
(function (root) {
  'use strict';
  const Sim = root.Sim;
  const PREFIX = 'jpphiphi-game-';
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const TALK = ['greet', 'story', 'ppe', 'praise', 'toolbox', 'scold'];
  const PPE = ['gentle', 'stop', 'scold'];
  const HZ = ['stop', 'coach', 'car', 'ignore'];
  const PTW = ['check', 'approve', 'reject'];
  const GUEST = ['greet', 'advise'];
  const CAUSE = ['condition', 'act', 'env'];

  let peer = null, mode = null, room = '', hostConn = null, myPid = 1;
  const conns = new Map();                 // DataConnection -> { pid }
  const pending = {};
  let reqSeq = 1, tFast = 0, tSlow = 0, tPos = 0, hooked = false;
  const listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev, a) { (listeners[ev] || []).forEach(fn => fn(a)); }

  function available() { return typeof root.Peer === 'function'; }
  function newCode() { let s = ''; for (let i = 0; i < 6; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]; return s; }
  function cleanCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }
  function send(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) { /* การเชื่อมต่อหลุด */ } }
  function broadcast(msg) { for (const c of conns.keys()) send(c, msg); }

  // ------------------------------------------------------------------ host
  function host(fixedCode) {
    return new Promise((resolve, reject) => {
      if (!available()) { reject(new Error('โหลดไลบรารีออนไลน์ไม่สำเร็จ')); return; }
      let tries = 0;
      const start = () => {
        const code = cleanCode(fixedCode) || newCode();
        peer = new root.Peer(PREFIX + code, { debug: 1 });
        peer.on('open', () => { mode = 'host'; room = code; Sim.setNet('host'); hookHost(); resolve(code); });
        peer.on('connection', setupHostConn);
        peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ลองใหม่รอบหน้า */ } });
        peer.on('error', e => {
          if (e.type === 'unavailable-id' && !fixedCode && tries++ < 3) { peer.destroy(); start(); return; }
          if (mode !== 'host') reject(new Error(errText(e))); else emit('error', errText(e));
        });
      };
      start();
    });
  }
  function hookHost() {
    if (hooked) return;
    hooked = true;
    Sim.on('log', (msg, type) => { if (mode === 'host') broadcast({ t: 'log', msg, type }); });
    Sim.on('incident', info => { if (mode === 'host') broadcast({ t: 'inc', title: info.t.title, who: info.who, level: info.level, lti: info.lti }); });
    Sim.on('dayend', (report, today) => { if (mode === 'host') broadcast({ t: 'dayend', report, today, today_by: Sim.S.today_by }); });
    Sim.on('gameover', reason => { if (mode === 'host') broadcast({ t: 'over', reason, by_player: Sim.S.by_player }); });
  }
  function setupHostConn(conn) {
    conn.on('data', d => onHostData(conn, d));
    conn.on('close', () => dropConn(conn));
    conn.on('error', () => dropConn(conn));
  }
  function dropConn(conn) {
    const c = conns.get(conn);
    if (!c) return;
    conns.delete(conn);
    Sim.removeRemotePlayer(c.pid);
    emit('peers', count());
  }
  function onHostData(conn, d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'hello') {
      if (conns.has(conn)) return;
      if (!Sim.S || Sim.players().length >= Sim.MAX_PLAYERS) { send(conn, { t: 'full' }); setTimeout(() => conn.close(), 400); return; }
      const pl = Sim.addRemotePlayer(d.name, d.look);   // หน้าตาถูกกรองค่าใน Sim.cleanLook
      if (!pl) { send(conn, { t: 'full' }); return; }
      conns.set(conn, { pid: pl.id });
      send(conn, { t: 'welcome', pid: pl.id, room, snap: Sim.netSnapshot(true) });
      emit('peers', count());
      return;
    }
    const c = conns.get(conn);
    if (!c) return;
    // จำกัดความถี่: ตำแหน่งไม่เกิน ~30 ครั้ง/วินาที คำขอไม่เกิน ~4 ครั้ง/วินาที (เกินจะถูกทิ้ง)
    const now = Date.now();
    const bucket = (key, rate, burst) => {
      const b = c[key] || (c[key] = { n: burst, t: now });
      b.n = Math.min(burst, b.n + (now - b.t) / 1000 * rate); b.t = now;
      if (b.n < 1) return false;
      b.n -= 1; return true;
    };
    if (d.t === 'pos') { if (bucket('pb', 30, 40)) Sim.netSetPos(c.pid, +d.x, +d.y, d.dir, d.mv); }
    else if (d.t === 'req' && bucket('rb', 4, 8)) {
      let r;
      try { r = handleReq(c.pid, d.q && typeof d.q === 'object' ? d.q : {}); } catch (e) { r = { err: 'คำขอผิดพลาด' }; }
      send(conn, { t: 'res', id: Math.round(+d.id) || 0, r });
    }
  }
  function handleReq(pid, q) {
    const S = Sim.S;
    const pl = Sim.players().find(p => p.id === pid);
    if (!pl || !S) return { err: 'ไม่พบผู้เล่น' };
    Sim.setActor(pl);
    try {
      if (q.k === 'npc' || q.k === 'ppe') {
        const n = Sim.byId(+q.id);
        if (!n || !n.on) return { err: 'พนักงานคนนี้ไม่อยู่แล้ว' };
        let reply;
        if (q.k === 'npc') { if (TALK.indexOf(q.topic) < 0) return { err: 'bad' }; reply = Sim.talk(n, q.topic); }
        else { if (PPE.indexOf(q.choice) < 0) return { err: 'bad' }; reply = Sim.ppeChoice(n, q.choice); }
        return { kind: 'npc', npc: Sim.npcModel(n), reply };
      }
      if (q.k === 'hz') {
        const h = S.hazards.find(x => x.id === +q.id && !x.done);
        if (!h || HZ.indexOf(q.act) < 0) return { err: 'จุดนี้มีคนจัดการไปแล้ว' };
        return { kind: 'hzres', r: Sim.hazardAction(h, q.act) };
      }
      if (q.k === 'ptw') {
        const p = S.ptw.find(x => x.id === +q.id && x.status === 'pending');
        if (!p || PTW.indexOf(q.decision) < 0) return { err: 'ใบอนุญาตนี้มีคนพิจารณาไปแล้ว' };
        return { kind: 'ptwres', r: Sim.ptwDecision(p, q.decision) };
      }
      if (q.k === 'guest') {
        const g = Sim.guests.find(x => x.t.id === +q.id);
        if (!g || GUEST.indexOf(q.topic) < 0) return { err: 'แขกเดินไปแล้ว' };
        return { kind: 'guest', reply: Sim.guestTalk(g, q.topic) };
      }
      if (q.k === 'inv') {
        const row = S.incidents.find(x => x.id === +q.id && x.status === 'investigating');
        if (!row || CAUSE.indexOf(q.cause) < 0) return { err: 'เหตุการณ์นี้สอบสวนไปแล้ว' };
        return { kind: 'invres', r: Sim.investigate(row, q.cause) };
      }
      return { err: 'คำขอไม่ถูกต้อง' };
    } finally {
      Sim.setActor(Sim.P);
    }
  }
  function nextDay() { if (mode === 'host') broadcast({ t: 'nextday' }); }

  // ------------------------------------------------------------------ client
  function join(code, name, look) {
    return new Promise((resolve, reject) => {
      if (!available()) { reject(new Error('โหลดไลบรารีออนไลน์ไม่สำเร็จ')); return; }
      code = cleanCode(code);
      if (code.length !== 6) { reject(new Error('รหัสห้องต้องมี 6 ตัวอักษร')); return; }
      let done = false;
      const fail = msg => { if (!done) { done = true; reject(new Error(msg)); try { peer.destroy(); } catch (e) { /* ปิดแล้ว */ } } };
      const timer = setTimeout(() => fail('เชื่อมต่อไม่สำเร็จภายใน 20 วินาที (ห้องอาจปิดแล้ว หรือเครือข่ายบล็อกการเชื่อมต่อ)'), 20000);
      peer = new root.Peer({ debug: 1 });
      peer.on('error', e => fail(errText(e)));
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true });
        hostConn = conn;
        conn.on('open', () => send(conn, { t: 'hello', name: String(name || '').slice(0, 20), look: Sim.cleanLook(look, 1) }));
        conn.on('data', d => {
          if (!d || typeof d !== 'object') return;
          if (d.t === 'welcome' && !done) {
            done = true; clearTimeout(timer);
            mode = 'client'; room = code; myPid = d.pid;
            Sim.netStartClient(myPid);
            Sim.netApply(d.snap);
            resolve({ pid: myPid, room: code });
            return;
          }
          if (d.t === 'full') { clearTimeout(timer); fail('ห้องนี้เต็มแล้ว (สูงสุด ' + Sim.MAX_PLAYERS + ' คน)'); return; }
          onClientData(d);
        });
        conn.on('close', () => { if (mode === 'client') emit('hostlost'); });
        conn.on('error', () => { if (mode === 'client') emit('hostlost'); });
      });
    });
  }
  function onClientData(d) {
    if (d.t === 'snap') Sim.netApply(d);
    else if (d.t === 'res') {
      const p = pending[d.id];
      if (!p) return;
      delete pending[d.id];
      if (d.r && d.r.err) p.reject(new Error(d.r.err)); else p.resolve(d.r);
    }
    else if (d.t === 'log') emit('log', d);
    else if (d.t === 'inc') emit('incident', d);
    else if (d.t === 'dayend') emit('dayend', d);
    else if (d.t === 'nextday') emit('nextday');
    else if (d.t === 'over') emit('over', d);
  }
  function request(q) {
    return new Promise((resolve, reject) => {
      if (mode !== 'client' || !hostConn || !hostConn.open) { reject(new Error('ไม่ได้เชื่อมต่อกับเจ้าของห้อง')); return; }
      const id = reqSeq++;
      pending[id] = { resolve, reject };
      send(hostConn, { t: 'req', id, q });
      setTimeout(() => { if (pending[id]) { delete pending[id]; reject(new Error('เจ้าของห้องไม่ตอบ')); } }, 8000);
    });
  }

  // ------------------------------------------------------------------ loop
  function tick(dt) {
    if (mode === 'host' && conns.size && Sim.S) {
      tFast -= dt; tSlow -= dt;
      if (tFast <= 0) {
        tFast = 0.12;
        const slow = tSlow <= 0;
        if (slow) tSlow = 2;
        broadcast(Sim.netSnapshot(slow));
      }
    } else if (mode === 'client' && hostConn && hostConn.open) {
      tPos -= dt;
      if (tPos <= 0) {
        tPos = 0.07;
        const P = Sim.P;
        send(hostConn, { t: 'pos', x: Math.round(P.x), y: Math.round(P.y), dir: P.dir, mv: P.moving ? 1 : 0 });
      }
    }
  }
  function count() { return mode === 'host' ? conns.size + 1 : Sim.players().length; }
  function errText(e) {
    const t = e && e.type;
    if (t === 'peer-unavailable') return 'ไม่พบห้องนี้ ตรวจรหัสอีกครั้ง หรือห้องอาจปิดไปแล้ว';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'ติดต่อบริการนัดพบไม่ได้ ตรวจการเชื่อมต่ออินเทอร์เน็ต';
    if (t === 'browser-incompatible') return 'เบราว์เซอร์นี้ไม่รองรับการเล่นออนไลน์';
    if (t === 'unavailable-id') return 'รหัสห้องนี้มีคนใช้อยู่';
    return 'เชื่อมต่อไม่สำเร็จ (' + (t || (e && e.message) || 'ไม่ทราบสาเหตุ') + ')';
  }

  root.Net = {
    available, host, join, request, tick, nextDay, on, cleanCode, count,
    get mode() { return mode; }, get room() { return room; }, get myPid() { return myPid; },
    get active() { return !!mode; }, get isHost() { return mode === 'host'; }, get isClient() { return mode === 'client'; }
  };
})(window);
