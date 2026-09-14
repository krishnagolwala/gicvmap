-- Seed demo detections and alerts
DO $$
DECLARE
    cam1 UUID; cam2 UUID; cam3 UUID; cam4 UUID; cam5 UUID; cam6 UUID; cam7 UUID; cam8 UUID;
    det1 BIGINT; det2 BIGINT; det3 BIGINT;
BEGIN
    SELECT id INTO cam1 FROM cameras WHERE name = 'SG Highway Junction Cam 1' LIMIT 1;
    SELECT id INTO cam2 FROM cameras WHERE name = 'Vastrapur Lake Cam' LIMIT 1;
    SELECT id INTO cam3 FROM cameras WHERE name = 'CG Road Circle Cam' LIMIT 1;
    SELECT id INTO cam4 FROM cameras WHERE name = 'Ahmedabad Railway Station' LIMIT 1;
    SELECT id INTO cam5 FROM cameras WHERE name = 'Gandhinagar Sector 16 Cam' LIMIT 1;
    SELECT id INTO cam6 FROM cameras WHERE name = 'Surat Ring Road Cam 1' LIMIT 1;
    SELECT id INTO cam7 FROM cameras WHERE name = 'Vadodara Sayaji Baug Cam' LIMIT 1;
    SELECT id INTO cam8 FROM cameras WHERE name = 'Rajkot Market Yard Cam' LIMIT 1;

    -- Insert detections (stolen vehicle GJ01AB1234 spotted across Gujarat)
    INSERT INTO detections (camera_id, detected_at, detection_type, plate_number, plate_normalized, plate_confidence, object_class, object_confidence, bbox, model_version)
    VALUES
        (cam1, now() - interval '4 hours', 'vehicle', 'GJ01AB1234', 'GJ01AB1234', 0.92, 'car', 0.88, '{"x":120,"y":80,"w":200,"h":150}'::jsonb, 'yolov8n'),
        (cam3, now() - interval '3 hours 45 minutes', 'vehicle', 'GJ01AB1234', 'GJ01AB1234', 0.87, 'car', 0.91, '{"x":300,"y":120,"w":180,"h":140}'::jsonb, 'yolov8n'),
        (cam2, now() - interval '3 hours 30 minutes', 'vehicle', 'GJ01AB1234', 'GJ01AB1234', 0.95, 'car', 0.85, '{"x":200,"y":100,"w":190,"h":130}'::jsonb, 'yolov8n'),
        (cam4, now() - interval '3 hours 15 minutes', 'vehicle', 'GJ01AB1234', 'GJ01AB1234', 0.89, 'car', 0.90, '{"x":150,"y":90,"w":210,"h":160}'::jsonb, 'yolov8n'),
        (cam5, now() - interval '2 hours 50 minutes', 'vehicle', 'GJ01AB1234', 'GJ01AB1234', 0.91, 'car', 0.87, '{"x":250,"y":110,"w":170,"h":120}'::jsonb, 'yolov8n'),
        (cam6, now() - interval '2 hours 20 minutes', 'vehicle', 'GJ01AB1234', 'GJ01AB1234', 0.93, 'car', 0.89, '{"x":180,"y":95,"w":200,"h":145}'::jsonb, 'yolov8n'),
        (cam7, now() - interval '1 hour 50 minutes', 'vehicle', 'GJ01AB1234', 'GJ01AB1234', 0.86, 'car', 0.84, '{"x":220,"y":105,"w":185,"h":135}'::jsonb, 'yolov8n'),
        -- Suspect vehicle GJ05CD5678
        (cam1, now() - interval '2 hours', 'vehicle', 'GJ05CD5678', 'GJ05CD5678', 0.88, 'car', 0.92, '{"x":320,"y":130,"w":195,"h":155}'::jsonb, 'yolov8n'),
        (cam3, now() - interval '1 hour 40 minutes', 'vehicle', 'GJ05CD5678', 'GJ05CD5678', 0.90, 'car', 0.86, '{"x":280,"y":115,"w":175,"h":125}'::jsonb, 'yolov8n'),
        (cam2, now() - interval '1 hour 20 minutes', 'vehicle', 'GJ05CD5678', 'GJ05CD5678', 0.85, 'car', 0.91, '{"x":160,"y":85,"w":205,"h":150}'::jsonb, 'yolov8n'),
        -- Random persons
        (cam1, now() - interval '3 hours', 'person', NULL, NULL, NULL, 'person', 0.78, '{"x":400,"y":60,"w":80,"h":200}'::jsonb, 'yolov8n'),
        (cam3, now() - interval '2 hours 30 minutes', 'person', NULL, NULL, NULL, 'person', 0.82, '{"x":350,"y":70,"w":90,"h":210}'::jsonb, 'yolov8n'),
        -- Blacklisted vehicle
        (cam2, now() - interval '1 hour', 'vehicle', 'GJ27EF9012', 'GJ27EF9012', 0.94, 'car', 0.87, '{"x":270,"y":100,"w":190,"h":140}'::jsonb, 'yolov8n'),
        -- Missing person vehicle
        (cam4, now() - interval '45 minutes', 'vehicle', 'GJ03GH3456', 'GJ03GH3456', 0.90, 'car', 0.85, '{"x":190,"y":90,"w":200,"h":155}'::jsonb, 'yolov8n'),
        -- Random vehicle
        (cam5, now() - interval '30 minutes', 'vehicle', 'MH12DE1111', 'MH12DE1111', 0.88, 'car', 0.91, '{"x":310,"y":110,"w":185,"h":130}'::jsonb, 'yolov8n');

    -- Get detection IDs for alerts
    SELECT id INTO det1 FROM detections WHERE plate_number = 'GJ01AB1234' AND camera_id = cam1 ORDER BY detected_at DESC LIMIT 1;
    SELECT id INTO det2 FROM detections WHERE plate_number = 'GJ01AB1234' AND camera_id = cam3 ORDER BY detected_at DESC LIMIT 1;
    SELECT id INTO det3 FROM detections WHERE plate_number = 'GJ05CD5678' AND camera_id = cam1 ORDER BY detected_at DESC LIMIT 1;

    -- Insert alerts (watchlist matches)
    INSERT INTO alerts (watchlist_id, detection_id, camera_id, triggered_at, severity, status, match_type, match_confidence, plate_number, watchlist_reason, camera_name, camera_lat, camera_lng)
    VALUES
        (1, det1, cam1, now() - interval '4 hours', 'critical', 'new', 'plate_exact', 0.92, 'GJ01AB1234', 'Stolen white Swift Dzire reported in FIR #2026/4521', 'SG Highway Junction Cam 1', 23.0410, 72.5645),
        (1, det2, cam3, now() - interval '3 hours 45 minutes', 'critical', 'acknowledged', 'plate_exact', 0.87, 'GJ01AB1234', 'Stolen white Swift Dzire reported in FIR #2026/4521', 'CG Road Circle Cam', 23.0385, 72.5520),
        (2, det3, cam1, now() - interval '2 hours', 'high', 'new', 'plate_exact', 0.88, 'GJ05CD5678', 'Suspect vehicle in robbery case FIR #2026/3892', 'SG Highway Junction Cam 1', 23.0410, 72.5645);

    RAISE NOTICE 'Seeded 15 detections and 3 alerts';
END $$;
