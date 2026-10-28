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

    taught_courses = relationship("Course", back_populates="faculty")
    enrollments = relationship("Enrollment", back_populates="student")

class Semester(Base):
    __tablename__ = "semesters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    add_drop_deadline = Column(DateTime)
    grading_start_date = Column(DateTime, nullable=True)
    grading_end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=False)

    courses = relationship("Course", back_populates="semester")

class ClassSession(Base):
    __tablename__ = "class_sessions"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
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
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=True)

    faculty = relationship("User", back_populates="taught_courses")
    semester = relationship("Semester", back_populates="courses")
    enrollments = relationship("Enrollment", back_populates="course")
    sessions = relationship("ClassSession", back_populates="course", cascade="all, delete-orphan")

class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    enrolled_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(Enum(EnrollmentStatus), default=EnrollmentStatus.pending)
    grade = Column(String, nullable=True)

    student = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")
    attendance_records = relationship("Attendance", back_populates="enrollment", cascade="all, delete-orphan")

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id"))
    class_session_id = Column(Integer, ForeignKey("class_sessions.id"))
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.present)

    enrollment = relationship("Enrollment", back_populates="attendance_records")
    session = relationship("ClassSession", back_populates="attendances")