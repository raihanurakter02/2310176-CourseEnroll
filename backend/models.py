from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, DateTime, Enum
from sqlalchemy.orm import relationship
import enum
import datetime
from backend.database import Base

class UserRole(str, enum.Enum):
    student = "student"
    faculty = "faculty"
    admin = "admin"

class EnrollmentStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    dropped = "dropped"
    waitlisted = "waitlisted"

class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(Enum(UserRole), default=UserRole.student)
    is_active = Column(Boolean, default=True)
    # Security fields
    is_banned = Column(Boolean, default=False)
    ban_reason = Column(String, nullable=True)
    login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    token_version = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    taught_courses = relationship("Course", back_populates="faculty")
    enrollments = relationship("Enrollment", back_populates="student")


class RefreshToken(Base):
    """Hashed server-side refresh tokens for rotation and revocation."""
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    token_hash = Column(String, unique=True, index=True)
    session_jti = Column(String, index=True, nullable=True)
    expires_at = Column(DateTime, index=True)
    revoked = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")


class TokenBlacklist(Base):
    """Stores revoked/invalidated JWTs (for forced logout)."""
    __tablename__ = "token_blacklist"
    id = Column(Integer, primary_key=True)
    jti = Column(String, unique=True, index=True)  # JWT ID claim
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    revoked_at = Column(DateTime, default=datetime.datetime.utcnow)
    reason = Column(String, nullable=True)  # "malformed", "admin_revoke", "logout", "user_banned"


class UserSession(Base):
    """Tracks active login sessions / devices."""
    __tablename__ = "user_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    jti = Column(String, unique=True, index=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    device_hint = Column(String, nullable=True)  # "Chrome on Windows", etc.
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True, index=True)


class SecurityEvent(Base):
    """Audit log for security events."""
    __tablename__ = "security_events"
    id = Column(Integer, primary_key=True)
    event_type = Column(String, index=True)  # "login_success", "login_failed", "token_malformed", "user_banned", "session_revoked", "force_logout_all", "suspicious_activity"
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_email = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    detail = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    severity = Column(String, default="info", index=True)  # "info", "warning", "critical"


class Announcement(Base):
    """Broadcast announcements from admins to students, faculty, or all users."""
    __tablename__ = "announcements"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    target_role = Column(String, default="all", index=True)  # "all", "student", "faculty"
    priority = Column(String, default="normal")  # "normal", "important", "urgent"
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True, index=True)

    author = relationship("User")
    reads = relationship("AnnouncementRead", back_populates="announcement", cascade="all, delete-orphan")


class AnnouncementRead(Base):
    """Tracks whether a user has read a specific announcement."""
    __tablename__ = "announcement_reads"
    id = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    read_at = Column(DateTime, default=datetime.datetime.utcnow)

    announcement = relationship("Announcement", back_populates="reads")
    user = relationship("User")


class Semester(Base):
    __tablename__ = "semesters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    add_drop_deadline = Column(DateTime)
    grading_start_date = Column(DateTime, nullable=True)
    grading_end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=False, index=True)

    courses = relationship("Course", back_populates="semester")

class ClassSession(Base):
    __tablename__ = "class_sessions"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), index=True)
    date = Column(DateTime)
    topic = Column(String, nullable=True)

    course = relationship("Course", back_populates="sessions")
    attendances = relationship("Attendance", back_populates="session", cascade="all, delete-orphan")

class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String, index=True)
    course_name = Column(String)
    description = Column(Text, nullable=True)
    credit = Column(Integer)
    capacity = Column(Integer)
    schedule_days = Column(String, default="Mon,Wed")
    start_time = Column(String, default="10:00")
    end_time = Column(String, default="11:30")
    room = Column(String, default="Hall 101")
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=True, index=True)

    faculty = relationship("User", back_populates="taught_courses")
    semester = relationship("Semester", back_populates="courses")
    enrollments = relationship("Enrollment", back_populates="course")
    sessions = relationship("ClassSession", back_populates="course", cascade="all, delete-orphan")

class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), index=True)
    enrolled_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(Enum(EnrollmentStatus), default=EnrollmentStatus.pending, index=True)
    grade = Column(String, nullable=True)

    student = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")
    attendance_records = relationship("Attendance", back_populates="enrollment", cascade="all, delete-orphan")

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id"), index=True)
    class_session_id = Column(Integer, ForeignKey("class_sessions.id"), index=True)
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.present, index=True)

    enrollment = relationship("Enrollment", back_populates="attendance_records")
    session = relationship("ClassSession", back_populates="attendances")


class StudyGroup(Base):
    """Shared course/study group with fine-grained member permissions."""
    __tablename__ = "study_groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id])
    course = relationship("Course")
    members = relationship("StudyGroupMember", back_populates="group", cascade="all, delete-orphan")
    items = relationship("StudyGroupItem", back_populates="group", cascade="all, delete-orphan")


class StudyGroupMember(Base):
    """Membership and fine-grained permissions inside a StudyGroup."""
    __tablename__ = "study_group_members"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    can_create = Column(Boolean, default=False)
    can_edit = Column(Boolean, default=False)
    can_assign = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)

    group = relationship("StudyGroup", back_populates="members")
    user = relationship("User")


class StudyGroupItem(Base):
    """Shared task/resource inside a StudyGroup."""
    __tablename__ = "study_group_items"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id"), index=True)
    title = Column(String)
    description = Column(Text, nullable=True)
    status = Column(String, default="todo")  # todo, in_progress, done
    created_by = Column(Integer, ForeignKey("users.id"), index=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

    group = relationship("StudyGroup", back_populates="items")
    creator = relationship("User", foreign_keys=[created_by])
    assignee = relationship("User", foreign_keys=[assigned_to])
