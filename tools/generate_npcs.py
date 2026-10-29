# -*- coding: utf-8 -*-
"""
สร้างไฟล์ data/npcs.js (ตาราง resort_npcs) — พนักงานสมมติ 204 คน
ชื่อทั้งหมดเป็นชื่อสมมติ ไม่ใช่พนักงานจริง

วิธีรัน (บนเครื่องนี้ให้รันผ่าน runpy):
  python -c "import runpy; runpy.run_path(r'tools/generate_npcs.py', run_name='__main__')"
"""
import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'data', 'npcs.js')

rng = random.Random(2026)

# แผนก: (id, code_prefix_for_npc_code, short, headcount, work_location_id, roles)
DEPTS = [
    (1, 'FO', 'ส่วนหน้า', 14, 'lobby', ['พนักงานต้อนรับ', 'พนักงานยกกระเป๋า', 'แคชเชียร์', 'เจ้าหน้าที่ประสานงานแขก']),
    (2, 'FB', 'ห้องอาหาร', 28, 'restaurant', ['พนักงานเสิร์ฟ', 'บาร์เทนเดอร์', 'หัวหน้าห้องอาหาร', 'พนักงานบัฟเฟต์']),
    (3, 'KIT', 'ครัว', 26, 'kitchen', ['เชฟ', 'ผู้ช่วยเชฟ', 'พนักงานล้างจาน', 'พนักงานเตรียมวัตถุดิบ']),
    (4, 'HK', 'แม่บ้าน', 36, 'housekeeping', ['แม่บ้านห้องพัก', 'พนักงานทำความสะอาดพื้นที่ส่วนกลาง', 'หัวหน้าแม่บ้าน', 'พนักงานมินิบาร์']),
    (5, 'LAU', 'ซักรีด', 12, 'laundry', ['พนักงานซักผ้า', 'พนักงานรีดผ้า', 'พนักงานคัดแยกผ้า']),
    (6, 'ENG', 'ช่าง', 22, 'engineering', ['ช่างไฟฟ้า', 'ช่างประปา', 'ช่างแอร์', 'ช่างเชื่อม', 'ช่างไม้', 'ช่างเครื่องกำเนิดไฟฟ้า']),
    (7, 'LAND', 'สวน', 14, 'nursery', ['คนสวน', 'พนักงานตัดแต่งต้นไม้', 'พนักงานเก็บขยะชายหาด']),
    (8, 'SEC', 'รปภ.', 10, 'security', ['พนักงานรักษาความปลอดภัย', 'หัวหน้า รปภ.']),
    (9, 'BOAT', 'เรือ', 14, 'pier', ['กัปตันเรือสปีดโบ๊ท', 'คนขับเรือหางยาว', 'ลูกเรือ', 'พนักงานท่าเรือ']),
    (10, 'SPA', 'สปา', 12, 'spa', ['นักบำบัด', 'พนักงานต้อนรับสปา', 'พนักงานเตรียมห้องสปา']),
    (11, 'RESCUE', 'กู้ภัย', 8, 'lifeguard', ['ไลฟ์การ์ด', 'เจ้าหน้าที่กู้ภัย', 'เจ้าหน้าที่ปฐมพยาบาล']),
    (12, 'ACT', 'กิจกรรม', 8, 'activity', ['ไกด์สโนร์เกิล', 'พนักงานให้เช่าเรือคายัค', 'ครูสอนดำน้ำ']),
]

