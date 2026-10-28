import datetime
from typing import Any

import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend import auth, models, schemas
from backend.database import engine, get_db

# Create database tables
models.Base.metadata.create_all(bind=engine)

# 1. Force PostgreSQL to accept the new Enum values (Must be done outside a transaction)
with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
    try:
        conn.execute(text("ALTER TYPE enrollmentstatus ADD VALUE IF NOT EXISTS 'pending';"))
        conn.execute(text("ALTER TYPE enrollmentstatus ADD VALUE IF NOT EXISTS 'approved';"))
        conn.execute(text("ALTER TYPE enrollmentstatus ADD VALUE IF NOT EXISTS 'rejected';"))
        conn.execute(text("ALTER TYPE enrollmentstatus ADD VALUE IF NOT EXISTS 'dropped';"))
    except SQLAlchemyError:
        pass

# 2. Automatically ensure database columns match latest models
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS semester_id INTEGER REFERENCES semesters(id);"))
        conn.execute(text("ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS grade VARCHAR;"))
        # Force add the new grading period columns that are missing
        conn.execute(text("ALTER TABLE semesters ADD COLUMN IF NOT EXISTS grading_start_date TIMESTAMP;"))
        conn.execute(text("ALTER TABLE semesters ADD COLUMN IF NOT EXISTS grading_end_date TIMESTAMP;"))
        # Force add the new class_session linkage to the attendance table
        conn.execute(text("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS class_session_id INTEGER REFERENCES class_sessions(id);"))
        
        # Ensure timestamp typing
        conn.execute(text("ALTER TABLE semesters ALTER COLUMN start_date TYPE TIMESTAMP USING start_date::timestamp;"))
        conn.execute(text("ALTER TABLE semesters ALTER COLUMN end_date TYPE TIMESTAMP USING end_date::timestamp;"))
        conn.execute(text("ALTER TABLE semesters ALTER COLUMN add_drop_deadline TYPE TIMESTAMP USING add_drop_deadline::timestamp;"))
        conn.commit()
    except SQLAlchemyError:
        conn.rollback()

app = FastAPI(title="CourseEnroll API")

# Configure CORS for React Frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def is_past_deadline(deadline: Any) -> tuple[bool, str]:
    if not deadline:
        return False, ""
    if isinstance(deadline, datetime.datetime):
        clean_deadline = deadline.replace(tzinfo=None)
        # If stored as midnight 00:00:00 from a Date column, treat as end of that day
        if clean_deadline.hour == 0 and clean_deadline.minute == 0 and clean_deadline.second == 0:
            clean_deadline = clean_deadline.replace(hour=23, minute=59, second=59)
    else:
        clean_deadline = datetime.datetime.combine(deadline, datetime.time(23, 59, 59))

    now = datetime.datetime.now()
    return now > clean_deadline, clean_deadline.strftime("%Y-%m-%d %H:%M")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):  # noqa: B008
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


@app.post("/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):  # noqa: B008
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        name=user.name,
        email=user.email,
        password_hash=hashed_password,
        role=user.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):  # noqa: B008
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role_val = user.role.value if hasattr(user.role, "value") else user.role
    access_token = auth.create_access_token(
        data={
            "sub": user.email,
            "role": role_val,
            "name": user.name,
            "id": user.id,
        }
    )
    return {"access_token": access_token, "token_type": "bearer", "role": role_val}


