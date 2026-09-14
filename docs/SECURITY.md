# Security Architecture
## GICVMAP — Security Design Document

---

## 1. Security Overview

### 1.1 Security Principles

| Principle | Implementation |
|-----------|---------------|
| Defense in Depth | Multiple security layers (network, auth, data, audit) |
| Least Privilege | RBAC with department-scoped access |
| Zero Trust | All API calls authenticated; no implicit trust |
| Data Protection | Encryption in transit and at rest |
| Audit Trail | All actions logged with actor identity |
| Vendor Neutral | No proprietary security dependencies |

### 1.2 Threat Model

| Threat | Risk | Mitigation |
|--------|------|-----------|
| Unauthorized API access | High | JWT auth + RBAC on all endpoints |
| Camera feed interception | High | RTSP over TLS where supported; VPN for production |
| Data exfiltration | High | Encrypted storage; signed URLs for snapshots |
| Privilege escalation | Medium | Role-based permissions; department isolation |
| Denial of service | Medium | Rate limiting; connection limits |
| SQL injection | Medium | Parameterized queries; ORM usage |
| XSS/CSRF | Low | React CSP headers; CSRF tokens |
| Insider threat | Low | Audit logging; role separation |

---

## 2. Authentication

### 2.1 JWT Token System

**Token Structure:**
```json
{
  "sub": "user123",
  "email": "operator@gujarat.gov.in",
  "role": "operator",
  "department_id": 1,
  "permissions": [
    "cameras.read", "alerts.read", "alerts.acknowledge",
    "vehicles.search", "watchlist.read"
  ],
  "iat": 1725964800,
  "exp": 1725968400,
  "iss": "gicvmap"
}
```

**Token Configuration:**
| Property | Value |
|----------|-------|
| Algorithm | HS256 (HMAC-SHA256) |
| Access Token TTL | 60 minutes |
| Refresh Token TTL | 7 days |
| Secret Key | 32+ character random string (env variable) |
| Issuer | `gicvmap` |

**Authentication Flow:**
```
1. Client sends POST /api/v1/auth/login with credentials
2. Server validates against bcrypt password hash
3. Server generates access_token (60min) + refresh_token (7 days)
4. Client stores tokens (httpOnly cookie or secure storage)
5. Client sends Authorization: Bearer {access_token} header
6. Server validates token on each request
7. When access_token expires, client uses refresh_token to get new one
```

### 2.2 Password Policy

| Rule | Requirement |
|------|-------------|
| Minimum length | 8 characters |
| Complexity | At least 1 uppercase, 1 lowercase, 1 number |
| Hashing | bcrypt (12 rounds) |
| Storage | Only hashed passwords in database |
| Reset | Email-based reset (future feature) |

### 2.3 Session Management

- Sessions stored in Redis with TTL matching token expiry
- Logout invalidates both access and refresh tokens
- Concurrent session limit: 5 per user (configurable)
- Session tracking: IP address, user agent, login time

---

## 3. Authorization (RBAC)

### 3.1 Role Definitions

| Role | Description | Scope |
|------|-------------|-------|
| `superadmin` | Full system access | All departments, all resources |
| `dept_admin` | Department administrator | Own department's resources only |
| `operator` | Control room operator | View cameras, search vehicles, acknowledge alerts |
| `viewer` | Read-only viewer | View cameras, search vehicles, view alerts (no modify) |

### 3.2 Permission Matrix

