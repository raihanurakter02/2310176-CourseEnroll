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
    schedule_days: Optional[str] = "Mon,Wed"
    start_time: Optional[str] = "10:00"
    end_time: Optional[str] = "11:30"
    room: Optional[str] = "Hall 101"

class CourseCreate(CourseBase):
    pass

class CourseResponse(CourseBase):
    id: int
    faculty_id: Optional[int] = None
    semester_id: Optional[int] = None
    enrolled_count: Optional[int] = 0
    waitlist_count: Optional[int] = 0
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


# --- SECURITY SCHEMAS ---

class SecurityEventResponse(BaseModel):
    id: int
    event_type: str
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    detail: Optional[str] = None
    created_at: datetime
    severity: str

    class Config:
        from_attributes = True


class UserSessionResponse(BaseModel):
    id: int
    user_id: int
    jti: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_hint: Optional[str] = None
    created_at: datetime
    last_seen: datetime
    is_active: bool
    # Joined user fields
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    class Config:
        from_attributes = True


class BanRequest(BaseModel):
    ban_reason: str


class SecurityStatsResponse(BaseModel):
    total_events: int
    critical_events_24h: int
    active_sessions: int
    banned_users: int
    failed_logins_24h: int


# --- ANNOUNCEMENT / INBOX SCHEMAS ---

class AnnouncementBase(BaseModel):
    title: str
    content: str
    target_role: str = "all"  # "all", "student", "faculty"
    priority: str = "normal"  # "normal", "important", "urgent"


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    target_role: Optional[str] = None
    priority: Optional[str] = None
    is_active: Optional[bool] = None


class AnnouncementResponse(AnnouncementBase):
    id: int
    created_by: Optional[int] = None
    author_name: Optional[str] = None
    created_at: datetime
    is_active: bool
    is_read: bool = False

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    unread_count: int
