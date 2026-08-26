"""Share solution endpoint — generates shareable solution links.

Thread-safe, bounded in-memory store with LRU eviction.
For production, replace with Firestore persistence.
"""
import uuid
import logging
import threading
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field

from backend.src.api.limiter import limiter

logger = logging.getLogger("math_assistant.share")
router = APIRouter()

# ── Thread-safe bounded LRU store ──────────────────────────────────────
MAX_SHARED_SOLUTIONS = 10_000  # Cap to prevent unbounded memory growth


class _BoundedShareStore:
    """Thread-safe, LRU-evicting dictionary for shared solutions.
    
    When the store exceeds MAX_SHARED_SOLUTIONS, the oldest entries
    are evicted automatically. All operations are protected by a lock.
    """
    def __init__(self, maxsize: int = MAX_SHARED_SOLUTIONS):
        self._store: OrderedDict[str, dict] = OrderedDict()
        self._lock = threading.Lock()
        self._maxsize = maxsize

    def put(self, key: str, value: dict) -> None:
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
            self._store[key] = value
            while len(self._store) > self._maxsize:
                evicted_key, _ = self._store.popitem(last=False)
                logger.debug(f"Evicted shared solution: {evicted_key}")

    def get(self, key: str) -> Optional[dict]:
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)  # Mark as recently used
                return self._store[key]
            return None

    def __len__(self) -> int:
        with self._lock:
            return len(self._store)


_shared_solutions = _BoundedShareStore()


# ── Models ─────────────────────────────────────────────────────────────

class ShareRequest(BaseModel):
    """Request body for sharing a solution."""
    problem: str = Field(..., min_length=1, max_length=5000, description="The math problem")
    solution: str = Field(..., min_length=1, max_length=20000, description="The solution content (markdown)")
    topic: Optional[str] = Field(default=None, description="Math topic category")
    verification_status: Optional[str] = Field(default=None, description="Whether the solution was verified")


class ShareResponse(BaseModel):
    """Response with the share link ID."""
    share_id: str
    share_url: str
    message: str


class SharedSolutionResponse(BaseModel):
    """Public shared solution view — no private user data."""
    share_id: str
    problem: str
    solution: str
    topic: Optional[str] = None
    verification_status: Optional[str] = None
    created_at: str


# ── Endpoints ──────────────────────────────────────────────────────────

@router.post("/share", response_model=ShareResponse)
@limiter.limit("10/minute")
async def share_solution(request: Request, payload: ShareRequest):
    """Generate a shareable link for a solution."""
    share_id = str(uuid.uuid4())[:8]

    _shared_solutions.put(share_id, {
        "problem": payload.problem,
        "solution": payload.solution,
        "topic": payload.topic,
        "verification_status": payload.verification_status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    logger.info(f"Solution shared with ID: {share_id} (store size: {len(_shared_solutions)})")

    return ShareResponse(
        share_id=share_id,
        share_url=f"/shared/{share_id}",
        message="Solution shared successfully!",
    )


@router.get("/shared/{share_id}", response_model=SharedSolutionResponse)
async def get_shared_solution(share_id: str):
    """Retrieve a shared solution by ID — public, no auth required."""
    solution = _shared_solutions.get(share_id)
    if not solution:
        raise HTTPException(status_code=404, detail="Shared solution not found or has expired.")

    return SharedSolutionResponse(
        share_id=share_id,
        problem=solution["problem"],
        solution=solution["solution"],
        topic=solution.get("topic"),
        verification_status=solution.get("verification_status"),
        created_at=solution["created_at"],
    )