| Resource | Action | superadmin | dept_admin | operator | viewer |
|----------|--------|-----------|------------|----------|--------|
| **cameras** | create | ✅ | ✅ (own dept) | ❌ | ❌ |
| | read | ✅ (all) | ✅ (own dept) | ✅ (own dept) | ✅ (own dept) |
| | update | ✅ | ✅ (own dept) | ❌ | ❌ |
| | delete | ✅ | ✅ (own dept) | ❌ | ❌ |
| | bulk_upload | ✅ | ✅ (own dept) | ❌ | ❌ |
| **watchlist** | create | ✅ | ✅ | ❌ | ❌ |
| | read | ✅ | ✅ | ✅ | ✅ |
| | update | ✅ | ✅ | ❌ | ❌ |
| | delete (soft) | ✅ | ✅ | ❌ | ❌ |
| | bulk_upload | ✅ | ✅ | ❌ | ❌ |
| **alerts** | read | ✅ | ✅ | ✅ | ✅ |
| | acknowledge | ✅ | ✅ | ✅ | ❌ |
| | dismiss | ✅ | ✅ | ❌ | ❌ |
| **vehicles** | search | ✅ | ✅ | ✅ | ✅ |
| | export_report | ✅ | ✅ | ✅ | ❌ |
| **users** | create | ✅ | ❌ | ❌ | ❌ |
| | read | ✅ | ✅ (own dept) | ❌ | ❌ |
| | update | ✅ | ❌ | ❌ | ❌ |
| **system** | config | ✅ | ❌ | ❌ | ❌ |
| | stats | ✅ | ✅ | ✅ | ✅ |

### 3.3 Department Isolation

```python
# Enforce department-scoped access
def require_department_access(user, resource_department_id):
    if user.role == 'superadmin':
        return True  # Superadmin sees everything
    if user.department_id != resource_department_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: resource belongs to another department"
        )
```

---

## 4. Data Protection

### 4.1 Encryption in Transit

| Channel | Protocol | Implementation |
|---------|----------|---------------|
| Browser → NGINX | HTTPS (TLS 1.2+) | Let's Encrypt / self-signed for PoC |
| NGINX → Backend | HTTP (internal network) | Docker network isolation |
| Backend → PostgreSQL | TLS (optional) | PostgreSQL SSL config |
| Backend → Redis | Plain (internal) | Docker network isolation |
| Dashboard ↔ Alert WS | WSS (WebSocket Secure) | TLS termination at NGINX |
| Camera → MediaMTX | RTSP (plain for PoC) | RTSPS for production |

### 4.2 Encryption at Rest

| Data Type | Method | Implementation |
|-----------|--------|---------------|
| User passwords | bcrypt hash | passlib library |
| Camera credentials | AES-256 encryption | Fernet symmetric encryption |
| Watchlist data | PostgreSQL TDE | Disk-level encryption |
| Face embeddings | pgvector storage | Encrypted column (pgcrypto) |
| Snapshots | MinIO server-side | MinIO encryption config |

### 4.3 Sensitive Data Handling

```python
# Camera credential encryption
from cryptography.fernet import Fernet

ENCRYPTION_KEY = os.environ['ENCRYPTION_KEY']
cipher = Fernet(ENCRYPTION_KEY)

# Store
encrypted_password = cipher.encrypt(camera_password.encode())

# Retrieve
decrypted_password = cipher.decrypt(encrypted_password).decode()
```

### 4.4 API Response Sanitization

```python
# Never expose RTSP credentials in API responses
class CameraResponse(BaseModel):
    rtsp_url: str
    
    @validator('rtsp_url')
    def mask_credentials(cls, v):
        # Mask password in RTSP URL
        return re.sub(r'://([^:]+):[^@]+@', r'://\1:***@', v)
```

---

## 5. Audit Logging

### 5.1 What Gets Logged

| Event | Data Captured |
|-------|--------------|
| User login/logout | Actor, timestamp, IP, success/fail |
| Camera create/update/delete | Actor, entity ID, old/new values |
| Watchlist add/modify/deactivate | Actor, entity ID, old/new values |
| Alert acknowledge/dismiss | Actor, alert ID, timestamp |
| API errors | Endpoint, status code, actor, timestamp |
| Stream connection/disconnect | Camera ID, timestamp, error |

### 5.2 Audit Log Schema

```sql
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor VARCHAR(100) NOT NULL,          -- Username or 'system'
    actor_ip INET,                        -- IP address
    action VARCHAR(100) NOT NULL,         -- 'camera.create', 'alert.acknowledge'
    entity VARCHAR(50) NOT NULL,          -- 'camera', 'watchlist', 'alert'
    entity_id VARCHAR(100),               -- UUID or integer ID
    old_values JSONB,                     -- Previous state (for updates)
    new_values JSONB,                     -- New state (for creates/updates)
    details JSONB,                        -- Additional context
    created_at TIMESTAMP DEFAULT now()
);
```

