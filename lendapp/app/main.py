from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import users, groups, items, bookings, upload, admin

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LendApp API",
    description="Gegenstände ausleihen mit Freunden & Familie",
    version="1.0.0",
    root_path="/api",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router,    prefix="/users",    tags=["Users"])
app.include_router(groups.router,   prefix="/groups",   tags=["Groups"])
app.include_router(items.router,    prefix="/items",    tags=["Items"])
app.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
app.include_router(upload.router,   prefix="/upload",   tags=["Upload"])
app.include_router(admin.router,    prefix="/admin",    tags=["Admin"])

@app.get("/")
def root():
    return {"message": "LendApp API is running 🚀"}
