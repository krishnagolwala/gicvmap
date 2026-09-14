-- Sentinel Camera Grid: 30 cameras with public RTSP endpoints
-- RTSP: rtsp://103.250.160.189:8554/stream/<id>
-- HLS:  https://cctv.corp8.cloud/<id>/index.m3u8

DELETE FROM cameras WHERE id::text LIKE 'a0000001%';

INSERT INTO cameras (id, name, department_id, camera_type, vendor, rtsp_url, lat, lng, status, is_analytics_enabled, resolution, fps) VALUES
('a0000001-0000-0000-0000-000000000001', 'cam01 - Chiman Bhai Bridge', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam01', 23.0225, 72.5714, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000002', 'cam02 - Janpath', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam02', 23.0300, 72.5650, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000003', 'cam03 - ONGC Office', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam03', 23.0350, 72.5800, 'online', true, '1280x720', 25),
('a0000001-0000-0000-0000-000000000004', 'cam04 - Paldi Circle', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam04', 23.0180, 72.5680, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000005', 'cam05 - Visat Teen Rasta', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam05', 23.0420, 72.5590, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000006', 'cam06 - SG Highway', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam06', 23.0200, 72.5100, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000007', 'cam07 - Ashram Road', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam07', 23.0300, 72.5600, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000008', 'cam08 - Nehru Bridge', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam08', 23.0250, 72.5720, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000009', 'cam09 - Kalupur', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam09', 23.0260, 72.5810, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000010', 'cam10 - Lal Darwaja', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam10', 23.0200, 72.5750, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000011', 'cam11 - Income Tax', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam11', 23.0350, 72.5500, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000012', 'cam12 - University Road', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam12', 23.0400, 72.5450, 'online', true, '1280x720', 25),
('a0000001-0000-0000-0000-000000000013', 'cam13 - Satellite', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam13', 23.0150, 72.5300, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000014', 'cam14 - Prahlad Nagar', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam14', 23.0180, 72.5200, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000015', 'cam15 - Vastrapur', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam15', 23.0300, 72.5300, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000016', 'cam16 - Bodakdev', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam16', 23.0350, 72.5250, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000017', 'cam17 - Thaltej', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam17', 23.0400, 72.5200, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000018', 'cam18 - Bopal', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam18', 23.0450, 72.5100, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000019', 'cam19 - Gota', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam19', 23.0500, 72.5000, 'online', true, '1280x720', 25),
('a0000001-0000-0000-0000-000000000020', 'cam20 - Sola', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam20', 23.0550, 72.5350, 'online', true, '1280x720', 25),
('a0000001-0000-0000-0000-000000000021', 'cam21 - Science City', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam21', 23.0180, 72.6000, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000022', 'cam22 - Kankaria', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam22', 23.0100, 72.5900, 'online', true, '1920x1080', 25),
('a0000001-0000-0000-0000-000000000023', 'cam23 - Maninagar', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam23', 23.0150, 72.6000, 'online', true, '1280x720', 25),
('a0000001-0000-0000-0000-000000000024', 'cam24 - Naroda', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam24', 23.0600, 72.6100, 'online', true, '960x576', 25),
('a0000001-0000-0000-0000-000000000025', 'cam25 - Odhav', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam25', 23.0650, 72.6050, 'online', true, '1280x960', 25),
('a0000001-0000-0000-0000-000000000026', 'cam26 - Vastral', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam26', 23.0050, 72.6100, 'online', true, '2560x1440', 25),
('a0000001-0000-0000-0000-000000000027', 'cam27 - Ranip', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam27', 23.0500, 72.5600, 'online', true, '1280x960', 25),
('a0000001-0000-0000-0000-000000000028', 'cam28 - Chandkheda', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam28', 23.0650, 72.5500, 'online', true, '1280x960', 25),
('a0000001-0000-0000-0000-000000000029', 'cam29 - Motera', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam29', 23.0750, 72.5700, 'online', true, '1280x960', 25),
('a0000001-0000-0000-0000-000000000030', 'cam30 - Sabarmati', 1, 'ip', 'Sentinel', 'rtsp://103.250.160.189:8554/stream/cam30', 23.0500, 72.5800, 'online', true, '1920x1080', 25);
