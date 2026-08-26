"""
FastAPI Application — AI Math Tutor Backend.

This is the main entry point for the backend API server.
Run with: uvicorn backend.src.main:app --host 0.0.0.0 --port 8080
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.src.config import settings
from backend.src.services.firebase_service import init_firebase
from backend.src.api.v1 import chat
from backend.src.api.v1 import progress
from backend.src.api.v1 import documents
from backend.src.api.v1 import symbolic

# ── Logging Setup ──────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("math_tutor.app")


# ── Application Lifespan ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events for the FastAPI application."""
    logger.info("🚀 Starting AI Math Tutor API...")
    logger.info(f"   Environment: {settings.environment}")
    logger.info(f"   Groq Primary Model: {settings.groq_primary_model}")
    logger.info(f"   Groq Fallbacks: {settings.groq_model_fallbacks}")
    logger.info(f"   Vector DB: {settings.vector_db_type}")

    # Initialize Firebase Admin SDK
    init_firebase()

    # Pre-build knowledge base on startup (optional, lazy by default)
    # Uncomment the following to eagerly build on startup:
    # from backend.src.services.vector_service import build_pipeline
    # build_pipeline()

    yield  # Application is running

    logger.info("🛑 Shutting down AI Math Tutor API.")


# ── FastAPI App ────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Math Tutor API",
    description=(
        "AI-powered math tutoring API for students worldwide. "
        "Uses multi-agent orchestration, verified mathematical computation, "
        "and step-by-step explanations to help students learn mathematics."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

from backend.src.api.limiter import limiter, _rate_limit_exceeded_handler, RateLimitExceeded
from fastapi.responses import JSONResponse

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Sanitize all unhandled exceptions to prevent exposing stack traces or secrets."""
    logger.error(f"Unhandled server error: {str(exc.__class__.__name__)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred."}
    )


# ── Security Headers Middleware ────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ── CORS Middleware ────────────────────────────────────────────────────
if settings.environment == "production":
    allowed_origins = ["https://advanced-math-ai.vercel.app"]
else:
    allowed_origins = [
        "http://localhost:3000",      # React dev server
        "http://localhost:5173",      # Vite dev server
        "http://localhost:8501",      # Streamlit
        "https://advanced-math-ai.vercel.app", # Vercel production
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────────────────
app.include_router(chat.router)
app.include_router(progress.router)
app.include_router(documents.router)
app.include_router(symbolic.router)

from backend.src.api.v1 import quiz
app.include_router(quiz.router, prefix="/api/v1/quiz", tags=["Quiz"])

# ── New Differentiation Feature Routes ─────────────────────────────────
from backend.src.api.v1 import check_work, hints, teach, practice, share
app.include_router(check_work.router)
app.include_router(hints.router)
app.include_router(teach.router)
app.include_router(practice.router)
app.include_router(share.router, prefix="/api/v1", tags=["Share"])

@app.get("/health")
async def health_check():
    """Health check endpoint — returns API status and knowledge base info.

    Returns HTTP 200 with:
    - status: "ok"
    - environment: current environment
    - kb_docs: number of indexed knowledge base documents (0 if not yet built)
    """
    kb_docs = 0
    try:
        from backend.src.services.vector_service import _PIPELINE_CACHE
        store = _PIPELINE_CACHE.get("store")
        if store:
            kb_docs = store.get_document_count()
    except Exception:
        pass

    return {
        "status": "ok",
        "environment": settings.environment,
        "version": "2.0.0",
        "kb_docs": kb_docs,
        "llm_model": settings.groq_primary_model,
        "vector_db": settings.vector_db_type,
    }


@app.get("/")
async def root():
    """Root endpoint — redirect info."""
    return {
        "message": "AI Math Tutor API",
        "docs": "/docs",
        "health": "/health",
    }
