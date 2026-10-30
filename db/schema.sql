-- ==============================================================================
-- DATABASE SCHEMA: EHS SAFETY RESORT ISLAND (PHI PHI THEME)  — schema_version 1
-- ต่อยอดจากโครงสร้างที่ผู้ใช้ออกแบบ (players, resort_npcs, npc_memories,
-- tourist_seasons, dynamic_tourists, safety_incidents, jsa_permitting_logs)
--
-- สิ่งที่เปลี่ยน/เพิ่มจากฉบับเดิม
--  1) แผนกแยกเป็นตาราง departments (เดิมเป็น ENUM ซึ่งขาดครัว สปา สวน ส่วนหน้า รปภ.)
--     คอลัมน์ department_group เก็บค่ากลุ่มตาม ENUM เดิมไว้ให้เทียบได้
--  2) เพิ่มตาราง locations, buildings, hazard_types, day_reports
--  3) npc_memories เพิ่มหมวด recognition, training, rumor และเก็บวันในเกม (game_day)
--  4) safety_incidents ผูกกับ hazard_types/locations และเก็บระดับความรุนแรง
--  5) ใช้ id จากเกมโดยตรง (ไม่ AUTO_INCREMENT ในตารางหลัก) เพื่อให้ไฟล์ส่งออกจากเกมนำเข้าได้ตรง
--  6) players เพิ่ม gender และ look_json (หน้าตาที่ผู้เล่นเลือก)
--  7) เพิ่มตาราง safety_activities: แผนงานประจำวัน ประชุม คปอ. และอบรมพนักงาน
--     npc_memories เพิ่มหมวด meeting (ความทรงจำเรื่องประชุม คปอ./นัดที่ไม่ได้จัด)
--
-- ใช้กับ MySQL 5.7+ / MariaDB 10.3+ (XAMPP)  นำเข้าผ่าน phpMyAdmin > Import
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS ehs_resort_island
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ehs_resort_island;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS safety_activities, day_reports, jsa_permitting_logs, safety_incidents, dynamic_tourists,
  tourist_seasons, npc_memories, resort_npcs, hazard_types, buildings, locations, departments, players;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------------------
