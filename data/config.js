// ============================================================================
// config.js — ค่าตั้งค่าเกมและสมดุลเกม (ตรงกับตาราง tourist_seasons ใน db/schema.sql)
// แก้ตัวเลขที่นี่ได้เลย ไม่ต้องแตะโค้ดเกม
// ============================================================================
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.config = {
  schema_version: 1,
  world: { width: 2400, height: 1600, mask_scale: 4 },

  // เล่นออนไลน์: เซิร์ฟเวอร์ช่วยหาเส้นทาง (STUN) และทางสำรองส่งต่อข้อมูล (TURN)
  // เซิร์ฟเวอร์ TURN ฟรีของ PeerJS ปิดไปแล้ว ถ้าไม่มี TURN สองเครื่องต่างเครือข่าย (เช่น 4G กับ WiFi) อาจต่อกันไม่ได้
  // ใส่ TURN ของบริการที่สมัครไว้ได้ที่ online_turn เช่น { urls: ['turn:…:80', 'turns:…:443?transport=tcp'], username: '…', credential: '…' }
  online_stun: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'],
  online_turn: [],
  // ทางสำรองเมื่อต่อตรงไม่ติด: ส่งต่อข้อความผ่านเซิร์ฟเวอร์ MQTT สาธารณะ (WebSocket) ข้อมูลเข้ารหัสด้วยรหัสห้องก่อนส่งเสมอ
  // เจ้าของห้องฟังทุกตัวพร้อมกัน ผู้ร่วมเล่นใช้ตัวแรกที่ต่อติด · ถ้าแก้รายการนี้ต้องแก้ connect-src ใน index.html ด้วย
  online_relay: ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'],

  time: {
    start_hour: 6,            // เริ่มกะเช้า 06:00
    end_hour: 22,             // สรุปผลประจำวัน 22:00
    game_minutes_per_second: 2.4,   // 1 วันในเกม ≈ 6.5 นาทีจริง
    start_date: '2026-11-01'  // วันแรกในเกม (พ.ย. = ไฮซีซัน) ฤดูกาลคิดจากเดือนตามปฏิทินจริง
  },

  // ตาราง tourist_seasons — เดือนที่ใช้เป็นค่าประมาณของฝั่งอันดามัน
  tourist_seasons: [
    {
      id: 1, season_name: 'High_Season', label: 'ไฮซีซัน',
      season_description: 'นักท่องเที่ยวเต็มเกาะ เรือเข้าออกทั้งวัน งานบริการเร่ง',
      months: [10, 11, 0, 1, 2, 3],
      tourist_density_multiplier: 2.5,
      weather_condition: 'sunny',
      sea_wave_height_meters: 0.8,
      guests_in_house: 150,        // ผู้เข้าพัก (สมมติ แก้ตามจริง)
      guest_sprites: 56,           // จำนวนแขกที่วาดบนจอ
      staff_active_ratio: 1.0,
      hazard_spawn_seconds: 30,
      ops_cost_multiplier: 1.4,    // หยุดงานช่วงแขกเต็ม กระทบบริการมากกว่า
      fuse_multiplier: 0.85
    },
    {
      id: 2, season_name: 'Low_Season', label: 'โลว์ซีซัน (มรสุม)',
      season_description: 'ฝนตกหนัก คลื่นลมแรง แขกน้อย เน้นงานซ่อมบำรุงและผู้รับเหมา',
      months: [4, 5, 6, 7, 8, 9],
      tourist_density_multiplier: 0.4,
      weather_condition: 'heavy_storm',
      sea_wave_height_meters: 3.2,
      guests_in_house: 40,
      guest_sprites: 16,
      staff_active_ratio: 0.7,
      hazard_spawn_seconds: 40,
      ops_cost_multiplier: 1.0,
      fuse_multiplier: 1.05
    }
  ],

  fuse_by_severity: { 1: 300, 2: 260, 3: 220, 4: 180 },   // วินาทีจริงก่อนเกิดเหตุ
  max_open_hazards: 7,
  near_miss_chance: 0.45,     // หมดเวลาครั้งแรก มีโอกาสเป็น "เกือบเกิดเหตุ" และได้แก้อีกรอบ
  severity_names: { 1: 'ต่ำ', 2: 'ปานกลาง', 3: 'สูง', 4: 'สูงมาก' },
  injury_names: { 1: 'ปฐมพยาบาล', 2: 'ต้องพบแพทย์', 3: 'บาดเจ็บถึงขั้นหยุดงาน', 4: 'บาดเจ็บสาหัส' },

  metrics_start: { ops: 80, guest_sat: 85, mgmt: 70 },
  game_over: { serious_incidents: 3 },

  // ผลของการตัดสินใจของ จป. แยกตามลักษณะอันตราย
  //  equip = ต้องแก้ที่อุปกรณ์/สภาพ   behav = พฤติกรรมคน   env = สภาพพื้นที่ชั่วคราว
  actions: {
    equip: {
      stop:  { resolve: true,  trust: 2,  ops: 6 },
      coach: { resolve: false, sev_down: 1, trust: 1, ops: 1 },
      car:   { resolve: false, sev_down: 1, car: true, trust: 0, ops: 1 }
    },
    behav: {
      stop:  { resolve: true,  trust: -4, ops: 5 },
      coach: { resolve: true,  trust: 5,  ops: 2, know: 4 },
      car:   { resolve: false, sev_down: 1, car: true, trust: -1, ops: 1 }
    },
    env: {
      stop:  { resolve: true,  trust: 1,  ops: 4 },
      coach: { resolve_if_sev_at_most: 2, sev_down: 1, trust: 2, ops: 2 },
      car:   { resolve: false, sev_down: 1, car: true, trust: 0, ops: 1 }
    }
  },
  car_days: 2,
  car_fuse_slowdown: 0.35,

  ppe_missing_chance: 0.25,
  report_every_seconds: 10,
  ptw_every_seconds: 70,          // คำขอใบอนุญาตทำงาน (เฉพาะโลว์ซีซันถี่กว่า)
  player_speed: 165,
  npc_speed: 28,
  guest_speed: 20
};