# NPC หลักจากข้อมูลตัวอย่างใน schema ของผู้ใช้ (id 1-3 ต้องตรงกับ seed_memories)
KEY_NPCS = [
    dict(id=1, npc_code='NPC_ENG_001', name='สมชาย สายไฟ', nickname='ช่างชาย', gender='M', age=48,
         job_role='หัวหน้าช่างไฟฟ้าประจำรีสอร์ต', department_id=6, work_location_id='engineering',
         personality_trait='ใจดี',
         personality_prompt='ช่างไฟประสบการณ์สูง ชอบลืมใส่ถุงมือกันไฟฟ้า แต่ใจดีและเคารพ จป.',
         safety_compliance_score=80, trust_in_player=70, origin='นครศรีธรรมราช',
         motive='ส่งลูกเรียนมหาวิทยาลัย', years_at_resort=15),
    dict(id=2, npc_code='NPC_BOAT_001', name='บังดล คนขับเรือ', nickname='บังดล', gender='M', age=41,
         job_role='กัปตันเรือสปีดโบ๊ทนำเที่ยว', department_id=9, work_location_id='pier',
         personality_trait='ขี้เล่น',
         personality_prompt='คนท้องถิ่นอารมณ์ดี ขับเรือเก่ง ชอบแอบพาคนเกินจำนวนเรือถ้าช่วง High Season',
         safety_compliance_score=70, trust_in_player=50, origin='เกาะพีพี',
         motive='อยากมีเรือเป็นของตัวเอง', years_at_resort=12),
    dict(id=3, npc_code='NPC_RESCUE_001', name='มะนาว กู้ภัย', nickname='มะนาว', gender='F', age=29,
         job_role='เจ้าหน้าที่กู้ภัยและไลฟ์การ์ด', department_id=11, work_location_id='lifeguard',
         personality_trait='จริงจัง',
         personality_prompt='เข้มงวดเรื่องความปลอดภัยทางน้ำ ตื่นตัวตลอดเวลา ชื่นชม จป.วิชาชีพ มาก',
         safety_compliance_score=95, trust_in_player=85, origin='กระบี่',
         motive='ฝันอยากเป็นครูสอนกู้ภัยทางน้ำ', years_at_resort=5),
]

MALE_FIRST = ['ประเสริฐ', 'วิชัย', 'สุริยา', 'อนุชา', 'ธนากร', 'ณัฐพล', 'กิตติพงษ์', 'ชัยวัฒน์', 'สมศักดิ์', 'อดิศร',
              'ปิยะพงษ์', 'จักรพันธ์', 'ศุภชัย', 'ธีรวัฒน์', 'วรวุฒิ', 'เอกชัย', 'อำนาจ', 'บุญมี', 'สุรชัย', 'ภาณุ',
              'พงศกร', 'นพดล', 'ยุทธนา', 'สราวุธ', 'เกียรติศักดิ์', 'ทรงศักดิ์', 'มานพ', 'สุเมธ', 'อภิชาติ', 'อัสมัน',
              'ยูโสบ', 'รอฮีม', 'ฮาซัน', 'อิสมาแอ', 'ธวัชชัย', 'ชาตรี', 'วีระพงษ์', 'ประยุทธ', 'สมบัติ', 'พิชิต']
FEMALE_FIRST = ['สุดารัตน์', 'กาญจนา', 'วิไลวรรณ', 'ปิยะนุช', 'อรอุมา', 'จันทร์เพ็ญ', 'สุนิสา', 'พรทิพย์', 'รัตนา', 'นงลักษณ์',
                'ศิริพร', 'มาลัย', 'ชไมพร', 'ธิดารัตน์', 'กมลวรรณ', 'เบญจวรรณ', 'ณัฐธิดา', 'สายสุนีย์', 'อัมพร', 'วรรณา',
                'ปวีณา', 'จิราพร', 'สุภาพร', 'ลำดวน', 'บุษบา', 'ดวงใจ', 'อุไรวรรณ', 'ทิพวรรณ', 'นันทนา', 'ศศิธร',
                'ฟาตีมะห์', 'ซารีนา', 'นูรีซัน', 'อามีเนาะ', 'ปาริชาติ', 'กัลยา', 'สมใจ', 'ยุพิน', 'เกศินี', 'ละเอียด']
SURNAMES = ['ทองดี', 'ศรีสุข', 'แก้วมณี', 'บุญมา', 'ใจดี', 'สุขสวัสดิ์', 'ทะเลงาม', 'หาดทราย', 'นาคสุวรรณ', 'แสงทอง',
            'อินทร์แก้ว', 'เพชรรัตน์', 'ชูช่วย', 'หมัดหลี', 'หลีหมัด', 'บินหมัด', 'เต็มหลง', 'ดำริห์', 'ขาวสะอาด', 'พรหมทอง',
            'จันทร์หอม', 'รักษ์ทะเล', 'ทองคำ', 'ศรีวิชัย', 'มณีรัตน์', 'คงสมบูรณ์', 'ชัยมงคล', 'สองเมือง', 'ปานทอง', 'วงศ์สวัสดิ์']
MALE_NICK = ['เอก', 'บอล', 'ต้น', 'แบงค์', 'โอ๊ต', 'เบียร์', 'กอล์ฟ', 'ต้อม', 'นัท', 'ภูมิ', 'ปอนด์', 'เจมส์', 'ไผ่', 'ตี๋',
             'ชาติ', 'แมน', 'บิ๊ก', 'เก่ง', 'หนึ่ง', 'ก้อง', 'โจ้', 'บอย', 'ต่อ', 'เต้', 'ยอด', 'วุฒิ', 'ดำ', 'หมาก',
             'ฟลุ๊ค', 'โบ๊ท', 'ปิง', 'ซัน', 'นิว', 'เพชร', 'ทอม', 'อั๋น', 'เด่น', 'ป๊อป', 'ฟาร์', 'มัน']
