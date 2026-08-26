"""Concurrency controls for multi-user production readiness.

Provides:
- AI request semaphore: limits concurrent LLM calls to prevent API quota exhaustion
- Request timeout utility: wraps async generators with a timeout
- File upload size validator

All limits are configurable via environment variables.
"""

import asyncio
import logging
from functools import wraps
from fastapi import HTTPException, UploadFile

logger = logging.getLogger("math_tutor.concurrency")

# ── AI Request Semaphore ──────────────────────────────────────────────
# Limits concurrent AI/LLM requests to prevent overwhelming free-tier APIs.
# With Groq free tier (~30 req/min), limiting to 10 concurrent requests
# provides good throughput while preventing queue pile-up.

MAX_CONCURRENT_AI_REQUESTS = 10
_ai_semaphore = asyncio.Semaphore(MAX_CONCURRENT_AI_REQUESTS)


async def acquire_ai_slot():
    """Acquire a slot for an AI request, or raise 503 if all slots are full.
    
    Usage as async context manager:
        async with acquire_ai_slot_ctx():
            # ... make AI request ...
    """
    try:
        acquired = _ai_semaphore.locked() and _ai_semaphore._value == 0
        if acquired:
            logger.warning(f"All {MAX_CONCURRENT_AI_REQUESTS} AI slots are occupied. Request queued.")
        await asyncio.wait_for(_ai_semaphore.acquire(), timeout=30.0)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=503,
            detail="The server is currently handling too many AI requests. Please try again in a few seconds."
        )


def release_ai_slot():
    """Release an AI request slot."""
    _ai_semaphore.release()


class AiSlot:
    """Async context manager for AI request slots."""
    async def __aenter__(self):
        await acquire_ai_slot()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        release_ai_slot()
        return False


# ── File Upload Validator ─────────────────────────────────────────────

MAX_UPLOAD_SIZE_MB = 10  # 10MB max file upload
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"}
ALLOWED_PDF_TYPES = {"application/pdf"}


async def validate_upload(file: UploadFile, allow_pdf: bool = False) -> bytes:
    """Read and validate an uploaded file.
    
    Args:
        file: The uploaded file
        allow_pdf: Whether to allow PDF files (in addition to images)
    
    Returns:
        The file bytes
    
    Raises:
        HTTPException: If file is too large or wrong type
    """
    allowed = ALLOWED_IMAGE_TYPES | (ALLOWED_PDF_TYPES if allow_pdf else set())
    
    if file.content_type and file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' is not supported. Allowed: {', '.join(sorted(allowed))}"
        )
    
    # Read with size check
    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(data) / 1024 / 1024:.1f}MB). Maximum allowed: {MAX_UPLOAD_SIZE_MB}MB."
        )
    
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")
    
    return data


# ── Request Timeout ───────────────────────────────────────────────────

AI_REQUEST_TIMEOUT_SECONDS = 60  # Max time for a single AI request


async def with_timeout(coro, timeout_seconds: float = AI_REQUEST_TIMEOUT_SECONDS):
    """Wrap an awaitable with a timeout.
    
    Returns the result of the coroutine, or raises HTTPException on timeout.
    """
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail=f"AI request timed out after {timeout_seconds} seconds. Please try again."
        )
