"""Department isolation helpers — enforces data scoping by department_id from JWT."""
from shared.auth import UserContext


def apply_dept_filter(conditions: list[str], params: dict, user: UserContext, table_alias: str = "c"):
    """
    Add department_id filter for non-superadmin users.
    Superadmins see everything; others see only their allowed departments.
    """
    if user.role == "superadmin":
        return

    # Check if user has explicit multi-department access
    if user.department_ids:
        placeholders = ", ".join(f":_dept_id_{i}" for i in range(len(user.department_ids)))
        conditions.append(f"{table_alias}.department_id IN ({placeholders})")
        for i, did in enumerate(user.department_ids):
            params[f"_dept_id_{i}"] = did
    elif user.department_id is not None:
        conditions.append(f"{table_alias}.department_id = :_dept_id")
        params["_dept_id"] = user.department_id


def apply_camera_filter(conditions: list[str], params: dict, user: UserContext, table_alias: str = "c"):
    """
    Add camera_id filter for users with camera-level access.
    Superadmins and users with empty camera_ids see all cameras.
    """
    if user.role == "superadmin":
        return
    if not user.camera_ids:
        return

    placeholders = ", ".join(f":_cam_id_{i}" for i in range(len(user.camera_ids)))
    conditions.append(f"{table_alias}.id IN ({placeholders})")
    for i, cid in enumerate(user.camera_ids):
        params[f"_cam_id_{i}"] = cid
