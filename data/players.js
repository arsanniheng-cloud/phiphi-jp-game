// ============================================================================
// players.js — ตาราง players และความทรงจำตั้งต้น (npc_memories) จากข้อมูลตัวอย่าง
// ============================================================================
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.players = [
  {
    id: 1,
    username: 'arsan_safety',
    character_name: 'จป.ซัน',
    license_no: 'JPO-PRO-8899',
    current_reputation_score: 100,
    // ชื่อที่ NPC ใช้เรียก: อายุน้อยกว่า 45 เรียก "พี่ซัน" อายุมากกว่าเรียก "จป.ซัน"
    call_name_young: 'พี่ซัน',
    call_name_senior: 'จป.ซัน'
  }
];

// ความทรงจำตั้งต้นของ NPC หลัก (ย้ายมาจาก Mock Data ใน schema)
GAME_DATA.seed_memories = [
  { npc_id: 1, player_id: 1, type: 'seed', event_category: 'safety_inspection',
    memory_text: 'จป.ซัน เคยเข้ามาชี้แจงและมอบหมวกนิรภัยใบใหม่ให้ตอนซ่อมปั๊มน้ำ', emotional_impact: 50, importance_level: 5, game_day: -7 },
  { npc_id: 2, player_id: 1, type: 'seed', event_category: 'rule_violation',
    memory_text: 'จป.ซัน เคยออกใบตักเตือนเรื่องไม่จัดเสื้อชูชีพให้ครบตามจำนวนผู้โดยสาร', emotional_impact: -20, importance_level: 4, game_day: -3 }
];
