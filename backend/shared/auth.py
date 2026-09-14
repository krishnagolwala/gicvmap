from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from shared.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


class TokenPayload(BaseModel):
    sub: str
    role: str
    department_id: Optional[int] = None
    permissions: list[str] = []
    department_ids: list[int] = []
    camera_ids: list[str] = []
    features: list[str] = []
    exp: int


class UserContext(BaseModel):
    user_id: int
    username: str
    role: str
    department_id: Optional[int] = None
    permissions: list[str] = []
    department_ids: list[int] = []
    camera_ids: list[str] = []
    features: list[str] = []


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, username: str, role: str,
                        department_id: Optional[int] = None,
                        permissions: Optional[list[str]] = None,
                        department_ids: Optional[list[int]] = None,
                        camera_ids: Optional[list[str]] = None,
                        features: Optional[list[str]] = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "department_id": department_id,
        "permissions": permissions or [],
        "department_ids": department_ids or [],
        "camera_ids": camera_ids or [],
        "features": features or [],
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_ACCESS_EXPIRY_MINUTES),
        "iss": "gicvmap",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=settings.JWT_REFRESH_EXPIRY_DAYS),
        "iss": "gicvmap",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return TokenPayload(
            sub=payload["sub"],
            role=payload.get("role", "viewer"),
            department_id=payload.get("department_id"),
            permissions=payload.get("permissions", []),
            department_ids=payload.get("department_ids", []),
            camera_ids=payload.get("camera_ids", []),
            features=payload.get("features", []),
            exp=payload["exp"],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid or expired token"}},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UserContext:
    token_data = decode_token(credentials.credentials)
    return UserContext(
        user_id=int(token_data.sub),
        username="",
        role=token_data.role,
        department_id=token_data.department_id,
        permissions=token_data.permissions,
        department_ids=token_data.department_ids,
        camera_ids=token_data.camera_ids,
        features=token_data.features,
    )


ROLE_HIERARCHY = {
    "superadmin": 4,
    "dept_admin": 3,
    "operator": 2,
    "viewer": 1,
    "analyst": 2,
    "auditor": 1,
}


def require_role(min_role: str):
    min_level = ROLE_HIERARCHY.get(min_role, 0)

    def checker(user: UserContext = Depends(get_current_user)) -> UserContext:
        user_level = ROLE_HIERARCHY.get(user.role, 0)
        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": f"Requires role >= {min_role}"}},
            )
        return user

    return checker


def require_feature(feature: str):
    """Require a specific feature permission. Superadmins always pass."""
    def checker(user: UserContext = Depends(get_current_user)) -> UserContext:
        if user.role == "superadmin":
            return user
        if feature not in user.features:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": f"Requires feature: {feature}"}},
            )
        return user
    return checker


def has_feature(user: UserContext, feature: str) -> bool:
    """Check if user has a specific feature (superadmin always true)."""
    if user.role == "superadmin":
        return True
    return feature in user.features


def can_access_camera(user: UserContext, camera_id: str) -> bool:
    """Check if user can access a specific camera."""
    if user.role == "superadmin":
        return True
    if not user.camera_ids:
        return True
    return camera_id in user.camera_ids


def can_access_department(user: UserContext, department_id: int) -> bool:
    """Check if user can access a specific department."""
    if user.role == "superadmin":
        return True
    if not user.department_ids:
        return user.department_id == department_id
    return department_id in user.department_ids
