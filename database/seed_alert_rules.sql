INSERT INTO alert_rules (name, description, trigger_type, condition_config, severity, enabled, notification_channels, created_by) VALUES
('Stolen Vehicle Alert', 'Alert when any watchlist stolen vehicle is detected', 'plate_match', '{"watchlist_category": "stolen_vehicle"}', 'critical', true, '{in_app,sms,email}', 'admin'),
('Wanted Person Alert', 'Alert when wanted person is detected', 'face_match', '{"watchlist_category": "wanted_person"}', 'high', true, '{in_app,email}', 'admin'),
('Night-time Activity', 'Alert on unusual activity between 12am-5am', 'anomaly', '{"time_range": "00:00-05:00", "min_detections": 10}', 'medium', false, '{in_app}', 'admin'),
('Border Zone Vehicle', 'Alert when blacklisted vehicle enters border zone cameras', 'plate_match', '{"watchlist_category": "blacklisted", "zone": "border"}', 'high', true, '{in_app,sms}', 'admin')
ON CONFLICT DO NOTHING;
