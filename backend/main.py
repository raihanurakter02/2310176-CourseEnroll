from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models, schemas
from .database import Base, engine, get_db

# Create tables in Supabase
Base.metadata.create_all(bind=engine)

app = FastAPI(title="CourseEnroll API")

# Add CORS Middleware here
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allows your React frontend to connect locally
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/")
def read_root():
    return {"message": "Welcome to the CourseEnroll MVP API"}

# 1. CREATE Course
@app.post("/api/courses/", response_model=schemas.Course)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):  # noqa: B008
    db_course = models.Course(**course.model_dump())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course

# 2. READ LIST (All Courses)
@app.get("/api/courses/", response_model=list[schemas.Course])
def read_courses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):  # noqa: B008
    courses = db.query(models.Course).offset(skip).limit(limit).all()
    return courses

# 3. READ SINGLE (One Course)
@app.get("/api/courses/{course_id}", response_model=schemas.Course)
def read_course(course_id: int, db: Session = Depends(get_db)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

# 4. UPDATE Course
@app.put("/api/courses/{course_id}", response_model=schemas.Course)
def update_course(course_id: int, course_update: schemas.CourseUpdate, db: Session = Depends(get_db)):  # noqa: B008
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if db_course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    
    update_data = course_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_course, key, value)
        
    db.commit()
    db.refresh(db_course)
    return db_course

# 5. DELETE Course
@app.delete("/api/courses/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db)):  # noqa: B008
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if db_course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    
    db.delete(db_course)
    db.commit()
    return {"message": "Course deleted successfully"}