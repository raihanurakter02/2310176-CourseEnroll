"""
Study Groups / Shared Course Teams Router with Fine-Grained Permissions.

- Only the owner can rename, delete, or manage members & permissions.
- Members have independent permissions: can_create, can_edit, can_assign.
- Admins can view and moderate (delete) groups.
"""

import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend import models, rbac, schemas
from backend.database import get_db


def _serialize_group(group: models.StudyGroup, user: models.User, db: Session, include_details: bool = False) -> schemas.GroupResponse:
    perms = rbac.get_group_permissions_for_user(group, user, db)
    owner = db.query(models.User).filter(models.User.id == group.owner_id).first()
    course = db.query(models.Course).filter(models.Course.id == group.course_id).first() if group.course_id else None

    members_list: list[schemas.GroupMemberResponse] = []
    items_list: list[schemas.GroupItemResponse] = []

    member_rows = db.query(models.StudyGroupMember).filter(models.StudyGroupMember.group_id == group.id).all()
    item_rows = db.query(models.StudyGroupItem).filter(models.StudyGroupItem.group_id == group.id).order_by(models.StudyGroupItem.created_at.desc()).all()

    if include_details:
        for m in member_rows:
            mu = db.query(models.User).filter(models.User.id == m.user_id).first()
            members_list.append(
                schemas.GroupMemberResponse(
                    id=m.id,
                    user_id=m.user_id,
                    user_name=mu.name if mu else None,
                    user_email=mu.email if mu else None,
                    can_create=bool(m.can_create),
                    can_edit=bool(m.can_edit),
                    can_assign=bool(m.can_assign),
                    joined_at=m.joined_at,
                )
            )
        for it in item_rows:
            cu = db.query(models.User).filter(models.User.id == it.created_by).first()
            au = db.query(models.User).filter(models.User.id == it.assigned_to).first() if it.assigned_to else None
            items_list.append(
                schemas.GroupItemResponse(
                    id=it.id,
                    group_id=it.group_id,
                    title=it.title,
                    description=it.description,
                    status=it.status,
                    created_by=it.created_by,
                    creator_name=cu.name if cu else None,
                    assigned_to=it.assigned_to,
                    assignee_name=au.name if au else None,
                    created_at=it.created_at,
                    updated_at=it.updated_at,
                )
            )

    return schemas.GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        course_id=group.course_id,
        course_code=course.course_code if course else None,
        owner_id=group.owner_id,
        owner_name=owner.name if owner else None,
        owner_email=owner.email if owner else None,
        created_at=group.created_at,
        member_count=len(member_rows) + 1,  # +1 for owner
        item_count=len(item_rows),
        my_permissions=perms,
        members=members_list,
        items=items_list,
    )


