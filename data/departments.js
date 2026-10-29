// ============================================================================
// departments.js — ตาราง departments (แผนก) รวมพนักงาน 204 คน
// headcount แต่ละแผนกเป็นตัวเลขสมมติ แก้ให้ตรงกับรายชื่อจริงได้ (ผลรวมควรเท่ากับ 204)
// uniform = ชุดที่ใช้วาดตัวละคร
// ============================================================================
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.departments = [
  {
    id: 1, code: 'FO', name: 'ส่วนหน้า (Front Office)', short: 'ส่วนหน้า', headcount: 14,
    color: '#14a5bd', work_location_id: 'lobby',
    roles: ['พนักงานต้อนรับ', 'พนักงานยกกระเป๋า', 'แคชเชียร์', 'เจ้าหน้าที่ประสานงานแขก'],
    ppe: null, toolbox: 'การยกกระเป๋าหนักและทางลาดชัน',
    uniform: { shirt: '#1aa9c0', pants: '#26324a', trim: '#f2d16b', hat: null }
  },
  {
    id: 2, code: 'FB', name: 'ห้องอาหารและเครื่องดื่ม (F&B)', short: 'ห้องอาหาร', headcount: 28,
    color: '#f2a20c', work_location_id: 'restaurant',
    roles: ['พนักงานเสิร์ฟ', 'บาร์เทนเดอร์', 'หัวหน้าห้องอาหาร', 'พนักงานบัฟเฟต์'],
    ppe: 'รองเท้ากันลื่น', toolbox: 'การถือถาดและทางเดินเปียก',
    uniform: { shirt: '#fbfbf7', pants: '#22252b', vest: '#2a2d34', trim: '#c9a227', hat: null }
  },
  {
    id: 3, code: 'KIT', name: 'ครัว (Kitchen)', short: 'ครัว', headcount: 26,
    color: '#ff7a3d', work_location_id: 'kitchen',
    roles: ['เชฟ', 'ผู้ช่วยเชฟ', 'พนักงานล้างจาน', 'พนักงานเตรียมวัตถุดิบ'],
    ppe: 'ถุงมือกันบาดและรองเท้ากันลื่น', toolbox: 'ก๊าซ LPG และพื้นลื่นในครัว',
    uniform: { shirt: '#ffffff', pants: '#3b3f46', apron: '#e9e4da', trim: '#222', hat: 'chef' }
  },
  {
    id: 4, code: 'HK', name: 'แม่บ้าน (Housekeeping)', short: 'แม่บ้าน', headcount: 36,
    color: '#e0559a', work_location_id: 'housekeeping',
    roles: ['แม่บ้านห้องพัก', 'พนักงานทำความสะอาดพื้นที่ส่วนกลาง', 'หัวหน้าแม่บ้าน', 'พนักงานมินิบาร์'],
    ppe: 'ถุงมือยางและรองเท้ากันลื่น', toolbox: 'สารเคมีทำความสะอาดและการยกฟูก',
    uniform: { shirt: '#b49ad6', pants: '#5a4a86', apron: '#ffffff', trim: '#ffffff', hat: null }
  },
  {
    id: 5, code: 'LAU', name: 'ซักรีด (Laundry)', short: 'ซักรีด', headcount: 12,
    color: '#8c6ee6', work_location_id: 'laundry',
    roles: ['พนักงานซักผ้า', 'พนักงานรีดผ้า', 'พนักงานคัดแยกผ้า'],
    ppe: 'ถุงมือกันความร้อน', toolbox: 'ความร้อนและไฟฟ้าที่เครื่องรีด',
    uniform: { shirt: '#9c8cf0', pants: '#463c8c', trim: '#ffffff', hat: null }
  },
  {
    id: 6, code: 'ENG', name: 'ช่างซ่อมบำรุง (Engineering)', short: 'ช่าง', headcount: 22,
    color: '#3d63e0', work_location_id: 'engineering',
    roles: ['ช่างไฟฟ้า', 'ช่างประปา', 'ช่างแอร์', 'ช่างเชื่อม', 'ช่างไม้', 'ช่างเครื่องกำเนิดไฟฟ้า'],
    ppe: 'รองเท้านิรภัย แว่นตา และถุงมือ', toolbox: 'LOTO งานไฟฟ้า งานร้อน และงานบนที่สูง',
    uniform: { shirt: '#2f50c2', pants: '#2a468f', trim: '#e8f05a', hat: 'hardhat', hat_color: '#ffd23b' }
  },
  {
    id: 7, code: 'LAND', name: 'สวนและภูมิทัศน์ (Landscape)', short: 'สวน', headcount: 14,
    color: '#3fae49', work_location_id: 'nursery',
    roles: ['คนสวน', 'พนักงานตัดแต่งต้นไม้', 'พนักงานเก็บขยะชายหาด'],
    ppe: 'แว่นตาและรองเท้าบูท', toolbox: 'เครื่องตัดหญ้าและการตัดกิ่งไม้สูง',
    uniform: { shirt: '#4caf50', pants: '#4a3a24', trim: '#2e7d32', hat: 'ngob', hat_color: '#dcb66e' }
  },
  {
    id: 8, code: 'SEC', name: 'รักษาความปลอดภัย (Security)', short: 'รปภ.', headcount: 10,
    color: '#55627a', work_location_id: 'security',
    roles: ['พนักงานรักษาความปลอดภัย', 'หัวหน้า รปภ.'],
    ppe: 'วิทยุสื่อสารและไฟฉาย', toolbox: 'ทางหนีไฟและการตรวจตรากลางคืน',
    uniform: { shirt: '#33465c', pants: '#1c2632', trim: '#d9c27a', hat: 'cap', hat_color: '#1c2632' }
  },
  {
    id: 9, code: 'MAR', name: 'เรือรับส่ง (Marine Transport)', short: 'เรือ', headcount: 14,
    color: '#1c7ed6', work_location_id: 'pier',
    roles: ['กัปตันเรือสปีดโบ๊ท', 'คนขับเรือหางยาว', 'ลูกเรือ', 'พนักงานท่าเรือ'],
    ppe: 'เสื้อชูชีพ', toolbox: 'การขึ้นลงเรือ การเติมน้ำมัน และคลื่นลมแรง',
    uniform: { shirt: '#1c7ed6', pants: '#26324a', vest: '#ff6a00', trim: '#ffffff', hat: 'cap', hat_color: '#ffffff' }
  },
  {
    id: 10, code: 'SPA', name: 'สปา (Spa)', short: 'สปา', headcount: 12,
    color: '#14b39a', work_location_id: 'spa',
    roles: ['นักบำบัด', 'พนักงานต้อนรับสปา', 'พนักงานเตรียมห้องสปา'],
    ppe: 'รองเท้ากันลื่น', toolbox: 'พื้นลื่นจากน้ำมันนวดและความร้อน',
    uniform: { shirt: '#22c2a6', pants: '#0f6b5c', trim: '#f4e3b0', hat: null }
  },
  {
    id: 11, code: 'EHS', name: 'ความปลอดภัยและกู้ภัยทางน้ำ (Safety_EHS)', short: 'กู้ภัย', headcount: 8,
    color: '#e8443a', work_location_id: 'lifeguard',
    roles: ['ไลฟ์การ์ด', 'เจ้าหน้าที่กู้ภัย', 'เจ้าหน้าที่ปฐมพยาบาล'],
    ppe: 'นกหวีด ทุ่นช่วยชีวิต และวิทยุ', toolbox: 'การช่วยคนจมน้ำและการปฐมพยาบาล',
    uniform: { shirt: '#e8443a', pants: '#f2c94c', trim: '#ffffff', hat: 'cap', hat_color: '#f2c94c' }
  },
  {
    id: 12, code: 'ACT', name: 'กิจกรรมทางน้ำ (Water Activities)', short: 'กิจกรรม', headcount: 8,
    color: '#ff5d8f', work_location_id: 'activity',
    roles: ['ไกด์สโนร์เกิล', 'พนักงานให้เช่าเรือคายัค', 'ครูสอนดำน้ำ'],
    ppe: 'เสื้อชูชีพและนกหวีด', toolbox: 'สโนร์เกิล กระแสน้ำ และการนับจำนวนแขก',
    uniform: { shirt: '#ff5d8f', pants: '#1b263b', trim: '#ffd166', hat: 'cap', hat_color: '#ffd166' }
  }
  // ตาราง departments ใน SQL มีแถว Merchant และ Local_Resident สำรองไว้ (ยังไม่มีในเกม)
];
