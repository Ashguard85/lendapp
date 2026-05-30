from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.orm import Session
from app.database import engine, Base, get_db
from app.models.models import User
from app.auth import verify_password
from app.routers import users, groups, items, bookings, upload, admin, ai

Base.metadata.create_all(bind=engine)

security = HTTPBasic()


def verify_docs(credentials: HTTPBasicCredentials = Depends(security), db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == credentials.username,
        User.is_admin == True,
        User.is_active == True,
    ).first()
    if not user or not verify_password(credentials.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Zugriff verweigert – nur Admins",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials


app = FastAPI(
    title="LendApp API",
    description="Gegenstände ausleihen mit Freunden & Familie",
    version="1.0.0",
    root_path="/api",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

import os as _os
_APP_URL = _os.getenv("APP_URL", "https://lendapp.haasenheim.com")
_ALLOWED_ORIGINS = [_APP_URL, "http://localhost:3000", "http://localhost:3100"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-User-Id"],
)

app.include_router(users.router,    prefix="/users",    tags=["Users"])
app.include_router(groups.router,   prefix="/groups",   tags=["Groups"])
app.include_router(items.router,    prefix="/items",    tags=["Items"])
app.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
app.include_router(upload.router,   prefix="/upload",   tags=["Upload"])
app.include_router(admin.router,    prefix="/admin",    tags=["Admin"])
app.include_router(ai.router,       prefix="/ai",       tags=["AI"])


@app.get("/")
def root():
    return {"message": "LendApp API is running 🚀"}


@app.get("/openapi.json", include_in_schema=False)
def openapi(credentials: HTTPBasicCredentials = Depends(verify_docs)):
    return get_openapi(title=app.title, version=app.version, routes=app.routes)


@app.get("/docs", include_in_schema=False)
def docs(credentials: HTTPBasicCredentials = Depends(verify_docs)):
    return get_swagger_ui_html(openapi_url="/api/openapi.json", title="LendApp API Docs")
