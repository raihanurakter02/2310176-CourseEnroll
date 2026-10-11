# CourseEnroll — Technical Design Document (TDD)
| Field | Details |
| --- | --- |
| **Project** | CourseEnroll – University Course Enrollment Management System |
| **Document** | Technical Design Document (TDD) |
| **Version** | 1.0 |
| **Date** | 10 October 2026 |
| **Author** | Raihanur Akter — Student ID: 2310176 |
| **Course / Section** | Web Application & Internet (Course Code: 309), Section 06 |
| **Submitted To** | Sayef Reyadh, Lecturer |
| **Task Issue Link** | [https://github.com/raihanurakter02/2310176-CourseEnroll/issues/1#issue-5791617388] |
| **Pull Request Link** | [https://github.com/raihanurakter02/2310176-CourseEnroll/pull/4#issue-5794783845] |
| **Related Documents** | [PRD](PRD.md) · [SRS](SRS.md) |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack and Rationale](#3-technology-stack-and-rationale)
4. [Backend Design](#4-backend-design)
5. [Database Design](#5-database-design)
6. [Authentication, Authorization and RBAC Design](#6-authentication-authorization-and-rbac-design)
7. [REST API Design](#7-rest-api-design)
8. [Key Business Logic and Sequences](#8-key-business-logic-and-sequences)
9. [Frontend Design](#9-frontend-design)
10. [Validation and Error Handling](#10-validation-and-error-handling)
11. [Security Design](#11-security-design)
12. [Testing Plan](#12-testing-plan)
13. [Configuration, Deployment and Running Locally](#13-configuration-deployment-and-running-locally)
14. [Development Workflow and Git Strategy](#14-development-workflow-and-git-strategy)
15. [Technical Risks and Mitigation](#15-technical-risks-and-mitigation)

---

## 1. Introduction

### 1.1 Purpose

This TDD explains **how** CourseEnroll will be built to satisfy the [PRD](PRD.md) and [SRS](SRS.md): architecture, technology choices, database schema, API contracts, security design, frontend structure and test plan.

### 1.2 Design Goals

| Goal | Design Response |
| --- | --- |
| Security first | JWT + bcrypt; scope checks centralized in reusable dependencies; ownership checks in services. |
| Simplicity | Three tables, three roles, 18 endpoints; no unnecessary services. |
| Maintainability | Layered backend (router → service → model); component-based frontend. |
| Consistency | Pydantic schemas (backend) mirrored by TypeScript interfaces (frontend). |
| Testability | Business logic isolated in services; dependency-injected DB session. |

---

## 2. System Architecture

CourseEnroll uses a **three-tier client–server architecture**.

```mermaid
flowchart TB
    subgraph Client["Presentation Tier — React + TypeScript"]
        UI["Student UI | Faculty UI | Admin UI"]
        AX["Axios services + AuthContext + ProtectedRoute"]
    end
    subgraph Server["Application Tier — FastAPI (Python)"]
        MW["CORS / Exception handlers"]
        AUTH["Authentication (JWT verify)"]
        RBAC["RBAC: role + scope dependencies"]
        RT["Routers"]
        SV["Services (business rules)"]
        MD["SQLAlchemy models"]
    end
    subgraph Data["Data Tier"]
        DB[("SQLite (dev) / PostgreSQL<br/>users · courses · enrollments")]
    end
    UI --> AX -->|"REST API (JSON/HTTPS)"| MW --> AUTH --> RBAC --> RT --> SV --> MD -->|"SQLAlchemy ORM"| DB
```

### 2.1 Request Flow

1. The user logs in and receives a JWT access token.
2. React stores the token and an Axios interceptor attaches `Authorization: Bearer <token>` to every request.
3. FastAPI decodes and verifies the token (**authentication**) and loads the user from the database.
4. A dependency checks the user's role and the required scope (**authorization**).
5. If permitted, the router calls the service layer, which enforces business rules and ownership, then returns JSON. Otherwise `401` or `403` is returned.

---

## 3. Technology Stack and Rationale

| Layer | Technology | Purpose / Rationale |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite, React Router v6, Axios | Component-based UI, type safety, client-side routing, HTTP client with interceptors. |
| Backend | Python 3.11+, FastAPI, Pydantic v2, Uvicorn | Fast development, automatic validation, OpenAPI/Swagger docs, dependency injection for RBAC. |
| Authentication | JWT (`python-jose` or `PyJWT`), `passlib[bcrypt]` | Stateless token auth; salted password hashing. |
| Authorization | FastAPI dependencies + `SecurityScopes` | Declarative, reusable scope enforcement. |
| Database | SQLite (dev) / PostgreSQL, SQLAlchemy 2.x ORM | Zero-setup development; relational integrity; parameterized queries. |
| Testing | Pytest, FastAPI `TestClient`, Postman, Swagger UI | Automated backend tests and manual API checks. |
| Tools | Git, GitHub, VS Code | Version control, issues, PRs. |

---

## 4. Backend Design

### 4.1 Project Structure

```
CourseEnroll/
├── docs/                      # PRD.md, SRS.md, TDD.md
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, router registration
│   │   ├── core/
│   │   │   ├── config.py      # Settings (env vars)
│   │   │   ├── security.py    # hash/verify password, create/decode JWT
│   │   │   └── scopes.py      # ROLE_SCOPES mapping
│   │   ├── db/
│   │   │   ├── base.py        # Declarative Base
│   │   │   └── session.py     # engine, SessionLocal, get_db
│   │   ├── models/            # user.py, course.py, enrollment.py
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── dependencies/
│   │   │   └── auth.py        # get_current_user, require_scopes, require_role
│   │   ├── routers/           # auth.py, courses.py, enrollments.py, faculty.py, users.py
│   │   ├── services/          # auth_service.py, course_service.py, enrollment_service.py, user_service.py
│   │   └── seed.py            # creates initial admin (and optional demo data)
│   ├── tests/                 # pytest suites
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/ …                 # see Section 9
```

### 4.2 Layer Responsibilities

| Layer | Responsibility | Must NOT |
| --- | --- | --- |
| **Router** | HTTP concerns: path, method, status code, dependencies (auth + scope), schema binding. | Contain business logic or raw queries. |
| **Service** | Business rules (capacity, duplicates, ownership), transactions. | Know about HTTP request objects. |
| **Model** | ORM table mapping and relationships. | Contain business logic. |
| **Schema** | Validation and serialization (Pydantic). | Expose `password_hash`. |
| **Dependency** | Token verification, scope/role checks, DB session. | Execute business logic. |

Services raise a small set of domain exceptions (`NotFoundError`, `ForbiddenError`, `ConflictError`, `BadRequestError`) mapped to `404`, `403`, `409`, `400` by global exception handlers.

---

## 5. Database Design

### 5.1 Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ COURSES : "teaches (faculty_id)"
    USERS ||--o{ ENROLLMENTS : "enrolls (student_id)"
    COURSES ||--o{ ENROLLMENTS : "has"

    USERS {
        int id PK
        string name
        string email UK
        string password_hash
        enum role "student|faculty|admin"
        bool is_active
    }
    COURSES {
        int id PK
        string course_code UK
        string course_name
        text description
        int credit
        int capacity
        int faculty_id FK
    }
    ENROLLMENTS {
        int id PK
        int student_id FK
        int course_id FK
        datetime enrolled_at
        enum status "active|dropped"
    }
```

### 5.2 Table Definitions

**users**

| Column | Type | Constraints |
| --- | --- | --- |
| id | INTEGER | PK, autoincrement |
| name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | NOT NULL, UNIQUE, indexed |
| password_hash | VARCHAR(255) | NOT NULL |
| role | ENUM('student','faculty','admin') | NOT NULL, default `student` |
| is_active | BOOLEAN | NOT NULL, default `true` |

**courses**

| Column | Type | Constraints |
| --- | --- | --- |
| id | INTEGER | PK |
| course_code | VARCHAR(20) | NOT NULL, UNIQUE |
| course_name | VARCHAR(150) | NOT NULL |
| description | TEXT | NULL |
| credit | INTEGER | NOT NULL, CHECK (credit > 0) |
| capacity | INTEGER | NOT NULL, CHECK (capacity > 0) |
| faculty_id | INTEGER | NULL, FK → users.id (`ON DELETE SET NULL`), indexed |

**enrollments**

| Column | Type | Constraints |
| --- | --- | --- |
| id | INTEGER | PK |
| student_id | INTEGER | NOT NULL, FK → users.id, indexed |
| course_id | INTEGER | NOT NULL, FK → courses.id, indexed |
| enrolled_at | DATETIME | NOT NULL, default `now()` (UTC) |
| status | ENUM('active','dropped') | NOT NULL, default `active` |
| | | UNIQUE (student_id, course_id) |

### 5.3 Relationships and Integrity

- **Faculty → Courses:** 1 : N via `courses.faculty_id`.
- **Students ↔ Courses:** M : N resolved through `enrollments`.
- The unique constraint `(student_id, course_id)` guarantees one row per student per course; a re-enrollment after a drop **reactivates** the existing row (status → `active`, `enrolled_at` refreshed).
- **Seats available** is computed, not stored:

```sql
SELECT c.capacity - COUNT(e.id) FILTER (WHERE e.status = 'active') AS seats_available
FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id
WHERE c.id = :course_id GROUP BY c.id;
```

- Role/active checks for faculty assignment are enforced in the service layer (BR-12).

---

## 6. Authentication, Authorization and RBAC Design

### 6.1 Authentication

- **Password hashing:** `bcrypt` via `passlib` (salted, adaptive cost).
- **Login:** the service looks up the user by email, verifies the hash, checks `is_active`, then issues a JWT.
- **Token (HS256):**

```json
{
  "sub": "12",
  "role": "student",
  "scopes": ["courses:read", "enrollments:create", "enrollments:read_own", "enrollments:delete_own"],
  "exp": 1760000000
}
```

- **Expiry:** `ACCESS_TOKEN_EXPIRE_MINUTES = 60` (configurable).
- **Secret:** `SECRET_KEY` from environment variables (never committed).
- **Logout:** client-side token removal (stateless JWT; no blacklist in this version).

### 6.2 Role → Scope Mapping (`core/scopes.py`)

```python
ROLE_SCOPES = {
    "student": ["courses:read", "enrollments:create",
                "enrollments:read_own", "enrollments:delete_own"],
    "faculty": ["courses:read", "courses:update", "enrollments:read_assigned"],
    "admin":   ["courses:read", "courses:create", "courses:update", "courses:delete",
                "enrollments:read_all", "users:read", "users:manage", "faculty:assign"],
}
```

### 6.3 Authorization Dependencies (`dependencies/auth.py`)

```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", scopes={...})

def get_current_user(security_scopes: SecurityScopes,
                     token: str = Depends(oauth2_scheme),
                     db: Session = Depends(get_db)) -> User:
    payload = decode_token(token)                    # 401 if invalid/expired
    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:           # SEC-7 / BR-16
        raise HTTPException(401, "Invalid or inactive user")
    for scope in security_scopes.scopes:             # authorization
        if scope not in ROLE_SCOPES[user.role]:      # DB role is the source of truth
            raise HTTPException(403, "Not enough permissions")
    return user

# usage in a router
@router.post("/courses", status_code=201)
def create_course(data: CourseCreate,
                  user: User = Security(get_current_user, scopes=["courses:create"]),
                  db: Session = Depends(get_db)): ...
```

Scopes are validated against the **current role in the database** (not only the token claim), so a role change by an Admin takes effect immediately.

`require_role("faculty")` is used for `/faculty/courses` where the access rule is the Faculty role itself.

### 6.4 Ownership Checks (service layer)

| Rule | Where | Error |
| --- | --- | --- |
| Student may drop only own enrollment (`enrollment.student_id == user.id`) | `enrollment_service.drop` | `403` |
| Faculty may view/update only courses with `course.faculty_id == user.id` | `course_service.update`, `faculty` router | `403` |
| Faculty may not change `capacity`, `course_code`, `faculty_id` | `course_service.update` | `403` |
| Admin may not deactivate/demote self | `user_service.update` | `400` |

### 6.5 Frontend Protection

React `ProtectedRoute` redirects unauthenticated users to `/login` and users with the wrong role to a "Not authorized" page. This improves UX only; **the backend remains the final authority**.

---

## 7. REST API Design

Base URL (dev): `http://localhost:8000`. All bodies are JSON. Protected routes require `Authorization: Bearer <token>`. Interactive docs: `/docs` (Swagger UI).

### 7.1 Endpoint Summary

| # | Method | Endpoint | Description | Access | Success |
| :-: | --- | --- | --- | --- | :-: |
| 1 | POST | `/auth/register` | Register new user (Student) | Public | 201 |
| 2 | POST | `/auth/login` | Login, receive token | Public | 200 |
| 3 | GET | `/auth/me` | Current user profile | Authenticated | 200 |
| 4 | GET | `/courses` | List courses (`?q=&skip=&limit=`) | `courses:read` | 200 |
| 5 | GET | `/courses/{id}` | Course details | `courses:read` | 200 |
| 6 | POST | `/courses` | Create course | `courses:create` | 201 |
| 7 | PUT | `/courses/{id}` | Update course | `courses:update` (+ownership) | 200 |
| 8 | DELETE | `/courses/{id}` | Delete course | `courses:delete` | 204 |
| 9 | PUT | `/courses/{id}/faculty` | Assign faculty | `faculty:assign` | 200 |
| 10 | POST | `/enrollments` | Enroll | `enrollments:create` | 201 |
| 11 | GET | `/enrollments/my` | Own enrollments | `enrollments:read_own` | 200 |
| 12 | DELETE | `/enrollments/{id}` | Drop enrollment | `enrollments:delete_own` | 200 |
| 13 | GET | `/enrollments` | All enrollments (`?course_id=&student_id=`) | `enrollments:read_all` | 200 |
| 14 | GET | `/faculty/courses` | Assigned courses | Faculty role | 200 |
| 15 | GET | `/faculty/courses/{id}/students` | Students in assigned course | `enrollments:read_assigned` | 200 |
| 16 | GET | `/users` | List users (`?role=`) | `users:read` | 200 |
| 17 | PUT | `/users/{id}` | Update role / status | `users:manage` | 200 |
| 18 | DELETE | `/users/{id}` | Deactivate user | `users:manage` | 200 |

### 7.2 Request / Response Contracts

#### Authentication

**POST `/auth/register`**

```json
// Request
{ "name": "Rafi Ahmed", "email": "rafi@uni.edu", "password": "Passw0rd!" }
// 201 Response
{ "id": 5, "name": "Rafi Ahmed", "email": "rafi@uni.edu", "role": "student", "is_active": true }
```

Errors: `409` email exists · `400` invalid input.

**POST `/auth/login`** (JSON body `{ "email", "password" }`)

```json
// 200 Response
{ "access_token": "<jwt>", "token_type": "bearer",
  "user": { "id": 5, "name": "Rafi Ahmed", "email": "rafi@uni.edu", "role": "student" } }
```

Errors: `401` invalid credentials · `403` account deactivated.

**GET `/auth/me`** → `200 { id, name, email, role, is_active }` · `401` invalid/missing token.

#### Courses

`CourseOut` (used in list/detail responses):

```json
{ "id": 3, "course_code": "CSE303", "course_name": "Database Systems",
  "description": "Relational model, SQL, normalization.", "credit": 3, "capacity": 40,
  "enrolled_count": 31, "seats_available": 9,
  "faculty": { "id": 2, "name": "Dr. Nila" } }
```

| Endpoint | Request body | Success | Errors |
| --- | --- | --- | --- |
| GET `/courses` | — (query: `q`, `skip=0`, `limit=50`) | `200 [CourseOut]` | 401, 403 |
| GET `/courses/{id}` | — | `200 CourseOut` | 401, 404 |
| POST `/courses` | `{ course_code, course_name, description?, credit, capacity }` | `201 CourseOut` | 400, 401, 403, 409 (duplicate code) |
| PUT `/courses/{id}` | Admin: any of `course_name, description, credit, capacity, course_code`. Faculty: only `course_name, description, credit`. | `200 CourseOut` | 400, 401, 403 (not assigned / restricted field), 404, 409 |
| DELETE `/courses/{id}` | — | `204` | 401, 403, 404, 409 (active enrollments) |
| PUT `/courses/{id}/faculty` | `{ "faculty_id": 2 }` | `200 CourseOut` | 400 (not an active faculty), 401, 403, 404 |

Capacity cannot be reduced below the current number of active enrollments (`409`).

#### Enrollments

`EnrollmentOut`:

```json
{ "id": 11, "course": { "id": 3, "course_code": "CSE303", "course_name": "Database Systems", "credit": 3 },
  "student": { "id": 5, "name": "Rafi Ahmed" }, "enrolled_at": "2026-10-12T09:30:00Z", "status": "active" }
```

| Endpoint | Request | Success | Errors |
| --- | --- | --- | --- |
| POST `/enrollments` | `{ "course_id": 3 }` | `201 EnrollmentOut` | 401, 403, 404 (course), 409 (already enrolled / course full) |
| GET `/enrollments/my` | — | `200 [EnrollmentOut]` (active only, own) | 401, 403 |
| DELETE `/enrollments/{id}` | — | `200 EnrollmentOut` (`status: dropped`) | 401, 403 (not owner), 404, 409 (already dropped) |
| GET `/enrollments` | query: `course_id?`, `student_id?` | `200 [EnrollmentOut]` | 401, 403 |

#### Faculty

| Endpoint | Success | Errors |
| --- | --- | --- |
| GET `/faculty/courses` | `200 [CourseOut]` (only `faculty_id == me`) | 401, 403 |
| GET `/faculty/courses/{id}/students` | `200 [ { id, name, email, enrolled_at } ]` (active enrollments) | 401, 403 (not assigned), 404 |

#### Users (Admin)

`UserOut`: `{ id, name, email, role, is_active }`

| Endpoint | Request | Success | Errors |
| --- | --- | --- | --- |
| GET `/users` | query: `role?` | `200 [UserOut]` | 401, 403 |
| PUT `/users/{id}` | `{ "role"?: "faculty", "is_active"?: false }` | `200 UserOut` | 400 (self change), 401, 403, 404, 409 (faculty has assigned courses) |
| DELETE `/users/{id}` | — | `200 UserOut` (`is_active: false`) | 400 (self), 401, 403, 404, 409 |

### 7.3 Status Code Usage

| Code | Used for |
| --- | --- |
| 200 / 201 / 204 | Success / Created / No content |
| 400 | Invalid input or violated request rule (e.g., assigning a non-faculty user) |
| 401 | Missing, invalid or expired token; inactive user on a protected call |
| 403 | Authenticated but lacking scope or ownership |
| 404 | Resource not found |
| 409 | Conflict (duplicate email/course code/enrollment, course full, delete blocked) |

---

## 8. Key Business Logic and Sequences

### 8.1 Enroll in a Course

```mermaid
sequenceDiagram
    actor S as Student
    participant FE as React (Axios)
    participant API as FastAPI Router
    participant DEP as Auth/RBAC Dependency
    participant SVC as enrollment_service
    participant DB as Database

    S->>FE: Click "Enroll"
    FE->>API: POST /enrollments {course_id} + Bearer token
    API->>DEP: verify JWT + scope enrollments:create
    DEP-->>API: current_user (Student)
    API->>SVC: enroll(user, course_id)
    SVC->>DB: SELECT course (404 if missing)
    SVC->>DB: SELECT enrollment (student, course)
    alt active enrollment exists
        SVC-->>API: ConflictError "Already enrolled" (409)
    else
        SVC->>DB: COUNT active enrollments of course
        alt count >= capacity
            SVC-->>API: ConflictError "Course is full" (409)
        else
            SVC->>DB: INSERT enrollment OR reactivate dropped one (commit)
            SVC-->>API: EnrollmentOut
            API-->>FE: 201 Created
        end
    end
```

**Concurrency note:** the capacity check and insert run inside one database transaction. On PostgreSQL the course row is locked (`SELECT … FOR UPDATE`) during enrollment so two students cannot take the last seat simultaneously; on SQLite (development) writes are serialized.

### 8.2 Drop an Enrollment

1. Load the enrollment by `id` → `404` if missing.
2. If `enrollment.student_id != current_user.id` → `403`.
3. If `status == dropped` → `409`.
4. Set `status = dropped`, commit, return `200`.

### 8.3 Assign Faculty

1. Load course (`404`) and target user (`404`).
2. If `user.role != faculty` or `not user.is_active` → `400`.
3. Set `course.faculty_id = user.id`, commit, return updated `CourseOut`.

### 8.4 Delete Course

If any `active` enrollment exists → `409`; otherwise delete the course and its dropped enrollment rows, return `204`.

### 8.5 User Update (Admin)

1. If target is the current admin → `400` (BR-14).
2. If changing from `faculty` or deactivating a faculty who has assigned courses → `409` (BR-15).
3. Apply role/status change and commit. The new role applies on the user's next request (Section 6.3).

---

## 9. Frontend Design

### 9.1 Project Structure

```
frontend/src/
├── components/        # Navbar, Sidebar, CourseCard, EnrollmentTable, ConfirmDialog, Loader, Alert
├── pages/
│   ├── auth/          # LoginPage, RegisterPage
│   ├── student/       # Dashboard, CourseList, CourseDetails, MyCourses
│   ├── faculty/       # Dashboard, AssignedCourses, CourseStudents
│   └── admin/         # Dashboard, ManageUsers, ManageCourses, Assignments
├── layouts/           # AuthLayout, StudentLayout, FacultyLayout, AdminLayout
├── services/          # api.ts (Axios instance), authService.ts, courseService.ts,
│                      #   enrollmentService.ts, facultyService.ts, userService.ts
├── context/           # AuthContext.tsx
├── hooks/             # useAuth.ts, useFetch.ts
├── routes/            # AppRoutes.tsx, ProtectedRoute.tsx
├── types/             # user.ts, course.ts, enrollment.ts (mirror backend schemas)
└── main.tsx, App.tsx
```

### 9.2 Routes and Access

| Route | Page | Allowed Role |
| --- | --- | --- |
| `/login`, `/register` | Auth pages | Public |
| `/student/dashboard` | Student dashboard (summary of enrolled courses) | Student |
| `/student/courses` | Browse/search courses | Student |
| `/student/courses/:id` | Course details + Enroll button | Student |
| `/student/my-courses` | Enrolled courses + Drop button | Student |
| `/faculty/dashboard` | Faculty dashboard | Faculty |
| `/faculty/courses` | Assigned courses | Faculty |
| `/faculty/courses/:id` | Course details/edit + enrolled students | Faculty |
| `/admin/dashboard` | Admin dashboard | Admin |
| `/admin/users` | Users: change role / deactivate | Admin |
| `/admin/courses` | Create / edit / delete courses | Admin |
| `/admin/assignments` | Assign faculty to courses, view all enrollments | Admin |

### 9.3 TypeScript Types (excerpt)

```ts
export type Role = "student" | "faculty" | "admin";

export interface User { id: number; name: string; email: string; role: Role; is_active: boolean; }

export interface Course {
  id: number; course_code: string; course_name: string; description?: string;
  credit: number; capacity: number; enrolled_count: number; seats_available: number;
  faculty: { id: number; name: string } | null;
}

export interface Enrollment {
  id: number; status: "active" | "dropped"; enrolled_at: string;
  course: Pick<Course, "id" | "course_code" | "course_name" | "credit">;
  student: { id: number; name: string };
}
```

### 9.4 Auth Context, Axios and Protected Routes

- **AuthContext** holds `user`, `token`, `login()`, `logout()`; on app start it restores the token from `localStorage` and calls `GET /auth/me` to validate it.
- **Axios instance** (`services/api.ts`): `baseURL` from `VITE_API_URL`; a request interceptor adds the Bearer token; a response interceptor logs the user out and redirects to `/login` on `401`.
- **ProtectedRoute**:

```tsx
export function ProtectedRoute({ allowedRoles }: { allowedRoles: Role[] }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/not-authorized" replace />;
  return <Outlet />;
}
```

- After login the user is redirected by role: `student → /student/dashboard`, `faculty → /faculty/dashboard`, `admin → /admin/dashboard`.

### 9.5 UI Behavior

| Concern | Design |
| --- | --- |
| Feedback | Alert/toast for every action; backend `detail` message displayed on `409`/`403`. |
| Loading / empty states | Loader while fetching; "No courses found" empty state. |
| Seat info | Course cards show `seats_available / capacity`; Enroll button disabled when 0. |
| Destructive actions | Drop / delete / deactivate use a confirmation dialog. |
| Responsiveness | CSS Grid/Flexbox; sidebar collapses to a top menu on small screens. |
| Token storage | `localStorage` (acceptable for this academic scope; see Section 11 for trade-offs). |

---

## 10. Validation and Error Handling

| Input | Rule (Pydantic) |
| --- | --- |
| `name` | 2–100 characters |
| `email` | Valid email format (`EmailStr`), normalized to lowercase |
| `password` | Minimum 8 characters |
| `course_code` | 3–20 characters, alphanumeric, uppercased |
| `credit`, `capacity` | Integers > 0 (credit ≤ 6, capacity ≤ 500) |
| `role` | One of `student`, `faculty`, `admin` |

**Global handlers** convert domain exceptions and `RequestValidationError` into a uniform JSON body:

```json
{ "detail": "Course is full" }
```

Unexpected exceptions return `500 { "detail": "Internal server error" }` with the stack trace logged server-side only.

---

## 11. Security Design

| Threat | Mitigation |
| --- | --- |
| Password theft | bcrypt salted hashes; `password_hash` never returned in any schema. |
| Token forgery / tampering | HS256 signature with strong secret from environment; expiry enforced. |
| Privilege escalation via registration | Registration always creates `student`; role changes are Admin-only. |
| Privilege escalation via stale token | Role/active status re-read from DB on every request. |
| Broken object-level authorization | Ownership checks in services (own enrollment, assigned course). |
| SQL injection | SQLAlchemy ORM with bound parameters only. |
| Invalid / malicious input | Pydantic validation on all request bodies and query params. |
| Cross-origin abuse | CORS restricted to the configured frontend origin. |
| Information leakage | Generic `401` for wrong email or password; no stack traces to clients. |
| XSS (token in `localStorage`) | React escapes output by default; no `dangerouslySetInnerHTML`. Trade-off accepted for scope; an `HttpOnly` cookie is listed as a future hardening. |
| Transport security | HTTPS required in deployment. |

---

## 12. Testing Plan

### 12.1 Strategy

| Type | Tooling | Coverage |
| --- | --- | --- |
| API testing | Swagger UI, Postman collection | Every endpoint, success and failure |
| Authentication tests | Pytest + TestClient | Valid login, invalid password, expired/missing token |
| Authorization tests | Pytest + TestClient | `403` for every restricted role/endpoint pair |
| Business-rule tests | Pytest | Duplicate enrollment, full course, not-owner drop, re-enroll after drop |
| Unit tests | Pytest | Service layer functions with an in-memory SQLite DB |
| UI testing | Manual checklist | Each role's workflow end-to-end |

Test fixtures create one Admin, two Faculty, three Students and sample courses in an in-memory SQLite database.

### 12.2 Test Case Matrix

| ID | Requirement | Scenario | Expected Result |
| --- | --- | --- | --- |
| TC-01 | FR-1 | Register with valid data | `201`, role = student |
| TC-02 | FR-1 | Register with an existing email | `409` |
| TC-03 | FR-2/3 | Login with valid credentials | `200`, access token returned |
| TC-04 | FR-2 | Login with wrong password | `401` |
| TC-05 | FR-2 | Login with deactivated account | `403` |
| TC-06 | FR-3 | Decode issued token | Contains `sub`, `role`, `scopes`, `exp` |
| TC-07 | FR-4 | `GET /auth/me` with valid token | `200`, correct profile |
| TC-08 | FR-4 | `GET /auth/me` with missing or expired token | `401` |
| TC-09 | FR-5 | `GET /courses` as student | `200`, list with `seats_available` |
| TC-10 | FR-6 | `GET /courses/{id}` existing course | `200`, details incl. faculty |
| TC-11 | FR-6 | `GET /courses/9999` | `404` |
| TC-12 | FR-7 | Student enrolls in course with free seats | `201`, seats decrease by 1 |
| TC-13 | FR-7 | Student enrolls in same course again | `409` |
| TC-14 | FR-7 | Student enrolls in a full course | `409` |
| TC-15 | FR-7 | Student re-enrolls after dropping | `201`, existing record reactivated |
| TC-16 | FR-8 | Student drops own enrollment | `200`, status `dropped`, seat freed |
| TC-17 | FR-8 | Student drops another student's enrollment | `403` |
| TC-18 | FR-8 | Student drops an already dropped enrollment | `409` |
| TC-19 | FR-9 | `GET /enrollments/my` | Only own, active enrollments |
| TC-20 | FR-10 | Faculty `GET /faculty/courses` | Only courses assigned to that faculty |
| TC-21 | FR-11 | Faculty lists students of assigned course | `200`, active students only |
| TC-22 | FR-11 | Faculty lists students of another's course | `403` |
| TC-23 | FR-12 | Faculty updates description of assigned course | `200` |
| TC-24 | FR-12 | Faculty updates unassigned course, or changes `capacity` | `403` |
| TC-25 | FR-13 | Admin creates course | `201` |
| TC-26 | FR-13 | Admin creates course with duplicate code | `409` |
| TC-27 | FR-13 | Admin updates course (incl. capacity) | `200`; capacity below active count → `409` |
| TC-28 | FR-13 | Admin deletes course (with / without active enrollments) | `409` / `204` |
| TC-29 | FR-14 | Admin lists users (`?role=faculty`) | `200`, filtered list |
| TC-30 | FR-14 | Admin changes user role to faculty | `200`; new role effective next request |
| TC-31 | FR-14 | Admin deactivates user; user tries to log in / use old token | `403` / `401` |
| TC-32 | FR-14 | Admin deactivates self; deactivate faculty with courses | `400` / `409` |
| TC-33 | FR-15 | Admin assigns an active faculty to a course | `200`, `faculty` set |
| TC-34 | FR-15 | Admin assigns a student as faculty | `400` |
| TC-35 | FR-16 | Admin lists all enrollments with `course_id` filter | `200`, filtered list |

### 12.3 RBAC Sweep (cross-cutting)

A parameterized Pytest test iterates over **every endpoint × every role** (Student, Faculty, Admin, anonymous) using the matrix in SRS Appendix A and asserts `401` for anonymous, `403` for forbidden roles and success for permitted roles.

### 12.4 Manual UI Checklist

- Student: register → login → browse → enroll → see in My Courses → drop.
- Faculty: login → assigned courses → student list → edit description.
- Admin: login → create course → assign faculty → promote a user → deactivate → view enrollments.
- Directly open another role's URL → redirected / "Not authorized".

### 12.5 Exit Criteria

All TC-01–TC-35 and the RBAC sweep pass; no endpoint is reachable without the required scope; each role completes its UI workflow.

---

## 13. Configuration, Deployment and Running Locally

### 13.1 Environment Variables (`backend/.env.example`)

```
DATABASE_URL=sqlite:///./courseenroll.db        # or postgresql+psycopg2://user:pass@host/db
SECRET_KEY=change-me-to-a-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
FRONTEND_ORIGIN=http://localhost:5173
ADMIN_EMAIL=admin@university.edu
ADMIN_PASSWORD=ChangeMe123!
```

Frontend `.env`: `VITE_API_URL=http://localhost:8000`

### 13.2 Run Locally

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed                                     # creates the first admin
uvicorn app.main:app --reload                          # http://localhost:8000/docs

# Frontend
cd frontend
npm install
npm run dev                                            # http://localhost:5173

# Tests
cd backend && pytest -v
```

### 13.3 Deployment Notes

- Switch `DATABASE_URL` to PostgreSQL for deployment; create tables via Alembic migrations (or `Base.metadata.create_all` for the academic demo).
- Serve the backend with Uvicorn/Gunicorn behind HTTPS; build the frontend with `npm run build` and host the static files.
- Secrets are supplied by environment variables only.

---

## 14. Development Workflow and Git Strategy

| Item | Convention |
| --- | --- |
| Repository layout | `docs/` (PRD, SRS, TDD), `backend/`, `frontend/` |
| Branching | `main` (stable) · feature branches such as `docs/prd-srs-tdd`, `feature/auth`, `feature/enrollment` |
| Task tracking | One GitHub **Issue** per task (e.g., "Add PRD, SRS and TDD documents"); referenced in the PR (`Closes #<issue>`). |
| Pull requests | Each PR links its Issue, describes changes, and is merged after self-review. |
| Commit messages | Imperative and scoped, e.g. `docs: add SRS`, `feat(api): add enrollment endpoints`. |
| Documentation submission | PRD, SRS and TDD placed in the repo's `docs/` folder, with the Task Issue and PR link recorded at the top of each document. |

**Implementation order:** database models → authentication → RBAC dependencies → courses → enrollments → faculty → users → frontend auth and routing → role pages → tests and polish (core features first, per the risk plan).

---

## 15. Technical Risks and Mitigation

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Authorization bugs (missed scope or ownership check) | Data exposure | Centralized dependencies; RBAC sweep test across all endpoints and roles. |
| Race condition on last seat | Over-enrollment | Transactional check + row lock on PostgreSQL. |
| Frontend–backend contract drift | Integration bugs | OpenAPI as source of truth; TypeScript types mirror Pydantic schemas. |
| Stale roles in tokens | Wrong access after role change | Role and active flag re-read from DB on each request. |
| Scope creep | Missed deadline | Strict adherence to PRD scope; extras only in Future Enhancements. |
| Token stored in `localStorage` | XSS exposure | React output escaping; no raw HTML rendering; documented trade-off. |