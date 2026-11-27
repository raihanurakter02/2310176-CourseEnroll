"""
Reusable Role-Based Access Control (RBAC) & Group Permission Module.

Centralizes:
- Permission constants
- Role -> Permission mappings
- Reusable FastAPI dependencies (RoleChecker, PermissionChecker)
- Ownership & fine-grained StudyGroup permission checks
- Admin safety rules (cannot change own role, cannot ban/delete another admin)
"""

from typing import Callable, Iterable
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend import models

# ---------------------------------------------------------------------------
# PERMISSION CONSTANTS
# ---------------------------------------------------------------------------
PERM_VIEW_COURSES = "courses:view"
PERM_ENROLL_COURSE = "courses:enroll"
PERM_MANAGE_COURSES = "courses:manage"
PERM_MANAGE_SEMESTERS = "semesters:manage"
PERM_GRADE_STUDENTS = "enrollments:grade"
PERM_MANAGE_ATTENDANCE = "attendance:manage"
PERM_MANAGE_USERS = "users:manage"
PERM_VIEW_SECURITY = "security:view"
PERM_MANAGE_SECURITY = "security:manage"
PERM_MODERATE_CONTENT = "content:moderate"
PERM_MANAGE_ANNOUNCEMENTS = "announcements:manage"
PERM_ACCESS_GROUPS = "groups:access"

ROLE_PERMISSIONS: dict[models.UserRole, set[str]] = {
    models.UserRole.student: {
        PERM_VIEW_COURSES,
        PERM_ENROLL_COURSE,
        PERM_ACCESS_GROUPS,
    },
    models.UserRole.faculty: {
        PERM_VIEW_COURSES,
        PERM_GRADE_STUDENTS,
        PERM_MANAGE_ATTENDANCE,
        PERM_ACCESS_GROUPS,
    },
    models.UserRole.admin: {
        PERM_VIEW_COURSES,
        PERM_ENROLL_COURSE,
        PERM_MANAGE_COURSES,
        PERM_MANAGE_SEMESTERS,
        PERM_GRADE_STUDENTS,
        PERM_MANAGE_ATTENDANCE,
        PERM_MANAGE_USERS,
        PERM_VIEW_SECURITY,
        PERM_MANAGE_SECURITY,
        PERM_MODERATE_CONTENT,
        PERM_MANAGE_ANNOUNCEMENTS,
        PERM_ACCESS_GROUPS,
    },
}


def has_permission(user: models.User, permission: str) -> bool:
    """Return True if the user's role grants the given permission constant."""
    return permission in ROLE_PERMISSIONS.get(user.role, set())


def make_role_checker(get_current_user_dep: Callable):
    """Factory returning a RoleChecker dependency bound to get_current_user."""
    class RoleChecker:
        def __init__(self, allowed_roles: Iterable[models.UserRole]):
            self.allowed_roles = list(allowed_roles)

        def __call__(self, user: models.User = Depends(get_current_user_dep)):
            if user.role not in self.allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Operation not permitted for your role",
                )
            return user

    return RoleChecker


def make_permission_checker(get_current_user_dep: Callable):
    """Factory returning a PermissionChecker dependency bound to get_current_user."""
    class PermissionChecker:
        def __init__(self, required_permission: str):
            self.required_permission = required_permission

        def __call__(self, user: models.User = Depends(get_current_user_dep)):
            if not has_permission(user, self.required_permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing required permission: {self.required_permission}",
                )
            return user

    return PermissionChecker


# ---------------------------------------------------------------------------
# OWNERSHIP & FINE-GRAINED GROUP PERMISSION HELPERS
# ---------------------------------------------------------------------------

def ensure_owner_or_admin(resource_owner_id: int, current_user: models.User, detail: str = "Not authorized to access this resource"):
    """Enforce ownership rule: only the owner or an admin may proceed."""
    if current_user.role != models.UserRole.admin and resource_owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def get_group_permissions_for_user(group: models.StudyGroup, user: models.User, db: Session) -> dict:
    """Compute effective permissions for a user in a StudyGroup."""
    if group.owner_id == user.id:
        return {
            "is_owner": True,
            "is_member": True,
            "can_view": True,
            "can_create": True,
            "can_edit": True,
            "can_assign": True,
            "can_manage_members": True,
        }
    member = (
        db.query(models.StudyGroupMember)
        .filter(
            models.StudyGroupMember.group_id == group.id,
            models.StudyGroupMember.user_id == user.id,
        )
        .first()
    )
    if member:
        return {
            "is_owner": False,
            "is_member": True,
            "can_view": True,
            "can_create": bool(member.can_create),
            "can_edit": bool(member.can_edit),
            "can_assign": bool(member.can_assign),
            "can_manage_members": False,
        }
    if user.role == models.UserRole.admin:
        return {
            "is_owner": False,
            "is_member": False,
            "can_view": True,
            "can_create": False,
            "can_edit": False,
            "can_assign": False,
            "can_manage_members": False,
        }
    return {
        "is_owner": False,
        "is_member": False,
        "can_view": False,
        "can_create": False,
        "can_edit": False,
        "can_assign": False,
        "can_manage_members": False,
    }


def require_group_permission(
    group: models.StudyGroup,
    user: models.User,
    db: Session,
    required: str,
) -> dict:
    """
    Enforce a fine-grained group permission ('view', 'owner', 'create', 'edit', 'assign').
    Raises 403 Forbidden if not permitted.
    """
    perms = get_group_permissions_for_user(group, user, db)
    if required == "view" and not perms["can_view"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this group")
    if required == "owner" and not perms["is_owner"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the group owner can perform this action")
    if required == "create" and not perms["can_create"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have 'create' permission in this group")
    if required == "edit" and not perms["can_edit"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have 'edit' permission in this group")
    if required == "assign" and not perms["can_assign"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have 'assign' permission in this group")
    return perms
