import os
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
import uuid

# Server secret and pepper loaded from environment variables
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
PEPPER = os.getenv("PASSWORD_PEPPER", "ce_secure_server_pepper_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Tell bcrypt to use fewer processing rounds so free-tier CPUs process it instantly
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=4)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies password using server pepper, with fallback for backwards compatibility."""
    try:
        if pwd_context.verify(plain_password + PEPPER, hashed_password):
            return True
    except Exception:
        pass
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hashes password combined with server-side pepper."""
    return pwd_context.hash(password + PEPPER)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # Add a unique JWT ID (jti) to every token for blacklisting / session tracking
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()),
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
