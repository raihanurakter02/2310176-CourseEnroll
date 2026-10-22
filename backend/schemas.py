from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from backend.models import UserRole, EnrollmentStatus

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole = UserRole.student

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool

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

    class Config:
        from_attributes = True

class EnrollmentBase(BaseModel):
    course_id: int

class EnrollmentCreate(EnrollmentBase):
    pass

class EnrollmentResponse(EnrollmentBase):
    id: int
    student_id: int
    enrolled_at: datetime
    status: EnrollmentStatus

    class Config:
        from_attributes = True