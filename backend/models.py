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
    active = "active"
    dropped = "dropped"

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

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String, unique=True, index=True)
    course_name = Column(String)
    description = Column(Text, nullable=True)
    credit = Column(Integer)
    capacity = Column(Integer)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    faculty = relationship("User", back_populates="taught_courses")
    enrollments = relationship("Enrollment", back_populates="course")

class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    enrolled_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(Enum(EnrollmentStatus), default=EnrollmentStatus.active)

    student = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")