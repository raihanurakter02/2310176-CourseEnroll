import os
import sys
import datetime
import random
import uuid
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

engine = create_engine(DATABASE_URL, connect_args={"prepare_threshold": None})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_bulk():
    db = SessionLocal()
    print("🚀 Starting Enterprise Bulk Dataset Seeding...")

    now = datetime.datetime.utcnow()
    # Precompute bcrypt hash once so 50+ users are created in milliseconds
    common_password_hash = auth.get_password_hash("password123")

    # -------------------------------------------------------------------------
    # 1. SEMESTERS (Historical, Active, Upcoming)
    # -------------------------------------------------------------------------
    print("📅 1/7 Seeding Academic Semesters...")
    db.query(models.Semester).update({"is_active": False})
    
    semesters_data = [
        {"name": "Fall 2024", "active": False, "start": now - datetime.timedelta(days=730), "end": now - datetime.timedelta(days=610)},
        {"name": "Spring 2025", "active": False, "start": now - datetime.timedelta(days=580), "end": now - datetime.timedelta(days=460)},
        {"name": "Fall 2025", "active": False, "start": now - datetime.timedelta(days=365), "end": now - datetime.timedelta(days=245)},
        {"name": "Spring 2026", "active": False, "start": now - datetime.timedelta(days=210), "end": now - datetime.timedelta(days=90)},
        {"name": "Fall 2026", "active": True, "start": now - datetime.timedelta(days=60), "end": now + datetime.timedelta(days=60), "deadline": now + datetime.timedelta(days=14)},
        {"name": "Spring 2027", "active": False, "start": now + datetime.timedelta(days=90), "end": now + datetime.timedelta(days=210)},
    ]

    semester_map = {}
    for sem in semesters_data:
        existing = db.query(models.Semester).filter(models.Semester.name == sem["name"]).first()
        if existing:
            existing.is_active = sem["active"]
            existing.start_date = sem["start"]
            existing.end_date = sem["end"]
            if "deadline" in sem:
                existing.add_drop_deadline = sem["deadline"]
            semester_map[sem["name"]] = existing
        else:
            new_s = models.Semester(
                name=sem["name"],
                is_active=sem["active"],
                start_date=sem["start"],
                end_date=sem["end"],
                add_drop_deadline=sem.get("deadline", sem["start"] + datetime.timedelta(days=14)),
                grading_start_date=sem["end"] - datetime.timedelta(days=15),
                grading_end_date=sem["end"] + datetime.timedelta(days=10),
            )
            db.add(new_s)
            db.flush()
            semester_map[sem["name"]] = new_s

    db.commit()
    active_semester = semester_map["Fall 2026"]

    # -------------------------------------------------------------------------
    # 2. USERS (Admin, 15 Faculty, 35 Students)
    # -------------------------------------------------------------------------
    print("👥 2/7 Seeding 50+ Enterprise Users...")

    faculty_list = [
        ("Dr. Rubaiyat Islam", "rubaiyat@gmail.com"),
        ("mr potato", "potato@gmail.com"),
        ("Sayef Reyadh", "sreyadh@gmail.com"),
        ("Farhan Habib", "habibf@gmail.com"),
        ("Nazmus Sakib", "nsakib@gmail.com"),
        ("Dr. Faisal Uddin", "fuddin@gmail.com"),
        ("Sadiqur Rahman", "srahman@gmail.com"),
        ("Dr. Elena Rostova", "erostova@university.edu"),
        ("Prof. Marcus Vance", "mvance@university.edu"),
        ("Dr. Aisha Al-Mansoor", "amansoor@university.edu"),
        ("Prof. David Sterling", "dsterling@university.edu"),
        ("Dr. Priya Sharma", "psharma@university.edu"),
        ("Prof. Liam O'Connor", "loconnor@university.edu"),
        ("Dr. Wei Zhang", "wzhang@university.edu"),
        ("Prof. Carlos Mendez", "cmendez@university.edu"),
    ]

    student_list = [
        ("Mila Vance", "mila@gmail.com"),
        ("Raihanur Akter", "rai@gmail.com"),
        ("Mishu Ahmed", "mishu@gmail.com"),
        ("Kafi Hassan", "kafi@gmail.com"),
        ("Laila Noor", "laila@gmail.com"),
        ("Tariqul Islam", "teststd@gmail.com"),
        ("Cat Williams", "cat@gmail.com"),
        ("Alex Turner", "alex@gmail.com"),
        ("Sophia Chen", "sophia@gmail.com"),
        ("Daniel Kim", "dkim@university.edu"),
        ("Emma Watson", "ewatson@university.edu"),
        ("Lucas Silva", "lsilva@university.edu"),
        ("Olivia Brown", "obrown@university.edu"),
        ("Noah Garcia", "ngarcia@university.edu"),
        ("Ava Johnson", "ajohnson@university.edu"),
        ("Ethan Davis", "edavis@university.edu"),
        ("Isabella Martinez", "imartinez@university.edu"),
        ("Mason Miller", "mmiller@university.edu"),
        ("Mia Wilson", "mwilson@university.edu"),
        ("James Anderson", "janderson@university.edu"),
        ("Harper Thomas", "hthomas@university.edu"),
        ("Benjamin Jackson", "bjackson@university.edu"),
        ("Amelia White", "awhite@university.edu"),
        ("Alexander Harris", "aharris@university.edu"),
        ("Evelyn Clark", "eclark@university.edu"),
        ("Henry Lewis", "hlewis@university.edu"),
        ("Charlotte Robinson", "crobinson@university.edu"),
        ("Sebastian Walker", "swalker@university.edu"),
        ("Abigail Young", "ayoung@university.edu"),
        ("Jack Allen", "jallen@university.edu"),
        ("Emily King", "eking@university.edu"),
        ("Aiden Wright", "awright@university.edu"),
        ("Ella Scott", "escott@university.edu"),
        ("Owen Torres", "otorres@university.edu"),
        ("Chloe Nguyen", "cnguyen@university.edu"),
    ]

    user_map = {}

    # Super Admin
    admin_u = db.query(models.User).filter(models.User.email == "admin@university.edu").first()
    if not admin_u:
        admin_u = models.User(name="Admin User", email="admin@university.edu", password_hash=common_password_hash, role=models.UserRole.admin, token_version=10)
        db.add(admin_u)
        db.flush()
    else:
        admin_u.password_hash = common_password_hash
        admin_u.token_version = 10
        admin_u.is_banned = False
    user_map["admin@university.edu"] = admin_u

    # Faculty
    for name, email in faculty_list:
        u = db.query(models.User).filter(models.User.email == email).first()
        if not u:
            u = models.User(name=name, email=email, password_hash=common_password_hash, role=models.UserRole.faculty, token_version=10)
            db.add(u)
            db.flush()
        else:
            u.name = name
            u.password_hash = common_password_hash
            u.role = models.UserRole.faculty
            u.is_banned = False
        user_map[email] = u

    # Students
    for name, email in student_list:
        u = db.query(models.User).filter(models.User.email == email).first()
        if not u:
            u = models.User(name=name, email=email, password_hash=common_password_hash, role=models.UserRole.student, token_version=10)
            db.add(u)
            db.flush()
        else:
            u.name = name
            u.password_hash = common_password_hash
            u.role = models.UserRole.student
            u.is_banned = False
        user_map[email] = u

    db.commit()

    # -------------------------------------------------------------------------
    # 3. COURSES & ACADEMIC SCHEDULES (25+ Detailed Sections)
    # -------------------------------------------------------------------------
    print("📚 3/7 Seeding 25+ University Courses Across All Departments...")

    courses_spec = [
        # CS Core
        {"code": "CSE115", "name": "Programming Language I", "desc": "Procedural programming in C, pointers, memory addressing, control structures, and standard I/O.", "cr": 3, "cap": 35, "days": "Sun,Tue", "st": "08:30", "et": "10:00", "rm": "Lab 201", "fac": "potato@gmail.com"},
        {"code": "CSE201", "name": "Discrete Mathematics", "desc": "Propositional logic, set theory, combinatorics, proof by induction, graphs, and recurrence relations.", "cr": 3, "cap": 40, "days": "Sun,Tue", "st": "10:00", "et": "11:30", "rm": "Hall 102", "fac": "habibf@gmail.com"},
        {"code": "CSE215", "name": "Programming Language II (Java)", "desc": "Object-oriented programming, class hierarchies, polymorphism, interfaces, exception handling, and streams.", "cr": 3, "cap": 35, "days": "Mon,Wed", "st": "08:30", "et": "10:00", "rm": "Lab 202", "fac": "erostova@university.edu"},
        {"code": "CSE220", "name": "Data Structures & Algorithms", "desc": "Algorithm design and complexity, balanced BSTs, graph traversals, shortest path, and dynamic programming.", "cr": 3, "cap": 35, "days": "Mon,Wed", "st": "11:30", "et": "13:00", "rm": "Lab 204", "fac": "sreyadh@gmail.com"},
        {"code": "CSE307", "name": "System Analysis & Design", "desc": "Software architecture, requirements engineering, UML modeling, design patterns, and Agile workflows.", "cr": 3, "cap": 40, "days": "Sun,Tue", "st": "13:00", "et": "14:30", "rm": "Hall 205", "fac": "sreyadh@gmail.com"},
        {"code": "CSE311", "name": "Database Management Systems", "desc": "Relational algebra, SQL query optimization, transactions, ACID guarantees, B-tree indexing, and NoSQL.", "cr": 3, "cap": 30, "days": "Mon,Wed", "st": "10:00", "et": "11:30", "rm": "Lab 305", "fac": "rubaiyat@gmail.com"},
        {"code": "CSE313", "name": "Compiler Design", "desc": "Lexical analysis, LR parsing, abstract syntax trees, semantic analysis, and target code generation.", "cr": 3, "cap": 35, "days": "Tue,Thu", "st": "14:30", "et": "16:00", "rm": "Hall 101", "fac": "srahman@gmail.com"},
        {"code": "CSE316", "name": "Data Communication & Networks", "desc": "TCP/IP protocol stack, network routing, congestion control, Ethernet switching, and socket APIs.", "cr": 3, "cap": 35, "days": "Mon,Wed", "st": "14:00", "et": "15:30", "rm": "Lab 402", "fac": "fuddin@gmail.com"},
        {"code": "CSE317", "name": "Numerical Methods", "desc": "Numerical root finding, Newton-Raphson, spline interpolation, matrix decomposition, and ODE integration.", "cr": 3, "cap": 35, "days": "Tue,Thu", "st": "10:00", "et": "11:30", "rm": "Hall 303", "fac": "nsakib@gmail.com"},
        {"code": "CSE415", "name": "Artificial Intelligence & Heuristics", "desc": "A* search, constraint satisfaction, adversarial minimax search, Bayesian probability, and knowledge graphs.", "cr": 3, "cap": 30, "days": "Sun,Tue", "st": "11:30", "et": "13:00", "rm": "Lab 304", "fac": "wzhang@university.edu"},
        {"code": "CSE425", "name": "Software Quality & Testing", "desc": "Automated unit test suites, integration testing, TDD, mocking, and mutation coverage analysis.", "cr": 3, "cap": 12, "days": "Sun,Tue", "st": "14:30", "et": "16:00", "rm": "Lab 302", "fac": "potato@gmail.com"},  # Waitlist test
        {"code": "CSE472", "name": "Cloud Computing & DevOps", "desc": "Container orchestration with Kubernetes, Docker virtualization, AWS architectures, and CI/CD pipelines.", "cr": 3, "cap": 18, "days": "Tue,Thu", "st": "11:30", "et": "13:00", "rm": "Lab 501", "fac": "sreyadh@gmail.com"},  # Waitlist test
        {"code": "CSE485", "name": "Cybersecurity & Cryptography", "desc": "Public key cryptography (RSA/ECC), digital signatures, vulnerability assessment, TLS protocols, and exploit mitigation.", "cr": 3, "cap": 25, "days": "Sun,Tue", "st": "16:00", "et": "17:30", "rm": "Lab 401", "fac": "amansoor@university.edu"},
        {"code": "CSE499", "name": "Senior Capstone Design Project", "desc": "Two-semester culmination project building scalable, peer-reviewed engineering applications.", "cr": 4, "cap": 10, "days": "Tue,Thu", "st": "16:00", "et": "17:30", "rm": "Auditorium B", "fac": "rubaiyat@gmail.com"},  # Waitlist test
        
        # Mathematics & Physics
        {"code": "MAT120", "name": "Calculus & Analytical Geometry", "desc": "Differential and integral calculus, series convergence, Taylor series, and multivariable functions.", "cr": 3, "cap": 45, "days": "Mon,Wed", "st": "08:30", "et": "10:00", "rm": "Hall 104", "fac": "nsakib@gmail.com"},
        {"code": "MAT212", "name": "Linear Algebra", "desc": "Vector spaces, linear transformations, eigenvalues and eigenvectors, singular value decomposition (SVD).", "cr": 3, "cap": 40, "days": "Tue,Thu", "st": "08:30", "et": "10:00", "rm": "Hall 106", "fac": "psharma@university.edu"},
        {"code": "PHY107", "name": "General Physics I (Mechanics)", "desc": "Classical Newtonian mechanics, energy conservation, rotational dynamics, and harmonic oscillation.", "cr": 3, "cap": 40, "days": "Sun,Tue", "st": "08:30", "et": "10:00", "rm": "Sci-101", "fac": "loconnor@university.edu"},
        {"code": "PHY108", "name": "General Physics II (Electromagnetism)", "desc": "Electrostatics, Gauss's Law, magnetic induction, Maxwell's equations, and electromagnetic wave propagation.", "cr": 3, "cap": 40, "days": "Mon,Wed", "st": "13:00", "et": "14:30", "rm": "Sci-102", "fac": "loconnor@university.edu"},
        
        # Engineering Core
        {"code": "EEE101", "name": "Electrical Circuits I", "desc": "Ohm's law, Kirchhoff's laws, nodal and mesh analysis, Thevenin/Norton equivalents, and AC circuits.", "cr": 3, "cap": 35, "days": "Mon,Wed", "st": "10:00", "et": "11:30", "rm": "Eng-201", "fac": "dsterling@university.edu"},
        {"code": "EEE211", "name": "Analog Electronics", "desc": "Semiconductor physics, diodes, BJT and MOSFET amplifier configurations, and frequency response.", "cr": 3, "cap": 30, "days": "Tue,Thu", "st": "13:00", "et": "14:30", "rm": "Eng-203", "fac": "dsterling@university.edu"},

        # Business & Economics
        {"code": "ACN201", "name": "Principles of Accounting", "desc": "Accounting cycle, journals, ledgers, balance sheets, income statements, and GAAP compliance.", "cr": 3, "cap": 45, "days": "Sun,Tue", "st": "08:30", "et": "10:00", "rm": "Hall 105", "fac": "cmendez@university.edu"},
        {"code": "FIN301", "name": "Corporate Financial Management", "desc": "Capital budgeting, cost of capital, time value of money, dividend policy, and financial valuation.", "cr": 3, "cap": 40, "days": "Tue,Thu", "st": "10:00", "et": "11:30", "rm": "BBA-201", "fac": "cmendez@university.edu"},
        {"code": "MKT201", "name": "Principles of Marketing", "desc": "Market segmentation, product lifecycle, consumer behavior, brand management, and digital pricing.", "cr": 3, "cap": 45, "days": "Mon,Wed", "st": "14:30", "et": "16:00", "rm": "BBA-202", "fac": "mvance@university.edu"},
        {"code": "MGT301", "name": "Organizational Leadership", "desc": "Organizational psychology, team dynamics, strategic decision-making, and organizational ethics.", "cr": 3, "cap": 40, "days": "Sun,Tue", "st": "14:30", "et": "16:00", "rm": "BBA-301", "fac": "mvance@university.edu"},
    ]

    course_map = {}
    for cs in courses_spec:
        fac_obj = user_map.get(cs["fac"])
        fac_id = fac_obj.id if fac_obj else None

        existing_c = db.query(models.Course).filter(models.Course.course_code == cs["code"]).first()
        if existing_c:
            existing_c.course_name = cs["name"]
            existing_c.description = cs["desc"]
            existing_c.credit = cs["cr"]
            existing_c.capacity = cs["cap"]
            existing_c.schedule_days = cs["days"]
            existing_c.start_time = cs["st"]
            existing_c.end_time = cs["et"]
            existing_c.room = cs["rm"]
            existing_c.faculty_id = fac_id
            existing_c.semester_id = active_semester.id
            course_map[cs["code"]] = existing_c
        else:
            new_c = models.Course(
                course_code=cs["code"],
                course_name=cs["name"],
                description=cs["desc"],
                credit=cs["cr"],
                capacity=cs["cap"],
                schedule_days=cs["days"],
                start_time=cs["st"],
                end_time=cs["et"],
                room=cs["rm"],
                faculty_id=fac_id,
                semester_id=active_semester.id,
            )
            db.add(new_c)
            db.flush()
            course_map[cs["code"]] = new_c

    db.commit()

    # -------------------------------------------------------------------------
    # 4. ENROLLMENTS (300+ Records, Transcripts, Waitlists & Approvals)
    # -------------------------------------------------------------------------
    print("🎓 4/7 Seeding 300+ Course Enrollments (Waitlists, Transcripts, Active Schedules)...")
    
    # Clear attendance & class sessions first to satisfy foreign key constraints
    db.query(models.Attendance).delete()
    db.query(models.ClassSession).delete()
    db.query(models.Enrollment).delete()
    db.commit()

    student_objs = [u for u in user_map.values() if u.role == models.UserRole.student]
    course_objs = list(course_map.values())
    mila = user_map["mila@gmail.com"]

    all_grades = ["A", "A", "A-", "A-", "B+", "B+", "B", "B", "B-", "C+", "C"]

    # --- A) Mila's Curated Showcase Record ---
    # 1. Past Completed Graded Courses (GPA: 3.75)
    mila_past = [
        ("CSE115", "A", 180),
        ("CSE201", "A-", 180),
        ("MAT120", "B+", 180),
        ("ACN201", "A", 180),
        ("CSE215", "A", 90),
        ("MAT212", "B+", 90),
    ]
    for code, grade, days_ago in mila_past:
        c = course_map[code]
        db.add(models.Enrollment(
            student_id=mila.id,
            course_id=c.id,
            status=models.EnrollmentStatus.approved,
            grade=grade,
            enrolled_at=now - datetime.timedelta(days=days_ago)
        ))

    # 2. Active Fall 2026 Courses for Mila (Populates Weekly Schedule Matrix cleanly!)
    mila_active = ["CSE220", "CSE311", "CSE472", "CSE307"]
    for code in mila_active:
        c = course_map[code]
        db.add(models.Enrollment(
            student_id=mila.id,
            course_id=c.id,
            status=models.EnrollmentStatus.approved,
            grade=None,
            enrolled_at=now - datetime.timedelta(days=20)
        ))

    # 3. Waitlisted Course for Mila (Queue #1)
    db.add(models.Enrollment(
        student_id=mila.id,
        course_id=course_map["CSE425"].id,
        status=models.EnrollmentStatus.waitlisted,
        grade=None,
        enrolled_at=now - datetime.timedelta(days=5)
    ))

    # 4. Pending Course for Mila
    db.add(models.Enrollment(
        student_id=mila.id,
        course_id=course_map["CSE317"].id,
        status=models.EnrollmentStatus.pending,
        grade=None,
        enrolled_at=now - datetime.timedelta(days=2)
    ))

    # 5. Rejected Course for Mila (Demonstrates Dismiss Record)
    db.add(models.Enrollment(
        student_id=mila.id,
        course_id=course_map["CSE316"].id,
        status=models.EnrollmentStatus.rejected,
        grade=None,
        enrolled_at=now - datetime.timedelta(days=12)
    ))

    # --- B) Pack Full Courses to Trigger Active Waitlists ---
    # 1. CSE425 (Cap: 12) -> Fill 12 approved, 5 waitlisted
    cse425 = course_map["CSE425"]
    for s in student_objs[1:13]:
        db.add(models.Enrollment(student_id=s.id, course_id=cse425.id, status=models.EnrollmentStatus.approved, enrolled_at=now - datetime.timedelta(days=25)))
    for s in student_objs[13:18]:
        db.add(models.Enrollment(student_id=s.id, course_id=cse425.id, status=models.EnrollmentStatus.waitlisted, enrolled_at=now - datetime.timedelta(days=4)))

    # 2. CSE472 (Cap: 18) -> Fill 18 approved, 7 waitlisted
    cse472 = course_map["CSE472"]
    for s in student_objs[1:18]:
        db.add(models.Enrollment(student_id=s.id, course_id=cse472.id, status=models.EnrollmentStatus.approved, enrolled_at=now - datetime.timedelta(days=25)))
    for s in student_objs[18:25]:
        db.add(models.Enrollment(student_id=s.id, course_id=cse472.id, status=models.EnrollmentStatus.waitlisted, enrolled_at=now - datetime.timedelta(days=3)))

    # 3. CSE499 (Cap: 10) -> Fill 10 approved, 4 waitlisted
    cse499 = course_map["CSE499"]
    for s in student_objs[2:12]:
        db.add(models.Enrollment(student_id=s.id, course_id=cse499.id, status=models.EnrollmentStatus.approved, enrolled_at=now - datetime.timedelta(days=30)))
    for s in student_objs[12:16]:
        db.add(models.Enrollment(student_id=s.id, course_id=cse499.id, status=models.EnrollmentStatus.waitlisted, enrolled_at=now - datetime.timedelta(days=2)))

    # --- C) Bulk Historical Graded Courses & Active Schedules for Other Students ---
    for s in student_objs:
        if s.id == mila.id:
            continue
        # 3-5 historical courses per student
        sampled_past = random.sample(course_objs, k=random.randint(3, 6))
        for pc in sampled_past:
            db.add(models.Enrollment(
                student_id=s.id,
                course_id=pc.id,
                status=models.EnrollmentStatus.approved,
                grade=random.choice(all_grades),
                enrolled_at=now - datetime.timedelta(days=random.randint(90, 300))
            ))

        # 2-3 current active approved courses per student
        sampled_active = random.sample(course_objs, k=random.randint(2, 4))
        for ac in sampled_active:
            db.add(models.Enrollment(
                student_id=s.id,
                course_id=ac.id,
                status=models.EnrollmentStatus.approved,
                grade=None,
                enrolled_at=now - datetime.timedelta(days=random.randint(5, 25))
            ))

    # --- D) Pending Queue for Admin Approvals Portal ---
    # Create 16 diverse pending requests across different students and courses
    pending_pool = random.sample(student_objs, k=16)
    for idx, s in enumerate(pending_pool):
        target_course = course_objs[(idx * 3) % len(course_objs)]
        db.add(models.Enrollment(
            student_id=s.id,
            course_id=target_course.id,
            status=models.EnrollmentStatus.pending,
            grade=None,
            enrolled_at=now - datetime.timedelta(hours=random.randint(2, 48))
        ))

    # --- E) Rejected Records for Dismissal Testing ---
    for idx in range(6):
        s = student_objs[idx]
        target_course = course_objs[(idx * 4 + 1) % len(course_objs)]
        db.add(models.Enrollment(
            student_id=s.id,
            course_id=target_course.id,
            status=models.EnrollmentStatus.rejected,
            grade=None,
            enrolled_at=now - datetime.timedelta(days=random.randint(6, 14))
        ))

    db.commit()

    # -------------------------------------------------------------------------
    # 5. CLASS SESSIONS & ATTENDANCE (50+ Sessions, 250+ Attendance Records)
    # -------------------------------------------------------------------------
    print("📝 5/7 Seeding 50+ Class Sessions and 250+ Attendance Records...")

    topics_library = [
        "Course Overview, Academic Integrity & Environment Setup",
        "Memory Addressing, Pointer Architecture & Array Traversal",
        "Recursion Principles, Call Stack Modeling & Dynamic Arrays",
        "Linked List Implementations & Memory Leak Profiling",
        "Stack & Queue Data Structures with Real-World Buffering",
        "Asymptotic Complexity: Big-O, Big-Omega & Theta Notation",
        "Binary Search Trees: Balancing, Rotations & AVL Trees",
        "Graph Search Algorithms: Breadth-First & Depth-First Traversals",
        "Midterm Examination Review & Sample Problem Walkthrough",
        "Heap Data Structures, Priority Queues & Heap Sort",
        "Hashing Collisions, Open Addressing & Chaining Performance",
        "Dynamic Programming: Memoization vs Tabulation Paradigms",
        "Greedy Algorithms: Huffman Coding & Spanning Trees",
        "Final Capstone Architecture & Production Deployment Review",
    ]

    # Select 10 core courses to populate with rich sessions
    selected_courses_for_sessions = [
        course_map["CSE220"],
        course_map["CSE311"],
        course_map["CSE472"],
        course_map["CSE115"],
        course_map["CSE201"],
        course_map["CSE307"],
        course_map["MAT120"],
        course_map["ACN201"],
        course_map["CSE316"],
        course_map["CSE425"],
    ]

    for c in selected_courses_for_sessions:
        # Create 5 sessions per course
        enrolled_students = db.query(models.Enrollment).filter(
            models.Enrollment.course_id == c.id,
            models.Enrollment.status == models.EnrollmentStatus.approved
        ).all()

        for s_idx in range(5):
            days_ago = (4 - s_idx) * 7 + random.randint(0, 2)
            sess_time = now - datetime.timedelta(days=days_ago) if s_idx < 4 else now + datetime.timedelta(days=3)
            topic = topics_library[(s_idx + c.id) % len(topics_library)]
            if s_idx == 4:
                topic = f"{topic} (Upcoming Lecture)"

            sess = models.ClassSession(
                course_id=c.id,
                date=sess_time,
                topic=topic
            )
            db.add(sess)
            db.flush()

            # Record attendance for past completed sessions
            if s_idx < 4 and enrolled_students:
                for enr in enrolled_students:
                    # 85% Present, 10% Late, 5% Absent distribution
                    dice = random.random()
                    status = models.AttendanceStatus.present
                    if dice > 0.95:
                        status = models.AttendanceStatus.absent
                    elif dice > 0.85:
                        status = models.AttendanceStatus.late

                    db.add(models.Attendance(
                        enrollment_id=enr.id,
                        class_session_id=sess.id,
                        status=status
                    ))

    db.commit()

    # -------------------------------------------------------------------------
    # 6. ANNOUNCEMENTS (12 University Broadcasts)
    # -------------------------------------------------------------------------
    print("📢 6/7 Seeding 12 Campus Announcements Across All Target Audiences...")
    db.query(models.AnnouncementRead).delete()
    db.query(models.Announcement).delete()
    db.commit()

    announcements_bulk = [
        {
            "title": "Fall 2026 Final Examination Schedule & Examination Protocols Released",
            "content": "The Office of the University Registrar has officially published the Final Examination timetable for Fall 2026. All exams will take place in assigned auditoriums and lecture halls. Students must present their physical student ID card upon entry. Programmable calculators and mobile devices are strictly prohibited.",
            "target": "all",
            "priority": "urgent",
            "days_ago": 1,
            "read_by": [mila.id, student_objs[1].id]
        },
        {
            "title": "Add/Drop Registration Deadline: Friday, November 28 at 11:59 PM",
            "content": "Attention all undergraduate students: The semester add/drop deadline is approaching rapidly. Any course dropped after Friday will be recorded with a 'W' (Withdrawal) transcript mark. Please review your weekly schedule and ensure your credit load satisfies degree requirements.",
            "target": "student",
            "priority": "urgent",
            "days_ago": 2,
            "read_by": []  # Unread for Mila
        },
        {
            "title": "University Central Library 24/7 Study Hours for Midterms",
            "content": "To support students through mid-semester assessments, the Central Library will remain open 24 hours a day, 7 days a week through December 10. Quiet study pods, computer terminals, and technical borrowing desks are available on floors 2 through 4.",
            "target": "all",
            "priority": "normal",
            "days_ago": 4,
            "read_by": [mila.id]
        },
        {
            "title": "Faculty Senate: Mid-Semester Evaluation & Grade Submission Portal Open",
            "content": "Faculty members are advised that the midterm progress reporting portal is now open. Please submit continuous assessment marks and student attendance summaries by next Wednesday. Department chairs will review low-attendance flags.",
            "target": "faculty",
            "priority": "normal",
            "days_ago": 5,
            "read_by": []
        },
        {
            "title": "Annual Hackathon & Competitive Programming Fest 2026 Registration Open",
            "content": "The Computer Science Society invites all undergraduate students to participate in HackTech 2026. A 36-hour team development sprint with mentorship from industry leaders and $10,000 in grand prize awards. Register your team of 4 before December 1st.",
            "target": "student",
            "priority": "low",
            "days_ago": 7,
            "read_by": [mila.id]
        },
        {
            "title": "Call for Faculty Research Grants - Spring 2027 Academic Cycle",
            "content": "The University Research Council is pleased to announce funding opportunities for faculty-led peer-reviewed research in AI, Quantum Computing, and Sustainable Engineering. Grants of up to $25,000 are available per laboratory.",
            "target": "faculty",
            "priority": "low",
            "days_ago": 9,
            "read_by": []
        },
        {
            "title": "Emergency Maintenance: Campus Wi-Fi & VPN Upgrades This Saturday",
            "content": "Information Technology Services will perform core router upgrades on Saturday between 02:00 AM and 06:00 AM. Access to campus eduroam networks and remote laboratory servers may be temporarily intermittent.",
            "target": "all",
            "priority": "normal",
            "days_ago": 10,
            "read_by": []  # Unread for Mila
        },
        {
            "title": "Spring 2027 Course Catalog Pre-Registration Preview Available",
            "content": "The provisional course catalog for Spring 2027 is now published for academic advising review. Students may consult with department faculty advisors to verify degree audit prerequisite sequences.",
            "target": "all",
            "priority": "low",
            "days_ago": 12,
            "read_by": [mila.id]
        },
        {
            "title": "Mandatory Faculty Attendance: Accreditation Audit Briefing",
            "content": "All full-time and adjunct faculty must attend the ABET Accreditation briefing in Auditorium A on Tuesday at 4:00 PM. Syllabi outcomes and assessment portfolios must be submitted prior to the session.",
            "target": "faculty",
            "priority": "urgent",
            "days_ago": 14,
            "read_by": []
        },
        {
            "title": "Career Fair & Technical Internship Expo 2026 - Save the Date",
            "content": "Over 60 technology and engineering enterprises will host recruitment booths in the University Gymnasium on Thursday, December 4. Professional attire and updated resumes required.",
            "target": "student",
            "priority": "normal",
            "days_ago": 16,
            "read_by": [mila.id]
        },
        {
            "title": "Health Center Flu Vaccine & Health Checkup Clinic",
            "content": "Free seasonal influenza vaccines and wellness screenings are available at the Student Wellness Pavilion weekdays between 09:00 AM and 03:00 PM. No appointments necessary.",
            "target": "all",
            "priority": "low",
            "days_ago": 18,
            "read_by": [mila.id]
        },
        {
            "title": "Graduation Application Deadline for Senior Class of 2026",
            "content": "Graduating seniors planning to participate in the Spring Commencement Ceremony must submit formal degree conferral petitions to the Registrar's Office before Friday, December 12.",
            "target": "student",
            "priority": "urgent",
            "days_ago": 20,
            "read_by": []  # Unread for Mila
        },
    ]

    for a in announcements_bulk:
        new_a = models.Announcement(
            title=a["title"],
            content=a["content"],
            target_role=a["target"],
            priority=a["priority"],
            created_by=admin_u.id,
            created_at=now - datetime.timedelta(days=a["days_ago"]),
            is_active=True
        )
        db.add(new_a)
        db.flush()

        for uid in a["read_by"]:
            db.add(models.AnnouncementRead(
                announcement_id=new_a.id,
                user_id=uid,
                read_at=now - datetime.timedelta(days=a["days_ago"] - 1)
            ))

    db.commit()

    # -------------------------------------------------------------------------
    # 7. SECURITY CENTER SESSIONS & AUDIT EVENTS (25+ Sessions, 80+ Events)
    # -------------------------------------------------------------------------
    print("🔒 7/7 Seeding 25+ Active Device Sessions and 80+ Security Audit Events...")
    db.query(models.UserSession).delete()
    db.query(models.SecurityEvent).delete()
    db.commit()

    device_options = [
        ("Chrome on Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"),
        ("Safari on macOS", "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15"),
        ("Safari on iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"),
        ("Chrome on Android", "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/121.0.6167.178 Mobile Safari/537.36"),
        ("Firefox on Linux", "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0"),
        ("Edge on Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/122.0.0.0"),
    ]

    ip_pool = [
        "127.0.0.1", "192.168.1.45", "103.25.120.12", "103.14.88.204", "182.160.118.5",
        "202.134.10.42", "175.107.192.11", "118.179.223.89", "45.120.114.30", "157.240.22.35"
    ]

    # Create 25 active sessions
    sample_users_for_sessions = [admin_u] + [u for u in user_map.values() if u.id != admin_u.id][:24]
    for idx, u in enumerate(sample_users_for_sessions):
        dev_name, dev_ua = device_options[idx % len(device_options)]
        ip_addr = ip_pool[idx % len(ip_pool)]
        sess = models.UserSession(
            user_id=u.id,
            jti=str(uuid.uuid4()),
            ip_address=ip_addr,
            user_agent=dev_ua,
            device_hint=dev_name,
            created_at=now - datetime.timedelta(hours=random.randint(1, 48)),
            last_seen=now - datetime.timedelta(minutes=random.randint(2, 60)),
            is_active=True
        )
        db.add(sess)

    # Create 85 Security Audit Events
    event_templates = [
        ("login_success", "info", "User authentication successful via credentials"),
        ("login_success", "info", "Authenticated session started"),
        ("login_failed", "warning", "Failed login attempt (invalid password provided)"),
        ("login_failed", "warning", "Failed login attempt #2"),
        ("token_tampered", "high", "Malformed or tampered JWT detected: Signature verification failed"),
        ("suspicious_activity", "critical", "Multiple JWT tampering attempts detected from IP"),
        ("announcement_broadcast", "info", "Administrative campus notice published"),
        ("session_revoked", "warning", "User session invalidated by security policy"),
        ("user_logout", "info", "User clean sign out confirmed"),
    ]

    for e_idx in range(85):
        etype, esev, edetail = random.choice(event_templates)
        u = random.choice(list(user_map.values())) if etype not in ["token_tampered", "suspicious_activity"] else None
        ip_addr = random.choice(ip_pool) if not u else "127.0.0.1"
        dev_name, dev_ua = random.choice(device_options)

        db.add(models.SecurityEvent(
            event_type=etype,
            severity=esev,
            user_id=u.id if u else None,
            user_email=u.email if u else f"attacker_{e_idx}@threat-actor.org",
            ip_address=ip_addr,
            user_agent=dev_ua,
            detail=f"{edetail} ({dev_name})",
            created_at=now - datetime.timedelta(hours=random.randint(1, 168))
        ))

    db.commit()

    print("\n🎉 ========================================================")
    print("✅ ENTERPRISE BULK DATASET INSERTED SUCCESSFULLY!")
    print("==========================================================")
    print(f"📊 Semesters:      {len(semesters_data)} records")
    print(f"👥 Users:          {len(user_map)} accounts (1 Admin, 15 Faculty, 35 Students)")
    print(f"📚 Courses:        {len(courses_spec)} sections across all departments")
    print("🎓 Enrollments:    300+ records (Waitlists, Transcripts, Active Schedules, Approvals)")
    print("📝 Class Sessions: 50 sessions across courses")
    print("📋 Attendance:     250+ student attendance records")
    print("📢 Announcements:  12 campus notices (All, Student, Faculty)")
    print("🔒 Security:       25 active device sessions & 85 audit log events")
    print("==========================================================\n")

if __name__ == "__main__":
    seed_bulk()
