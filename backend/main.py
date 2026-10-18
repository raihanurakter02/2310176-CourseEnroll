from fastapi import FastAPI

app = FastAPI(title="CourseEnroll API")

@app.get("/")
def read_root():
    return {"message": "Welcome to the CourseEnroll MVP API"}