FEMALE_NICK = ['ฝน', 'ปลา', 'ฟ้า', 'แป้ง', 'มด', 'นุ่น', 'ปู', 'อ้อม', 'หนิง', 'ยุ้ย', 'แอน', 'จอย', 'เมย์', 'บี', 'น้ำ',
               'ฝ้าย', 'กิ๊ฟ', 'มิ้นท์', 'ส้ม', 'แตง', 'นก', 'ติ๊ก', 'อร', 'ดาว', 'เพ็ญ', 'นิด', 'หน่อย', 'แพร', 'ใบเตย',
               'ขวัญ', 'ปุ้ย', 'จูน', 'ออย', 'ตาล', 'เปิ้ล', 'ดา', 'กุ้ง', 'ต่าย', 'ยา', 'นะ']
MIGRANT_M = ['ซอ ทุน', 'มิน ลวิน', 'จ่อ ซวา', 'อ่อง เมียต', 'เต็ง ลิน', 'ทุน ทุน', 'ซาย ลา', 'ญาณ เนียง']
MIGRANT_F = ['ซู ซู', 'โม โม', 'ทันดา', 'เอ เอ', 'นิลาร์', 'ขิ่น เมียว', 'ทิดา', 'เอ มา']

ORIGINS = ['เกาะพีพี'] * 3 + ['กระบี่'] * 5 + ['ตรัง'] * 3 + ['พังงา'] * 2 + ['ภูเก็ต'] * 2 + ['นครศรีธรรมราช'] * 3 + \
          ['สุราษฎร์ธานี'] * 2 + ['สตูล', 'ชุมพร', 'พัทลุง', 'ขอนแก่น', 'อุดรธานี', 'ร้อยเอ็ด', 'เชียงราย', 'กรุงเทพฯ']
MOTIVES = ['ส่งเงินให้แม่ทุกเดือน', 'เก็บเงินเปิดร้านของตัวเอง', 'ส่งลูกเรียน', 'ชอบทะเลเลยมาทำงานที่นี่',
           'ตามแฟนมาทำงาน', 'กำลังผ่อนมอเตอร์ไซค์', 'อยากฝึกภาษาอังกฤษกับแขก', 'เก็บเงินสร้างบ้านให้พ่อแม่',
           'ชอบงานบริการ', 'อยากเป็นหัวหน้างานให้ได้ภายใน 3 ปี']
TRAITS = ['ขี้เล่น', 'ขี้อาย', 'จริงจัง', 'ขี้บ่น', 'ใจดี']
MIGRANT_DEPTS = {3, 4, 5, 7, 6}


def compliance_phrase(score):
    if score < 65:
        return 'มักลัดขั้นตอนเมื่องานเร่ง'
    if score < 85:
        return 'ทำตามกฎเป็นส่วนใหญ่ แต่ละเลยบ้างเวลางานเร่ง'
    return 'เคร่งครัดเรื่องความปลอดภัย'


def look_for(gender, age, migrant):
    skin = rng.choice([0, 1, 1, 2, 2, 3]) if not migrant else rng.choice([1, 2, 2, 3])
    if gender == 'M':
        style = rng.choice([0, 0, 0, 4, 4, 1])
    else:
        style = rng.choice([1, 2, 2, 3, 3])
    hair = rng.choice([0, 0, 0, 1, 1, 2])
    if age >= 50 and rng.random() < 0.5:
        hair = 5
    return {'skin': skin, 'hair': hair, 'hair_style': style}


