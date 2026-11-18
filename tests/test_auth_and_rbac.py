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