-- 1. ผู้เล่น / จป.วิชาชีพ
-- ------------------------------------------------------------------------------
CREATE TABLE players (
    id INT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    character_name VARCHAR(100) NOT NULL DEFAULT 'จป.ซัน',
    license_no VARCHAR(50) DEFAULT 'JPO-PRO-8899',            -- เลขทะเบียน จป.วิชาชีพ
    current_reputation_score INT DEFAULT 100,                 -- ความน่าเชื่อถือของ จป. (0-100)
    gender ENUM('M','F') NOT NULL DEFAULT 'M',
    look_json TEXT NULL,                                      -- หน้าตาที่เลือก {gender, skin, hair, hair_style, vest}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 2. แผนก (แทน ENUM department เดิม)
-- ------------------------------------------------------------------------------
CREATE TABLE departments (
    id INT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50) NOT NULL,
    department_group ENUM('Engineering','Marine_Transport','Housekeeping','F&B','Safety_EHS',
                          'Merchant','Local_Resident','Front_Office','Landscape','Security','Spa',
                          'Recreation') NOT NULL,
    headcount INT NOT NULL DEFAULT 0,                         -- จำนวนพนักงาน (รวมทุกแผนก = 204)
    work_location_id VARCHAR(40) NULL,
    ppe_required VARCHAR(255) NULL,
    toolbox_topic VARCHAR(255) NULL,
    color CHAR(7) NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 3. สถานที่ (จุดทำงาน/จุดเกิดเหตุ) และอาคารบนแผนที่
-- ------------------------------------------------------------------------------
CREATE TABLE locations (
    id VARCHAR(40) PRIMARY KEY,                               -- เช่น kitchen, pier, pool
    name VARCHAR(100) NOT NULL,
    x INT NOT NULL, y INT NOT NULL,                           -- พิกัดบนแผนที่เกม
    rx INT NOT NULL DEFAULT 20, ry INT NOT NULL DEFAULT 10    -- รัศมีพื้นที่ทำงาน
) ENGINE=InnoDB;

CREATE TABLE buildings (
    id VARCHAR(40) PRIMARY KEY,
    building_type VARCHAR(20) NOT NULL,                       -- villa, sala, boh, ...
    label VARCHAR(100) NOT NULL,
    x INT NOT NULL, y INT NOT NULL, w INT NOT NULL, d INT NOT NULL, h INT NOT NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 4. NPC ประจำเกาะ 204 คน
-- ------------------------------------------------------------------------------
CREATE TABLE resort_npcs (
    id INT PRIMARY KEY,
    npc_code VARCHAR(20) UNIQUE NOT NULL,                     -- เช่น NPC_ENG_001, NPC_BOAT_020
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    gender ENUM('M','F') NOT NULL,
    age TINYINT UNSIGNED,
    job_role VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,
    work_location_id VARCHAR(40) NOT NULL,
    shift ENUM('M','A') NOT NULL DEFAULT 'M',                 -- M = กะเช้า, A = กะบ่าย
    personality_trait VARCHAR(30),
    personality_prompt TEXT NOT NULL,                         -- คำอธิบายนิสัย (ใช้ส่งเข้า LLM ในอนาคต)
    safety_compliance_score INT DEFAULT 100,                  -- การปฏิบัติตามกฎ (0-100)
    trust_in_player INT DEFAULT 50,                           -- ความไว้ใจต่อ จป. (0-100)
    current_status ENUM('working','resting','injured','violating_rule') DEFAULT 'working',
    origin VARCHAR(100),
    motive VARCHAR(255),
    years_at_resort TINYINT UNSIGNED,
    friend_id INT NULL,
    low_season_active BOOLEAN DEFAULT TRUE,                   -- ทำงานช่วงโลว์ซีซันหรือไม่
    look_json TEXT,                                           -- ข้อมูลหน้าตาตัวละคร
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (work_location_id) REFERENCES locations(id),
    INDEX idx_department (department_id),
    INDEX idx_job (job_role)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 5. ความทรงจำของ NPC (Memory System — เลือก Top-K ตาม importance_level)
-- ------------------------------------------------------------------------------
CREATE TABLE npc_memories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    npc_id INT NOT NULL,
    player_id INT NOT NULL,
    event_category ENUM('safety_inspection','accident','rule_violation','personal_talk','heroic_act',
                        'punishment','recognition','training','rumor','meeting') NOT NULL,
    memory_type VARCHAR(20) NULL,                             -- ประเภทละเอียดในเกม เช่น coach, scold
    memory_text TEXT NOT NULL,
    emotional_impact INT DEFAULT 0,                           -- -100 ถึง +100
    importance_level INT DEFAULT 1,                           -- 1-5
    about_npc_id INT NULL,                                    -- กรณีข่าวลือ: เรื่องของใคร
    hazard_type_id INT NULL,
    game_day INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (npc_id) REFERENCES resort_npcs(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    INDEX idx_npc_importance (npc_id, importance_level)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 6. ฤดูกาลท่องเที่ยว และนักท่องเที่ยวหมุนเวียน
-- ------------------------------------------------------------------------------
CREATE TABLE tourist_seasons (
    id INT PRIMARY KEY,
    season_name ENUM('High_Season','Low_Season','Shoulder_Season') NOT NULL,
    season_description VARCHAR(255),
    months VARCHAR(40),                                       -- เดือนที่ใช้ (0=ม.ค.)
    tourist_density_multiplier FLOAT DEFAULT 1.0,
    weather_condition ENUM('sunny','monsoon','heavy_storm') DEFAULT 'sunny',
    sea_wave_height_meters FLOAT DEFAULT 0.5,
    guests_in_house INT DEFAULT 0,
    staff_active_ratio FLOAT DEFAULT 1.0,
    is_active BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB;

CREATE TABLE dynamic_tourists (
    id INT PRIMARY KEY,
    tourist_code VARCHAR(30) UNIQUE NOT NULL,
    nationality VARCHAR(50) DEFAULT 'International',
    risk_behavior_trait ENUM('safe','careless','drunk_swimmer','rule_breaker') DEFAULT 'safe',
    stay_zone VARCHAR(100) NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 7. ประเภทจุดอันตราย
-- ------------------------------------------------------------------------------
CREATE TABLE hazard_types (
    id INT PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    department_id INT NOT NULL,
    location_id VARCHAR(40) NOT NULL,
    kind ENUM('equip','behav','env') NOT NULL,
    severity TINYINT NOT NULL,                                -- 1-4
    involves_guest BOOLEAN DEFAULT FALSE,
    weight_high FLOAT DEFAULT 1, weight_low FLOAT DEFAULT 1,
    incident_type VARCHAR(30) NOT NULL,
    best_action ENUM('stop','coach','car') NOT NULL,
    requires_ptw BOOLEAN DEFAULT FALSE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    why_text TEXT,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 8. งานความปลอดภัย: จุดอันตราย/อุบัติเหตุ และใบอนุญาตทำงาน (PTW/JSA)
-- ------------------------------------------------------------------------------
CREATE TABLE safety_incidents (
    id INT PRIMARY KEY,
    location_zone VARCHAR(100) NOT NULL,
    location_id VARCHAR(40) NULL,
    hazard_type_id INT NULL,
    incident_type ENUM('near_miss','first_aid','property_damage','fire_hazard','chemical_spill',
                       'drowning_risk','electrical','fall_from_height','injury') NOT NULL,
    severity TINYINT NULL,
    reported_by_npc_id INT NULL,
    offender_npc_id INT NULL,
    injured_npc_id INT NULL,
    injured_guest BOOLEAN DEFAULT FALSE,
    injury_level TINYINT NULL,                                -- 1 ปฐมพยาบาล ... 4 สาหัส
    description TEXT NOT NULL,
    corrective_action_taken TEXT,
    root_cause VARCHAR(100) NULL,
    status ENUM('open','investigating','resolved','closed') DEFAULT 'open',
    game_day INT NULL,
    game_time VARCHAR(5) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reported_by_npc_id) REFERENCES resort_npcs(id) ON DELETE SET NULL,
    FOREIGN KEY (offender_npc_id) REFERENCES resort_npcs(id) ON DELETE SET NULL,
    FOREIGN KEY (injured_npc_id) REFERENCES resort_npcs(id) ON DELETE SET NULL,
    FOREIGN KEY (hazard_type_id) REFERENCES hazard_types(id) ON DELETE SET NULL,
    INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE jsa_permitting_logs (
    id INT PRIMARY KEY,
    work_title VARCHAR(150) NOT NULL,
    location VARCHAR(100) NOT NULL,
    location_id VARCHAR(40) NULL,
    risk_level ENUM('low','medium','high','extreme') NOT NULL,
    assigned_npc_id INT NOT NULL,
    approved_by_player_id INT NULL,                           -- NULL = ยังไม่พิจารณา/ไม่อนุมัติ
    is_ppe_checked BOOLEAN DEFAULT FALSE,
    status ENUM('pending','approved','rejected','completed') DEFAULT 'pending',
    game_day INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_npc_id) REFERENCES resort_npcs(id),
    FOREIGN KEY (approved_by_player_id) REFERENCES players(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 9. สรุปผลรายวัน (ใช้ทำกราฟ/รายงานในอนาคต)
-- ------------------------------------------------------------------------------
CREATE TABLE day_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    game_day INT NOT NULL,
    game_date DATE NOT NULL,
    season_name VARCHAR(20) NOT NULL,
    hazards_found INT DEFAULT 0,
    hazards_closed INT DEFAULT 0,
    incidents INT DEFAULT 0,
    lost_time_injuries INT DEFAULT 0,
    ops_score INT, guest_sat INT, reputation INT, avg_trust INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id),
    UNIQUE KEY uq_player_day (player_id, game_day)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 10. แผนงานของ จป.: แผนงานประจำวัน / ประชุม คปอ. / อบรมพนักงาน
-- ------------------------------------------------------------------------------
CREATE TABLE safety_activities (
    id INT PRIMARY KEY,
    activity_type ENUM('daily_focus','kpo_meeting','training') NOT NULL,
    title VARCHAR(200) NOT NULL,
    player_id INT NOT NULL,                                   -- จป. ที่นัด/จัด
    department_id INT NULL,                                   -- แผนกที่อบรม (ประชุม คปอ. = NULL ทุกแผนก)
    topic_code VARCHAR(20) NULL,                              -- หัวข้ออบรม เช่น FIRE หรือรหัสแผนงาน เช่น PATROL
    scheduled_day INT NOT NULL,                               -- วันในเกม (0 = วันแรก)
    scheduled_date DATE NULL,
    scheduled_time VARCHAR(5) NULL,                           -- HH:MM
    location_id VARCHAR(40) NULL,
    status ENUM('planned','due','done','missed','cancelled') NOT NULL DEFAULT 'planned',
    attendees INT DEFAULT 0,
    score INT NULL,                                           -- อบรม: ข้อที่ตอบถูก · คปอ.: จำนวนเรื่องที่อนุมัติ
    budget_baht INT DEFAULT 0,                                -- งบที่ใช้ตามมติ คปอ.
    details_json TEXT NULL,                                   -- มติที่อนุมัติ/เลื่อน, ความรู้ที่เพิ่ม ฯลฯ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (location_id) REFERENCES locations(id),
    INDEX idx_type_day (activity_type, scheduled_day)
) ENGINE=InnoDB;

-- ข้อมูลทั้งหมด (แผนก สถานที่ NPC 204 คน ความทรงจำ เหตุการณ์ ฯลฯ) อยู่ในไฟล์ seed.sql
-- หรือกดปุ่ม "ส่งออก SQL" ในเกมเพื่อได้ข้อมูลล่าสุดจากการเล่น