### 5.3 Audit Middleware

```python
# FastAPI middleware for automatic audit logging
from fastapi import Request

@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    response = await call_next(request)
    
    # Log write operations
    if request.method in ("POST", "PUT", "DELETE"):
        await log_audit(
            actor=get_current_user(request),
            action=f"{request.url.path}.{request.method.lower()}",
            entity=extract_entity(request.url.path),
            entity_id=extract_id(request.url.path),
            request_method=request.method,
            response_status=response.status_code
        )
    
    return response
```

---

## 6. Network Security

### 6.1 Network Segmentation (Production)

```
┌─────────────────────────────────────────────────┐
│                    NETWORK ZONES                  │
│                                                   │
│  ┌─────────────────────────────────────────────┐│
│  │ Zone 1: Camera VLAN                          ││
│  │ - Isolated from corporate/office network     ││
│  │ - Cameras + NVRs only                        ││
│  │ - Access: MediaMTX gateway only              ││
│  └─────────────────────────────────────────────┘│
│                                                   │
│  ┌─────────────────────────────────────────────┐│
│  │ Zone 2: DMZ                                  ││
│  │ - MediaMTX stream gateway                    ││
│  │ - NGINX API gateway                          ││
│  │ - Internet-facing (if needed)                ││
│  └─────────────────────────────────────────────┘│
│                                                   │
│  ┌─────────────────────────────────────────────┐│
│  │ Zone 3: Application                          ││
│  │ - Backend services (FastAPI)                 ││
│  │ - AI inference service                       ││
│  │ - Not directly internet-exposed              ││
│  └─────────────────────────────────────────────┘│
│                                                   │
│  ┌─────────────────────────────────────────────┐│
│  │ Zone 4: Data                                 ││
│  │ - PostgreSQL, Redis, MinIO                   ││
│  │ - Most restricted access                     ││
│  │ - Application tier only                      ││
│  └─────────────────────────────────────────────┘│
│                                                   │
└─────────────────────────────────────────────────┘
```

### 6.2 NGINX Security Configuration

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

# Connection limits
limit_conn_zone $binary_remote_addr zone=conn:10m;
limit_conn conn 100;

# Request size limits
client_max_body_size 10M;

# Hide server version
server_tokens off;
```

---

## 7. Input Validation

### 7.1 API Request Validation

```python
from pydantic import BaseModel, validator
import re

class CameraCreate(BaseModel):
    name: str
    department_id: int
    camera_type: str
    lat: float
    lng: float
    rtsp_url: str
    
    @validator('camera_type')
    def validate_camera_type(cls, v):
        if v not in ('analog', 'ip'):
            raise ValueError('camera_type must be "analog" or "ip"')
        return v
    
    @validator('lat')
    def validate_lat(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('latitude must be between -90 and 90')
        return v
    
    @validator('lng')
    def validate_lng(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('longitude must be between -180 and 180')
        return v
    
    @validator('rtsp_url')
    def validate_rtsp(cls, v):
        if not re.match(r'^rtsp://', v):
            raise ValueError('rtsp_url must start with rtsp://')
        return v
```

### 7.2 SQL Injection Prevention

- All queries use SQLAlchemy ORM (parameterized)
- Raw SQL only with explicit parameter binding
- No string interpolation in queries

### 7.3 XSS Prevention

- React auto-escapes output by default
- Content Security Policy headers
- No `dangerouslySetInnerHTML` usage

---

## 8. PoC Security vs. Production

| Aspect | PoC | Production |
|--------|-----|-----------|
| TLS | Optional (self-signed) | Mandatory (Let's Encrypt) |
| Camera credentials | Plain in env file | Encrypted in vault |
| Rate limiting | Basic (NGINX) | Advanced (API gateway) |
| Network segmentation | Docker networks | VLAN + firewall rules |
| Audit logging | Database only | Database + external SIEM |
| Secret management | .env file | HashiCorp Vault / K8s Secrets |
| mTLS | No | Yes (service-to-service) |
| Penetration testing | No | Yes (pre-deployment) |

---

*End of Security Architecture Document*
