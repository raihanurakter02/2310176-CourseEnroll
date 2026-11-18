from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
import uuid

# NOTE: In production, load this from an environment variable (e.g., os.environ["SECRET_KEY"])
SECRET_KEY = "your-super-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Tell bcrypt to use fewer processing rounds so free-tier CPUs process it instantly
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=4)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

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
