from fastapi import FastAPI

from . import models  # noqa: F401
from .database import Base, engine

# Create tables in Supabase
Base.metadata.create_all(bind=engine)

app = FastAPI(title="CourseEnroll API")

@app.get("/")
def read_root():
    return {"message": "Welcome to the CourseEnroll MVP API"}