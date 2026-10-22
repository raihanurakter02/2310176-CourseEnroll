import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend import auth, models, schemas
from backend.database import engine, get_db
from typing import List
# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CourseEnroll API")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

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
        role=user.role
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
    
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):  # noqa: B008
    return current_user
# --- RBAC DEPENDENCY ---
class RoleChecker:
    def __init__(self, allowed_roles: List[models.UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: models.User = Depends(get_current_user)):  # noqa: B008
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Operation not permitted for your role"
            )
        return user

# Define role requirements based on proposal
allow_all_roles = RoleChecker([models.UserRole.student, models.UserRole.faculty, models.UserRole.admin])
allow_admin_only = RoleChecker([models.UserRole.admin])

# --- COURSE ENDPOINTS ---
@app.get("/courses", response_model=List[schemas.CourseResponse])
def get_courses(db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    courses = db.query(models.Course).all()
    return courses

@app.get("/courses/{course_id}", response_model=schemas.CourseResponse)
def get_course(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

@app.post("/courses", response_model=schemas.CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    new_course = models.Course(
        course_code=course.course_code,
        course_name=course.course_name,
        description=course.description,
        credit=course.credit,
        capacity=course.capacity
    )
    db.add(new_course)
    db.commit()
    db.refresh(new_course)
    return new_course
# --- STUDENT ENROLLMENT ENDPOINTS ---
allow_student_only = RoleChecker([models.UserRole.student])

@app.post("/enrollments", response_model=schemas.EnrollmentResponse, status_code=status.HTTP_201_CREATED)
def enroll_in_course(enrollment: schemas.EnrollmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_student_only)):  # noqa: B008
    # Verify course exists
    course = db.query(models.Course).filter(models.Course.id == enrollment.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Prevent duplicate enrollments
    existing_enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == enrollment.course_id,
        models.Enrollment.student_id == current_user.id
    ).first()
    
    if existing_enrollment:
        raise HTTPException(status_code=409, detail="You are already enrolled in this course")
        
    new_enrollment = models.Enrollment(
        student_id=current_user.id,
        course_id=enrollment.course_id
    )
    db.add(new_enrollment)
    db.commit()
    db.refresh(new_enrollment)
    return new_enrollment

@app.get("/enrollments/my", response_model=List[schemas.EnrollmentResponse])
def get_my_enrollments(db: Session = Depends(get_db), current_user: models.User = Depends(allow_student_only)):  # noqa: B008
    enrollments = db.query(models.Enrollment).filter(models.Enrollment.student_id == current_user.id).all()
    return enrollments
# --- ADDITIONAL STUDENT ENDPOINT ---
@app.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def drop_course(enrollment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_student_only)):  # noqa: B008
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.id == enrollment_id,
        models.Enrollment.student_id == current_user.id
    ).first()
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
        
    db.delete(enrollment)
    db.commit()
    return None

# --- FACULTY ENDPOINTS ---
allow_faculty_only = RoleChecker([models.UserRole.faculty])

@app.get("/faculty/courses", response_model=List[schemas.CourseResponse])
def get_assigned_courses(db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    courses = db.query(models.Course).filter(models.Course.faculty_id == current_user.id).all()
    return courses

@app.get("/faculty/courses/{course_id}/students", response_model=List[schemas.UserResponse])
def get_enrolled_students(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    course = db.query(models.Course).filter(
        models.Course.id == course_id, 
        models.Course.faculty_id == current_user.id
    ).first()
    
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized to view this course")
        
    enrollments = db.query(models.Enrollment).filter(models.Enrollment.course_id == course_id).all()
    students = [enrollment.student for enrollment in enrollments]
    return students
# --- ADMIN ENDPOINTS ---
@app.put("/courses/{course_id}", response_model=schemas.CourseResponse)
def update_course(course_id: int, course_data: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course.course_code = course_data.course_code
    course.course_name = course_data.course_name
    course.description = course_data.description
    course.credit = course_data.credit
    course.capacity = course_data.capacity
    db.commit()
    db.refresh(course)
    return course

@app.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    db.delete(course)
    db.commit()
    return None

@app.put("/courses/{course_id}/faculty")
def assign_faculty(course_id: int, faculty_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    faculty = db.query(models.User).filter(
        models.User.id == faculty_id, 
        models.User.role == models.UserRole.faculty
    ).first()
    
    if not course or not faculty:
        raise HTTPException(status_code=404, detail="Course or valid Faculty not found")
        
    course.faculty_id = faculty.id
    db.commit()
    return {"message": "Faculty assigned successfully"}

@app.get("/users", response_model=List[schemas.UserResponse])
def get_all_users(db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    return db.query(models.User).all()

@app.get("/enrollments", response_model=List[schemas.EnrollmentResponse])
def get_all_enrollments(db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    return db.query(models.Enrollment).all()

