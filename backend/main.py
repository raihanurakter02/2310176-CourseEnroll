import asyncio
import csv
import datetime
import io
import time
from typing import Any, Optional

import jwt
from fastapi import Body, Cookie, Depends, FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import text, func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from backend import auth, models, rbac, schemas
from backend.database import engine, get_db

class NotificationManager:
    """Manages real-time WebSocket connections for instant notification delivery."""
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        try:
            self._loop = asyncio.get_running_loop()
        except Exception:
            pass

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

    def broadcast_sync(self, message: dict):
        if not self.active_connections:
            return
        try:
            if self._loop and self._loop.is_running():
                asyncio.run_coroutine_threadsafe(self.broadcast(message), self._loop)
            else:
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(self.broadcast(message))
                except RuntimeError:
                    pass
        except Exception:
            pass

realtime_notifier = NotificationManager()

# Create database tables
models.Base.metadata.create_all(bind=engine)

# 1. Force PostgreSQL to accept the new Enum values (Must be done outside a transaction)
with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
    try:
        conn.execute(text("ALTER TYPE enrollmentstatus ADD VALUE IF NOT EXISTS 'pending';"))
        conn.execute(text("ALTER TYPE enrollmentstatus ADD VALUE IF NOT EXISTS 'approved';"))
        conn.execute(text("ALTER TYPE enrollmentstatus ADD VALUE IF NOT EXISTS 'rejected';"))
        conn.execute(text("ALTER TYPE enrollmentstatus ADD VALUE IF NOT EXISTS 'dropped';"))
        conn.execute(text("ALTER TYPE enrollmentstatus ADD VALUE IF NOT EXISTS 'waitlisted';"))
    except SQLAlchemyError:
        pass

# 2. Automatically ensure database columns match latest models
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS semester_id INTEGER REFERENCES semesters(id);"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS schedule_days VARCHAR DEFAULT 'Mon,Wed';"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS start_time VARCHAR DEFAULT '10:00';"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS end_time VARCHAR DEFAULT '11:30';"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS room VARCHAR DEFAULT 'Hall 101';"))
        conn.execute(text("ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS grade VARCHAR;"))
        # Force add the new grading period columns that are missing
        conn.execute(text("ALTER TABLE semesters ADD COLUMN IF NOT EXISTS grading_start_date TIMESTAMP;"))
        conn.execute(text("ALTER TABLE semesters ADD COLUMN IF NOT EXISTS grading_end_date TIMESTAMP;"))
        # Force add the new class_session linkage to the attendance table
        conn.execute(text("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS class_session_id INTEGER REFERENCES class_sessions(id);"))
        
        # Ensure timestamp typing
        conn.execute(text("ALTER TABLE semesters ALTER COLUMN start_date TYPE TIMESTAMP USING start_date::timestamp;"))
        conn.execute(text("ALTER TABLE semesters ALTER COLUMN end_date TYPE TIMESTAMP USING end_date::timestamp;"))
        conn.execute(text("ALTER TABLE semesters ALTER COLUMN add_drop_deadline TYPE TIMESTAMP USING add_drop_deadline::timestamp;"))

        # Security columns on users table
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason VARCHAR;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))

        conn.commit()
    except SQLAlchemyError:
        conn.rollback()

app = FastAPI(title="CourseEnroll API")

@app.get("/health")
def health_check():
    return {"status": "awake"}

# Configure CORS for React Frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://2310176-course-enroll.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    """Real-time instant notification broadcast channel for announcements & enrollments."""
    await realtime_notifier.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        realtime_notifier.disconnect(websocket)
    except Exception:
        realtime_notifier.disconnect(websocket)


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def is_past_deadline(deadline: Any) -> tuple[bool, str]:
    if not deadline:
        return False, ""
    if isinstance(deadline, datetime.datetime):
        clean_deadline = deadline.replace(tzinfo=None)
        # If stored as midnight 00:00:00 from a Date column, treat as end of that day
        if clean_deadline.hour == 0 and clean_deadline.minute == 0 and clean_deadline.second == 0:
            clean_deadline = clean_deadline.replace(hour=23, minute=59, second=59)
    else:
        clean_deadline = datetime.datetime.combine(deadline, datetime.time(23, 59, 59))

    now = datetime.datetime.now()
    return now > clean_deadline, clean_deadline.strftime("%Y-%m-%d %H:%M")


def parse_device_hint(user_agent: str) -> str:
    ua = user_agent.lower()
    browser = "Unknown Browser"
    os_name = "Unknown OS"
    for b in ["chrome", "firefox", "safari", "edge", "opera"]:
        if b in ua:
            browser = b.capitalize()
            break
    for o in [("windows", "Windows"), ("mac", "macOS"), ("linux", "Linux"), ("android", "Android"), ("iphone", "iPhone")]:
        if o[0] in ua:
            os_name = o[1]
            break
    return f"{browser} on {os_name}"


def log_security_event(
    db: Session,
    event_type: str,
    severity: str = "info",
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    detail: Optional[str] = None,
):
    """Helper: write a row to security_events and flush immediately."""
    event = models.SecurityEvent(
        event_type=event_type,
        severity=severity,
        user_id=user_id,
        user_email=user_email,
        ip_address=ip_address,
        user_agent=user_agent,
        detail=detail,
    )
    db.add(event)
    db.flush()  # flush but don't commit — caller owns the transaction


# ---------------------------------------------------------------------------
# LIGHTNING IN-MEMORY AUTH & DATA CACHES
# ---------------------------------------------------------------------------
_auth_cache: dict[str, tuple[models.User, float]] = {}
_data_cache: dict[str, tuple[Any, float]] = {}

def get_auth_cached(jti: str) -> Optional[models.User]:
    entry = _auth_cache.get(jti)
    if entry and time.time() < entry[1]:
        return entry[0]
    return None

def set_auth_cached(jti: str, user: models.User, ttl: float = 30.0):
    _auth_cache[jti] = (user, time.time() + ttl)

def invalidate_auth_cache(jti: Optional[str] = None, user_id: Optional[int] = None):
    global _auth_cache
    if jti:
        _auth_cache.pop(jti, None)
    elif user_id:
        _auth_cache = {k: v for k, v in _auth_cache.items() if getattr(v[0], 'id', None) != user_id}
    else:
        _auth_cache.clear()

def get_data_cached(key: str) -> Optional[Any]:
    entry = _data_cache.get(key)
    if entry and time.time() < entry[1]:
        return entry[0]
    return None

def set_data_cached(key: str, data: Any, ttl: float = 30.0):
    _data_cache[key] = (data, time.time() + ttl)

def invalidate_data_cache(*prefixes: str):
    global _data_cache
    if not prefixes:
        _data_cache.clear()
        return
    _data_cache = {
        k: v for k, v in _data_cache.items()
        if not any(k.startswith(p) for p in prefixes)
    }


# ---------------------------------------------------------------------------
# AUTH / GET CURRENT USER
# ---------------------------------------------------------------------------

