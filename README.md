# 🎓 CourseEnroll - Secure Enterprise Course Registration & Academic ERP

A production-ready academic ERP and course enrollment platform built with **React (TypeScript)**, **FastAPI (Python)**, and **PostgreSQL (Supabase)**. Fully implements **JWT Authentication**, **Role-Based Access Control (RBAC)**, **Admin Security Center**, **Real-Time Notification Websockets**, and **Automated Waitlist Promotion**.

---

## 🚀 Live Deployment URLs

* **Frontend Application (Vercel)**: Deployed on Vercel with responsive desktop & mobile support.
* **Backend API & Swagger Documentation**: [https://two310176-courseenroll.onrender.com/docs](https://two310176-courseenroll.onrender.com/docs)
* **API Alternative OpenAPI Schema**: `https://two310176-courseenroll.onrender.com/redoc`

---

## 👥 Seeded Instructor & Evaluator Test Accounts

> **Note:** Passwords for these demo accounts are provided in the final submission form and PDF report (never stored in the repository).

### 1. Administrator Accounts
| Name | User ID / Email | Role | Primary Features to Test |
| :--- | :--- | :--- | :--- |
| **Admin User** | `admin@university.edu` | `admin` | **Primary Admin**: Security Center, Approvals Queue, Session Revocation, User Bans, CSV Exports. |
| **Secondary Administrator** | `admin2@university.edu` | `admin` | **Co-Admin**: Verify Admin Immunity (Admins cannot ban or delete other admins, nor change their own role). |

### 2. Faculty / Instructor Accounts
| Name | User ID / Email | Role | Assigned Courses |
| :--- | :--- | :--- | :--- |
| **Sayef Reyadh** | `sreyadh@gmail.com` | `faculty` | `CSE220` (Data Structures), `CSE307` (SAD), `CSE472` (Cloud DevOps) |
| **mr potato** | `potato@gmail.com` | `faculty` | `CSE115` (C Programming), `CSE425` (SQT & Testing) |
| **Dr. Rubaiyat Islam** | `rubaiyat@gmail.com` | `faculty` | `CSE311` (DBMS), `CSE499` (Senior Capstone) |

### 3. Student Accounts
| Name | User ID / Email | Role | Academic Profile Highlights |
| :--- | :--- | :--- | :--- |
| **Mila Vance (Showcase)** | `mila@gmail.com` | `student` | **GPA 3.75**, 12 completed credits, 12 active credits, printable enrollment slip, weekly schedule timetable. |
| **Raihanur Akter** | `rai@gmail.com` | `student` | Active student registrations, catalog enrollment. |
| **Alex Turner** | `alex@gmail.com` | `student` | Active waitlist testing on `CSE425` and `CSE472`. |
| **Cat Williams** | `cat@gmail.com` | `student` | Standard student account with course history. |

### 4. Shared Study Group with Mixed Permissions
| Group Name | Owner | Member Permissions |
| :--- | :--- | :--- |
| **CSE303 Capstone Team** (or created via `/groups`) | `mila@gmail.com` | `rai@gmail.com` (`create`, `edit`), `alex@gmail.com` (`assign` only), `cat@gmail.com` (read-only) |

---

## 🔐 Security & RBAC Implementation Highlights

### 2.1 Authentication & JWT
* **Password Hashing**: Stored with industry-standard **bcrypt** salt & hash algorithms. Plain text passwords are never stored.
* **Short-Lived Signed JWTs**: Signed with HS256 and expiration set to 15 minutes or less (`ACCESS_TOKEN_EXPIRE_MINUTES`). Each token contains `sub` (email), `id`, `role`, `name`, `tv` (token version), and unique `jti` (JWT ID).
* **Token Verification & Rejection**: Verified on every protected endpoint. Missing, tampered, expired, or blacklisted tokens return **401 Unauthorized**.
* **Device Session Tracking & Token Blacklist**: Every login records IP address, User-Agent, and device hint into `UserSession`. Logout invalidates the active `jti` via `TokenBlacklist`.
* **Account Lockout Protection**: 5 consecutive failed login attempts trigger automated 30-minute lockout.

### 2.2 Reusable RBAC & Authorization
* **Single Reusable RBAC Module**: Enforced via FastAPI dependencies (`allow_admin_only`, `allow_faculty_only`, `allow_all_roles`) rather than scattered checks.
* **Safety Rules**:
  * An administrator cannot change their own role or ban another administrator.
  * Banned users (`is_banned = True`) are blocked on the very next request via token and session checks.
* **Ownership Rules**: Students can only inspect and drop their own course enrollments.

### 2.3 Admin Security Center & Moderation
* **Active Device Sessions**: Inspect real-time client sessions across Windows, macOS, Linux, iOS, and Android with one-click revocation.
* **Emergency Force Logout All**: Global kill-switch that increments `token_version` for all users, instantly invalidating all tokens.
* **Security Audit Logs**: Track `login_success`, `login_failed`, `token_malformed`, `session_revoked`, and `user_banned` with IP, User-Agent, and timestamp.
* **Content Moderation & Approvals**: Review pending registrations, approve or reject requests, and broadcast university-wide notices.

---

## 🧪 Automated Pytest Suite

Run the full automated test suite verifying login, token rejection, and 4 RBAC rules:

```bash
# Activate your virtualenv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS / Linux

# Run pytest
pytest tests/test_auth_and_rbac.py -v
```

### Verified Test Cases:
1. `test_login_success_returns_jwt`: Valid credentials return signed JWT access token.
2. `test_login_failure_invalid_password`: Invalid credentials reject with `401 Unauthorized`.
3. `test_missing_token_rejection`: Unauthenticated requests to protected routes reject with `401`.
4. `test_tampered_token_rejection`: Tampered JWT signature rejects with `401`.
5. `test_rbac_rule_1_student_blocked_from_admin_security`: Student accessing `/admin/security/stats` receives `403 Forbidden`.
6. `test_rbac_rule_2_student_blocked_from_broadcasting_announcements`: Student posting announcement receives `403 Forbidden`.
7. `test_rbac_rule_3_faculty_blocked_from_admin_user_management`: Faculty executing force-logout receives `403 Forbidden`.
8. `test_rbac_rule_4_safety_admin_cannot_ban_admin`: Admin attempting to ban another admin receives `400 Bad Request`.

---

## 🛠️ Local Development Setup

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
fastapi dev main.py
```

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

### 3. Database Re-Seeding
To reset and re-populate the entire enterprise dataset (51 users, 25 courses, 345 enrollments, 50 sessions, 636 attendance records, 12 announcements, 25 sessions, 85 security events):
```bash
python backend/seed_bulk_dataset.py
```
