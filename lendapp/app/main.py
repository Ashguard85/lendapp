from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://192.168.1.127:3100"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
from app.database import engine, Base
from app.routers import users, groups, items, bookings

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LendApp API",
    description="Gegenstände ausleihen mit Freunden & Familie",
    version="1.0.0",
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

@app.get("/")
def root():
    return {"message": "LendApp API is running 🚀"}