def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):  # noqa: B008
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent", "Unknown")

    # --- Decode token ---
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: Optional[str] = payload.get("sub")
        jti: Optional[str] = payload.get("jti")
        tv: Optional[int] = payload.get("tv")
        if email is None or jti is None:
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        # Standard routine token expiration
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as exc:
        # Malformed or forged token: log audit event for investigation and reject caller
        try:
            ten_mins_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=10)
            tamper_count = (
                db.query(models.SecurityEvent)
                .filter(
                    models.SecurityEvent.ip_address == ip,
                    models.SecurityEvent.event_type.in_(["token_malformed", "token_tampered"]),
                    models.SecurityEvent.created_at >= ten_mins_ago,
                )
                .count()
            )
            severity = "critical" if tamper_count >= 2 else "high"
            log_security_event(
                db,
                event_type="token_tampered",
                severity=severity,
                ip_address=ip,
                user_agent=ua,
                detail=f"Malformed or tampered JWT detected (attempt #{tamper_count + 1}): {exc}",
            )
            if tamper_count >= 2:
                log_security_event(
                    db,
                    event_type="suspicious_activity",
                    severity="critical",
                    ip_address=ip,
                    user_agent=ua,
                    detail=f"Automated or brute-force token tampering detected from IP {ip}",
                )
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token: signature verification failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fast path: in-memory auth cache (0.0001 ms lookup)
    cached_user = get_auth_cached(jti)
    if cached_user is not None:
        if cached_user.is_banned:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Account suspended: {cached_user.ban_reason or 'Contact administrator'}",
            )
        if cached_user.locked_until and cached_user.locked_until > datetime.datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account temporarily locked",
            )
        user_tv = cached_user.token_version if cached_user.token_version is not None else 0
        if tv is not None and tv < user_tv:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session revoked (global logout)",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return cached_user

    # --- Fetch user ---
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception

    # --- Check token_blacklist ---
    blacklisted = (
        db.query(models.TokenBlacklist)
        .filter(models.TokenBlacklist.jti == jti)
        .first()
    )
    if blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # --- Check token_version (force-logout-all) ---
    user_tv = user.token_version if user.token_version is not None else 0
    if tv is not None and tv < user_tv:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session revoked (global logout)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # --- Check ban ---
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Account suspended: {user.ban_reason or 'Contact administrator'}",
        )

    # --- Check lockout ---
    if user.locked_until and user.locked_until > datetime.datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account temporarily locked",
        )

    # --- Check and update active session / detect session hijacking ---
    session_row = (
        db.query(models.UserSession)
        .filter(models.UserSession.jti == jti)
        .first()
    )
    if session_row:
        if not session_row.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Detect IP mismatch / token hijacking
        if session_row.ip_address and ip and session_row.ip_address != ip:
            log_security_event(
                db,
                event_type="suspicious_activity",
                severity="warning",
                user_id=user.id,
                user_email=user.email,
                ip_address=ip,
                user_agent=ua,
                detail=f"IP mismatch detected (Origin: {session_row.ip_address}, Current: {ip})",
            )
        now = datetime.datetime.utcnow()
        # Throttled update: only write last_seen if 60s passed to eliminate write lock latency on read queries
        if not session_row.last_seen or (now - session_row.last_seen).total_seconds() > 60:
            session_row.last_seen = now
            try:
                db.commit()
            except Exception:
                db.rollback()

    set_auth_cached(jti, user, ttl=30.0)
    return user


# ---------------------------------------------------------------------------
# REGISTER & LOGIN
# ---------------------------------------------------------------------------

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
        role=user.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def _set_refresh_cookie(response: Response, raw_token: str, request: Request):
    """Set httpOnly refresh_token cookie with cross-site flags when served over HTTPS."""
    is_https = (
        request.url.scheme == "https"
        or request.headers.get("x-forwarded-proto", "").lower() == "https"
    )
    response.set_cookie(
        key="refresh_token",
        value=raw_token,
        httponly=True,
        max_age=auth.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
        samesite="none" if is_https else "lax",
        secure=is_https,
    )


def _clear_refresh_cookie(response: Response, request: Request):
    is_https = (
        request.url.scheme == "https"
        or request.headers.get("x-forwarded-proto", "").lower() == "https"
    )
    response.delete_cookie(
        key="refresh_token",
        path="/",
        samesite="none" if is_https else "lax",
        secure=is_https,
    )