def main():
    rows = []
    used_ids = {k['id'] for k in KEY_NPCS}
    next_id = 4
    counters = {}
    for k in KEY_NPCS:
        prefix = k['npc_code'].split('_')[1]
        counters[prefix] = 1
        row = dict(k)
        row.update(shift='M', low_season_active=True,
                   look=look_for(k['gender'], k['age'], False), friend_id=None)
        rows.append(row)

    key_by_dept = {}
    for k in KEY_NPCS:
        key_by_dept[k['department_id']] = key_by_dept.get(k['department_id'], 0) + 1

    for (dep_id, prefix, short, headcount, loc, roles) in DEPTS:
        used_nicks = set()
        need = headcount - key_by_dept.get(dep_id, 0)
        for i in range(need):
            migrant = dep_id in MIGRANT_DEPTS and rng.random() < 0.12
            gender = rng.choice('MF')
            if dep_id in (4, 10):           # แม่บ้าน/สปา ผู้หญิงมากกว่า
                gender = 'F' if rng.random() < 0.8 else 'M'
            if dep_id in (6, 8, 9):         # ช่าง/รปภ./เรือ ผู้ชายมากกว่า
                gender = 'M' if rng.random() < 0.85 else 'F'
            age = rng.randint(19, 56)
            role = roles[0] if i % 3 != 2 else rng.choice(roles)
            if i == 0 and any(r.startswith('หัวหน้า') for r in roles):
                role = [r for r in roles if r.startswith('หัวหน้า')][0]
                age = max(age, 38)
            if migrant:
                full = rng.choice(MIGRANT_M if gender == 'M' else MIGRANT_F)
                nick = full.split(' ')[0]
                origin = 'เมียนมา (แรงงาน MOU)'
            else:
                first = rng.choice(MALE_FIRST if gender == 'M' else FEMALE_FIRST)
                full = first + ' ' + rng.choice(SURNAMES)
                pool = [n for n in (MALE_NICK if gender == 'M' else FEMALE_NICK) if n not in used_nicks]
                nick = rng.choice(pool) if pool else rng.choice(MALE_NICK if gender == 'M' else FEMALE_NICK)
                origin = rng.choice(ORIGINS)
            used_nicks.add(nick)
            trait = rng.choice(TRAITS)
            score = max(45, min(98, int(rng.gauss(76, 11))))
            years = rng.randint(0, min(20, max(0, age - 18)))
            motive = rng.choice(MOTIVES)
            counters[prefix] = counters.get(prefix, 0) + 1
            gword = 'ชาย' if gender == 'M' else 'หญิง'
            prompt = (f'{nick} ({gword} อายุ {age}) ตำแหน่ง{role} แผนก{short} นิสัย{trait} บ้านอยู่{origin} '
                      f'ทำงานที่รีสอร์ตมา {years} ปี {motive} {compliance_phrase(score)}')
            while next_id in used_ids:
                next_id += 1
            rows.append({
                'id': next_id,
                'npc_code': f'NPC_{prefix}_{counters[prefix]:03d}',
                'name': full,
                'nickname': nick,
                'gender': gender,
                'age': age,
                'job_role': role,
                'department_id': dep_id,
                'work_location_id': loc,
                'shift': 'M' if i % 2 == 0 else 'A',
                'personality_trait': trait,
                'personality_prompt': prompt,
                'safety_compliance_score': score,
                'trust_in_player': max(25, min(70, int(rng.gauss(48, 9)))),
                'origin': origin,
                'motive': motive,
                'years_at_resort': years,
                'low_season_active': rng.random() < 0.72,
                'look': look_for(gender, age, migrant),
                'friend_id': None
            })
            used_ids.add(next_id)
            next_id += 1

    # เพื่อนสนิทในแผนกเดียวกัน
    by_dept = {}
    for r in rows:
        by_dept.setdefault(r['department_id'], []).append(r)
    for dep, members in by_dept.items():
        for r in members:
            others = [m for m in members if m['id'] != r['id']]
            r['friend_id'] = rng.choice(others)['id'] if others else None

    rows.sort(key=lambda r: r['id'])
    assert len(rows) == 204, len(rows)

    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// ============================================================================\n')
        f.write('// npcs.js — ตาราง resort_npcs: พนักงานสมมติ 204 คน (สร้างจาก tools/generate_npcs.py)\n')
        f.write('// ชื่อทั้งหมดเป็นชื่อสมมติ  id 1-3 คือ NPC หลักจากข้อมูลตัวอย่างใน schema\n')
        f.write('// shift: M = กะเช้า 06-15 น.  A = กะบ่าย 14-22 น.\n')
        f.write('// ============================================================================\n')
        f.write('window.GAME_DATA = window.GAME_DATA || {};\n\n')
        f.write('GAME_DATA.npcs = [\n')
        for i, r in enumerate(rows):
            f.write('  ' + json.dumps(r, ensure_ascii=False) + (',\n' if i < len(rows) - 1 else '\n'))
        f.write('];\n')
    print('wrote', OUT, len(rows), 'npcs')


if __name__ == '__main__':
    main()
