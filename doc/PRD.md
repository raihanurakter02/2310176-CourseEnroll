# CourseEnroll — Product Requirements Document (PRD)

| Field | Details |
| --- | --- |
| **Project** | CourseEnroll – University Course Enrollment Management System |
| **Document** | Product Requirements Document (PRD) |
| **Version** | 1.0 |
| **Date** | 10 October 2026 |
| **Author** | Raihanur Akter — Student ID: 2310176 |
| **Course / Section** | Web Application & Internet (Course Code: 309), Section 06 |
| **Submitted To** | Sayef Reyadh, Lecturer |
| **Task Issue Link** | [https://github.com/raihanurakter02/2310176-CourseEnroll/issues/1#issue-5791617388] |
| **Pull Request Link** | [https://github.com/raihanurakter02/2310176-CourseEnroll/pull/4#issue-5794783845] |
| **Related Documents** | [SRS](SRS.md) · [TDD](TDD.md) · Project Proposal |

---

## Table of Contents

1. [Purpose of this Document](#1-purpose-of-this-document)
2. [Product Overview](#2-product-overview)
3. [Problem Statement](#3-problem-statement)
4. [Goals, Objectives and Success Metrics](#4-goals-objectives-and-success-metrics)
5. [Target Users and Personas](#5-target-users-and-personas)
6. [User Roles and Permissions](#6-user-roles-and-permissions)
7. [Product Scope](#7-product-scope)
8. [Features and Priorities](#8-features-and-priorities)
9. [User Stories and Acceptance Criteria](#9-user-stories-and-acceptance-criteria)
10. [User Flows](#10-user-flows)
11. [Non-Functional Product Requirements](#11-non-functional-product-requirements)
12. [Technology Constraints](#12-technology-constraints)
13. [Assumptions, Dependencies and Constraints](#13-assumptions-dependencies-and-constraints)
14. [Risks and Mitigation](#14-risks-and-mitigation)
15. [Milestones and Deliverables](#15-milestones-and-deliverables)
16. [Future Enhancements](#16-future-enhancements)
17. [Alignment with Faculty Requirements](#17-alignment-with-faculty-requirements)

---

## 1. Purpose of this Document

This PRD describes **what** CourseEnroll should do and **why**, from the point of view of its users and stakeholders. It defines the product vision, target users, roles, features, priorities and success criteria. The detailed, testable requirements are in the [SRS](SRS.md) and the engineering design is in the [TDD](TDD.md).

## 2. Product Overview

**CourseEnroll** is a web-based university course enrollment system. Students can browse available courses and enroll in or drop them. Faculty members can manage their assigned courses and view the students enrolled in them. Administrators manage users, courses and faculty-course assignments.

The system uses a **React.js + TypeScript** frontend that communicates with a **FastAPI (Python)** backend through **REST APIs**. Every API endpoint is protected by authentication and permission checks based on the user's role (Role-Based Access Control with permission scopes).

**Core functionality (summary):** a secure, role-based platform where *students enroll in courses, faculty manage their assigned courses and see their students, and admins manage users, courses and assignments*.

## 3. Problem Statement

In many institutions, course registration relies on paper forms, spreadsheets or loosely connected systems. This causes:

- Students cannot easily see available courses, seat capacity and course details in one place.
- Enrollment and drop requests are slow and prone to duplication or errors.
- Faculty cannot quickly see which students are enrolled in their courses.
- Administrators spend time manually managing users, courses and faculty assignments.
- Without access control, users may view or modify data that does not belong to them.

**Need:** a simple, secure, centralized system in which every user can perform *only* the actions allowed for their role.

## 4. Goals, Objectives and Success Metrics

### 4.1 Product Goal

Design and develop a secure, role-based course enrollment system that demonstrates authentication, authorization, RBAC and frontend–backend integration using React.js, TypeScript, FastAPI and Python.

### 4.2 Objectives

| ID | Objective |
| --- | --- |
| O-1 | Provide secure registration and login with hashed passwords and token-based (JWT) authentication. |
| O-2 | Define three roles (Student, Faculty, Admin) with clearly separated permissions. |
| O-3 | Protect all REST endpoints using role checks and permission scopes. |
| O-4 | Let students view courses, enroll, drop and view their enrollments. |
| O-5 | Let faculty view only their assigned courses and the students enrolled in them. |
| O-6 | Let administrators manage users, courses and faculty assignments. |
| O-7 | Deliver a clean, responsive React + TypeScript interface consuming the FastAPI backend. |
| O-8 | Keep the PRD, SRS and TDD consistent with the final implementation. |

### 4.3 Success Metrics

| Metric | Target |
| --- | --- |
| Functional coverage | All 16 functional requirements (FR-1 to FR-16) implemented and demonstrable |
| Access control correctness | 100% of restricted endpoints return `403` for unauthorized roles and `401` for missing/invalid tokens |
| Business-rule correctness | Duplicate enrollment and full-course enrollment are always rejected with `409` |
| API responsiveness | Typical requests respond within 2 seconds under normal load |
| Endpoint coverage | Every endpoint exercised in Swagger UI/Postman; core services covered by Pytest |
| Role journeys | Each role can complete its main workflow end-to-end from the UI |

## 5. Target Users and Personas

| Persona | Description | Needs |
| --- | --- | --- |
| **Student** (e.g., "Rafi", 2nd-year undergraduate) | Wants to pick courses for the semester. | See all courses with seats left; enroll/drop quickly; see own course list. |
| **Faculty** (e.g., "Dr. Nila", lecturer) | Teaches one or more courses. | See assigned courses and the list of enrolled students; keep course details up to date. |
| **Administrator** (e.g., "Mr. Karim", registrar office) | Maintains academic records. | Create/edit/delete courses; manage user accounts and roles; assign faculty; see all enrollments. |

## 6. User Roles and Permissions

The system defines **exactly three roles**. Each role has a fixed set of permission scopes validated by the backend before any protected operation.

| Role | Description | Allowed Actions | Restrictions |
| --- | --- | --- | --- |
| **Student** | Primary user who enrolls in courses. | View courses; view course details; enroll; drop own enrollment; view own enrollments. | Cannot create/edit/delete courses, manage users, assign faculty, or view other students' enrollments. |
| **Faculty** | Instructor responsible for assigned courses. | View assigned courses; update assigned course details; view students enrolled in assigned courses. | Cannot access courses assigned to other faculty; cannot manage users or enrollments directly. |
| **Admin** | System administrator. | Manage users and roles; create, update, delete courses; assign faculty; view all enrollments. | Full access to administrative functions. |

### 6.1 Permission Scopes

| Permission Scope | Student | Faculty | Admin |
| --- | :---: | :---: | :---: |
| `courses:read` | Yes | Yes | Yes |
| `courses:create` | No | No | Yes |
| `courses:update` | No | Assigned only | Yes |
| `courses:delete` | No | No | Yes |
| `enrollments:create` | Yes | No | No |
| `enrollments:read_own` | Yes | No | No |
| `enrollments:delete_own` | Yes | No | No |
| `enrollments:read_assigned` | No | Yes | No |
| `enrollments:read_all` | No | No | Yes |
| `users:read` | No | No | Yes |
| `users:manage` | No | No | Yes |
| `faculty:assign` | No | No | Yes |

## 7. Product Scope

### 7.1 In Scope

- User registration, login and logout; retrieval of the current user's profile.
- Three roles: Student, Faculty, Admin.
- Course listing and course details with capacity information.
- Student enrollment, course drop and a "My Courses" view.
- Faculty dashboard with assigned courses and enrolled-student lists.
- Admin management of users, courses (create, update, delete) and faculty assignments.
- RBAC and permission-scope enforcement on the backend; route protection on the frontend.
- Input validation and standard HTTP error handling (400, 401, 403, 404, 409).

### 7.2 Out of Scope (this version)

To keep the project small, practical and completable, the following will **not** be implemented:

- Online payment and tuition fee management
- Attendance, examination and result/GPA management
- AI/ML-based course recommendation or chatbot
- Email/SMS notifications
- Timetable generation and live chat
- Mobile application and microservices architecture

## 8. Features and Priorities

Priority uses MoSCoW: **M**ust, **S**hould, **C**ould.

| ID | Feature | Role | Priority | Requirement |
| --- | --- | --- | :---: | --- |
| F-1 | User registration | Public | M | FR-1 |
| F-2 | Login with JWT access token | Public | M | FR-2, FR-3 |
| F-3 | View current user profile and role | All | M | FR-4 |
| F-4 | Browse courses and view course details | Student | M | FR-5, FR-6 |
| F-5 | Enroll in a course (seat + duplicate checks) | Student | M | FR-7 |
| F-6 | Drop an enrolled course | Student | M | FR-8 |
| F-7 | View own enrolled courses | Student | M | FR-9 |
| F-8 | View assigned courses | Faculty | M | FR-10 |
| F-9 | View students enrolled in an assigned course | Faculty | M | FR-11 |
| F-10 | Update details of an assigned course | Faculty | S | FR-12 |
| F-11 | Create, update, delete courses | Admin | M | FR-13 |
| F-12 | View users, change roles, deactivate users | Admin | M | FR-14 |
| F-13 | Assign faculty to a course | Admin | M | FR-15 |
| F-14 | View all enrollments | Admin | S | FR-16 |
| F-15 | Role-specific dashboards | All | S | — |
| F-16 | Search/filter courses by code or name | Student | C | — |

## 9. User Stories and Acceptance Criteria

### 9.1 Authentication

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| US-1 | As a new user, I want to register with my name, email and password so that I can use the system. | • Registration succeeds with valid name, unique email, password ≥ 8 chars. • Duplicate email → `409`. • Invalid data → `400`/`422`. • New public accounts are created with the **Student** role. |
| US-2 | As a registered user, I want to log in so that I can access my role's features. | • Valid credentials return a JWT access token. • Wrong password or unknown email → `401`. • Deactivated account cannot log in (`403`). |
| US-3 | As a logged-in user, I want to see my profile and role. | • `GET /auth/me` returns name, email, role. • Missing/invalid token → `401`. |

### 9.2 Student

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| US-4 | As a student, I want to view all available courses and their details. | • List shows code, name, credit, capacity and seats available. • Detail page shows description and faculty name. |
| US-5 | As a student, I want to enroll in a course. | • Succeeds when seats are available and I am not already enrolled (`201`). • Full course → `409`. • Already enrolled → `409`. • Non-existent course → `404`. |
| US-6 | As a student, I want to drop a course. | • I can drop only my own active enrollment. • Another student's enrollment → `403`. • The seat becomes available again. |
| US-7 | As a student, I want to see my enrolled courses. | • "My Courses" lists only my active enrollments. |

### 9.3 Faculty

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| US-8 | As a faculty member, I want to see my assigned courses. | • Only courses assigned to me are listed. |
| US-9 | As a faculty member, I want to see students enrolled in my course. | • Student list (name, email, enrolled date) for an assigned course. • Course not assigned to me → `403`. |
| US-10 | As a faculty member, I want to update details of my course. | • I can update the name, description and credit of an assigned course. • Other faculty's course → `403`. • I cannot change capacity, course code or assignment. |

### 9.4 Admin

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| US-11 | As an admin, I want to create, update and delete courses. | • Duplicate course code → `409`. • Course with active enrollments cannot be deleted (`409`). |
| US-12 | As an admin, I want to view users, change roles and deactivate users. | • User list shows role and status. • Changing role/status takes effect on the user's next request. • Admin cannot deactivate or demote their own account. |
| US-13 | As an admin, I want to assign a faculty member to a course. | • Only active users with the Faculty role can be assigned; otherwise `400`. |
| US-14 | As an admin, I want to view all enrollments. | • List can be filtered by course or student. |

## 10. User Flows

**Student flow:** Register → Login → Student Dashboard → Browse Courses → View Course Details → Enroll → My Courses → (optional) Drop.

**Faculty flow:** Login → Faculty Dashboard → My Assigned Courses → Course Details → Enrolled Students (optionally update course details).

**Admin flow:** Login → Admin Dashboard → Manage Users (roles/status) → Manage Courses (create/update/delete) → Assign Faculty → View All Enrollments.

## 11. Non-Functional Product Requirements

| Category | Requirement |
| --- | --- |
| Security | Passwords stored only as salted hashes (bcrypt); JWT-protected endpoints; permission checks on every protected route. |
| Usability | Simple, consistent, responsive UI with a dedicated dashboard per role. |
| Performance | Typical API requests respond within 2 seconds under normal load. |
| Reliability | Input validation and meaningful error responses prevent invalid data and system failure. |
| Maintainability | Modular backend (routers, schemas, services, dependencies) and component-based frontend. |
| Portability | Runs in any modern browser; backend deployable on any system supporting Python. |

## 12. Technology Constraints

| Layer | Technology |
| --- | --- |
| Frontend | React.js, TypeScript, React Router, Axios |
| Backend | Python, FastAPI, Pydantic |
| Authentication | JWT, bcrypt password hashing |
| Authorization | RBAC with FastAPI dependencies and security scopes |
| Database | SQLite (development) / PostgreSQL, SQLAlchemy ORM |
| Tools | Git, GitHub, Postman / Swagger UI, VS Code |

## 13. Assumptions, Dependencies and Constraints

**Assumptions**

- Users have a modern web browser and internet/network access to the server.
- A single semester context is used; there is no semester/term management.
- An initial Admin account is created by a seed script; faculty accounts are created by registering and then being promoted to Faculty by an Admin.
- A student can hold at most one active enrollment per course.

**Dependencies**

- Python 3.11+, Node.js 18+, and the open-source libraries listed in the TDD.
- GitHub for version control, issue tracking and pull requests.

**Constraints**

- Academic project with a fixed submission timeline (see Section 15).
- Scope is deliberately small; extra ideas are recorded only under Future Enhancements.

## 14. Risks and Mitigation

| Risk | Mitigation |
| --- | --- |
| Scope becomes too large | Follow the defined scope strictly; list extra ideas only under Future Enhancements. |
| Authorization bugs | Centralize permission checks in reusable dependencies; test every role against every endpoint. |
| Frontend–backend mismatch | Use Swagger/OpenAPI documentation and shared TypeScript types. |
| Time constraints | Build core features first (authentication, courses, enrollment), then polish the UI. |

## 15. Milestones and Deliverables

| Phase | Activity | Deliverable | Date |
| :---: | --- | --- | --- |
| 1 | Project idea selection and proposal | Project Proposal | 8 Oct 2026 |
| 2 | Requirement and design documentation | PRD, SRS, TDD | 10 Oct 2026 |
| 3 | GitHub task issue and pull request setup | Repository, Issue, PR | After documentation |
| 4 | Backend: database, authentication, RBAC, APIs | Working FastAPI backend | Implementation phase |
| 5 | Frontend: pages, routing, API integration | React + TypeScript UI | Implementation phase |
| 6 | Testing, bug fixing and documentation update | Tested system | Final phase |
| 7 | Final submission and demonstration | Final project and presentation | As scheduled |

## 16. Future Enhancements

Not part of the current scope: course prerequisites and semester management, email notifications, waiting list for full courses, grade and attendance management, online payment integration, course recommendation.

## 17. Alignment with Faculty Requirements

| Faculty Requirement | How CourseEnroll Satisfies It |
| --- | --- |
| Core functionality in 2–3 sentences | Section 2 (Product Overview). |
| 2–3 user roles | Exactly three roles: Student, Faculty, Admin (Section 6). |
| Clear permissions | Role table and permission scopes (Sections 6, 6.1). |
| Functionality via REST APIs | 18 REST endpoints (see SRS Section 3.4 / TDD Section 7). |
| React.js + TypeScript | Frontend built with React and TypeScript. |
| FastAPI + Python | Backend built with FastAPI and Python. |
| Authentication / Authorization / RBAC / Scopes | JWT authentication and scope-based RBAC (see SRS Section 3.5 / TDD Section 6). |
| Frontend–backend integration | React consumes FastAPI APIs through Axios services. |
| Small, practical scope; no unnecessary AI/ML | Scope and exclusions in Section 7. |
| Submission: PRD, SRS, TDD in `docs/` with Task Issue and PR link | This document set; links in the header table of each document. |