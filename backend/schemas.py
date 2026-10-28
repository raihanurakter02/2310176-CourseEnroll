from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from backend.models import UserRole, EnrollmentStatus, AttendanceStatus

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole = UserRole.student

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: str
    email: EmailStr
    role: UserRole

class UserResponse(UserBase):
    id: int
    is_active: bool
    class Config:
        from_attributes = True

class SemesterBase(BaseModel):
    name: str
    start_date: datetime
    end_date: datetime
    add_drop_deadline: datetime
    grading_start_date: Optional[datetime] = None
    grading_end_date: Optional[datetime] = None

class SemesterCreate(SemesterBase):
    pass

class SemesterUpdate(SemesterBase):
    is_active: bool

class SemesterResponse(SemesterBase):
    id: int
    is_active: bool
    class Config:
        from_attributes = True

class ClassSessionBase(BaseModel):
    date: datetime
    topic: Optional[str] = None

class ClassSessionCreate(ClassSessionBase):
    pass

class ClassSessionResponse(ClassSessionBase):
    id: int
    course_id: int
    class Config:
        from_attributes = True

class CourseBase(BaseModel):
    course_code: str
    course_name: str
    description: Optional[str] = None
    credit: int
    capacity: int

class CourseCreate(CourseBase):
    pass

class CourseResponse(CourseBase):
    id: int
    faculty_id: Optional[int] = None
    semester_id: Optional[int] = None
    class Config:
        from_attributes = True

class EnrollmentBase(BaseModel):
    course_id: int

class EnrollmentCreate(EnrollmentBase):
    pass

class StudentInfo(BaseModel):
    name: str
    email: str
    class Config:
        from_attributes = True

class EnrollmentResponse(EnrollmentBase):
    id: int
    student_id: int
    enrolled_at: datetime
    status: EnrollmentStatus
    grade: Optional[str] = None
    student: Optional[StudentInfo] = None
    class Config:
        from_attributes = True

class GradeUpdate(BaseModel):
    grade: str

class EnrollmentStatusUpdate(BaseModel):
    status: EnrollmentStatus

class AttendanceBase(BaseModel):
    class_session_id: int
    status: AttendanceStatus

class AttendanceCreate(BaseModel):
    enrollment_id: int
    status: AttendanceStatus

class AttendanceSubmit(BaseModel):
    class_session_id: int
    records: list[AttendanceCreate]

class AttendanceResponse(AttendanceBase):
    id: int
    enrollment_id: int
    session: Optional[ClassSessionResponse] = None
    class Config:
        from_attributes = True