@app.post("/auth/login")
def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):  # noqa: B008
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent", "Unknown")

    user = db.query(models.User).filter(models.User.email == form_data.username).first()

    # --- Check ban first ---
    if user and user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account suspended by administrator",
        )

    # --- Check lockout ---
    if user and user.locked_until and user.locked_until > datetime.datetime.utcnow():
        unlock_str = user.locked_until.strftime("%Y-%m-%d %H:%M UTC")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account temporarily locked. Try again after {unlock_str}.",
        )

    # --- Verify password ---
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        if user:
            # Increment failed attempts
            attempts = (user.login_attempts or 0) + 1
            user.login_attempts = attempts
            if attempts >= 5:
                user.locked_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
            log_security_event(
                db,
                event_type="login_failed",
                severity="warning",
                user_id=user.id,
                user_email=user.email,
                ip_address=ip,
                user_agent=ua,
                detail=f"Failed attempt #{attempts}",
            )
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # --- Success ---
    user.login_attempts = 0
    user.locked_until = None

    role_val = user.role.value if hasattr(user.role, "value") else user.role
    token_version = user.token_version if user.token_version is not None else 0

    access_token = auth.create_access_token(
        data={
            "sub": user.email,
            "role": role_val,
            "name": user.name,
            "id": user.id,
            "tv": token_version,
        }
    )

    # Extract jti from the freshly created token
    decoded = jwt.decode(access_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
    jti = decoded["jti"]

    device_hint = parse_device_hint(ua)
    new_session = models.UserSession(
        user_id=user.id,
        jti=jti,
        ip_address=ip,
        user_agent=ua,
        device_hint=device_hint,
    )
    db.add(new_session)

    # Issue hashed server-side refresh token + httpOnly cookie
    raw_refresh = auth.generate_refresh_token()
    db.add(
        models.RefreshToken(
            user_id=user.id,
            token_hash=auth.hash_refresh_token(raw_refresh),
            session_jti=jti,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=auth.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    _set_refresh_cookie(response, raw_refresh, request)

    log_security_event(
        db,
        event_type="login_success",
        severity="info",
        user_id=user.id,
        user_email=user.email,
        ip_address=ip,
        user_agent=ua,
        detail=f"Device: {device_hint}",
    )
    db.commit()

    return {"access_token": access_token, "token_type": "bearer", "role": role_val}


@app.post("/auth/refresh")
def refresh_access_token(
    request: Request,
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
):
    """Rotate httpOnly refresh token and issue a fresh short-lived JWT access token."""
    raw_token = refresh_token or (body.get("refresh_token") if isinstance(body, dict) else None)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    token_hash = auth.hash_refresh_token(raw_token)
    rt = db.query(models.RefreshToken).filter(models.RefreshToken.token_hash == token_hash).first()
    if not rt or rt.revoked or rt.expires_at < datetime.datetime.utcnow():
        _clear_refresh_cookie(response, request)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user = db.query(models.User).filter(models.User.id == rt.user_id).first()
    if not user or not user.is_active or user.is_banned:
        rt.revoked = True
        db.commit()
        _clear_refresh_cookie(response, request)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended or inactive")

    # Ensure linked session wasn't revoked
    if rt.session_jti:
        sess = db.query(models.UserSession).filter(models.UserSession.jti == rt.session_jti).first()
        if sess and not sess.is_active:
            rt.revoked = True
            db.commit()
            _clear_refresh_cookie(response, request)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked")

    # Rotate: revoke old refresh token
    rt.revoked = True

    role_val = user.role.value if hasattr(user.role, "value") else user.role
    token_version = user.token_version if user.token_version is not None else 0
    new_access_token = auth.create_access_token(
        data={
            "sub": user.email,
            "role": role_val,
            "name": user.name,
            "id": user.id,
            "tv": token_version,
        }
    )
    decoded = jwt.decode(new_access_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
    new_jti = decoded["jti"]

    # Update session JTI & last_seen
    if rt.session_jti:
        db.query(models.UserSession).filter(models.UserSession.jti == rt.session_jti).update({
            "jti": new_jti,
            "last_seen": datetime.datetime.utcnow(),
        })
    else:
        ua = request.headers.get("user-agent", "Unknown")
        db.add(models.UserSession(
            user_id=user.id,
            jti=new_jti,
            ip_address=request.client.host if request.client else None,
            user_agent=ua,
            device_hint=parse_device_hint(ua),
        ))

    new_raw_refresh = auth.generate_refresh_token()
    db.add(
        models.RefreshToken(
            user_id=user.id,
            token_hash=auth.hash_refresh_token(new_raw_refresh),
            session_jti=new_jti,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=auth.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    db.commit()
    _set_refresh_cookie(response, new_raw_refresh, request)

    return {"access_token": new_access_token, "token_type": "bearer", "role": role_val}


@app.get("/auth/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):  # noqa: B008
    return current_user


@app.put("/auth/me", response_model=schemas.UserResponse)
def update_my_profile(
    profile: schemas.ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update the authenticated user's own profile (name, email)."""
    existing = db.query(models.User).filter(models.User.email == profile.email, models.User.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use by another account")
    current_user.name = profile.name.strip()
    current_user.email = profile.email.strip()
    invalidate_auth_cache(user_id=current_user.id)
    log_security_event(
        db,
        event_type="profile_updated",
        severity="info",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail="User updated profile details",
    )
    db.commit()
    db.refresh(current_user)
    return current_user


@app.post("/auth/change-password")
def change_my_password(
    payload: schemas.PasswordChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Change current user's password; verifies current password and records failed attempts."""
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent", "Unknown")

    if not auth.verify_password(payload.current_password, current_user.password_hash):
        log_security_event(
            db,
            event_type="password_change_failed",
            severity="warning",
            user_id=current_user.id,
            user_email=current_user.email,
            ip_address=ip,
            user_agent=ua,
            detail="Incorrect current password provided during password change",
        )
        db.commit()
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters long")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    current_user.password_hash = auth.get_password_hash(payload.new_password)
    invalidate_auth_cache(user_id=current_user.id)
    log_security_event(
        db,
        event_type="password_change",
        severity="info",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=ip,
        user_agent=ua,
        detail="User changed their password successfully",
    )
    db.commit()
    return {"message": "Password changed successfully"}


@app.get("/auth/sessions", response_model=list[schemas.UserSessionResponse])
def list_my_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List the authenticated user's own login sessions."""
    sessions = (
        db.query(models.UserSession)
        .filter(models.UserSession.user_id == current_user.id)
        .order_by(models.UserSession.last_seen.desc())
        .all()
    )
    return [
        schemas.UserSessionResponse(
            id=s.id,
            user_id=s.user_id,
            jti=s.jti,
            ip_address=s.ip_address,
            user_agent=s.user_agent,
            device_hint=s.device_hint,
            created_at=s.created_at,
            last_seen=s.last_seen,
            is_active=s.is_active,
            user_name=current_user.name,
            user_email=current_user.email,
        )
        for s in sessions
    ]


@app.delete("/auth/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_my_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Revoke one of the current user's own sessions (enforces ownership)."""
    sess = db.query(models.UserSession).filter(models.UserSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    rbac.ensure_owner_or_admin(sess.user_id, current_user, detail="Cannot revoke another user's session")

    existing_bl = db.query(models.TokenBlacklist).filter(models.TokenBlacklist.jti == sess.jti).first()
    if not existing_bl:
        db.add(models.TokenBlacklist(jti=sess.jti, user_id=sess.user_id, reason="user_session_revoke"))
    db.query(models.RefreshToken).filter(models.RefreshToken.session_jti == sess.jti).update({"revoked": True})
    sess.is_active = False
    invalidate_auth_cache(jti=sess.jti)
    log_security_event(
        db,
        event_type="session_revoked",
        severity="info",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"User revoked their own session {session_id}",
    )
    db.commit()


@app.post("/auth/logout")
def logout_user(
    request: Request,
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Graceful logout: blacklists token jti, revokes refresh token, clears cookie."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").strip()
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent", "Unknown")

    if refresh_token:
        rt_hash = auth.hash_refresh_token(refresh_token)
        db.query(models.RefreshToken).filter(models.RefreshToken.token_hash == rt_hash).update({"revoked": True})

    if token:
        try:
            payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
            jti = payload.get("jti")
            if jti:
                existing = db.query(models.TokenBlacklist).filter(models.TokenBlacklist.jti == jti).first()
                if not existing:
                    db.add(models.TokenBlacklist(jti=jti, user_id=current_user.id, reason="user_logout"))
                db.query(models.UserSession).filter(models.UserSession.jti == jti).update({"is_active": False})
                db.query(models.RefreshToken).filter(models.RefreshToken.session_jti == jti).update({"revoked": True})
                invalidate_auth_cache(jti=jti)
                log_security_event(
                    db,
                    event_type="user_logout",
                    severity="info",
                    user_id=current_user.id,
                    user_email=current_user.email,
                    ip_address=ip,
                    user_agent=ua,
                    detail=f"User {current_user.email} signed out cleanly",
                )
                db.commit()
        except Exception:
            db.rollback()

    _clear_refresh_cookie(response, request)
    return {"message": "Logged out successfully"}


# ---------------------------------------------------------------------------
# RBAC DEPENDENCY (from reusable backend/rbac.py module)
# ---------------------------------------------------------------------------
RoleChecker = rbac.make_role_checker(get_current_user)
PermissionChecker = rbac.make_permission_checker(get_current_user)


allow_all_roles = RoleChecker([models.UserRole.student, models.UserRole.faculty, models.UserRole.admin])
allow_admin_only = RoleChecker([models.UserRole.admin])
allow_faculty_only = RoleChecker([models.UserRole.faculty])
allow_student_only = RoleChecker([models.UserRole.student])

from backend.groups import create_groups_router
app.include_router(create_groups_router(allow_all_roles, log_security_event))


# ---------------------------------------------------------------------------
# SEMESTER ENDPOINTS
# ---------------------------------------------------------------------------
@app.get("/semesters", response_model=list[schemas.SemesterResponse])
def get_semesters(db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    cached = get_data_cached("semesters")
    if cached is not None:
        return cached
    res = db.query(models.Semester).all()
    set_data_cached("semesters", res, ttl=60.0)
    return res


@app.post("/semesters", response_model=schemas.SemesterResponse, status_code=status.HTTP_201_CREATED)
def create_semester(semester: schemas.SemesterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    existing_active = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    new_semester = models.Semester(
        name=semester.name,
        start_date=semester.start_date,
        end_date=semester.end_date,
        add_drop_deadline=semester.add_drop_deadline,
        grading_start_date=semester.grading_start_date,
        grading_end_date=semester.grading_end_date,
        is_active=existing_active is None,
    )
    db.add(new_semester)
    db.commit()
    invalidate_data_cache("semesters")
    db.refresh(new_semester)
    return new_semester


@app.put("/semesters/{semester_id}", response_model=schemas.SemesterResponse)
def update_semester(semester_id: int, semester_data: schemas.SemesterUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    target_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not target_semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    setattr(target_semester, "name", semester_data.name)
    setattr(target_semester, "start_date", semester_data.start_date)
    setattr(target_semester, "end_date", semester_data.end_date)
    setattr(target_semester, "add_drop_deadline", semester_data.add_drop_deadline)
    setattr(target_semester, "grading_start_date", semester_data.grading_start_date)
    setattr(target_semester, "grading_end_date", semester_data.grading_end_date)

    if semester_data.is_active:
        db.query(models.Semester).update({"is_active": False})
        setattr(target_semester, "is_active", True)
    else:
        setattr(target_semester, "is_active", False)

    db.commit()
    invalidate_data_cache("semesters")
    db.refresh(target_semester)
    return target_semester


@app.put("/semesters/{semester_id}/activate", response_model=schemas.SemesterResponse)
def activate_semester(semester_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    target_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not target_semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    db.query(models.Semester).update({"is_active": False})
    setattr(target_semester, "is_active", True)
    
    db.commit()
    invalidate_data_cache("semesters")
    db.refresh(target_semester)
    return target_semester


# ---------------------------------------------------------------------------
# COURSE & SCHEDULE ENDPOINTS
# ---------------------------------------------------------------------------
@app.get("/courses", response_model=list[schemas.CourseResponse])
def get_courses(db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    cached_courses = get_data_cached("courses")
    if cached_courses is not None:
        return cached_courses

    courses = db.query(models.Course).all()
    
    # 1 single fast aggregated query for all enrollment counts across courses
    counts = (
        db.query(
            models.Enrollment.course_id,
            models.Enrollment.status,
            func.count(models.Enrollment.id)
        )
        .filter(models.Enrollment.status.in_([models.EnrollmentStatus.approved, models.EnrollmentStatus.waitlisted]))
        .group_by(models.Enrollment.course_id, models.Enrollment.status)
        .all()
    )
    enrolled_map: dict[int, int] = {}
    waitlist_map: dict[int, int] = {}
    for cid, st, cnt in counts:
        if st == models.EnrollmentStatus.approved:
            enrolled_map[cid] = cnt
        elif st == models.EnrollmentStatus.waitlisted:
            waitlist_map[cid] = cnt

    results = []
    for c in courses:
        results.append(
            schemas.CourseResponse(
                id=c.id,
                course_code=c.course_code,
                course_name=c.course_name,
                description=c.description,
                credit=c.credit,
                capacity=c.capacity,
                schedule_days=c.schedule_days or "Mon,Wed",
                start_time=c.start_time or "10:00",
                end_time=c.end_time or "11:30",
                room=c.room or "Hall 101",
                faculty_id=c.faculty_id,
                semester_id=c.semester_id,
                enrolled_count=enrolled_map.get(c.id, 0),
                waitlist_count=waitlist_map.get(c.id, 0),
            )
        )
    set_data_cached("courses", results, ttl=20.0)
    return results


@app.get("/courses/{course_id}", response_model=schemas.CourseResponse)
def get_course(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    enrolled_c = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == course.id,
        models.Enrollment.status == models.EnrollmentStatus.approved,
    ).count()
    waitlisted_c = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == course.id,
        models.Enrollment.status == models.EnrollmentStatus.waitlisted,
    ).count()
    return schemas.CourseResponse(
        id=course.id,
        course_code=course.course_code,
        course_name=course.course_name,
        description=course.description,
        credit=course.credit,
        capacity=course.capacity,
        schedule_days=course.schedule_days or "Mon,Wed",
        start_time=course.start_time or "10:00",
        end_time=course.end_time or "11:30",
        room=course.room or "Hall 101",
        faculty_id=course.faculty_id,
        semester_id=course.semester_id,
        enrolled_count=enrolled_c,
        waitlist_count=waitlisted_c,
    )


@app.post("/courses", response_model=schemas.CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    new_course = models.Course(**course.dict())
    db.add(new_course)
    db.commit()
    invalidate_data_cache("courses")
    db.refresh(new_course)
    return new_course


@app.put("/courses/{course_id}", response_model=schemas.CourseResponse)
def update_course(course_id: int, course_data: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    for key, value in course_data.dict().items():
        setattr(course, key, value)
        
    db.commit()
    invalidate_data_cache("courses")
    db.refresh(course)
    return course


@app.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    db.query(models.Enrollment).filter(models.Enrollment.course_id == course_id).delete()
    db.delete(course)
    db.commit()
    invalidate_data_cache("courses")


@app.put("/courses/{course_id}/faculty")
def assign_faculty(course_id: int, faculty_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    faculty = db.query(models.User).filter(
        models.User.id == faculty_id,
        models.User.role == models.UserRole.faculty,
    ).first()
    if not course or not faculty:
        raise HTTPException(status_code=404, detail="Course or valid Faculty not found")

    setattr(course, "faculty_id", faculty.id)
    db.commit()
    invalidate_data_cache("courses")
    return {"message": "Faculty assigned successfully"}

@app.delete("/courses/{course_id}/faculty", status_code=status.HTTP_204_NO_CONTENT)
def remove_faculty_assignment(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Remove the assigned faculty member
    setattr(course, "faculty_id", None)
    db.commit()
    invalidate_data_cache("courses")
    return


@app.get("/courses/{course_id}/sessions", response_model=list[schemas.ClassSessionResponse])
def get_course_sessions(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    return db.query(models.ClassSession).filter(models.ClassSession.course_id == course_id).order_by(models.ClassSession.date).all()


@app.post("/courses/{course_id}/sessions", response_model=schemas.ClassSessionResponse)
def create_course_session(course_id: int, session_data: schemas.ClassSessionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str != "admin" and (role_str != "faculty" or course.faculty_id != current_user.id):
        raise HTTPException(status_code=403, detail="Only assigned faculty or administrators can schedule class sessions")
    new_session = models.ClassSession(course_id=course_id, date=session_data.date, topic=session_data.topic)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@app.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_session(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_all_roles)):  # noqa: B008
    session = db.query(models.ClassSession).filter(models.ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    course = db.query(models.Course).filter(models.Course.id == session.course_id).first()
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str != "admin" and (role_str != "faculty" or (course and course.faculty_id != current_user.id)):
        raise HTTPException(status_code=403, detail="Only assigned faculty or administrators can delete class sessions")
    db.delete(session)
    db.commit()


# ---------------------------------------------------------------------------
# STUDENT ENROLLMENT ENDPOINTS
# ---------------------------------------------------------------------------
@app.post("/enrollments", response_model=schemas.EnrollmentResponse, status_code=status.HTTP_201_CREATED)
def enroll_in_course(enrollment: schemas.EnrollmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_student_only)):  # noqa: B008
    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem:
        raise HTTPException(status_code=400, detail="Registration is closed. Please ask Admin to activate a semester.")

    expired, formatted_deadline = is_past_deadline(active_sem.add_drop_deadline)
    if expired:
        raise HTTPException(status_code=400, detail=f"Add/Drop deadline passed on {formatted_deadline}.")

    course = db.query(models.Course).filter(models.Course.id == enrollment.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == enrollment.course_id,
        models.Enrollment.student_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already requested or enrolled in this course.")

    approved_enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == enrollment.course_id,
        models.Enrollment.status == models.EnrollmentStatus.approved,
    ).count()

    # If course is full, place student on the automatic Waitlist queue
    is_at_capacity = approved_enrollments >= course.capacity
    initial_status = "waitlisted" if is_at_capacity else "pending"

    new_enrollment = models.Enrollment(
        student_id=current_user.id,
        course_id=enrollment.course_id,
        status=initial_status,
    )
    db.add(new_enrollment)
    db.commit()
    invalidate_data_cache("courses")
    db.refresh(new_enrollment)
    return new_enrollment


@app.get("/enrollments/my", response_model=list[schemas.EnrollmentResponse])
def get_my_enrollments(db: Session = Depends(get_db), current_user: models.User = Depends(allow_student_only)):  # noqa: B008
    return (
        db.query(models.Enrollment)
        .options(joinedload(models.Enrollment.course))
        .filter(models.Enrollment.student_id == current_user.id)
        .all()
    )


@app.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def drop_course(enrollment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_student_only)):  # noqa: B008
    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if active_sem:
        expired, formatted_deadline = is_past_deadline(active_sem.add_drop_deadline)
        if expired:
            raise HTTPException(
                status_code=400,
                detail=f"The Add/Drop deadline ({formatted_deadline}) has passed. You cannot drop courses anymore.",
            )

    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.id == enrollment_id,
        models.Enrollment.student_id == current_user.id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    course_id = enrollment.course_id
    was_approved = enrollment.status == models.EnrollmentStatus.approved

    db.delete(enrollment)
    db.commit()
    invalidate_data_cache("courses")

    # Automatic Waitlist Promotion: promote earliest waitlisted student when a seat opens up
    if was_approved:
        next_waitlisted = (
            db.query(models.Enrollment)
            .filter(
                models.Enrollment.course_id == course_id,
                models.Enrollment.status == models.EnrollmentStatus.waitlisted,
            )
            .order_by(models.Enrollment.enrolled_at.asc())
            .first()
        )
        if next_waitlisted:
            next_waitlisted.status = models.EnrollmentStatus.approved
            db.commit()
            realtime_notifier.broadcast_sync({
                "type": "waitlist_promoted",
                "student_id": next_waitlisted.student_id,
                "course_id": course_id,
            })


# ---------------------------------------------------------------------------
# FACULTY ENDPOINTS
# ---------------------------------------------------------------------------
@app.get("/faculty/courses", response_model=list[schemas.CourseResponse])
def get_assigned_courses(db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    return db.query(models.Course).filter(models.Course.faculty_id == current_user.id).all()


@app.get("/faculty/courses/{course_id}/roster", response_model=list[schemas.EnrollmentResponse])
def get_course_roster(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.faculty_id == current_user.id,
    ).first()
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized to view this course roster")
    return (
        db.query(models.Enrollment)
        .options(joinedload(models.Enrollment.student))
        .filter(
            models.Enrollment.course_id == course_id,
            models.Enrollment.status == models.EnrollmentStatus.approved,
        )
        .all()
    )


@app.put("/enrollments/{enrollment_id}/grade")
def update_student_grade(enrollment_id: int, grade_data: schemas.GradeUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    active_sem = db.query(models.Semester).filter(models.Semester.is_active == True).first()
    if not active_sem or not active_sem.grading_start_date or not active_sem.grading_end_date:
        raise HTTPException(status_code=400, detail="Grading period is not defined for the active semester.")
    
    now = datetime.datetime.utcnow()
    if not (active_sem.grading_start_date <= now <= active_sem.grading_end_date):
        raise HTTPException(status_code=400, detail="The official grading window is currently closed.")

    enrollment = db.query(models.Enrollment).filter(models.Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment record not found")
        
    course = db.query(models.Course).filter(
        models.Course.id == enrollment.course_id,
        models.Course.faculty_id == current_user.id,
    ).first()
    if not course:
        raise HTTPException(status_code=403, detail="You cannot grade a student in a course you do not teach")
    
    setattr(enrollment, "grade", grade_data.grade)
    db.commit()
    return {"message": f"Grade {grade_data.grade} assigned successfully"}


@app.get("/faculty/courses/{course_id}/attendance", response_model=list[schemas.AttendanceResponse])
def get_course_attendance(course_id: int, session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    return db.query(models.Attendance).join(models.Enrollment).filter(
        models.Enrollment.course_id == course_id,
        models.Attendance.class_session_id == session_id
    ).all()


@app.post("/faculty/courses/{course_id}/attendance")
def submit_course_attendance(course_id: int, attendance_data: schemas.AttendanceSubmit, db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.faculty_id == current_user.id,
    ).first()
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized to modify this course")
    
    for record in attendance_data.records:
        existing = db.query(models.Attendance).filter(
            models.Attendance.enrollment_id == record.enrollment_id,
            models.Attendance.class_session_id == attendance_data.class_session_id,
        ).first()
        
        if existing:
            setattr(existing, "status", record.status)
        else:
            new_att = models.Attendance(
                enrollment_id=record.enrollment_id,
                class_session_id=attendance_data.class_session_id,
                status=record.status,
            )
            db.add(new_att)
            
    db.commit()
    return {"message": "Attendance saved successfully"}


@app.get("/faculty/courses/{course_id}/attendance/history", response_model=list[schemas.AttendanceResponse])
def get_course_attendance_history(course_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_faculty_only)):  # noqa: B008
    return (
        db.query(models.Attendance)
        .options(joinedload(models.Attendance.session))
        .join(models.Enrollment)
        .filter(models.Enrollment.course_id == course_id)
        .all()
    )


# ---------------------------------------------------------------------------
# ADMIN ENDPOINTS (USERS & ENROLLMENT APPROVALS)
# ---------------------------------------------------------------------------
@app.get("/users", response_model=list[schemas.UserResponse])
def get_all_users(db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    cached = get_data_cached("admin_users_list")
    if cached is not None:
        return cached
    res = db.query(models.User).all()
    set_data_cached("admin_users_list", res, ttl=20.0)
    return res


@app.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    user_data: schemas.UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):  # noqa: B008
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Safety rule: an admin cannot change their own role
    if user_id == current_user.id and user_data.role != user.role:
        raise HTTPException(status_code=400, detail="Administrators cannot change their own role")

    old_role = user.role.value if hasattr(user.role, "value") else str(user.role)
    new_role = user_data.role.value if hasattr(user_data.role, "value") else str(user_data.role)

    setattr(user, "name", user_data.name)
    setattr(user, "email", user_data.email)
    setattr(user, "role", user_data.role)

    if old_role != new_role:
        log_security_event(
            db,
            event_type="role_change",
            severity="warning",
            user_id=user.id,
            user_email=user.email,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent", "Unknown"),
            detail=f"Role changed from {old_role} to {new_role} by {current_user.email}",
        )
    invalidate_auth_cache(user_id=user.id)
    invalidate_data_cache("admin_users_list")
    db.commit()
    db.refresh(user)
    return user


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == models.UserRole.admin:
        raise HTTPException(status_code=400, detail="Administrator accounts cannot be removed")

    db.query(models.Enrollment).filter(models.Enrollment.student_id == user_id).delete()
    db.query(models.Course).filter(models.Course.faculty_id == user_id).update({"faculty_id": None})
    db.delete(user)
    db.commit()


@app.get("/enrollments", response_model=list[schemas.EnrollmentResponse])
def get_all_enrollments(db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    return db.query(models.Enrollment).all()


@app.put("/enrollments/{enrollment_id}/status", response_model=schemas.EnrollmentResponse)
def update_enrollment_status(enrollment_id: int, status_update: schemas.EnrollmentStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(allow_admin_only)):  # noqa: B008
    enrollment = db.query(models.Enrollment).filter(models.Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if status_update.status == models.EnrollmentStatus.approved:
        course = db.query(models.Course).filter(models.Course.id == enrollment.course_id).first()
        approved_count = db.query(models.Enrollment).filter(
            models.Enrollment.course_id == enrollment.course_id,
            models.Enrollment.status == models.EnrollmentStatus.approved,
        ).count()
        if course and approved_count >= course.capacity:
            raise HTTPException(status_code=400, detail="Course is at full capacity")

    setattr(enrollment, "status", status_update.status)
    db.commit()
    invalidate_data_cache("courses")
    db.refresh(enrollment)

    course = db.query(models.Course).filter(models.Course.id == enrollment.course_id).first()
    status_str = status_update.status.value if hasattr(status_update.status, "value") else str(status_update.status)
    try:
        realtime_notifier.broadcast_sync({
            "type": "enrollment_update",
            "student_id": enrollment.student_id,
            "course_id": enrollment.course_id,
            "course_title": course.course_name if course else "Course",
            "course_code": course.course_code if course else "",
            "status": status_str,
        })
    except Exception:
        pass

    return enrollment


# ---------------------------------------------------------------------------
# ADMIN SECURITY ENDPOINTS
# ---------------------------------------------------------------------------

@app.get("/admin/security/events", response_model=list[schemas.SecurityEventResponse])
def list_security_events(
    limit: int = 100,
    offset: int = 0,
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """List security audit log events with optional filters and pagination."""
    q = db.query(models.SecurityEvent)
    if event_type and event_type != "all":
        q = q.filter(models.SecurityEvent.event_type == event_type)
    if severity and severity != "all":
        q = q.filter(models.SecurityEvent.severity == severity)
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            (models.SecurityEvent.user_email.ilike(term))
            | (models.SecurityEvent.ip_address.ilike(term))
            | (models.SecurityEvent.detail.ilike(term))
            | (models.SecurityEvent.event_type.ilike(term))
        )
    return (
        q.order_by(models.SecurityEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@app.get("/admin/security/failed-logins-summary")
def failed_logins_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Aggregate failed logins by IP address and by account email."""
    by_ip_rows = (
        db.query(models.SecurityEvent.ip_address, func.count(models.SecurityEvent.id))
        .filter(models.SecurityEvent.event_type == "login_failed")
        .group_by(models.SecurityEvent.ip_address)
        .order_by(func.count(models.SecurityEvent.id).desc())
        .limit(20)
        .all()
    )
    by_account_rows = (
        db.query(models.SecurityEvent.user_email, func.count(models.SecurityEvent.id))
        .filter(models.SecurityEvent.event_type == "login_failed")
        .group_by(models.SecurityEvent.user_email)
        .order_by(func.count(models.SecurityEvent.id).desc())
        .limit(20)
        .all()
    )
    return {
        "by_ip": [{"ip_address": ip or "Unknown", "count": cnt} for ip, cnt in by_ip_rows],
        "by_account": [{"user_email": em or "Unknown", "count": cnt} for em, cnt in by_account_rows],
    }


@app.get("/admin/security/sessions", response_model=list[schemas.UserSessionResponse])
def list_user_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """List all user sessions with joined user info."""
    rows = (
        db.query(models.UserSession, models.User)
        .join(models.User, models.User.id == models.UserSession.user_id)
        .order_by(models.UserSession.last_seen.desc())
        .all()
    )
    result = []
    for sess, user in rows:
        result.append(
            schemas.UserSessionResponse(
                id=sess.id,
                user_id=sess.user_id,
                jti=sess.jti,
                ip_address=sess.ip_address,
                user_agent=sess.user_agent,
                device_hint=sess.device_hint,
                created_at=sess.created_at,
                last_seen=sess.last_seen,
                is_active=sess.is_active,
                user_name=user.name,
                user_email=user.email,
            )
        )
    return result


@app.delete("/admin/security/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Revoke a specific user session (adds to blacklist, marks inactive)."""
    sess = db.query(models.UserSession).filter(models.UserSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    # Blacklist the jti
    existing_bl = db.query(models.TokenBlacklist).filter(models.TokenBlacklist.jti == sess.jti).first()
    if not existing_bl:
        db.add(models.TokenBlacklist(jti=sess.jti, user_id=sess.user_id, reason="admin_revoke"))

    sess.is_active = False
    invalidate_auth_cache(jti=sess.jti)
    invalidate_data_cache("admin_security_stats")

    log_security_event(
        db,
        event_type="session_revoked",
        severity="warning",
        user_id=sess.user_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Session {session_id} revoked by admin {current_user.email}",
    )
    db.commit()


@app.post("/admin/security/users/{user_id}/ban")
@app.post("/admin/users/{user_id}/ban")
def ban_user(
    user_id: int,
    ban_data: schemas.BanRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Ban a user: set is_banned, revoke all active sessions, log event."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == models.UserRole.admin:
        raise HTTPException(status_code=400, detail="Administrator accounts cannot be banned")

    user.is_banned = True
    user.ban_reason = ban_data.ban_reason

    # Revoke all active sessions for this user
    active_sessions = (
        db.query(models.UserSession)
        .filter(models.UserSession.user_id == user_id, models.UserSession.is_active == True)
        .all()
    )
    for sess in active_sessions:
        existing_bl = db.query(models.TokenBlacklist).filter(models.TokenBlacklist.jti == sess.jti).first()
        if not existing_bl:
            db.add(models.TokenBlacklist(jti=sess.jti, user_id=user_id, reason="user_banned"))
        sess.is_active = False

    invalidate_auth_cache(user_id=user_id)
    invalidate_data_cache("admin_security_stats", "admin_users_list")

    log_security_event(
        db,
        event_type="user_banned",
        severity="critical",
        user_id=user.id,
        user_email=user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Banned by {current_user.email}. Reason: {ban_data.ban_reason}",
    )
    db.commit()
    return {"message": f"User {user.email} has been banned"}


@app.post("/admin/security/users/{user_id}/unban")
@app.post("/admin/users/{user_id}/unban")
def unban_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Unban a user."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_banned = False
    user.ban_reason = None
    invalidate_auth_cache(user_id=user_id)
    invalidate_data_cache("admin_security_stats", "admin_users_list")

    log_security_event(
        db,
        event_type="user_unbanned",
        severity="info",
        user_id=user.id,
        user_email=user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Unbanned by {current_user.email}",
    )
    db.commit()
    return {"message": f"User {user.email} has been unbanned"}


@app.post("/admin/security/force-logout-all")
def force_logout_all(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """
    Revoke ALL active sessions system-wide by incrementing every user's
    token_version. Any existing token with an outdated `tv` claim is rejected
    in get_current_user.
    """
    db.query(models.User).update({"token_version": models.User.token_version + 1})

    # Also mark all active sessions inactive
    db.query(models.UserSession).filter(models.UserSession.is_active == True).update({"is_active": False})
    invalidate_auth_cache()
    invalidate_data_cache("admin_security_stats")
    db.query(models.UserSession).filter(models.UserSession.is_active == True).update({"is_active": False})

    log_security_event(
        db,
        event_type="force_logout_all",
        severity="critical",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Global force-logout triggered by {current_user.email}",
    )
    db.commit()
    return {"message": "All sessions have been invalidated"}


@app.get("/admin/security/stats", response_model=schemas.SecurityStatsResponse)
def security_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Return aggregate security and overview statistics."""
    cached = get_data_cached("admin_security_stats")
    if cached is not None:
        return cached

    now = datetime.datetime.utcnow()
    since_24h = now - datetime.timedelta(hours=24)
    since_7d = now - datetime.timedelta(days=7)

    total_events = db.query(models.SecurityEvent).count()
    critical_events_24h = (
        db.query(models.SecurityEvent)
        .filter(
            models.SecurityEvent.severity == "critical",
            models.SecurityEvent.created_at >= since_24h,
        )
        .count()
    )
    active_sessions = (
        db.query(models.UserSession).filter(models.UserSession.is_active == True).count()
    )
    banned_users = db.query(models.User).filter(models.User.is_banned == True).count()
    failed_logins_24h = (
        db.query(models.SecurityEvent)
        .filter(
            models.SecurityEvent.event_type == "login_failed",
            models.SecurityEvent.created_at >= since_24h,
        )
        .count()
    )
    total_users = db.query(models.User).count()
    total_courses = db.query(models.Course).count()
    total_enrollments = db.query(models.Enrollment).count()
    total_groups = db.query(models.StudyGroup).count()
    new_users_7d = db.query(models.User).filter(models.User.created_at >= since_7d).count()
    new_groups_7d = db.query(models.StudyGroup).filter(models.StudyGroup.created_at >= since_7d).count()

    stats = schemas.SecurityStatsResponse(
        total_events=total_events,
        critical_events_24h=critical_events_24h,
        active_sessions=active_sessions,
        banned_users=banned_users,
        failed_logins_24h=failed_logins_24h,
        total_users=total_users,
        total_courses=total_courses,
        total_enrollments=total_enrollments,
        total_groups=total_groups,
        new_users_7d=new_users_7d,
        new_groups_7d=new_groups_7d,
    )
    set_data_cached("admin_security_stats", stats, ttl=15.0)
    return stats


@app.get("/admin/users/{user_id}/details")
def get_user_details(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Detailed admin view: user's records, groups, sessions, and recent activity."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    enrollments = (
        db.query(models.Enrollment, models.Course)
        .join(models.Course, models.Course.id == models.Enrollment.course_id)
        .filter(models.Enrollment.student_id == user_id)
        .all()
    )
    taught_courses = db.query(models.Course).filter(models.Course.faculty_id == user_id).all()

    owned_groups = db.query(models.StudyGroup).filter(models.StudyGroup.owner_id == user_id).all()
    member_groups = (
        db.query(models.StudyGroup, models.StudyGroupMember)
        .join(models.StudyGroupMember, models.StudyGroupMember.group_id == models.StudyGroup.id)
        .filter(models.StudyGroupMember.user_id == user_id)
        .all()
    )

    sessions = (
        db.query(models.UserSession)
        .filter(models.UserSession.user_id == user_id)
        .order_by(models.UserSession.last_seen.desc())
        .limit(20)
        .all()
    )
    events = (
        db.query(models.SecurityEvent)
        .filter((models.SecurityEvent.user_id == user_id) | (models.SecurityEvent.user_email == user.email))
        .order_by(models.SecurityEvent.created_at.desc())
        .limit(30)
        .all()
    )

    return {
        "user": schemas.UserResponse.model_validate(user),
        "enrollments": [
            {
                "id": e.id,
                "course_id": c.id,
                "course_code": c.course_code,
                "course_name": c.course_name,
                "status": e.status.value if hasattr(e.status, "value") else e.status,
                "grade": e.grade,
            }
            for e, c in enrollments
        ],
        "taught_courses": [
            {"id": c.id, "course_code": c.course_code, "course_name": c.course_name}
            for c in taught_courses
        ],
        "groups": [
            {"id": g.id, "name": g.name, "role": "owner"} for g in owned_groups
        ] + [
            {
                "id": g.id,
                "name": g.name,
                "role": "member",
                "can_create": m.can_create,
                "can_edit": m.can_edit,
                "can_assign": m.can_assign,
            }
            for g, m in member_groups
        ],
        "sessions": [
            {
                "id": s.id,
                "device_hint": s.device_hint,
                "ip_address": s.ip_address,
                "is_active": s.is_active,
                "created_at": s.created_at,
                "last_seen": s.last_seen,
            }
            for s in sessions
        ],
        "recent_activity": [schemas.SecurityEventResponse.model_validate(ev) for ev in events],
    }


@app.post("/admin/security/users/{user_id}/revoke-sessions")
def revoke_all_user_sessions(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Revoke all active sessions and refresh tokens for a specific user."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    active_sessions = (
        db.query(models.UserSession)
        .filter(models.UserSession.user_id == user_id, models.UserSession.is_active == True)
        .all()
    )
    for sess in active_sessions:
        if not db.query(models.TokenBlacklist).filter(models.TokenBlacklist.jti == sess.jti).first():
            db.add(models.TokenBlacklist(jti=sess.jti, user_id=user_id, reason="admin_revoke_all"))
        sess.is_active = False

    db.query(models.RefreshToken).filter(models.RefreshToken.user_id == user_id).update({"revoked": True})
    user.token_version = (user.token_version or 0) + 1
    invalidate_auth_cache(user_id=user_id)
    invalidate_data_cache("admin_security_stats")

    log_security_event(
        db,
        event_type="session_revoked",
        severity="warning",
        user_id=user.id,
        user_email=user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"All sessions revoked for {user.email} by {current_user.email}",
    )
    db.commit()
    return {"message": f"Revoked all sessions for {user.email}"}


@app.post("/admin/security/users/bulk-ban")
def bulk_ban_users(
    payload: schemas.BulkUserActionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Bulk ban multiple non-admin users."""
    banned_count = 0
    for uid in payload.user_ids:
        user = db.query(models.User).filter(models.User.id == uid).first()
        if not user or user.role == models.UserRole.admin:
            continue
        user.is_banned = True
        user.ban_reason = payload.ban_reason or "Bulk administrative suspension"
        active_sessions = db.query(models.UserSession).filter(models.UserSession.user_id == uid, models.UserSession.is_active == True).all()
        for sess in active_sessions:
            if not db.query(models.TokenBlacklist).filter(models.TokenBlacklist.jti == sess.jti).first():
                db.add(models.TokenBlacklist(jti=sess.jti, user_id=uid, reason="user_banned"))
            sess.is_active = False
        db.query(models.RefreshToken).filter(models.RefreshToken.user_id == uid).update({"revoked": True})
        invalidate_auth_cache(user_id=uid)
        banned_count += 1

    invalidate_data_cache("admin_security_stats", "admin_users_list")
    log_security_event(
        db,
        event_type="user_banned",
        severity="critical",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Bulk banned {banned_count} user(s). Reason: {payload.ban_reason}",
    )
    db.commit()
    return {"message": f"Banned {banned_count} user(s)", "count": banned_count}


@app.post("/admin/security/users/bulk-unban")
def bulk_unban_users(
    payload: schemas.BulkUserActionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Bulk unban multiple users."""
    unbanned_count = 0
    for uid in payload.user_ids:
        user = db.query(models.User).filter(models.User.id == uid).first()
        if not user:
            continue
        user.is_banned = False
        user.ban_reason = None
        invalidate_auth_cache(user_id=uid)
        unbanned_count += 1

    invalidate_data_cache("admin_security_stats", "admin_users_list")
    log_security_event(
        db,
        event_type="user_unbanned",
        severity="info",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Bulk unbanned {unbanned_count} user(s)",
    )
    db.commit()
    return {"message": f"Unbanned {unbanned_count} user(s)", "count": unbanned_count}


@app.post("/admin/moderation/courses/bulk-delete")
def bulk_delete_courses(
    payload: schemas.BulkDeleteRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    deleted = 0
    for cid in payload.ids:
        course = db.query(models.Course).filter(models.Course.id == cid).first()
        if course:
            db.query(models.Enrollment).filter(models.Enrollment.course_id == cid).delete()
            db.delete(course)
            deleted += 1
    invalidate_data_cache("courses")
    log_security_event(
        db,
        event_type="record_deleted",
        severity="warning",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Bulk deleted {deleted} course(s)",
    )
    db.commit()
    return {"deleted": deleted}


@app.post("/admin/moderation/groups/bulk-delete")
def bulk_delete_groups(
    payload: schemas.BulkDeleteRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    deleted = 0
    for gid in payload.ids:
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == gid).first()
        if group:
            db.delete(group)
            deleted += 1
    log_security_event(
        db,
        event_type="record_deleted",
        severity="warning",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Bulk deleted {deleted} group(s)",
    )
    db.commit()
    return {"deleted": deleted}


def _csv_response(rows: list[list[Any]], headers: list[str], filename: str):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/admin/export/users")
def export_users_csv(
    request: Request,
    role: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    q = db.query(models.User)
    if role and role != "all":
        q = q.filter(models.User.role == role)
    if status_filter == "banned":
        q = q.filter(models.User.is_banned == True)
    elif status_filter == "active":
        q = q.filter(models.User.is_banned == False)
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter((models.User.name.ilike(term)) | (models.User.email.ilike(term)))

    users = q.all()
    log_security_event(
        db,
        event_type="export_csv",
        severity="info",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Exported {len(users)} users to CSV",
    )
    db.commit()
    rows = [
        [u.id, u.name, u.email, u.role.value if hasattr(u.role, "value") else u.role, u.is_banned, u.ban_reason or ""]
        for u in users
    ]
    return _csv_response(rows, ["ID", "Name", "Email", "Role", "Is Banned", "Ban Reason"], "users_export.csv")


@app.get("/admin/export/records")
def export_records_csv(
    request: Request,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    q = db.query(models.Course)
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter((models.Course.course_code.ilike(term)) | (models.Course.course_name.ilike(term)))
    courses = q.all()
    log_security_event(
        db,
        event_type="export_csv",
        severity="info",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Exported {len(courses)} course records to CSV",
    )
    db.commit()
    rows = [[c.id, c.course_code, c.course_name, c.credit, c.capacity, c.room, c.schedule_days] for c in courses]
    return _csv_response(rows, ["ID", "Code", "Name", "Credit", "Capacity", "Room", "Schedule"], "records_export.csv")


@app.get("/admin/export/events")
def export_events_csv(
    request: Request,
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    q = db.query(models.SecurityEvent)
    if event_type and event_type != "all":
        q = q.filter(models.SecurityEvent.event_type == event_type)
    if severity and severity != "all":
        q = q.filter(models.SecurityEvent.severity == severity)
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            (models.SecurityEvent.user_email.ilike(term))
            | (models.SecurityEvent.ip_address.ilike(term))
            | (models.SecurityEvent.detail.ilike(term))
        )
    events = q.order_by(models.SecurityEvent.created_at.desc()).limit(1000).all()
    log_security_event(
        db,
        event_type="export_csv",
        severity="info",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Exported {len(events)} audit events to CSV",
    )
    db.commit()
    rows = [
        [e.id, e.created_at.isoformat() if e.created_at else "", e.event_type, e.severity, e.user_email or "", e.ip_address or "", e.user_agent or "", e.detail or ""]
        for e in events
    ]
    return _csv_response(rows, ["ID", "Timestamp", "Event Type", "Severity", "User Email", "IP Address", "Browser/UA", "Detail"], "audit_log_export.csv")


# ---------------------------------------------------------------------------
# ANNOUNCEMENTS & INBOX ENDPOINTS
# ---------------------------------------------------------------------------

@app.get("/announcements", response_model=list[schemas.AnnouncementResponse])
def get_announcements(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_roles),
):
    """Retrieve announcements tailored to the current user's role with read status."""
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    
    cached_all = get_data_cached("active_announcements")
    if cached_all is None:
        cached_all = (
            db.query(models.Announcement)
            .options(joinedload(models.Announcement.author))
            .filter(models.Announcement.is_active == True)
            .order_by(models.Announcement.created_at.desc())
            .all()
        )
        set_data_cached("active_announcements", cached_all, ttl=20.0)

    if role_str == "admin":
        announcements = cached_all
    else:
        announcements = [a for a in cached_all if a.target_role in ("all", role_str)]
    
    # Get all read announcement IDs for this user
    read_ids = {
        r.announcement_id
        for r in db.query(models.AnnouncementRead)
        .filter(models.AnnouncementRead.user_id == current_user.id)
        .all()
    }
    
    result = []
    for a in announcements:
        author_name = a.author.name if a.author else "Administrator"
        result.append(
            schemas.AnnouncementResponse(
                id=a.id,
                title=a.title,
                content=a.content,
                target_role=a.target_role,
                priority=a.priority,
                created_by=a.created_by,
                author_name=author_name,
                created_at=a.created_at,
                is_active=a.is_active,
                is_read=(a.id in read_ids),
            )
        )
    return result


@app.get("/announcements/unread-count", response_model=schemas.UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_roles),
):
    """Return count of unread announcements for current user."""
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    cache_key = f"unread_{current_user.id}_{role_str}"
    cached = get_data_cached(cache_key)
    if cached is not None:
        return schemas.UnreadCountResponse(unread_count=cached)

    read_subquery = (
        db.query(models.AnnouncementRead.announcement_id)
        .filter(models.AnnouncementRead.user_id == current_user.id)
        .subquery()
    )
    query = db.query(models.Announcement).filter(
        models.Announcement.is_active == True,
        ~models.Announcement.id.in_(read_subquery)
    )
    if role_str != "admin":
        query = query.filter(models.Announcement.target_role.in_(["all", role_str]))
        
    unread = query.count()
    set_data_cached(cache_key, unread, ttl=15.0)
    return schemas.UnreadCountResponse(unread_count=unread)


@app.post("/announcements", response_model=schemas.AnnouncementResponse, status_code=status.HTTP_201_CREATED)
def create_announcement(
    announcement_data: schemas.AnnouncementCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Admin creates a new announcement."""
    new_announcement = models.Announcement(
        title=announcement_data.title,
        content=announcement_data.content,
        target_role=announcement_data.target_role,
        priority=announcement_data.priority,
        created_by=current_user.id,
    )
    db.add(new_announcement)
    db.commit()
    invalidate_data_cache("active_announcements", "unread_")
    db.refresh(new_announcement)
    
    log_security_event(
        db,
        event_type="announcement_broadcast",
        severity="info",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "Unknown"),
        detail=f"Broadcast '{new_announcement.title}' to {new_announcement.target_role}",
    )
    db.commit()

    try:
        realtime_notifier.broadcast_sync({
            "type": "new_announcement",
            "id": new_announcement.id,
            "title": new_announcement.title,
            "content": new_announcement.content,
            "target_role": new_announcement.target_role,
            "priority": new_announcement.priority,
            "author_name": current_user.name,
            "created_at": new_announcement.created_at.isoformat() if new_announcement.created_at else "",
        })
    except Exception:
        pass
    
    return schemas.AnnouncementResponse(
        id=new_announcement.id,
        title=new_announcement.title,
        content=new_announcement.content,
        target_role=new_announcement.target_role,
        priority=new_announcement.priority,
        created_by=new_announcement.created_by,
        author_name=current_user.name,
        created_at=new_announcement.created_at,
        is_active=new_announcement.is_active,
        is_read=True,
    )


@app.put("/announcements/{announcement_id}", response_model=schemas.AnnouncementResponse)
def update_announcement(
    announcement_id: int,
    data: schemas.AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Admin updates an announcement."""
    announcement = db.query(models.Announcement).filter(models.Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
        
    for key, value in data.dict(exclude_unset=True).items():
        setattr(announcement, key, value)
        
    db.commit()
    invalidate_data_cache("active_announcements", "unread_")
    db.refresh(announcement)
    return schemas.AnnouncementResponse(
        id=announcement.id,
        title=announcement.title,
        content=announcement.content,
        target_role=announcement.target_role,
        priority=announcement.priority,
        created_by=announcement.created_by,
        author_name=announcement.author.name if announcement.author else "Administrator",
        created_at=announcement.created_at,
        is_active=announcement.is_active,
        is_read=True,
    )


@app.delete("/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_admin_only),
):
    """Admin deletes an announcement."""
    announcement = db.query(models.Announcement).filter(models.Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(announcement)
    db.commit()
    invalidate_data_cache("active_announcements", "unread_")


@app.post("/announcements/{announcement_id}/read")
def mark_announcement_read(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_roles),
):
    """Mark an announcement as read for the current user."""
    existing = (
        db.query(models.AnnouncementRead)
        .filter(
            models.AnnouncementRead.announcement_id == announcement_id,
            models.AnnouncementRead.user_id == current_user.id,
        )
        .first()
    )
    if not existing:
        db.add(models.AnnouncementRead(announcement_id=announcement_id, user_id=current_user.id))
        db.commit()
        invalidate_data_cache(f"unread_{current_user.id}")
    return {"message": "Marked as read"}


@app.post("/announcements/mark-all-read")
def mark_all_announcements_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_roles),
):
    """Mark all eligible announcements as read for the current user."""
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    query = (
        db.query(models.Announcement)
        .options(joinedload(models.Announcement.author))
        .filter(models.Announcement.is_active == True)
    )
    if role_str != "admin":
        query = query.filter(models.Announcement.target_role.in_(["all", role_str]))
    eligible = query.all()
    
    read_ids = {
        r.announcement_id
        for r in db.query(models.AnnouncementRead)
        .filter(models.AnnouncementRead.user_id == current_user.id)
        .all()
    }
    
    for a in eligible:
        if a.id not in read_ids:
            db.add(models.AnnouncementRead(announcement_id=a.id, user_id=current_user.id))
    db.commit()
    invalidate_data_cache(f"unread_{current_user.id}")
    return {"message": "All marked as read"}
