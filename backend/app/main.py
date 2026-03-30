from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.health import api_router as health_api_router
from app.api.v1.health import public_router as health_public_router
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(
    title="AI Stock Research Platform API",
    version="0.1.0",
)

if settings.cors_allow_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(health_public_router)
app.include_router(health_api_router)
