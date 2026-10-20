from pydantic import BaseModel


class CourseBase(BaseModel):
    course_code: str
    title: str
    description: str


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class Course(CourseBase):
    id: int
    faculty_id: int | None = None

    model_config = {"from_attributes": True}