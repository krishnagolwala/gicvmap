from typing import Any, Optional

from fastapi import HTTPException, status
from fastapi.responses import JSONResponse


class AppError(HTTPException):
    def __init__(self, code: str, message: str, status_code: int = 400, details: Any = None):
        self.error_code = code
        super().__init__(
            status_code=status_code,
            detail={"error": {"code": code, "message": message, "details": details or {}}},
        )


class NotFoundError(AppError):
    def __init__(self, entity: str, identifier: str):
        super().__init__(
            code=f"{entity.upper()}_NOT_FOUND",
            message=f"{entity} with id '{identifier}' not found",
            status_code=404,
        )


class ConflictError(AppError):
    def __init__(self, code: str, message: str):
        super().__init__(code=code, message=message, status_code=409)


class ValidationError(AppError):
    def __init__(self, message: str, details: Any = None):
        super().__init__(code="VALIDATION_ERROR", message=message, status_code=422, details=details)


def error_response(code: str, message: str, status_code: int = 400, details: Any = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details or {}}},
    )
