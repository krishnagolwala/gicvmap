import socket, concurrent.futures

def check_cam(cam_id):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        s.connect(('103.250.160.189', 8554))
        s.send(f'OPTIONS rtsp://103.250.160.189:8554/stream/{cam_id} RTSP/1.0\r\nCSeq: 1\r\n\r\n'.encode())
        resp = s.recv(512).decode('utf-8', errors='ignore')
        s.close()
        if '200' in resp:
            return (cam_id, 'ONLINE')
        else:
            return (cam_id, f'RESP: {resp.strip()[:50]}')
    except Exception as e:
        return (cam_id, f'ERROR: {str(e)[:50]}')

with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
    futures = {ex.submit(check_cam, f'cam{i:02d}'): f'cam{i:02d}' for i in range(1, 31)}
    results = {}
    for f in concurrent.futures.as_completed(futures):
        cam, status = f.result()
        results[cam] = status
    online = 0
    for i in range(1, 31):
        cam = f'cam{i:02d}'
        status = results.get(cam, 'UNKNOWN')
        marker = '+' if 'ONLINE' in status else '-'
        if 'ONLINE' in status:
            online += 1
        print(f'  [{marker}] {cam}: {status}')
    print(f'\n  Total: {online}/30 online')
