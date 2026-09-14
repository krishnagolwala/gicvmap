-- ═══════════════════════════════════════════════════════════════
-- GICVMAP — Granular Access Control Migration
-- Adds: multi-dept access, camera-level access, feature perms
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Extend users table ──────────────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('superadmin','dept_admin','operator','viewer','analyst','auditor'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_valid_from TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_valid_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_ips TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_login_hours JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '[]'::jsonb;

-- ─── 2. User ↔ Department (multi-dept access) ──────────────
CREATE TABLE IF NOT EXISTS user_departments (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    department_id INT REFERENCES departments(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT now(),
    granted_by VARCHAR(100),
    PRIMARY KEY (user_id, department_id)
);
CREATE INDEX IF NOT EXISTS idx_user_dept_user ON user_departments(user_id);

-- ─── 3. User ↔ Camera (camera-level access) ────────────────
CREATE TABLE IF NOT EXISTS user_cameras (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    camera_id UUID REFERENCES cameras(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT now(),
    granted_by VARCHAR(100),
    PRIMARY KEY (user_id, camera_id)
);
CREATE INDEX IF NOT EXISTS idx_user_cam_user ON user_cameras(user_id);

-- ─── 4. User ↔ Feature permissions ─────────────────────────
CREATE TABLE IF NOT EXISTS user_features (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    feature VARCHAR(50) NOT NULL,
    granted_at TIMESTAMP DEFAULT now(),
    granted_by VARCHAR(100),
    PRIMARY KEY (user_id, feature)
);
CREATE INDEX IF NOT EXISTS idx_user_feat_user ON user_features(user_id);

-- ─── 5. Role hierarchy levels (for reference) ──────────────
-- superadmin=4, dept_admin=3, operator=2, viewer=1, analyst=2, auditor=1
-- analyst: search+analytics+reports+playback (limited dept)
-- auditor: audit logs+reports only (read-only, all depts for logs)

-- ─── 6. Grant default permissions to existing roles ─────────
-- superadmin: all features (handled in code, no DB rows needed)
-- dept_admin: all within dept (handled in code)
-- operator: limited set
INSERT INTO user_features (user_id, feature)
SELECT id, f.feature
FROM users, (VALUES
    ('view_live_feeds'),
    ('playback_recording'),
    ('search_vehicles'),
    ('view_analytics'),
    ('manage_alerts'),
    ('acknowledge_alerts')
) AS f(feature)
WHERE role = 'operator' AND id NOT IN (SELECT user_id FROM user_features)
ON CONFLICT DO NOTHING;

-- analyst: search + analytics + reports + playback
INSERT INTO user_features (user_id, feature)
SELECT id, f.feature
FROM users, (VALUES
    ('view_live_feeds'),
    ('playback_recording'),
    ('search_vehicles'),
    ('view_analytics'),
    ('export_data'),
    ('view_reports')
) AS f(feature)
WHERE role = 'analyst' AND id NOT IN (SELECT user_id FROM user_features)
ON CONFLICT DO NOTHING;

-- auditor: audit logs + reports only
INSERT INTO user_features (user_id, feature)
SELECT id, f.feature
FROM users, (VALUES
    ('view_audit_logs'),
    ('view_reports'),
    ('export_data')
) AS f(feature)
WHERE role = 'auditor' AND id NOT IN (SELECT user_id FROM user_features)
ON CONFLICT DO NOTHING;

-- ─── 7. Create demo users for hackathon ─────────────────────
-- Municipal Operator: only Municipal cameras, limited features
INSERT INTO users (username, email, password_hash, full_name, role, department_id, designation, phone)
VALUES (
    'muni_operator',
    'operator@municipal.gov.in',
    '$2b$12$iuSVCnT4dm9kKJ84dTC5Nulx6n6.ErCVc5YBH3MLrEm2sNLMeMN2C',
    'Municipal Operator',
    'operator',
    2,
    'CCTV Operator',
    '+91-79-2345-6789'
) ON CONFLICT (username) DO NOTHING;

-- RTO Analyst: multi-dept read access (Police + RTO)
INSERT INTO users (username, email, password_hash, full_name, role, department_id, designation, phone)
VALUES (
    'rto_analyst',
    'analyst@rto.gujarat.gov.in',
    '$2b$12$iuSVCnT4dm9kKJ84dTC5Nulx6n6.ErCVc5YBH3MLrEm2sNLMeMN2C',
    'RTO Vehicle Analyst',
    'analyst',
    3,
    'Vehicle Tracking Analyst',
    '+91-79-8765-4321'
) ON CONFLICT (username) DO NOTHING;

-- Home Dept Viewer: read-only Police cameras
INSERT INTO users (username, email, password_hash, full_name, role, department_id, designation, phone)
VALUES (
    'police_viewer',
    'viewer@gujaratpolice.gov.in',
    '$2b$12$iuSVCnT4dm9kKJ84dTC5Nulx6n6.ErCVc5YBH3MLrEm2sNLMeMN2C',
    'Police Control Room Viewer',
    'viewer',
    1,
    'Control Room Operator',
    '+91-79-1122-3344'
) ON CONFLICT (username) DO NOTHING;

-- Auditor: cross-dept audit access
INSERT INTO users (username, email, password_hash, full_name, role, department_id, designation, phone)
VALUES (
    'state_auditor',
    'auditor@gicvmap.gov.in',
    '$2b$12$iuSVCnT4dm9kKJ84dTC5Nulx6n6.ErCVc5YBH3MLrEm2sNLMeMN2C',
    'State System Auditor',
    'auditor',
    NULL,
    'IT Security Auditor',
    '+91-79-9988-7766'
) ON CONFLICT (username) DO NOTHING;

-- ─── 8. Grant multi-dept access to RTO analyst ──────────────
-- RTO analyst can see Police + RTO departments
INSERT INTO user_departments (user_id, department_id, granted_by)
SELECT u.id, d.id, 'admin'
FROM users u, departments d
WHERE u.username = 'rto_analyst' AND d.code IN ('HOME', 'RTO')
ON CONFLICT DO NOTHING;

-- Auditor can see all departments (for audit logs)
INSERT INTO user_departments (user_id, department_id, granted_by)
SELECT u.id, d.id, 'admin'
FROM users u, departments d
WHERE u.username = 'state_auditor'
ON CONFLICT DO NOTHING;

-- ─── 9. Grant camera-level access to municipal operator ─────
-- Municipal operator only sees Municipal cameras (dept_id=2)
-- This is enforced via department_id in the users table + user_departments
-- For explicit camera-level: grant access to a few specific cameras
INSERT INTO user_cameras (user_id, camera_id, granted_by)
SELECT u.id, c.id, 'admin'
FROM users u, cameras c
WHERE u.username = 'muni_operator' AND c.department_id = 2
ON CONFLICT DO NOTHING;

-- ─── 10. Grant feature permissions ──────────────────────────
-- Municipal operator: live feeds + search + acknowledge alerts
INSERT INTO user_features (user_id, feature, granted_by)
SELECT id, f.feature, 'admin'
FROM users, (VALUES
    ('view_live_feeds'),
    ('search_vehicles'),
    ('acknowledge_alerts')
) AS f(feature)
WHERE username = 'muni_operator'
ON CONFLICT DO NOTHING;

-- RTO analyst: search + analytics + reports + playback
INSERT INTO user_features (user_id, feature, granted_by)
SELECT id, f.feature, 'admin'
FROM users, (VALUES
    ('view_live_feeds'),
    ('playback_recording'),
    ('search_vehicles'),
    ('view_analytics'),
    ('export_data'),
    ('view_reports')
) AS f(feature)
WHERE username = 'rto_analyst'
ON CONFLICT DO NOTHING;

-- Police viewer: live feeds only (selected cameras)
INSERT INTO user_features (user_id, feature, granted_by)
SELECT id, f.feature, 'admin'
FROM users, (VALUES
    ('view_live_feeds')
) AS f(feature)
WHERE username = 'police_viewer'
ON CONFLICT DO NOTHING;

-- Auditor: audit logs + reports + export
INSERT INTO user_features (user_id, feature, granted_by)
SELECT id, f.feature, 'admin'
FROM users, (VALUES
    ('view_audit_logs'),
    ('view_reports'),
    ('export_data')
) AS f(feature)
WHERE username = 'state_auditor'
ON CONFLICT DO NOTHING;

-- ─── Done ───────────────────────────────────────────────────
SELECT 'Granular access control migration complete' AS status;
