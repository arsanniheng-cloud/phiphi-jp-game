// ============================================================================
// dialogue.js — บทพูดของ NPC (แก้/เพิ่มประโยคได้ที่นี่)
// ตัวแปรในประโยค: {me}=ชื่อเรียกผู้เล่น  {detail}=เรื่องที่เกิด  {about}=ชื่อเพื่อนที่เล่าต่อ
//                 {ppe}=อุปกรณ์ PPE  {topic}=หัวข้ออบรม  {hazard}=จุดอันตราย
// เขียนด้วยสรรพนาม "ผม/ครับ" ระบบจะเปลี่ยนเป็น "ฉัน/ค่ะ" ให้ตัวละครหญิงเอง
// band: 0 = ยังไม่ไว้ใจ (<35)  1 = ปกติ (35-64)  2 = ไว้ใจมาก (65+)
// ============================================================================
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.dialogue = {
  greet: [
    ['ครับ... มีอะไรหรือเปล่าครับ', 'ทำงานอยู่ครับ ไม่มีอะไรผิดปกติ', 'ครับ (ท่าทีระวังตัว)', 'จะมาตรวจอะไรอีกครับ'],
    ['สวัสดีครับ{me} วันนี้เดินตรวจหรือครับ', 'ทำงานตามปกติครับ', 'สวัสดีครับ มีอะไรให้ช่วยบอกได้เลย', 'วันนี้งานเยอะนิดหน่อยครับ'],
    ['{me}มาพอดีเลย! กำลังอยากคุยด้วย', 'สวัสดีครับ{me} เดี๋ยวผมเล่าให้ฟังว่าหน้างานเป็นยังไง', 'ทีมเราสบายใจเวลา{me}แวะมาครับ', 'ดีใจที่เจอ{me}ครับ']
  ],
  season: {
    High_Season: ['ไฮซีซันงานล้นมือเลยครับ แขกเต็มทุกวัน', 'เรือเข้าออกทั้งวัน แทบไม่ได้พักเลยครับ', 'ช่วงนี้รีบไปหมด ผมกลัวพลาดเหมือนกัน'],
    Low_Season: ['มรสุมเข้า ฝนตกทั้งวัน พื้นลื่นไปหมดครับ', 'แขกน้อย แต่งานซ่อมเยอะ ผู้รับเหมาเข้าออกตลอด', 'คลื่นแรงมาก เรือออกยากครับ']
  },
  migrant: ['ภาษาไทยผมยังไม่เก่ง {me}พูดช้าๆ ได้ไหมครับ', 'ถ้ามีป้ายภาษาพม่าด้วย ผมจะเข้าใจง่ายขึ้นครับ'],
  // ความทรงจำ (เลือกจากความสำคัญสูงสุดก่อน)
  memory: {
    coach: ['ที่{me}สอนเรื่อง{detail} ผมเอาไปใช้ทุกวันเลยครับ', 'เรื่อง{detail}ที่{me}อธิบาย ผมเข้าใจแล้วครับ'],
    stop_pos: ['วันที่{me}สั่งหยุดงานเรื่อง{detail} ตอนแรกหงุดหงิด แต่ตอนนี้เข้าใจแล้วครับ'],
    stop_neg: ['ที่{me}สั่งหยุดงานเรื่อง{detail} หัวหน้าบ่นผมทั้งวันเลยนะครับ'],
    car: ['ใบ CAR เรื่อง{detail} หัวหน้ากำลังตามของอยู่ครับ'],
    car_ok: ['เรื่อง{detail}ที่{me}ออก CAR ไว้ แก้เสร็จแล้วนะครับ'],
    car_fail: ['CAR เรื่อง{detail}ยังไม่เสร็จเลยครับ งบยังไม่ผ่าน'],
    ignored: ['เรื่อง{detail}ที่{me}เห็นวันก่อน ยังไม่มีใครมาแก้เลยนะครับ'],
    scold: ['{me}เคยตำหนิผมต่อหน้าเพื่อน... ผมยังจำได้อยู่ครับ'],
    praise: ['ที่{me}ชมทีมเราวันก่อน ทุกคนดีใจกันมากครับ'],
    talk: ['คุยกับ{me}แล้วสบายใจดีครับ'],
    toolbox: ['เรื่อง{detail}ที่{me}สอน ผมเล่าให้เพื่อนในกะฟังแล้ว'],
    incident: ['เรื่อง{detail}ที่เกิดขึ้น... ผมยังไม่หายตกใจเลยครับ'],
    heroic: ['ถ้าวันนั้น{me}ไม่มาหยุดงาน{detail}ไว้ ผมคงแย่ไปแล้ว ขอบคุณจริงๆ ครับ'],
    ppe_ok: ['ผมใส่{detail}ครบทุกวันนะครับ {me}ตรวจได้เลย'],
    ppe_remind: ['ตอนนี้ผมใส่{detail}ทุกครั้งแล้วนะครับ ไม่ต้องห่วง'],
    ptw_ok: ['ใบอนุญาตงาน{detail}ที่{me}มาตรวจหน้างาน ทำให้ทีมมั่นใจขึ้นครับ'],
    ptw_reject: ['งาน{detail}ที่{me}ไม่อนุมัติ หัวหน้าเลื่อนงานออกไป ผมโดนเร่งอยู่เลย'],
    seed: ['ผมยังจำได้นะครับ {detail}']
  },
  rumor: {
    coach: '{about}เล่าให้ฟังว่า{me}สอนงานดี ไม่ดุ',
    scold: '{about}เล่าว่า{me}ดุเขาต่อหน้าคนอื่น',
    stop: '{about}บอกว่า{me}สั่งหยุดงาน แต่ก็มีเหตุผล',
    ignored: '{about}บ่นว่าบอก{me}เรื่องอันตรายแล้วไม่เห็นแก้',
    incident: 'ได้ข่าวเรื่อง{about}บาดเจ็บ ทุกคนกังวลกันมาก',
    praise: '{about}อวดใหญ่เลยว่า{me}ชม',
    heroic: '{about}เล่าว่า{me}ช่วยเขาไว้ทัน'
  },
  ppe_ok: ['ใส่ครบครับ {ppe} พร้อม', 'ครบครับ เช็กก่อนเข้ากะทุกวัน'],
  ppe_missing: ['เอ่อ... วันนี้ลืม{ppe}ไว้ที่ล็อกเกอร์ครับ', 'ของหมดครับ ยังไม่ได้เบิกใหม่', 'ใส่แล้วร้อนครับ เลยถอดไว้แป๊บนึง'],
  ppe_none: ['งานผมไม่ต้องใช้ PPE เฉพาะครับ แต่ต้องยืนและยกของบ่อย'],
  praise_first: ['ขอบคุณครับ{me}! มีกำลังใจขึ้นเยอะเลย', 'จริงหรือครับ ดีใจมากเลย', 'ขอบคุณที่สังเกตนะครับ'],
  praise_again: ['ครับ... {me}ชมไปแล้วนะวันนี้ (ยิ้มแห้ง)'],
  toolbox_ok: ['ได้ครับ เรื่อง{topic} ผมจะบอกเพื่อนในกะต่อ', 'เข้าใจแล้วครับ ไม่เคยรู้มาก่อนว่าอันตรายขนาดนี้'],
  toolbox_again: ['วันนี้{me}สอนไปแล้วครับ ขอไปทำงานก่อนนะครับ'],
  scold: [['...ครับ (ก้มหน้า ไม่พูดต่อ)'], ['ผมขอโทษครับ แต่{me}พูดต่อหน้าคนอื่นแบบนี้ ผมเสียหน้านะ'], ['ครับ ผมผิดเอง... แต่คราวหน้าคุยกันส่วนตัวได้ไหมครับ']],
  story_locked: 'ยังไม่สนิทพอจะเล่าเรื่องส่วนตัวครับ',
  story: 'บ้านผมอยู่{origin} ทำงานที่นี่มา {years} ปีแล้วครับ {motive}',
  hint: ['{me}ครับ ผมว่า{hazard} น่ากลัวนะ ไปดูหน่อยได้ไหม', 'เมื่อกี้ผมเห็น{hazard} บอก{me}ไว้ก่อนครับ'],
  hurt: ['โอย... เจ็บอยู่ครับ', 'ขอนั่งพักก่อนนะครับ'],
  traits: {
    'ขี้เล่น': [' 555', ' วันนี้ทะเลสวยเนอะ'],
    'ขี้อาย': [' (ยิ้มเขินๆ)'],
    'จริงจัง': [' งานต้องเสร็จตามเวลาครับ'],
    'ขี้บ่น': [' แต่คนไม่พอเลยนะครับ', ' แดดร้อนจะตาย'],
    'ใจดี': [' {me}กินข้าวหรือยังครับ']
  },
  guest: {
    greet: ['Hello! รีสอร์ตสวยมากเลย', 'ทะเลที่นี่ใสมาก!', 'พรุ่งนี้จะไปอ่าวมาหยา', 'ขอบคุณที่ดูแลนะ'],
    careless: ['ไม่ต้องห่วง ฉันว่ายน้ำเก่ง!', 'ป้ายเตือน? ไม่เห็นเลยนะ'],
    drunk_swimmer: ['เบียร์อีกขวดแล้วจะลงทะเล!', 'คืนนี้จะว่ายน้ำดูดาว~'],
    rule_breaker: ['กฎเยอะจัง ขอนิดเดียวเอง', 'ไม่มีใครเห็นหรอก'],
    advised: ['โอเค เข้าใจแล้ว ขอบคุณที่บอกนะ', 'จริงด้วย จะระวังมากขึ้น']
  }
};

