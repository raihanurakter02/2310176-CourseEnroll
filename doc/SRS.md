# CourseEnroll — Software Requirements Specification (SRS)

| Field | Details |
| --- | --- |
| **Project** | CourseEnroll – University Course Enrollment Management System |
| **Document** | Software Requirements Specification (SRS) |
| **Version** | 1.0 |
| **Date** | 10 October 2026 |
| **Author** | Raihanur Akter — Student ID: 2310176 |
| **Course / Section** | Web Application & Internet (Course Code: 309), Section 06 |
| **Submitted To** | Sayef Reyadh, Lecturer |
| **Task Issue Link** | [https://github.com/raihanurakter02/2310176-CourseEnroll/issues/1#issue-5791617388] |
| **Pull Request Link** | [https://github.com/raihanurakter02/2310176-CourseEnroll/pull/4#issue-5794783845] |
| **Related Documents** | [PRD](PRD.md) · [TDD](TDD.md) |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Specific Requirements](#3-specific-requirements)
   - 3.1 External Interface Requirements
   - 3.2 Functional Requirements
   - 3.3 Business Rules
   - 3.4 REST API Requirements
   - 3.5 Security, Authentication and Authorization Requirements
   - 3.6 Data Requirements
   - 3.7 Non-Functional Requirements
4. [Use Cases](#4-use-cases)
5. [Appendices](#5-appendices)
6. [Requirements Traceability Matrix](#6-requirements-traceability-matrix)

---

## 1. Introduction

### 1.1 Purpose

This SRS specifies the functional and non-functional requirements of **CourseEnroll**, a web-based university course enrollment system. It is the reference for design, implementation and testing. Intended readers: the development team, faculty evaluators and testers.

### 1.2 Scope

CourseEnroll lets **students** browse and enroll in courses, **faculty** manage their assigned courses and view enrolled students, and **administrators** manage users, courses and faculty assignments. Access is controlled by authentication (JWT) and role-based authorization with permission scopes. The system comprises a React + TypeScript web client, a FastAPI REST backend and a relational database.

**Out of scope:** payments/fees, attendance/exams/GPA, AI/ML recommendation or chatbot, email/SMS notifications, timetable generation, live chat, mobile app, microservices.

### 1.3 Definitions, Acronyms and Abbreviations

| Term | Meaning |
| --- | --- |
| API | Application Programming Interface |
| REST | Representational State Transfer |
| JWT | JSON Web Token |
| RBAC | Role-Based Access Control |
| Scope | A named permission (e.g., `courses:create`) attached to a role and checked by the backend |
| ORM | Object-Relational Mapping (SQLAlchemy) |
| PRD / SRS / TDD | Product Requirements / Software Requirements Specification / Technical Design Document |
| FR / NFR / BR | Functional Requirement / Non-Functional Requirement / Business Rule |

### 1.4 References

- CourseEnroll Project Proposal (8 October 2026)
- [CourseEnroll PRD](PRD.md) and [CourseEnroll TDD](TDD.md)
- IEEE Std 830-1998 / ISO/IEC/IEEE 29148 (SRS structure guidance)
- FastAPI, SQLAlchemy, Pydantic and React documentation

### 1.5 Document Overview

Section 2 describes the product context. Section 3 lists the specific, testable requirements. Section 4 gives use cases. Section 5 contains appendices and Section 6 maps requirements to features and tests.

---

## 2. Overall Description

### 2.1 Product Perspective

CourseEnroll is a standalone, three-tier client–server application:

```
Browser (React + TypeScript)  --HTTPS/JSON-->  FastAPI backend  --SQLAlchemy-->  Database
```

### 2.2 Product Functions (summary)

- Authentication: register, login, current-user profile.
- Student: view courses, enroll, drop, view own enrollments.
- Faculty: view assigned courses, view enrolled students, update assigned course details.
- Admin: manage courses, manage users/roles, assign faculty, view all enrollments.

### 2.3 User Classes and Characteristics

| User Class | Characteristics | Technical Skill |
| --- | --- | --- |
| Student | Largest user group; uses the system mainly during enrollment periods. | Basic |
| Faculty | Uses the system to view courses/students. | Basic |
| Admin | Small group; manages all data. | Basic–Intermediate |

### 2.4 Operating Environment

- **Client:** any modern browser (Chrome, Firefox, Edge, Safari – latest two versions).
- **Server:** Python 3.11+ on any OS (Windows/Linux/macOS).
- **Database:** SQLite (development) or PostgreSQL (deployment).

### 2.5 Design and Implementation Constraints

- Frontend: React.js with TypeScript. Backend: FastAPI with Python.
- All functionality exposed through REST APIs (JSON).
- Authentication via JWT; passwords hashed with bcrypt.
- Exactly three roles; permissions enforced on the backend.
- No AI/ML features; scope limited to Section 1.2.

### 2.6 Assumptions and Dependencies

- Network connectivity between client and server.
- An initial Admin account is created by a seed script.
- Public registration always creates a Student; an Admin promotes users to Faculty or Admin.
- A single academic term is assumed (no semester management).

---

## 3. Specific Requirements

### 3.1 External Interface Requirements

#### 3.1.1 User Interfaces

| ID | Requirement |
| --- | --- |
| UI-1 | The UI shall be responsive and usable on desktop and tablet/mobile screen widths. |
| UI-2 | The UI shall provide a login page and a registration page for unauthenticated users. |
| UI-3 | After login, the user shall be redirected to the dashboard of their role (`/student/dashboard`, `/faculty/dashboard`, `/admin/dashboard`). |
| UI-4 | The UI shall show clear success and error messages (e.g., "Course is full", "Already enrolled"). |
| UI-5 | Pages belonging to another role shall not be accessible (protected routes redirect to login or a "Not authorized" page). |

**Pages by role**

| Role | Routes |
| --- | --- |
| Public | `/login`, `/register` |
| Student | `/student/dashboard`, `/student/courses`, `/student/courses/:id`, `/student/my-courses` |
| Faculty | `/faculty/dashboard`, `/faculty/courses`, `/faculty/courses/:id` |
| Admin | `/admin/dashboard`, `/admin/users`, `/admin/courses`, `/admin/assignments` |

#### 3.1.2 Software Interfaces

| ID | Requirement |
| --- | --- |
| SI-1 | The frontend shall communicate with the backend only through the REST API using JSON over HTTP(S). |
| SI-2 | The frontend shall send `Authorization: Bearer <token>` with every protected request. |
| SI-3 | The backend shall access the database only via the SQLAlchemy ORM. |
| SI-4 | The backend shall publish OpenAPI documentation (Swagger UI at `/docs`). |

#### 3.1.3 Communication Interfaces

HTTP/HTTPS with JSON payloads; CORS shall allow only the configured frontend origin.

---

### 3.2 Functional Requirements

#### 3.2.1 Authentication Module

| ID | Requirement | Priority |
| --- | --- | :---: |
| **FR-1** | A new user shall be able to register with name, email and password. The system shall validate that the email is well-formed and unique and that the password has at least 8 characters. Newly registered users receive the Student role. | Must |
| **FR-2** | A registered user shall be able to log in using email and password. Invalid credentials shall return `401`; a deactivated account shall return `403`. | Must |
| **FR-3** | The system shall issue a signed JWT access token on successful login, containing the user ID, role, permission scopes and an expiry time. | Must |
| **FR-4** | The system shall return the profile (id, name, email, role, is_active) of the logged-in user. | Must |

#### 3.2.2 Student Module

| ID | Requirement | Priority |
| --- | --- | :---: |
| **FR-5** | A student shall be able to view all available courses, including code, name, credit, capacity and seats available. | Must |
| **FR-6** | A student shall be able to view the details of a course, including description and assigned faculty name. | Must |
| **FR-7** | A student shall be able to enroll in a course if seats are available and the student is not already actively enrolled in it. | Must |
| **FR-8** | A student shall be able to drop one of their own active enrollments. | Must |
| **FR-9** | A student shall be able to view the list of their own enrolled courses. | Must |

#### 3.2.3 Faculty Module

| ID | Requirement | Priority |
| --- | --- | :---: |
| **FR-10** | A faculty member shall be able to view the courses assigned to them. | Must |
| **FR-11** | A faculty member shall be able to view the students actively enrolled in a course assigned to them. | Must |
| **FR-12** | A faculty member shall be able to update the name, description and credit of a course assigned to them. | Should |

#### 3.2.4 Admin Module

| ID | Requirement | Priority |
| --- | --- | :---: |
| **FR-13** | An admin shall be able to create, update and delete courses. | Must |
| **FR-14** | An admin shall be able to view users, change user roles and deactivate users. | Must |
| **FR-15** | An admin shall be able to assign a faculty member to a course. | Must |
| **FR-16** | An admin shall be able to view all enrollments (optionally filtered by course or student). | Should |

---

### 3.3 Business Rules

| ID | Rule | Related FR | Error |
| --- | --- | --- | --- |
| BR-1 | Email addresses are unique across all users. | FR-1 | `409` |
| BR-2 | Public registration creates only Student accounts; roles are changed only by an Admin. | FR-1, FR-14 | — |
| BR-3 | A student cannot actively enroll in the same course twice (unique `(student_id, course_id)`). | FR-7 | `409` |
| BR-4 | A student cannot enroll in a course whose active enrollments already equal its capacity. | FR-7 | `409` |
| BR-5 | Seats available = `capacity − count(active enrollments)`. Dropped enrollments free a seat. | FR-5–FR-8 | — |
| BR-6 | Dropping an enrollment sets its status to `dropped` (record retained). A student may re-enroll later, which reactivates the record. | FR-8 | — |
| BR-7 | A student can drop only their own enrollment. | FR-8 | `403` |
| BR-8 | A faculty member can view/update only courses where `faculty_id` equals their user ID. | FR-10–FR-12 | `403` |
| BR-9 | Faculty cannot change `capacity`, `course_code` or `faculty_id`; these are Admin-only. | FR-12 | `403` |
| BR-10 | Course code is unique. Capacity and credit must be positive integers. | FR-13 | `409` / `400` |
| BR-11 | A course with active enrollments cannot be deleted. | FR-13 | `409` |
| BR-12 | Only an active user with the Faculty role can be assigned to a course. | FR-15 | `400` |
| BR-13 | Users are deactivated, not physically deleted (`is_active = false`). | FR-14 | — |
| BR-14 | An Admin cannot deactivate or change the role of their own account. | FR-14 | `400` |
| BR-15 | A Faculty user who still has assigned courses cannot be demoted or deactivated until reassigned. | FR-14 | `409` |
| BR-16 | A deactivated user's existing tokens are rejected on their next request. | FR-14 | `401` / `403` |

---

### 3.4 REST API Requirements

The system shall expose the following endpoints. Each protected endpoint declares the scope it requires.

| # | Method | Endpoint | Description | Required Access | Related FR |
| :-: | --- | --- | --- | --- | --- |
| 1 | POST | `/auth/register` | Register a new user | Public | FR-1 |
| 2 | POST | `/auth/login` | Login and receive token | Public | FR-2, FR-3 |
| 3 | GET | `/auth/me` | Current user profile | Authenticated | FR-4 |
| 4 | GET | `/courses` | List all courses | `courses:read` | FR-5 |
| 5 | GET | `/courses/{id}` | Course details | `courses:read` | FR-6 |
| 6 | POST | `/courses` | Create a course | `courses:create` (Admin) | FR-13 |
| 7 | PUT | `/courses/{id}` | Update a course | `courses:update` (Admin / assigned Faculty) | FR-12, FR-13 |
| 8 | DELETE | `/courses/{id}` | Delete a course | `courses:delete` (Admin) | FR-13 |
| 9 | PUT | `/courses/{id}/faculty` | Assign faculty to course | `faculty:assign` (Admin) | FR-15 |
| 10 | POST | `/enrollments` | Enroll in a course | `enrollments:create` (Student) | FR-7 |
| 11 | GET | `/enrollments/my` | List own enrollments | `enrollments:read_own` (Student) | FR-9 |
| 12 | DELETE | `/enrollments/{id}` | Drop an enrollment | `enrollments:delete_own` (Student) | FR-8 |
| 13 | GET | `/enrollments` | List all enrollments | `enrollments:read_all` (Admin) | FR-16 |
| 14 | GET | `/faculty/courses` | List assigned courses | Faculty role | FR-10 |
| 15 | GET | `/faculty/courses/{id}/students` | Students in assigned course | `enrollments:read_assigned` (Faculty) | FR-11 |
| 16 | GET | `/users` | List users (optional `role` filter) | `users:read` (Admin) | FR-14 |
| 17 | PUT | `/users/{id}` | Update role / status | `users:manage` (Admin) | FR-14 |
| 18 | DELETE | `/users/{id}` | Deactivate user | `users:manage` (Admin) | FR-14 |

**HTTP status codes**

| Code | Meaning | Example |
| --- | --- | --- |
| 200 / 201 | Success / Created | Course created |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Student attempting to create a course |
| 404 | Not Found | Course does not exist |
| 409 | Conflict | Already enrolled or course full |

---

### 3.5 Security, Authentication and Authorization Requirements

| ID | Requirement |
| --- | --- |
| SEC-1 | Passwords shall be stored only as salted bcrypt hashes; plaintext passwords shall never be stored or logged. |
| SEC-2 | All endpoints except `/auth/register` and `/auth/login` shall require a valid, unexpired JWT. |
| SEC-3 | The JWT shall be signed (HS256) with a secret loaded from environment configuration, never hard-coded. |
| SEC-4 | Access tokens shall expire after a limited period (default 60 minutes). |
| SEC-5 | Each protected endpoint shall verify that the token carries the required permission scope before executing. |
| SEC-6 | The backend shall enforce ownership checks (own enrollment, assigned course) in addition to scope checks. |
| SEC-7 | The backend shall re-load the user on every request and reject deactivated users. |
| SEC-8 | All input shall be validated with Pydantic schemas; invalid input shall not reach the database layer. |
| SEC-9 | Database access shall use the ORM (parameterized queries) to prevent SQL injection. |
| SEC-10 | CORS shall be restricted to the configured frontend origin. |
| SEC-11 | Error responses shall not reveal sensitive details (stack traces, hashes, whether an email exists on login failure). |
| SEC-12 | The frontend shall protect routes by authentication and role; the backend remains the final authority. |

**Role → scope mapping** (embedded in the token at login)

| Role | Scopes |
| --- | --- |
| Student | `courses:read`, `enrollments:create`, `enrollments:read_own`, `enrollments:delete_own` |
| Faculty | `courses:read`, `courses:update` (assigned only), `enrollments:read_assigned` |
| Admin | `courses:read`, `courses:create`, `courses:update`, `courses:delete`, `enrollments:read_all`, `users:read`, `users:manage`, `faculty:assign` |

---

### 3.6 Data Requirements

#### Logical data model

**users**

| Field | Type | Constraints |
| --- | --- | --- |
| id | Integer | PK |
| name | String | Not null |
| email | String | Unique, not null |
| password_hash | String | Not null |
| role | Enum(student, faculty, admin) | Not null, default `student` |
| is_active | Boolean | Not null, default true |

**courses**

| Field | Type | Constraints |
| --- | --- | --- |
| id | Integer | PK |
| course_code | String | Unique, not null (e.g., CSE303) |
| course_name | String | Not null |
| description | Text | Optional |
| credit | Integer | > 0 |
| capacity | Integer | > 0 |
| faculty_id | Integer | FK → users.id, nullable (faculty) |

**enrollments**

| Field | Type | Constraints |
| --- | --- | --- |
| id | Integer | PK |
| student_id | Integer | FK → users.id |
| course_id | Integer | FK → courses.id |
| enrolled_at | DateTime | Default current time |
| status | Enum(active, dropped) | Default `active` |

**Relationships:** one faculty → many courses (1:N); students ↔ courses is many-to-many through `enrollments`; unique constraint on `(student_id, course_id)`.

---

### 3.7 Non-Functional Requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-1 | Performance | Typical API requests shall respond within 2 seconds under normal load (up to ~50 concurrent users). |
| NFR-2 | Security | See Section 3.5 (SEC-1 to SEC-12). |
| NFR-3 | Usability | Consistent layout and navigation; each role has its own dashboard; actions give clear feedback. |
| NFR-4 | Reliability | Validation and meaningful error responses shall prevent invalid data and avoid unhandled failures; database operations for enrollment shall be atomic. |
| NFR-5 | Maintainability | Backend organized into routers, schemas, services, models and dependencies; frontend into components, pages, layouts, services, hooks, types and context. |
| NFR-6 | Portability | Runs on any modern browser; backend runs on any OS supporting Python 3.11+. |
| NFR-7 | Compatibility | Supports the latest two versions of Chrome, Firefox, Edge and Safari. |
| NFR-8 | Documentation | API documented via OpenAPI/Swagger; PRD, SRS and TDD kept consistent with the implementation. |
| NFR-9 | Testability | Core services have Pytest unit tests; every endpoint is tested for allowed and forbidden roles. |

---

## 4. Use Cases

### 4.1 Use Case Summary

| ID | Use Case | Actor | FR |
| --- | --- | --- | --- |
| UC-1 | Register account | Visitor | FR-1 |
| UC-2 | Log in | All users | FR-2, FR-3, FR-4 |
| UC-3 | Browse courses and view details | Student | FR-5, FR-6 |
| UC-4 | Enroll in course | Student | FR-7 |
| UC-5 | Drop course | Student | FR-8 |
| UC-6 | View my courses | Student | FR-9 |
| UC-7 | View assigned courses and enrolled students | Faculty | FR-10, FR-11 |
| UC-8 | Update assigned course | Faculty | FR-12 |
| UC-9 | Manage courses | Admin | FR-13 |
| UC-10 | Manage users | Admin | FR-14 |
| UC-11 | Assign faculty to course | Admin | FR-15 |
| UC-12 | View all enrollments | Admin | FR-16 |

### 4.2 UC-4: Enroll in Course (detailed)

| Item | Description |
| --- | --- |
| **Actor** | Student |
| **Preconditions** | Student is logged in and holds scope `enrollments:create`. |
| **Main flow** | 1. Student opens a course's detail page. 2. Student clicks **Enroll**. 3. System verifies the token and scope. 4. System checks the course exists. 5. System checks the student has no active enrollment in it. 6. System checks seats are available. 7. System creates the enrollment (status `active`). 8. System returns `201`; UI shows the course under "My Courses". |
| **Alternate flows** | 4a. Course not found → `404`. 5a. Already enrolled → `409`. 6a. Course full → `409`. 7a. A previously dropped record exists → it is reactivated instead of creating a new row. |
| **Postconditions** | Seats available decrease by one. |

### 4.3 UC-5: Drop Course (detailed)

| Item | Description |
| --- | --- |
| **Actor** | Student |
| **Preconditions** | Student is logged in and holds scope `enrollments:delete_own`. |
| **Main flow** | 1. Student opens "My Courses". 2. Student clicks **Drop**. 3. System verifies the enrollment belongs to the student. 4. System sets status to `dropped`. 5. System returns `200`. |
| **Alternate flows** | 3a. Enrollment not found → `404`. 3b. Belongs to another student → `403`. 3c. Already dropped → `409`. |
| **Postconditions** | Seat is freed. |

### 4.4 UC-11: Assign Faculty to Course (detailed)

| Item | Description |
| --- | --- |
| **Actor** | Admin |
| **Preconditions** | Admin is logged in with scope `faculty:assign`. |
| **Main flow** | 1. Admin opens `/admin/assignments`. 2. Admin selects a course and a faculty member. 3. System checks the user is an active Faculty. 4. System sets `courses.faculty_id`. 5. System returns the updated course. |
| **Alternate flows** | 3a. User not Faculty or inactive → `400`. 3b. Course/user not found → `404`. |

---

## 5. Appendices

### Appendix A — RBAC Permission Matrix by Endpoint

| Endpoint | Student | Faculty | Admin |
| --- | :---: | :---: | :---: |
| POST `/auth/register`, `/auth/login` | ✔ (public) | ✔ (public) | ✔ (public) |
| GET `/auth/me` | ✔ | ✔ | ✔ |
| GET `/courses`, `/courses/{id}` | ✔ | ✔ | ✔ |
| POST `/courses` | ✘ 403 | ✘ 403 | ✔ |
| PUT `/courses/{id}` | ✘ 403 | ✔ assigned only | ✔ |
| DELETE `/courses/{id}` | ✘ 403 | ✘ 403 | ✔ |
| PUT `/courses/{id}/faculty` | ✘ 403 | ✘ 403 | ✔ |
| POST `/enrollments` | ✔ | ✘ 403 | ✘ 403 |
| GET `/enrollments/my` | ✔ | ✘ 403 | ✘ 403 |
| DELETE `/enrollments/{id}` | ✔ own only | ✘ 403 | ✘ 403 |
| GET `/enrollments` | ✘ 403 | ✘ 403 | ✔ |
| GET `/faculty/courses` | ✘ 403 | ✔ | ✘ 403 |
| GET `/faculty/courses/{id}/students` | ✘ 403 | ✔ assigned only | ✘ 403 |
| GET `/users` | ✘ 403 | ✘ 403 | ✔ |
| PUT/DELETE `/users/{id}` | ✘ 403 | ✘ 403 | ✔ |

### Appendix B — Error Response Format

```json
{ "detail": "Course is full" }
```

Validation errors (`422` from FastAPI/Pydantic) are normalized to `400` with a list of field messages.

### Appendix C — Assumptions Recorded as Design Decisions

| # | Decision | Reason |
| --- | --- | --- |
| 1 | Public registration → Student only. | Prevents self-assigned privileged roles. |
| 2 | Users are deactivated rather than deleted. | Preserves enrollment history. |
| 3 | Faculty may edit only name, description, credit. | Capacity and assignment affect enrollment integrity. |
| 4 | Logout is client-side (token discarded). | JWT is stateless; no token blacklist in this version. |
| 5 | Drop is a soft status change. | Keeps an audit trail of enrollments. |

---

## 6. Requirements Traceability Matrix

| FR | Description | PRD Feature / Story | API Endpoint(s) | Scope(s) | Business Rules | Test Cases (TDD §12) |
| --- | --- | --- | --- | --- | --- | --- |
| FR-1 | Register | F-1 / US-1 | POST `/auth/register` | Public | BR-1, BR-2 | TC-01, TC-02 |
| FR-2 | Login | F-2 / US-2 | POST `/auth/login` | Public | BR-16 | TC-03, TC-04, TC-05 |
| FR-3 | Issue token | F-2 / US-2 | POST `/auth/login` | Public | — | TC-03, TC-06 |
| FR-4 | Current profile | F-3 / US-3 | GET `/auth/me` | Authenticated | — | TC-07, TC-08 |
| FR-5 | List courses | F-4 / US-4 | GET `/courses` | `courses:read` | BR-5 | TC-09 |
| FR-6 | Course details | F-4 / US-4 | GET `/courses/{id}` | `courses:read` | — | TC-10, TC-11 |
| FR-7 | Enroll | F-5 / US-5 | POST `/enrollments` | `enrollments:create` | BR-3, BR-4, BR-5, BR-6 | TC-12 – TC-15 |
| FR-8 | Drop | F-6 / US-6 | DELETE `/enrollments/{id}` | `enrollments:delete_own` | BR-6, BR-7 | TC-16 – TC-18 |
| FR-9 | My enrollments | F-7 / US-7 | GET `/enrollments/my` | `enrollments:read_own` | — | TC-19 |
| FR-10 | Assigned courses | F-8 / US-8 | GET `/faculty/courses` | Faculty role | BR-8 | TC-20 |
| FR-11 | Students in course | F-9 / US-9 | GET `/faculty/courses/{id}/students` | `enrollments:read_assigned` | BR-8 | TC-21, TC-22 |
| FR-12 | Update assigned course | F-10 / US-10 | PUT `/courses/{id}` | `courses:update` | BR-8, BR-9 | TC-23, TC-24 |
| FR-13 | Manage courses | F-11 / US-11 | POST/PUT/DELETE `/courses` | `courses:create/update/delete` | BR-10, BR-11 | TC-25 – TC-28 |
| FR-14 | Manage users | F-12 / US-12 | GET/PUT/DELETE `/users` | `users:read`, `users:manage` | BR-2, BR-13 – BR-16 | TC-29 – TC-32 |
| FR-15 | Assign faculty | F-13 / US-13 | PUT `/courses/{id}/faculty` | `faculty:assign` | BR-12 | TC-33, TC-34 |
| FR-16 | All enrollments | F-14 / US-14 | GET `/enrollments` | `enrollments:read_all` | — | TC-35 |