def create_groups_router(allow_all_roles, log_security_event):
    router = APIRouter(prefix="/groups", tags=["groups"])

    @router.get("", response_model=list[schemas.GroupResponse])
    def list_groups(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(allow_all_roles),
    ):
        """List groups owned by or shared with the current user (admins see all)."""
        if current_user.role == models.UserRole.admin:
            groups = db.query(models.StudyGroup).order_by(models.StudyGroup.created_at.desc()).all()
        else:
            member_group_ids = [
                m.group_id
                for m in db.query(models.StudyGroupMember.group_id)
                .filter(models.StudyGroupMember.user_id == current_user.id)
                .all()
            ]
            groups = (
                db.query(models.StudyGroup)
                .filter(
                    (models.StudyGroup.owner_id == current_user.id)
                    | (models.StudyGroup.id.in_(member_group_ids))
                )
                .order_by(models.StudyGroup.created_at.desc())
                .all()
            )
        return [_serialize_group(g, current_user, db, include_details=False) for g in groups]

    @router.post("", response_model=schemas.GroupResponse, status_code=status.HTTP_201_CREATED)
    def create_group(
        payload: schemas.GroupCreate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(allow_all_roles),
    ):
        """Create a new study/course group; creator becomes owner."""
        if payload.course_id is not None:
            course = db.query(models.Course).filter(models.Course.id == payload.course_id).first()
            if not course:
                raise HTTPException(status_code=404, detail="Linked course not found")

        group = models.StudyGroup(
            name=payload.name.strip(),
            description=payload.description,
            course_id=payload.course_id,
            owner_id=current_user.id,
        )
        db.add(group)
        db.commit()
        db.refresh(group)
        return _serialize_group(group, current_user, db, include_details=True)

    @router.get("/{group_id}", response_model=schemas.GroupResponse)
    def get_group(
        group_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(allow_all_roles),
    ):
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        rbac.require_group_permission(group, current_user, db, "view")
        return _serialize_group(group, current_user, db, include_details=True)

    @router.put("/{group_id}", response_model=schemas.GroupResponse)
    def update_group(
        group_id: int,
        payload: schemas.GroupUpdate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(allow_all_roles),
    ):
        """Rename or update group details — owner only."""
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        rbac.require_group_permission(group, current_user, db, "owner")

        group.name = payload.name.strip()
        group.description = payload.description
        db.commit()
        db.refresh(group)
        return _serialize_group(group, current_user, db, include_details=True)

    @router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_group(
        group_id: int,
        request: Request,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(allow_all_roles),
    ):
        """Delete a group — owner only (or admin moderation)."""
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if current_user.role != models.UserRole.admin:
            rbac.require_group_permission(group, current_user, db, "owner")

        group_name = group.name
        db.delete(group)
        log_security_event(
            db,
            event_type="record_deleted",
            severity="info",
            user_id=current_user.id,
            user_email=current_user.email,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent", "Unknown"),
            detail=f"Deleted group '{group_name}' (id={group_id})",
        )
        db.commit()

    @router.post("/{group_id}/members", response_model=schemas.GroupMemberResponse, status_code=status.HTTP_201_CREATED)
    def add_group_member(
        group_id: int,
        payload: schemas.GroupMemberAdd,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(allow_all_roles),
    ):
        """Add a member with fine-grained permissions — owner only."""
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        rbac.require_group_permission(group, current_user, db, "owner")

        target_user = db.query(models.User).filter(models.User.email == payload.email).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User with that email not found")
        if target_user.id == group.owner_id:
            raise HTTPException(status_code=400, detail="Owner already has full permissions")

        existing = (
            db.query(models.StudyGroupMember)
            .filter(models.StudyGroupMember.group_id == group_id, models.StudyGroupMember.user_id == target_user.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="User is already a member of this group")

        member = models.StudyGroupMember(
            group_id=group_id,
            user_id=target_user.id,
            can_create=payload.can_create,
            can_edit=payload.can_edit,
            can_assign=payload.can_assign,
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        return schemas.GroupMemberResponse(
            id=member.id,
            user_id=member.user_id,
            user_name=target_user.name,
            user_email=target_user.email,
            can_create=bool(member.can_create),
            can_edit=bool(member.can_edit),
            can_assign=bool(member.can_assign),
            joined_at=member.joined_at,
        )

    @router.put("/{group_id}/members/{member_user_id}", response_model=schemas.GroupMemberResponse)
    def update_group_member(
        group_id: int,
        member_user_id: int,
        payload: schemas.GroupMemberUpdate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(allow_all_roles),
    ):
        """Update a member's permissions — owner only."""
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        rbac.require_group_permission(group, current_user, db, "owner")

        member = (
            db.query(models.StudyGroupMember)
            .filter(models.StudyGroupMember.group_id == group_id, models.StudyGroupMember.user_id == member_user_id)
            .first()
        )
        if not member:
            raise HTTPException(status_code=404, detail="Member not found in this group")

        member.can_create = payload.can_create
        member.can_edit = payload.can_edit
        member.can_assign = payload.can_assign
        db.commit()
        db.refresh(member)
        u = db.query(models.User).filter(models.User.id == member_user_id).first()
        return schemas.GroupMemberResponse(
            id=member.id,
            user_id=member.user_id,
            user_name=u.name if u else None,
            user_email=u.email if u else None,
            can_create=bool(member.can_create),
            can_edit=bool(member.can_edit),
            can_assign=bool(member.can_assign),
            joined_at=member.joined_at,
        )

    @router.delete("/{group_id}/members/{member_user_id}", status_code=status.HTTP_204_NO_CONTENT)
    def remove_group_member(
        group_id: int,
        member_user_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(allow_all_roles),
    ):
        """Remove a member from the group — owner only."""
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        rbac.require_group_permission(group, current_user, db, "owner")

        member = (
            db.query(models.StudyGroupMember)
            .filter(models.StudyGroupMember.group_id == group_id, models.StudyGroupMember.user_id == member_user_id)
            .first()
        )
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        db.delete(member)
        db.commit()

    @router.post("/{group_id}/items", response_model=schemas.GroupItemResponse, status_code=status.HTTP_201_CREATED)
    def create_group_item(
        group_id: int,
        payload: schemas.GroupItemCreate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(allow_all_roles),
    ):
        """Create a shared item/task — requires owner or 'can_create'."""
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        rbac.require_group_permission(group, current_user, db, "create")
        if payload.assigned_to is not None:
            rbac.require_group_permission(group, current_user, db, "assign")

        item = models.StudyGroupItem(
            group_id=group_id,
            title=payload.title.strip(),
            description=payload.description,
            created_by=current_user.id,
            assigned_to=payload.assigned_to,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        au = db.query(models.User).filter(models.User.id == item.assigned_to).first() if item.assigned_to else None
        return schemas.GroupItemResponse(
            id=item.id,
            group_id=item.group_id,
            title=item.title,
            description=item.description,
            status=item.status,
            created_by=item.created_by,
            creator_name=current_user.name,
            assigned_to=item.assigned_to,
            assignee_name=au.name if au else None,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @router.put("/{group_id}/items/{item_id}", response_model=schemas.GroupItemResponse)
    def update_group_item(
        group_id: int,
        item_id: int,
        payload: schemas.GroupItemUpdate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(allow_all_roles),
    ):
        """Edit or assign a shared item — checks 'can_edit' and/or 'can_assign'."""
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        item = (
            db.query(models.StudyGroupItem)
            .filter(models.StudyGroupItem.id == item_id, models.StudyGroupItem.group_id == group_id)
            .first()
        )
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        editing_fields = payload.title is not None or payload.description is not None or payload.status is not None
        assigning = "assigned_to" in payload.model_fields_set

        if editing_fields:
            rbac.require_group_permission(group, current_user, db, "edit")
        if assigning:
            rbac.require_group_permission(group, current_user, db, "assign")

        if payload.title is not None:
            item.title = payload.title.strip()
        if payload.description is not None:
            item.description = payload.description
        if payload.status is not None:
            item.status = payload.status
        if assigning:
            item.assigned_to = payload.assigned_to
        item.updated_at = datetime.datetime.utcnow()

        db.commit()
        db.refresh(item)
        cu = db.query(models.User).filter(models.User.id == item.created_by).first()
        au = db.query(models.User).filter(models.User.id == item.assigned_to).first() if item.assigned_to else None
        return schemas.GroupItemResponse(
            id=item.id,
            group_id=item.group_id,
            title=item.title,
            description=item.description,
            status=item.status,
            created_by=item.created_by,
            creator_name=cu.name if cu else None,
            assigned_to=item.assigned_to,
            assignee_name=au.name if au else None,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @router.delete("/{group_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_group_item(
        group_id: int,
        item_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(allow_all_roles),
    ):
        """Delete a shared item — owner or item creator only."""
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        item = (
            db.query(models.StudyGroupItem)
            .filter(models.StudyGroupItem.id == item_id, models.StudyGroupItem.group_id == group_id)
            .first()
        )
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        if group.owner_id != current_user.id and item.created_by != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the group owner or item creator can delete this item")
        db.delete(item)
        db.commit()

    return router