// ตารางแปลงประเภทความทรงจำในเกม -> event_category ในตาราง npc_memories
// emotional_impact (-100..100) และ importance_level (1-5) ใช้เลือกความทรงจำ Top-K มาพูด
GAME_DATA.memory_types = {
  coach:      { event_category: 'safety_inspection', emotional_impact: 20,  importance_level: 3 },
  stop:       { event_category: 'safety_inspection', emotional_impact: 0,   importance_level: 3 },
  heroic:     { event_category: 'heroic_act',        emotional_impact: 60,  importance_level: 5 },
  car:        { event_category: 'rule_violation',    emotional_impact: -5,  importance_level: 2 },
  car_ok:     { event_category: 'safety_inspection', emotional_impact: 15,  importance_level: 2 },
  car_fail:   { event_category: 'rule_violation',    emotional_impact: -15, importance_level: 3 },
  ignored:    { event_category: 'safety_inspection', emotional_impact: -20, importance_level: 3 },
  scold:      { event_category: 'punishment',        emotional_impact: -40, importance_level: 4 },
  praise:     { event_category: 'recognition',       emotional_impact: 25,  importance_level: 2 },
  talk:       { event_category: 'personal_talk',     emotional_impact: 10,  importance_level: 1 },
  toolbox:    { event_category: 'training',          emotional_impact: 15,  importance_level: 2 },
  incident:   { event_category: 'accident',          emotional_impact: -60, importance_level: 5 },
  ppe_ok:     { event_category: 'safety_inspection', emotional_impact: 5,   importance_level: 1 },
  ppe_remind: { event_category: 'rule_violation',    emotional_impact: -5,  importance_level: 2 },
  ptw_ok:     { event_category: 'safety_inspection', emotional_impact: 10,  importance_level: 2 },
  ptw_reject: { event_category: 'safety_inspection', emotional_impact: -15, importance_level: 2 },
  rumor:      { event_category: 'rumor',             emotional_impact: 0,   importance_level: 1 },
  seed:       { event_category: 'safety_inspection', emotional_impact: 0,   importance_level: 3 }
};