@app.get("/auth/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):  # noqa: B008
    return current_user


# --- RBAC DEPENDENCY ---
class RoleChecker:
    def __init__(self, allowed_roles: list[models.UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: models.User = Depends(get_current_user)):  # noqa: B008
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for your role",
            )
        return user


allow_all_roles = RoleChecker([models.UserRole.student, models.UserRole.faculty, models.UserRole.admin])
allow_admin_only = RoleChecker([models.UserRole.admin])
allow_faculty_only = RoleChecker([models.UserRole.faculty])
allow_student_only = RoleChecker([models.UserRole.student])


# --- SEMESTER ENDPOINTS ---
@app.get("/semesters", response_model=list[schemas.SemesterResponse])
def get_semesters(db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    return db.query(models.Semester).all()


@app.post("/semesters", response_model=schemas.SemesterResponse, status_code=status.HTTP_201_CREATED)
def create_semester(semester: schemas.SemesterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    existing_active = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    new_semester = models.Semester(
        name=semester.name,
        start_date=semester.start_date,
        end_date=semester.end_date,
        add_drop_deadline=semester.add_drop_deadline,
        grading_start_date=semester.grading_start_date,
        grading_end_date=semester.grading_end_date,
        is_active=existing_active is None,
    )
    db.add(new_semester)
    db.commit()
    db.refresh(new_semester)
    return new_semester


@app.put("/semesters/{semester_id}", response_model=schemas.SemesterResponse)
def update_semester(semester_id: int, semester_data: schemas.SemesterUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    target_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not target_semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    setattr(target_semester, "name", semester_data.name)
    setattr(target_semester, "start_date", semester_data.start_date)
    setattr(target_semester, "end_date", semester_data.end_date)
    setattr(target_semester, "add_drop_deadline", semester_data.add_drop_deadline)
    setattr(target_semester, "grading_start_date", semester_data.grading_start_date)
    setattr(target_semester, "grading_end_date", semester_data.grading_end_date)

    if semester_data.is_active:
        db.query(models.Semester).update({"is_active": False})
        setattr(target_semester, "is_active", True)
    else:
        setattr(target_semester, "is_active", False)

    db.commit()
    db.refresh(target_semester)
    return target_semester


@app.put("/semesters/{semester_id}/activate", response_model=schemas.SemesterResponse)
def activate_semester(semester_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    target_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not target_semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    db.query(models.Semester).update({"is_active": False})
    setattr(target_semester, "is_active", True)
    
    db.commit()
    db.refresh(target_semester)
    return target_semester


# --- COURSE & SCHEDULE ENDPOINTS ---
@app.get("/courses", response_model=list[schemas.CourseResponse])
def get_courses(db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    return db.query(models.Course).all()


@app.get("/courses/{course_id}", response_model=schemas.CourseResponse)
def get_course(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@app.post("/courses", response_model=schemas.CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    new_course = models.Course(**course.dict())
    db.add(new_course)
    db.commit()
    db.refresh(new_course)
    return new_course


@app.put("/courses/{course_id}", response_model=schemas.CourseResponse)
def update_course(course_id: int, course_data: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    for key, value in course_data.dict().items():
        setattr(course, key, value)
        
    db.commit()
    db.refresh(course)
    return course


@app.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    db.query(models.Enrollment).filter(models.Enrollment.course_id == course_id).delete()
    db.delete(course)
    db.commit()


@app.put("/courses/{course_id}/faculty")
def assign_faculty(course_id: int, faculty_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    faculty = db.query(models.User).filter(
        models.User.id == faculty_id,
        models.User.role == models.UserRole.faculty,
    ).first()
    if not course or not faculty:
        raise HTTPException(status_code=404, detail="Course or valid Faculty not found")

    setattr(course, "faculty_id", faculty.id)
    db.commit()
    return {"message": "Faculty assigned successfully"}


@app.get("/courses/{course_id}/sessions", response_model=list[schemas.ClassSessionResponse])
def get_course_sessions(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    return db.query(models.ClassSession).filter(models.ClassSession.course_id == course_id).order_by(models.ClassSession.date).all()


@app.post("/courses/{course_id}/sessions", response_model=schemas.ClassSessionResponse)
def create_course_session(course_id: int, session_data: schemas.ClassSessionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    new_session = models.ClassSession(course_id=course_id, date=session_data.date, topic=session_data.topic)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@app.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_session(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    session = db.query(models.ClassSession).filter(models.ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()


# --- STUDENT ENROLLMENT ENDPOINTS ---
@app.post("/enrollments", response_model=schemas.EnrollmentResponse, status_code=status.HTTP_201_CREATED)
def enroll_in_course(enrollment: schemas.EnrollmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_student_only)):  # noqa: B008
    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem:
        raise HTTPException(status_code=400, detail="Registration is closed. Please ask Admin to activate a semester.")

    expired, formatted_deadline = is_past_deadline(active_sem.add_drop_deadline)
    if expired:
        raise HTTPException(status_code=400, detail=f"Add/Drop deadline passed on {formatted_deadline}.")

    course = db.query(models.Course).filter(models.Course.id == enrollment.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == enrollment.course_id,
        models.Enrollment.student_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already requested or enrolled in this course.")

    approved_enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == enrollment.course_id,
        models.Enrollment.status == models.EnrollmentStatus.approved,
    ).count()
    if approved_enrollments >= course.capacity:
        raise HTTPException(status_code=400, detail="Course is at full capacity.")

    new_enrollment = models.Enrollment(
        student_id=current_user.id,
        course_id=enrollment.course_id,
        status="pending",
    )
    db.add(new_enrollment)
    db.commit()
    db.refresh(new_enrollment)
    return new_enrollment


@app.get("/enrollments/my", response_model=list[schemas.EnrollmentResponse])
def get_my_enrollments(db: Session = Depends(get_db), current_user: models.User = Depends(allow_student_only)):  # noqa: B008
    return db.query(models.Enrollment).filter(models.Enrollment.student_id == current_user.id).all()


@app.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def drop_course(enrollment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_student_only)):  # noqa: B008
    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if active_sem:
        expired, formatted_deadline = is_past_deadline(active_sem.add_drop_deadline)
        if expired:
            raise HTTPException(
                status_code=400,
                detail=f"The Add/Drop deadline ({formatted_deadline}) has passed. You cannot drop courses anymore.",
            )

    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.id == enrollment_id,
        models.Enrollment.student_id == current_user.id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    db.delete(enrollment)
    db.commit()


# --- FACULTY ENDPOINTS ---
@app.get("/faculty/courses", response_model=list[schemas.CourseResponse])
def get_assigned_courses(db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    return db.query(models.Course).filter(models.Course.faculty_id == current_user.id).all()


@app.get("/faculty/courses/{course_id}/roster", response_model=list[schemas.EnrollmentResponse])
def get_course_roster(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.faculty_id == current_user.id,
    ).first()
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized to view this course roster")
    return db.query(models.Enrollment).filter(
        models.Enrollment.course_id == course_id,
        models.Enrollment.status == models.EnrollmentStatus.approved,
    ).all()


@app.put("/enrollments/{enrollment_id}/grade")
def update_student_grade(enrollment_id: int, grade_data: schemas.GradeUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem or not active_sem.grading_start_date or not active_sem.grading_end_date:
        raise HTTPException(status_code=400, detail="Grading period is not defined for the active semester.")
    
    now = datetime.datetime.utcnow()
    if not (active_sem.grading_start_date <= now <= active_sem.grading_end_date):
        raise HTTPException(status_code=400, detail="The official grading window is currently closed.")

    enrollment = db.query(models.Enrollment).filter(models.Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment record not found")
        
    course = db.query(models.Course).filter(
        models.Course.id == enrollment.course_id,
        models.Course.faculty_id == current_user.id,
    ).first()
    if not course:
        raise HTTPException(status_code=403, detail="You cannot grade a student in a course you do not teach")
    
    setattr(enrollment, "grade", grade_data.grade)
    db.commit()
    return {"message": f"Grade {grade_data.grade} assigned successfully"}


@app.get("/faculty/courses/{course_id}/attendance", response_model=list[schemas.AttendanceResponse])
def get_course_attendance(course_id: int, session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    return db.query(models.Attendance).join(models.Enrollment).filter(
        models.Enrollment.course_id == course_id,
        models.Attendance.class_session_id == session_id
    ).all()


@app.post("/faculty/courses/{course_id}/attendance")
def submit_course_attendance(course_id: int, attendance_data: schemas.AttendanceSubmit, db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.faculty_id == current_user.id,
    ).first()
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized to modify this course")
    
    for record in attendance_data.records:
        existing = db.query(models.Attendance).filter(
            models.Attendance.enrollment_id == record.enrollment_id,
            models.Attendance.class_session_id == attendance_data.class_session_id,
        ).first()
        
        if existing:
            setattr(existing, "status", record.status)
        else:
            new_att = models.Attendance(
                enrollment_id=record.enrollment_id,
                class_session_id=attendance_data.class_session_id,
                status=record.status,
            )
            db.add(new_att)
            
    db.commit()
    return {"message": "Attendance saved successfully"}


@app.get("/faculty/courses/{course_id}/attendance/history", response_model=list[schemas.AttendanceResponse])
def get_course_attendance_history(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    return db.query(models.Attendance).join(models.Enrollment).filter(
        models.Enrollment.course_id == course_id
    ).all()


# --- ADMIN ENDPOINTS (USERS & ENROLLMENT APPROVALS) ---
@app.get("/users", response_model=list[schemas.UserResponse])
def get_all_users(db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    return db.query(models.User).all()


@app.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, user_data: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    setattr(user, "name", user_data.name)
    setattr(user, "email", user_data.email)
    setattr(user, "role", user_data.role)
    
    db.commit()
    db.refresh(user)
    return user


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account")

    db.query(models.Enrollment).filter(models.Enrollment.student_id == user_id).delete()
    db.query(models.Course).filter(models.Course.faculty_id == user_id).update({"faculty_id": None})
    db.delete(user)
    db.commit()


@app.get("/enrollments", response_model=list[schemas.EnrollmentResponse])
def get_all_enrollments(db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    return db.query(models.Enrollment).all()


@app.put("/enrollments/{enrollment_id}/status", response_model=schemas.EnrollmentResponse)
def update_enrollment_status(enrollment_id: int, status_update: schemas.EnrollmentStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    enrollment = db.query(models.Enrollment).filter(models.Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if status_update.status == models.EnrollmentStatus.approved:
        course = db.query(models.Course).filter(models.Course.id == enrollment.course_id).first()
        approved_count = db.query(models.Enrollment).filter(
            models.Enrollment.course_id == enrollment.course_id,
            models.Enrollment.status == models.EnrollmentStatus.approved,
        ).count()
        if course and approved_count >= course.capacity:
            raise HTTPException(status_code=400, detail="Course is at full capacity")

    setattr(enrollment, "status", status_update.status)
    db.commit()
    db.refresh(enrollment)
    return enrollment