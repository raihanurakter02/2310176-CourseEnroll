import pytest
import os
import sys

# Ensure root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

# ── 1. AUTHENTICATION & LOGIN TESTS ──────────────────────────────────────────

def test_login_success_returns_jwt():
    """Valid credentials return a signed JWT access token containing user metadata."""
    res = client.post("/auth/login", data={"username": "admin@university.edu", "password": "password123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data.get("token_type") == "bearer"
    assert data.get("role") == "admin"


def test_login_failure_invalid_password():
    """Invalid credentials return 401 Unauthorized."""
    res = client.post("/auth/login", data={"username": "admin@university.edu", "password": "wrongpassword_xyz"})
    assert res.status_code == 401
    assert "Incorrect email or password" in res.json().get("detail", "")


# ── 2. TOKEN REJECTION TESTS (Missing, Tampered, Invalid) ─────────────────────

def test_missing_token_rejection():
    """Protected endpoints reject requests without Authorization header with 401."""
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_tampered_token_rejection():
    """Tampered or forged JWT tokens return 401 Unauthorized."""
    headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.tampered_signature"}
    res = client.get("/auth/me", headers=headers)
    assert res.status_code == 401


# ── 3. RBAC RULE TESTS ────────────────────────────────────────────────────────

def test_rbac_rule_1_student_blocked_from_admin_security():
    """RBAC Rule 1: A student cannot access the Admin Security Center."""
    login_res = client.post("/auth/login", data={"username": "mila@gmail.com", "password": "password123"})
    assert login_res.status_code == 200
    student_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {student_token}"}

    res = client.get("/admin/security/stats", headers=headers)
    assert res.status_code == 403


def test_rbac_rule_2_student_blocked_from_broadcasting_announcements():
    """RBAC Rule 2: A student cannot create or broadcast university announcements."""
    login_res = client.post("/auth/login", data={"username": "mila@gmail.com", "password": "password123"})
    assert login_res.status_code == 200
    student_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {student_token}"}

    res = client.post("/announcements", json={
        "title": "Unauthorized Notice",
        "content": "Students should not be allowed to post this.",
        "target_role": "all",
        "priority": "urgent"
    }, headers=headers)
    assert res.status_code == 403


def test_rbac_rule_3_faculty_blocked_from_admin_user_management():
    """RBAC Rule 3: A faculty member cannot access admin user management or force logouts."""
    login_res = client.post("/auth/login", data={"username": "sreyadh@gmail.com", "password": "password123"})
    assert login_res.status_code == 200
    faculty_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {faculty_token}"}

    res = client.post("/admin/security/force-logout-all", headers=headers)
    assert res.status_code == 403


def test_rbac_rule_4_safety_admin_cannot_ban_admin():
    """Safety Rule: An administrator account cannot be banned or locked out."""
    login_res = client.post("/auth/login", data={"username": "admin@university.edu", "password": "password123"})
    assert login_res.status_code == 200
    admin_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    me_res = client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200
    admin_id = me_res.json()["id"]

    res = client.post(f"/admin/security/users/{admin_id}/ban", json={"ban_reason": "Testing admin immunity"}, headers=headers)
    assert res.status_code == 400
    assert "Administrator accounts cannot be banned" in res.json().get("detail", "")


def test_rbac_rule_5_admin_cannot_change_own_role():
    """Safety Rule: An administrator cannot change their own role."""
    login_res = client.post("/auth/login", data={"username": "admin@university.edu", "password": "password123"})
    assert login_res.status_code == 200
    admin_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    me = client.get("/auth/me", headers=headers).json()

    res = client.put(
        f"/users/{me['id']}",
        json={"name": me["name"], "email": me["email"], "role": "student"},
        headers=headers,
    )
    assert res.status_code == 400
    assert "cannot change their own role" in res.json().get("detail", "")


def test_refresh_token_rotation_and_user_sessions():
    """Login sets httpOnly refresh_token cookie, /auth/refresh rotates it, and /auth/sessions lists it."""
    c = TestClient(app)
    login_res = c.post("/auth/login", data={"username": "mila@gmail.com", "password": "password123"})
    assert login_res.status_code == 200
    assert "refresh_token" in c.cookies

    refresh_res = c.post("/auth/refresh")
    assert refresh_res.status_code == 200
    new_token = refresh_res.json()["access_token"]
    assert new_token

    sess_res = c.get("/auth/sessions", headers={"Authorization": f"Bearer {new_token}"})
    assert sess_res.status_code == 200
    assert isinstance(sess_res.json(), list)
    assert len(sess_res.json()) >= 1


def test_study_group_fine_grained_permissions():
    """Group owner can manage members; member permissions (create/edit/assign) and non-member 403 are enforced."""
    mila_token = client.post("/auth/login", data={"username": "mila@gmail.com", "password": "password123"}).json()["access_token"]
    rai_token = client.post("/auth/login", data={"username": "rai@gmail.com", "password": "password123"}).json()["access_token"]
    alex_token = client.post("/auth/login", data={"username": "alex@gmail.com", "password": "password123"}).json()["access_token"]

    mila_h = {"Authorization": f"Bearer {mila_token}"}
    rai_h = {"Authorization": f"Bearer {rai_token}"}
    alex_h = {"Authorization": f"Bearer {alex_token}"}

    # Owner creates group
    g_res = client.post("/groups", json={"name": "Pytest Group", "description": "Temp test group"}, headers=mila_h)
    assert g_res.status_code == 201
    gid = g_res.json()["id"]

    try:
        # Owner adds Rai with can_create=True, can_edit=False, can_assign=False
        m_res = client.post(
            f"/groups/{gid}/members",
            json={"email": "rai@gmail.com", "can_create": True, "can_edit": False, "can_assign": False},
            headers=mila_h,
        )
        assert m_res.status_code == 201

        # Non-member Alex is blocked (403)
        assert client.get(f"/groups/{gid}", headers=alex_h).status_code == 403

        # Rai cannot rename group (owner only -> 403)
        assert client.put(f"/groups/{gid}", json={"name": "Hijacked"}, headers=rai_h).status_code == 403

        # Rai can create item
        item_res = client.post(f"/groups/{gid}/items", json={"title": "Task 1"}, headers=rai_h)
        assert item_res.status_code == 201
        item_id = item_res.json()["id"]

        # Rai cannot edit item (can_edit=False -> 403)
        assert client.put(f"/groups/{gid}/items/{item_id}", json={"status": "done"}, headers=rai_h).status_code == 403
    finally:
        # Clean up
        client.delete(f"/groups/{gid}", headers=mila_h)
