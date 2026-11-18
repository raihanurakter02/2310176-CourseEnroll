import os
import sys
import datetime
from dotenv import load_dotenv

# Ensure the root directory is on the python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

import backend.models as models
import backend.auth as auth

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set.")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_database():
    db = SessionLocal()
    print("🚀 Starting comprehensive demo data seeding...")

    common_password_hash = auth.get_password_hash("password123")
    now = datetime.datetime.utcnow()

    # ---------------------------------------------------------
    # 1. SEMESTERS
    # ---------------------------------------------------------
    print("📅 Setting up Semesters...")
    # Deactivate existing
    db.query(models.Semester).update({"is_active": False})

    active_sem = db.query(models.Semester).filter(models.Semester.name == "Fall 2026").first()
    if not active_sem:
        active_sem = models.Semester(
            name="Fall 2026",
            is_active=True,
            start_date=now - datetime.timedelta(days=60),
            end_date=now + datetime.timedelta(days=60),
            add_drop_deadline=now + datetime.timedelta(days=14),
            grading_start_date=now + datetime.timedelta(days=45),
            grading_end_date=now + datetime.timedelta(days=65),
        )
        db.add(active_sem)
    else:
        active_sem.is_active = True
        active_sem.add_drop_deadline = now + datetime.timedelta(days=14)

    past_sem = db.query(models.Semester).filter(models.Semester.name == "Spring 2026").first()
    if not past_sem:
        past_sem = models.Semester(
            name="Spring 2026",
            is_active=False,
            start_date=now - datetime.timedelta(days=240),
            end_date=now - datetime.timedelta(days=120),
            add_drop_deadline=now - datetime.timedelta(days=220),
        )
        db.add(past_sem)

    upcoming_sem = db.query(models.Semester).filter(models.Semester.name == "Spring 2027").first()
    if not upcoming_sem:
        upcoming_sem = models.Semester(
            name="Spring 2027",
            is_active=False,
            start_date=now + datetime.timedelta(days=90),
            end_date=now + datetime.timedelta(days=210),
            add_drop_deadline=now + datetime.timedelta(days=105),
        )
        db.add(upcoming_sem)

    db.commit()
    db.refresh(active_sem)

    # ---------------------------------------------------------
    # 2. USERS
    # ---------------------------------------------------------
    print("👥 Populating Users...")
    demo_users = [
        # Admin
        {"name": "Admin User", "email": "admin@university.edu", "role": models.UserRole.admin},
        # Faculty
        {"name": "Dr. Rubaiyat Islam", "email": "rubaiyat@gmail.com", "role": models.UserRole.faculty},
        {"name": "mr potato", "email": "potato@gmail.com", "role": models.UserRole.faculty},
        {"name": "Sayef Reyadh", "email": "sreyadh@gmail.com", "role": models.UserRole.faculty},
        {"name": "Farhan Habib", "email": "habibf@gmail.com", "role": models.UserRole.faculty},
        {"name": "Nazmus Sakib", "email": "nsakib@gmail.com", "role": models.UserRole.faculty},
        {"name": "Dr. Faisal Uddin", "email": "fuddin@gmail.com", "role": models.UserRole.faculty},
        {"name": "Sadiqur Rahman", "email": "srahman@gmail.com", "role": models.UserRole.faculty},
        # Students
        {"name": "Mila Vance", "email": "mila@gmail.com", "role": models.UserRole.student},
        {"name": "Raihanur Akter", "email": "rai@gmail.com", "role": models.UserRole.student},
        {"name": "Mishu Ahmed", "email": "mishu@gmail.com", "role": models.UserRole.student},
        {"name": "Kafi Hassan", "email": "kafi@gmail.com", "role": models.UserRole.student},
        {"name": "Laila Noor", "email": "laila@gmail.com", "role": models.UserRole.student},
        {"name": "Alex Turner", "email": "alex@gmail.com", "role": models.UserRole.student},
        {"name": "Sophia Chen", "email": "sophia@gmail.com", "role": models.UserRole.student},
        {"name": "Tariqul Islam", "email": "teststd@gmail.com", "role": models.UserRole.student},
        {"name": "Cat Williams", "email": "cat@gmail.com", "role": models.UserRole.student},
    ]

    user_objs = {}
    for u in demo_users:
        existing = db.query(models.User).filter(models.User.email == u["email"]).first()
        if existing:
            existing.password_hash = common_password_hash
            existing.name = u["name"]
            existing.role = u["role"]
            existing.is_banned = False
            existing.login_attempts = 0
            existing.locked_until = None
            existing.token_version = 10
            user_objs[u["email"]] = existing
        else:
            new_u = models.User(
                name=u["name"],
                email=u["email"],
                password_hash=common_password_hash,
                role=u["role"],
                token_version=10,
                is_banned=False,
                login_attempts=0
            )
            db.add(new_u)
            db.flush()
            user_objs[u["email"]] = new_u

    db.commit()

    # ---------------------------------------------------------
    # 3. COURSES & ACADEMIC SCHEDULES
    # ---------------------------------------------------------
    print("📚 Creating Course Catalog & Schedules...")
    demo_courses = [
        {
            "code": "CSE115",
            "name": "Programming Language I",
            "desc": "Fundamental concepts of procedural programming in C, control flow, functions, arrays, and pointer memory architecture.",
            "credit": 3,
            "cap": 35,
            "days": "Sun,Tue",
            "start": "08:30",
            "end": "10:00",
            "room": "Lab 201",
            "faculty": "potato@gmail.com"
        },
        {
            "code": "CSE201",
            "name": "Discrete Mathematics",
            "desc": "Logic, set theory, combinatorics, graph theory, induction, relations, and proof methods foundational to computational theory.",
            "credit": 3,
            "cap": 40,
            "days": "Sun,Tue",
            "start": "10:00",
            "end": "11:30",
            "room": "Hall 102",
            "faculty": "habibf@gmail.com"
        },
        {
            "code": "CSE220",
            "name": "Data Structures & Algorithms",
            "desc": "Analysis of algorithms, asymptotic notation, balanced trees, heaps, graph search (BFS/DFS), hashing, and dynamic programming.",
            "credit": 3,
            "cap": 35,
            "days": "Mon,Wed",
            "start": "11:30",
            "end": "13:00",
            "room": "Lab 204",
            "faculty": "sreyadh@gmail.com"
        },
        {
            "code": "CSE307",
            "name": "System Analysis & Design",
            "desc": "Modern software lifecycles, Agile scrum methodologies, UML diagramming, requirements gathering, and enterprise architecture.",
            "credit": 3,
            "cap": 40,
            "days": "Sun,Tue",
            "start": "13:00",
            "end": "14:30",
            "room": "Hall 205",
            "faculty": "sreyadh@gmail.com"
        },
        {
            "code": "CSE311",
            "name": "Database Management Systems",
            "desc": "Relational calculus, ER modeling, SQL optimization, ACID transactions, indexing (B-Trees), and distributed NoSQL databases.",
            "credit": 3,
            "cap": 30,
            "days": "Mon,Wed",
            "start": "10:00",
            "end": "11:30",
            "room": "Lab 305",
            "faculty": "rubaiyat@gmail.com"
        },
        {
            "code": "CSE313",
            "name": "Compiler Design",
            "desc": "Lexical analysis, top-down and bottom-up parsing, intermediate code representation, register allocation, and code generation.",
            "credit": 3,
            "cap": 35,
            "days": "Tue,Thu",
            "start": "14:30",
            "end": "16:00",
            "room": "Hall 101",
            "faculty": "srahman@gmail.com"
        },
        {
            "code": "CSE316",
            "name": "Data Communication & Networks",
            "desc": "OSI 7-layer and TCP/IP models, routing protocols, flow & congestion control, socket programming, and transport security.",
            "credit": 3,
            "cap": 35,
            "days": "Mon,Wed",
            "start": "14:00",
            "end": "15:30",
            "room": "Lab 402",
            "faculty": "fuddin@gmail.com"
        },
        {
            "code": "CSE317",
            "name": "Numerical Methods",
            "desc": "Root finding algorithms, interpolation, numerical differentiation, matrix factorizations (LU/QR), and error analysis.",
            "credit": 3,
            "cap": 35,
            "days": "Tue,Thu",
            "start": "10:00",
            "end": "11:30",
            "room": "Hall 303",
            "faculty": "nsakib@gmail.com"
        },
        {
            "code": "CSE472",
            "name": "Cloud Computing & DevOps",
            "desc": "Cloud infrastructure (AWS/GCP), containerization with Docker & Kubernetes, CI/CD pipelines, microservices, and serverless architectures.",
            "credit": 3,
            "cap": 25,
            "days": "Tue,Thu",
            "start": "11:30",
            "end": "13:00",
            "room": "Lab 501",
            "faculty": "sreyadh@gmail.com"
        },
        {
            "code": "CSE425",
            "name": "Software Quality & Testing",
            "desc": "Automated unit testing, integration suites, test-driven development (TDD), mocking frameworks, and continuous verification.",
            "credit": 3,
            "cap": 5,  # Small capacity to demonstrate Full Waitlist!
            "days": "Sun,Tue",
            "start": "14:30",
            "end": "16:00",
            "room": "Lab 302",
            "faculty": "potato@gmail.com"
        },
        {
            "code": "MAT120",
            "name": "Calculus & Analytical Geometry",
            "desc": "Limits, derivatives, definite integrals, transcendental functions, series convergence, and multivariable functions.",
            "credit": 3,
            "cap": 45,
            "days": "Mon,Wed",
            "start": "08:30",
            "end": "10:00",
            "room": "Hall 104",
            "faculty": "nsakib@gmail.com"
        },
        {
            "code": "ACN201",
            "name": "Principles of Accounting",
            "desc": "Accounting cycle, double-entry bookkeeping, financial statements, balance sheets, and cost management for technical managers.",
            "credit": 3,
            "cap": 40,
            "days": "Sun,Tue",
            "start": "08:30",
            "end": "10:00",
            "room": "Hall 105",
            "faculty": "rubaiyat@gmail.com"
        },
    ]

    course_objs = {}
    for cd in demo_courses:
        fac = user_objs.get(cd["faculty"])
        fac_id = fac.id if fac else None

        existing_c = db.query(models.Course).filter(models.Course.course_code == cd["code"]).first()
        if existing_c:
            existing_c.course_name = cd["name"]
            existing_c.description = cd["desc"]
            existing_c.credit = cd["credit"]
            existing_c.capacity = cd["cap"]
            existing_c.schedule_days = cd["days"]
            existing_c.start_time = cd["start"]
            existing_c.end_time = cd["end"]
            existing_c.room = cd["room"]
            existing_c.faculty_id = fac_id
            existing_c.semester_id = active_sem.id
            course_objs[cd["code"]] = existing_c
        else:
            new_c = models.Course(
                course_code=cd["code"],
                course_name=cd["name"],
                description=cd["desc"],
                credit=cd["credit"],
                capacity=cd["cap"],
                schedule_days=cd["days"],
                start_time=cd["start"],
                end_time=cd["end"],
                room=cd["room"],
                faculty_id=fac_id,
                semester_id=active_sem.id,
            )
            db.add(new_c)
            db.flush()
            course_objs[cd["code"]] = new_c

    db.commit()

    # ---------------------------------------------------------
    # 4. ENROLLMENTS & DEGREE PROGRESS
    # ---------------------------------------------------------
    print("🎓 Configuring Student Enrollments, Grades & Waitlists...")
    mila = user_objs["mila@gmail.com"]

    # Clear attendance and class sessions first to satisfy foreign key constraints
    db.query(models.Attendance).delete()
    db.query(models.ClassSession).delete()
    db.query(models.Enrollment).filter(models.Enrollment.student_id == mila.id).delete()
    db.commit()

    # Mila's Enrollments:
    # A) Past Completed Courses (with real letter grades -> GPA ~ 3.75)
    past_courses_grades = [
        ("CSE115", "A"),
        ("CSE201", "A-"),
        ("MAT120", "B+"),
        ("ACN201", "A"),
    ]
    for code, grade in past_courses_grades:
        c = course_objs[code]
        db.add(models.Enrollment(
            student_id=mila.id,
            course_id=c.id,
            status=models.EnrollmentStatus.approved,
            grade=grade,
            enrolled_at=now - datetime.timedelta(days=120)
        ))

    # B) Active Approved Courses for Fall 2026 (Fills Mila's Schedule Timetable perfectly!)
    active_approved_codes = ["CSE220", "CSE311", "CSE472", "CSE307"]
    for code in active_approved_codes:
        c = course_objs[code]
        db.add(models.Enrollment(
            student_id=mila.id,
            course_id=c.id,
            status=models.EnrollmentStatus.approved,
            grade=None,
            enrolled_at=now - datetime.timedelta(days=15)
        ))

    # C) Waitlisted Course for Mila (Demonstrates Waitlist UI and position!)
    c_wait = course_objs["CSE425"]
    db.add(models.Enrollment(
        student_id=mila.id,
        course_id=c_wait.id,
        status=models.EnrollmentStatus.waitlisted,
        grade=None,
        enrolled_at=now - datetime.timedelta(days=2)
    ))

    # D) Pending Course for Mila
    c_pend = course_objs["CSE317"]
    db.add(models.Enrollment(
        student_id=mila.id,
        course_id=c_pend.id,
        status=models.EnrollmentStatus.pending,
        grade=None,
        enrolled_at=now - datetime.timedelta(days=1)
    ))

    # E) Rejected Course for Mila (Shows Dismiss button & rejected banner)
    c_rej = course_objs["CSE316"]
    db.add(models.Enrollment(
        student_id=mila.id,
        course_id=c_rej.id,
        status=models.EnrollmentStatus.rejected,
        grade=None,
        enrolled_at=now - datetime.timedelta(days=10)
    ))

    # Fill CSE425 (cap=5) with other students to make it 100% full with an active waitlist!
    other_student_emails = ["rai@gmail.com", "mishu@gmail.com", "kafi@gmail.com", "laila@gmail.com", "alex@gmail.com"]
    for semail in other_student_emails:
        st = user_objs.get(semail)
        if st:
            # Check existing
            ex = db.query(models.Enrollment).filter(
                models.Enrollment.student_id == st.id,
                models.Enrollment.course_id == c_wait.id
            ).first()
            if not ex:
                db.add(models.Enrollment(
                    student_id=st.id,
                    course_id=c_wait.id,
                    status=models.EnrollmentStatus.approved,
                    enrolled_at=now - datetime.timedelta(days=20)
                ))

    # Add another student in waitlist behind Mila on CSE425 (Queue #2)
    cat_st = user_objs.get("cat@gmail.com")
    if cat_st:
        ex = db.query(models.Enrollment).filter(
            models.Enrollment.student_id == cat_st.id,
            models.Enrollment.course_id == c_wait.id
        ).first()
        if not ex:
            db.add(models.Enrollment(
                student_id=cat_st.id,
                course_id=c_wait.id,
                status=models.EnrollmentStatus.waitlisted,
                enrolled_at=now - datetime.timedelta(days=1)
            ))

    # Populate enrollments for CSE220 so Faculty roster has 6+ students
    c_220 = course_objs["CSE220"]
    for semail in ["rai@gmail.com", "mishu@gmail.com", "kafi@gmail.com", "laila@gmail.com", "sophia@gmail.com"]:
        st = user_objs.get(semail)
        if st:
            ex = db.query(models.Enrollment).filter(
                models.Enrollment.student_id == st.id,
                models.Enrollment.course_id == c_220.id
            ).first()
            if not ex:
                db.add(models.Enrollment(
                    student_id=st.id,
                    course_id=c_220.id,
                    status=models.EnrollmentStatus.approved,
                    enrolled_at=now - datetime.timedelta(days=25)
                ))

    db.commit()

    # ---------------------------------------------------------
    # 5. CLASS SESSIONS & ATTENDANCE
    # ---------------------------------------------------------
    print("📝 Scheduling Class Sessions & Logging Attendance...")
    c_220_id = course_objs["CSE220"].id
    sessions_data = [
        {"date": now - datetime.timedelta(days=21), "topic": "Course Introduction, Environment Setup & Memory Basics"},
        {"date": now - datetime.timedelta(days=14), "topic": "Linked Lists, Array Performance & Pointer Traversal"},
        {"date": now - datetime.timedelta(days=7), "topic": "Stacks, Queues & Breadth-First Graph Traversal"},
        {"date": now + datetime.timedelta(days=2), "topic": "Binary Search Trees & Heap Priority Queues (Upcoming)"},
    ]

    session_objs = []
    for s in sessions_data:
        sess = models.ClassSession(
            course_id=c_220_id,
            date=s["date"],
            topic=s["topic"]
        )
        db.add(sess)
        db.flush()
        session_objs.append(sess)

    # Attendance for the first 3 completed sessions
    enrollments_220 = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == c_220_id,
        models.Enrollment.status == models.EnrollmentStatus.approved
    ).all()

    for idx, sess in enumerate(session_objs[:3]):
        for enr in enrollments_220:
            status = models.AttendanceStatus.present
            if (enr.id + idx) % 7 == 0:
                status = models.AttendanceStatus.late
            elif (enr.id + idx) % 11 == 0:
                status = models.AttendanceStatus.absent

            att = models.Attendance(
                enrollment_id=enr.id,
                class_session_id=sess.id,
                status=status
            )
            db.add(att)

    db.commit()

    # ---------------------------------------------------------
    # 6. ANNOUNCEMENTS
    # ---------------------------------------------------------
    print("📢 Broadcasting Campus Announcements...")
    admin_id = user_objs["admin@university.edu"].id

    # Clear old announcements for a clean set
    db.query(models.AnnouncementRead).delete()
    db.query(models.Announcement).delete()
    db.commit()

    announcements_data = [
        {
            "title": "Fall 2026 Final Examination Schedule & Examination Protocols Released",
            "content": "The Office of the University Registrar has officially published the Final Examination timetable for Fall 2026. All exams will take place in assigned auditoriums and lecture halls. Students must present their physical student ID card upon entry. Programmable calculators and mobile devices are strictly prohibited.",
            "target": "all",
            "priority": "urgent",
            "days_ago": 1,
            "read_by_mila": False,
        },
        {
            "title": "Add/Drop Registration Deadline: Friday, November 28 at 11:59 PM",
            "content": "Attention all students: The semester add/drop deadline is approaching rapidly. Any course dropped after Friday will be recorded with a 'W' (Withdrawal) transcript mark. Please review your weekly schedule and ensure your credit load satisfies degree requirements.",
            "target": "student",
            "priority": "urgent",
            "days_ago": 3,
            "read_by_mila": False,
        },
        {
            "title": "University Central Library 24/7 Study Hours for Midterms",
            "content": "To support students through mid-semester assessments, the Central Library will remain open 24 hours a day, 7 days a week through December 10. Quiet study pods, computer terminals, and technical borrowing desks are available on floors 2 through 4.",
            "target": "all",
            "priority": "normal",
            "days_ago": 5,
            "read_by_mila": True,
        },
        {
            "title": "Faculty Senate: Mid-Semester Evaluation & Grade Submission Portal Open",
            "content": "Faculty members are advised that the midterm progress reporting portal is now open. Please submit continuous assessment marks and student attendance summaries by next Wednesday. Department chairs will review low-attendance flags.",
            "target": "faculty",
            "priority": "normal",
            "days_ago": 6,
            "read_by_mila": False,
        },
        {
            "title": "Annual Hackathon & Competitive Programming Fest 2026 Registration Open",
            "content": "The Computer Science Society invites all undergraduate students to participate in HackTech 2026. A 36-hour team development sprint with mentorship from industry leaders and $10,000 in grand prize awards. Register your team of 4 before December 1st.",
            "target": "student",
            "priority": "low",
            "days_ago": 8,
            "read_by_mila": True,
        },
        {
            "title": "Call for Faculty Research Grants - Spring 2027 Academic Cycle",
            "content": "The University Research Council is pleased to announce funding opportunities for faculty-led peer-reviewed research in AI, Quantum Computing, and Sustainable Engineering. Grants of up to $25,000 are available per laboratory.",
            "target": "faculty",
            "priority": "low",
            "days_ago": 12,
            "read_by_mila": False,
        },
    ]

    for a in announcements_data:
        new_a = models.Announcement(
            title=a["title"],
            content=a["content"],
            target_role=a["target"],
            priority=a["priority"],
            created_by=admin_id,
            created_at=now - datetime.timedelta(days=a["days_ago"]),
            is_active=True
        )
        db.add(new_a)
        db.flush()

        # If read by Mila, record it
        if a["read_by_mila"]:
            db.add(models.AnnouncementRead(
                announcement_id=new_a.id,
                user_id=mila.id,
                read_at=now - datetime.timedelta(days=a["days_ago"] - 1)
            ))

    db.commit()

    # ---------------------------------------------------------
    # 7. SECURITY SESSIONS & AUDIT LOGS
    # ---------------------------------------------------------
    print("🔒 Creating Active Device Sessions & Security Audit Logs...")
    # Active sessions
    db.query(models.UserSession).delete()
    db.commit()

    active_sessions_data = [
        {"user": "admin@university.edu", "ip": "127.0.0.1", "device": "Chrome on Windows", "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"},
        {"user": "admin@university.edu", "ip": "192.168.1.45", "device": "Safari on iPhone", "ua": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"},
        {"user": "potato@gmail.com", "ip": "103.25.120.12", "device": "Firefox on Linux", "ua": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0"},
        {"user": "mila@gmail.com", "ip": "127.0.0.1", "device": "Chrome on Windows", "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"},
        {"user": "sreyadh@gmail.com", "ip": "103.14.88.204", "device": "Edge on Windows", "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/122.0.0.0"},
    ]

    import uuid
    for s in active_sessions_data:
        u = user_objs.get(s["user"])
        if u:
            db.add(models.UserSession(
                user_id=u.id,
                jti=str(uuid.uuid4()),
                ip_address=s["ip"],
                user_agent=s["ua"],
                device_hint=s["device"],
                created_at=now - datetime.timedelta(hours=2),
                last_seen=now - datetime.timedelta(minutes=5),
                is_active=True
            ))

    # Security events
    sec_events = [
        {"type": "login_success", "sev": "info", "user": "admin@university.edu", "detail": "Device: Chrome on Windows", "ip": "127.0.0.1"},
        {"type": "announcement_broadcast", "sev": "info", "user": "admin@university.edu", "detail": "Broadcast 'Fall 2026 Final Examination Schedule' to all", "ip": "127.0.0.1"},
        {"type": "login_failed", "sev": "warning", "user": "unknown@hacker.io", "detail": "Failed attempt #1 with invalid credentials", "ip": "194.26.29.112"},
        {"type": "token_tampered", "sev": "high", "user": None, "detail": "Malformed or tampered JWT detected: Signature verification failed", "ip": "194.26.29.112"},
        {"type": "login_success", "sev": "info", "user": "mila@gmail.com", "detail": "Device: Chrome on Windows", "ip": "127.0.0.1"},
    ]
    for e in sec_events:
        u = user_objs.get(e["user"]) if e["user"] else None
        db.add(models.SecurityEvent(
            event_type=e["type"],
            severity=e["sev"],
            user_id=u.id if u else None,
            user_email=u.email if u else e["user"],
            ip_address=e["ip"],
            detail=e["detail"],
            created_at=now - datetime.timedelta(hours=1)
        ))

    db.commit()
    print("✅ All demo data inserted and verified successfully!")

if __name__ == "__main__":
    seed_database()
