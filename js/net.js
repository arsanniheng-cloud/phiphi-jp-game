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
  // รายการ STUN/TURN จาก data/config.js (TURN เดิมของ PeerJS ปิดไปแล้ว จึงไม่ใช้ค่าเริ่มต้นของไลบรารี)
  function iceConfig() {
    const C = (root.GAME_DATA && root.GAME_DATA.config) || {};
    const list = [{ urls: (C.online_stun || ['stun:stun.l.google.com:19302']).slice() }];
    (C.online_turn || []).forEach(t => { if (t && t.urls) list.push(t); });
    return { iceServers: list, sdpSemantics: 'unified-plan' };
  }
  function hasTurn() { const C = (root.GAME_DATA && root.GAME_DATA.config) || {}; return !!(C.online_turn && C.online_turn.length); }

  // ------------------------------------------------------------------ ทางสำรอง: ส่งต่อผ่านเซิร์ฟเวอร์ MQTT สาธารณะ (WebSocket)
  // ใช้เมื่อสองเครื่องต่อกันตรงๆ ไม่ได้ (คนละ WiFi / 4G) · ข้อมูลทุกชิ้นเข้ารหัส AES-GCM ด้วยกุญแจที่สร้างจากรหัสห้อง
  // เซิร์ฟเวอร์เห็นแค่ข้อมูลที่อ่านไม่ออก และชื่อหัวข้อที่เป็นค่าแฮชของรหัสห้อง คนที่ไม่รู้รหัสห้องจึงอ่านหรือปลอมข้อความไม่ได้
  const te = typeof TextEncoder === 'function' ? new TextEncoder() : null, td = typeof TextDecoder === 'function' ? new TextDecoder() : null;
  const GZ = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  function relayUrls() { const C = (root.GAME_DATA && root.GAME_DATA.config) || {}; return (C.online_relay || []).filter(u => /^wss:\/\//.test(u)); }
  function relayOK() { return !!(te && td && root.crypto && root.crypto.subtle && typeof WebSocket === 'function' && relayUrls().length); }
  function rid(n) { const a = root.crypto.getRandomValues(new Uint8Array(n)); let s = ''; for (let i = 0; i < a.length; i++) s += 'abcdefghijkmnpqrstuvwxyz23456789'[a[i] % 32]; return s; }
  function cat() { let n = 0; for (const a of arguments) n += a.length; const o = new Uint8Array(n); let i = 0; for (const a of arguments) { o.set(a, i); i += a.length; } return o; }
  function mstr(s) { const b = te.encode(s); return cat([b.length >> 8, b.length & 255], b); }
  function pkt(h, body) { const L = []; let n = body.length; do { let x = n % 128; n = Math.floor(n / 128); if (n) x |= 128; L.push(x); } while (n); return cat([h], L, body); }
  // ไคลเอนต์ MQTT 3.1.1 ขนาดเล็ก (QoS 0): เชื่อมต่อ สมัครหัวข้อ ส่งข้อความ
  function mqtt(url, onMsg) {
    return new Promise((resolve, reject) => {
      let ws, buf = new Uint8Array(0), ready = false, ping = 0, pid = 1;
      const api = {
        url, closed: false, onclose: null,
        sub(topic) { if (ws.readyState === 1) ws.send(pkt(0x82, cat([0, (pid++) & 255], mstr(topic), [0]))); },
        pub(topic, bytes) { if (ws.readyState === 1) ws.send(pkt(0x30, cat(mstr(topic), bytes))); },
        close() { api.closed = true; clearInterval(ping); try { ws.send(Uint8Array.of(0xE0, 0)); ws.close(); } catch (e) { /* ปิดแล้ว */ } }
      };
      const to = setTimeout(() => { if (!ready) { try { ws.close(); } catch (e) { /* */ } reject(new Error('timeout')); } }, 8000);
      try { ws = new WebSocket(url, ['mqtt']); } catch (e) { clearTimeout(to); reject(e); return; }
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => ws.send(pkt(0x10, cat(mstr('MQTT'), [4, 2, 0, 45], mstr('jpp' + rid(12)))));
      ws.onerror = () => { if (!ready) { clearTimeout(to); reject(new Error('ws')); } };
      ws.onclose = () => { clearInterval(ping); api.closed = true; if (!ready) { clearTimeout(to); reject(new Error('closed')); } else if (api.onclose) api.onclose(); };
      ws.onmessage = ev => {
        buf = cat(buf, new Uint8Array(ev.data));
        while (buf.length >= 2) {
          let i = 1, mul = 1, len = 0, b;
          do { if (i >= buf.length) return; b = buf[i++]; len += (b & 127) * mul; mul *= 128; } while ((b & 128) && i < 5);
          if (buf.length < i + len) return;
          const h = buf[0], body = buf.subarray(i, i + len);
          buf = buf.slice(i + len);
          if (h >> 4 === 2) {
            if (body[1] !== 0) { clearTimeout(to); reject(new Error('refused')); try { ws.close(); } catch (e) { /* */ } return; }
            ready = true; clearTimeout(to);
            ping = setInterval(() => { try { if (ws.readyState === 1) ws.send(Uint8Array.of(0xC0, 0)); } catch (e) { /* */ } }, 20000);
            resolve(api);
          } else if (h >> 4 === 3) {
            const tl = (body[0] << 8) | body[1], qos = (h >> 1) & 3;
            onMsg(td.decode(body.subarray(2, 2 + tl)), body.slice(2 + tl + (qos ? 2 : 0)), api);
          }
        }
      };
    });
  }
  const keyCache = {};
  function roomKey(code) {
    const s = root.crypto.subtle;
    return keyCache[code] || (keyCache[code] = s.importKey('raw', te.encode('jpphiphi-room:' + code), 'PBKDF2', false, ['deriveKey'])
      .then(base => s.deriveKey({ name: 'PBKDF2', salt: te.encode('jpphiphi-relay-v1'), iterations: 60000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])));
  }
  function roomTopic(code) {
    return root.crypto.subtle.digest('SHA-256', te.encode('jpphiphi-topic:' + code))
      .then(h => 'jpp1/' + Array.prototype.map.call(new Uint8Array(h).subarray(0, 12), b => (b < 16 ? '0' : '') + b.toString(16)).join(''));
  }
  function gz(bytes, inflate) {
    return new Response(new Blob([bytes]).stream().pipeThrough(inflate ? new DecompressionStream('gzip') : new CompressionStream('gzip'))).arrayBuffer().then(b => new Uint8Array(b));
  }
  function seal(key, obj, zip) {
    const iv = root.crypto.getRandomValues(new Uint8Array(12)), raw = te.encode(JSON.stringify(obj)), z = !!(zip && GZ);
    return (z ? gz(raw) : Promise.resolve(raw))
      .then(data => root.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data))
      .then(ct => cat([z ? 1 : 0], iv, new Uint8Array(ct)));
  }
  function unseal(key, bytes) {
    if (bytes.length < 30 || bytes.length > 300000) return Promise.reject(new Error('size'));
    return root.crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(1, 13) }, key, bytes.slice(13))
      .then(pt => bytes[0] === 1 ? (GZ ? gz(new Uint8Array(pt), true) : Promise.reject(new Error('gz'))) : new Uint8Array(pt))
      .then(d => { if (d.length > 2000000) throw new Error('size'); return JSON.parse(td.decode(d)); });
  }
  // ฝั่งเจ้าของห้อง: ฟังทุกเซิร์ฟเวอร์ในรายการพร้อมกัน ผู้ร่วมเล่นที่มาทางสำรองจะได้ "การเชื่อมต่อเสมือน" หน้าตาเหมือนของ PeerJS
  let rKey = null, rBase = '';
  const relays = [], rConns = new Map();
  function relayVConn(cid) {
    const vc = { open: true, relay: true, cid, last: Date.now(), gz: false, lastSnap: 0, rel: null, h: {} };
    vc.on = (ev, fn) => { vc.h[ev] = fn; };
    vc.send = msg => {
      if (!vc.open || !vc.rel || vc.rel.closed) return;
      if (msg && msg.t === 'snap' && !msg.slow) { const now = Date.now(); if (now - vc.lastSnap < 240) return; vc.lastSnap = now; }   // ทางสำรองส่งภาพรวมราว 4 ครั้ง/วินาที
      const rel = vc.rel;
      seal(rKey, msg, vc.gz).then(b => rel.pub(rBase + '/c/' + cid, b)).catch(() => { /* ส่งไม่ได้ ข้ามไป */ });
    };
    vc.close = () => { if (!vc.open) return; vc.open = false; rConns.delete(cid); if (vc.h.close) vc.h.close(); };
    return vc;
  }
  function relayHost(code) {
    if (!relayOK() || rKey || relays.length) return;          // เริ่มครั้งเดียว (PeerJS อาจส่ง open ซ้ำหลังต่อใหม่)
    Promise.all([roomKey(code), roomTopic(code)]).then(r => {
      rKey = r[0]; rBase = r[1];
      relayUrls().forEach(u => mqtt(u, onRelayHost).then(rel => { relays.push(rel); rel.sub(rBase + '/h'); }).catch(() => { /* ใช้ตัวอื่นแทน */ }));
    }).catch(() => { /* เครื่องนี้ใช้ทางสำรองไม่ได้ */ });
  }
  function onRelayHost(topic, bytes, rel) {
    if (!rKey || topic !== rBase + '/h') return;
    unseal(rKey, bytes).then(env => {
      if (!env || typeof env !== 'object' || typeof env.cid !== 'string' || !/^[a-z2-9]{8,16}$/.test(env.cid) || !env.m || typeof env.m !== 'object') return;
      let vc = rConns.get(env.cid);
      if (!vc) {
        if (env.m.t !== 'hello' || rConns.size >= 8) return;
        vc = relayVConn(env.cid);
        vc.gz = !!env.m.gz && GZ;
        rConns.set(env.cid, vc);
        setupHostConn(vc);
      }
      vc.last = Date.now(); vc.rel = rel;
      if (vc.h.data) vc.h.data(env.m);
    }).catch(() => { /* ถอดรหัสไม่ได้ = ไม่ใช่ห้องนี้ ทิ้งไป */ });
  }
  let relayMode = false, lastHost = 0, lostSent = false;
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
        peer = new root.Peer(PREFIX + code, { debug: 1, config: iceConfig() });
        peer.on('open', () => { mode = 'host'; room = code; Sim.setNet('host'); hookHost(); relayHost(code); resolve(code); });
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
  // เข้าห้อง: ลองต่อตรง (WebRTC) ก่อน ถ้า 10 วินาทียังไม่ติด หรือบริการนัดพบมีปัญหา จะเปลี่ยนไปใช้ทางสำรองให้อัตโนมัติ
  // (เครื่องที่ใช้ทางสำรองไม่ได้ จะลองต่อตรงซ้ำ 3 รอบแทน เผื่อเครื่องเจ้าของห้องสลับไปแอปอื่นชั่วคราว)
  function join(code, name, look, onStatus, opt) {
    opt = opt || {};
    return new Promise((resolve, reject) => {
      if (!available() && !relayOK()) { reject(new Error('โหลดไลบรารีออนไลน์ไม่สำเร็จ')); return; }
      code = cleanCode(code);
      if (code.length !== 6) { reject(new Error('รหัสห้องต้องมี 6 ตัวอักษร')); return; }
      let done = false, tries = 0, conn = null, retryT = 0, relayT = 0, relayOn = false, rel = null;
      const hello = () => ({ t: 'hello', name: String(name || '').slice(0, 20), look: Sim.cleanLook(look, 1), gz: GZ });
      const status = m => { try { if (onStatus) onStatus(m); } catch (e) { /* ไม่เป็นไร */ } };
      const fail = msg => {
        if (done) return;
        done = true; clearTimeout(timer); clearTimeout(retryT); clearTimeout(relayT); reject(new Error(msg));
        try { if (peer) peer.destroy(); } catch (e) { /* ปิดแล้ว */ }
        try { if (rel) rel.close(); } catch (e) { /* ปิดแล้ว */ }
      };
      const timer = setTimeout(() => fail(relayOn
        ? 'เชื่อมต่อไม่สำเร็จทั้งแบบต่อตรงและทางสำรอง ตรวจรหัสห้องอีกครั้ง และให้เจ้าของห้องเปิดหน้าเกมค้างไว้ (ไม่สลับไปแอปอื่น) แล้วลองใหม่'
        : 'เชื่อมต่อไม่สำเร็จ: สองเครื่องอาจอยู่คนละเครือข่ายที่ต่อกันตรงๆ ไม่ได้ ลองให้ทุกเครื่องใช้ WiFi เดียวกัน และให้เจ้าของห้องเปิดหน้าเกมค้างไว้'), 50000);
      // รับข้อมูลจากเจ้าของห้อง ใช้ได้ทั้งแบบต่อตรงและทางสำรอง
      const wire = c => {
        c.on('data', d => {
          if (conn !== c || !d || typeof d !== 'object') return;
          lastHost = Date.now();
          if (d.t === 'welcome' && !done) {
            done = true; clearTimeout(timer); clearTimeout(retryT); clearTimeout(relayT);
            mode = 'client'; room = code; myPid = d.pid; relayMode = !!c.relay; lostSent = false;
            if (c.relay) { try { if (peer) peer.destroy(); } catch (e) { /* */ } peer = null; }
            Sim.netStartClient(myPid);
            Sim.netApply(d.snap);
            resolve({ pid: myPid, room: code, relay: relayMode });
            return;
          }
          if (d.t === 'full') { fail('ห้องนี้เต็มแล้ว (สูงสุด ' + Sim.MAX_PLAYERS + ' คน)'); return; }
          onClientData(d);
        });
        c.on('close', () => { if (mode === 'client' && conn === c) emit('hostlost'); });
        c.on('error', () => { if (mode === 'client' && conn === c) emit('hostlost'); });
      };
      const startRelay = () => {
        if (relayOn || done || !relayOK()) return;
        relayOn = true; clearTimeout(retryT); clearTimeout(relayT);
        if (conn) { const old = conn; conn = null; try { old.close(); } catch (e) { /* */ } }
        status('ต่อตรงไม่ติด กำลังเชื่อมผ่านทางสำรอง (ข้อมูลเข้ารหัสด้วยรหัสห้อง)…');
        const cid = rid(10);
        Promise.all([roomKey(code), roomTopic(code)]).then(r => {
          const key = r[0], base = r[1];
          const hc = { open: true, relay: true, h: {} };
          hc.on = (ev, fn) => { hc.h[ev] = fn; };
          hc.send = msg => { if (hc.open && rel && !rel.closed) seal(key, { cid, m: msg }).then(b => rel.pub(base + '/h', b)).catch(() => { /* */ }); };
          hc.close = () => { hc.open = false; if (rel) rel.close(); };
          wire(hc);
          const onMsg = (topic, bytes) => { if (topic === base + '/c/' + cid) unseal(key, bytes).then(m => { if (hc.h.data) hc.h.data(m); }).catch(() => { /* */ }); };
          const urls = relayUrls();
          const tryUrl = i => {
            if (done || i >= urls.length) return;
            mqtt(urls[i], onMsg).then(r2 => {
              if (done) { r2.close(); return; }
              rel = r2; conn = hc; hostConn = hc;
              r2.onclose = () => { hc.open = false; if (mode === 'client' && conn === hc) emit('hostlost'); };
              r2.sub(base + '/c/' + cid);
              const say = () => { if (!done && conn === hc) { hc.send(hello()); setTimeout(say, 4000); } };   // ส่งทักซ้ำจนกว่าเจ้าของห้องจะตอบ
              setTimeout(say, 400);
            }).catch(() => tryUrl(i + 1));
          };
          tryUrl(0);
        }).catch(() => { /* เครื่องนี้ใช้ทางสำรองไม่ได้ รอหมดเวลา */ });
      };
      if (opt.relayOnly || !available()) { startRelay(); return; }
      peer = new root.Peer({ debug: 1, config: iceConfig() });
      peer.on('error', e => { if (relayOK()) startRelay(); else fail(errText(e)); });
      const attempt = () => {
        if (done || relayOn) return;
        tries++;
        if (conn) { try { conn.close(); } catch (e) { /* ปิดแล้ว */ } }
        status(tries === 1 ? 'กำลังเชื่อมต่อห้อง ' + code + '…' : 'ยังต่อไม่ติด กำลังลองใหม่ (' + tries + '/3)… ให้เจ้าของห้องเปิดหน้าเกมค้างไว้');
        const c = peer.connect(PREFIX + code, { reliable: true });
        conn = c; hostConn = c;
        c.on('open', () => { if (conn === c && !done) { clearTimeout(relayT); send(c, hello()); } });
        wire(c);
        if (tries < 3 && !relayOK()) retryT = setTimeout(attempt, 14000);
      };
      peer.on('open', attempt);
      if (relayOK()) relayT = setTimeout(startRelay, 10000);
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
    if (mode === 'host' && rConns.size) { const now = Date.now(); rConns.forEach(vc => { if (now - vc.last > 20000) vc.close(); }); }   // ผู้เล่นทางสำรองเงียบเกิน 20 วินาที = หลุด
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
        tPos = relayMode ? 0.2 : 0.07;                 // ทางสำรองส่งตำแหน่งห่างขึ้น
        const P = Sim.P;
        send(hostConn, { t: 'pos', x: Math.round(P.x), y: Math.round(P.y), dir: P.dir, mv: P.moving ? 1 : 0 });
      }
      if (relayMode && !lostSent && Date.now() - lastHost > 15000) { lostSent = true; emit('hostlost'); }
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
