"""
Practice API — /api/v1/practice endpoints.

Generates practice problems, daily practice sets, and manages mistake review.
"""

import logging
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel, Field

from backend.src.services.firebase_service import get_firestore_client
from backend.src.config import settings
from backend.src.api.middleware.auth import verify_firebase_token
from backend.src.api.limiter import limiter

logger = logging.getLogger("math_tutor.api.practice")

router = APIRouter(prefix="/api/v1/practice", tags=["practice"])


class PracticeGenerateRequest(BaseModel):
    """Request to generate practice problems."""
    topic: str = Field(default="algebra", description="Math topic")
    difficulty: str = Field(default="same", description="easier | same | harder")
    count: int = Field(default=3, ge=1, le=10)
    reference_problem: Optional[str] = Field(default=None, description="Generate similar to this problem")
    education_level: str = Field(default="high_school")


class PracticeProblem(BaseModel):
    """A generated practice problem."""
    problem: str
    topic: str
    difficulty: str
    hint: str = ""


class PracticeGenerateResponse(BaseModel):
    """Response with generated practice problems."""
    problems: List[PracticeProblem]
    topic: str
    difficulty: str


class MistakeRecord(BaseModel):
    """A recorded mistake for review."""
    id: str
    problem: str
    student_mistake: str
    correct_concept: str
    topic: str
    timestamp: str


class MistakeRecordRequest(BaseModel):
    """Request to record a mistake."""
    problem: str = Field(..., max_length=3000)
    student_mistake: str = Field(..., max_length=2000)
    correct_concept: str = Field(default="", max_length=1000)
    topic: str = Field(default="general")


PRACTICE_PROMPT = """Generate exactly {count} math practice problems.

Topic: {topic}
Difficulty: {difficulty}
Education level: {education_level}
{reference}

Return ONLY a valid JSON array. Each element must have:
- "problem": the problem statement (use LaTeX $...$ for math)
- "topic": "{topic}"
- "difficulty": "{difficulty}"
- "hint": a brief hint (1 sentence)

Example: [{{"problem": "Solve $2x + 5 = 15$", "topic": "algebra", "difficulty": "same", "hint": "Isolate x by subtracting 5 first."}}]

Generate {count} problems:"""

DAILY_PRACTICE_PROMPT = """Generate 3-5 math practice problems for a daily practice session.

The student's weak topics are: {weak_topics}
Recent activity topics: {recent_topics}
Education level: {education_level}

Focus on the weak topics. Mix difficulty levels.

Return ONLY a valid JSON array. Each element must have:
- "problem": the problem statement (use LaTeX $...$ for math)
- "topic": the math topic
- "difficulty": "easier" | "same" | "harder"
- "hint": a brief hint (1 sentence)

Generate the daily practice set:"""


# In-memory mistake store for when Firebase is unavailable
_MEMORY_MISTAKES: dict = {}


@router.post("/generate", response_model=PracticeGenerateResponse)
@limiter.limit("15/minute")
async def generate_practice(request: Request, payload: PracticeGenerateRequest, uid: str = Depends(verify_firebase_token)):
    """Generate practice problems for a given topic and difficulty."""
    try:
        reference = ""
        if payload.reference_problem:
            reference = f"Generate problems SIMILAR to this one (same concept, different numbers): {payload.reference_problem}"
        
        prompt = PRACTICE_PROMPT.format(
            count=payload.count,
            topic=payload.topic,
            difficulty=payload.difficulty,
            education_level=payload.education_level,
            reference=reference,
        )
        
        from backend.src.services.llm_service import MathAIEngine
        engine = MathAIEngine(session_id="practice")
        raw = engine.generate(user_input=prompt, system_prompt="")
        
        import json
        import re
        
        # Extract JSON array
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            problems_data = json.loads(match.group(0))
            problems = [PracticeProblem(**p) for p in problems_data[:payload.count]]
            return PracticeGenerateResponse(
                problems=problems,
                topic=payload.topic,
                difficulty=payload.difficulty,
            )
        
        # Fallback
        return PracticeGenerateResponse(
            problems=[PracticeProblem(
                problem=f"Practice problem for {payload.topic} could not be generated. Please try again.",
                topic=payload.topic,
                difficulty=payload.difficulty,
            )],
            topic=payload.topic,
            difficulty=payload.difficulty,
        )
        
    except Exception as e:
        logger.error(f"Practice generation error: {e}")
        raise HTTPException(status_code=500, detail="Couldn't generate practice problems. Please try again.")


@router.post("/daily", response_model=PracticeGenerateResponse)
@limiter.limit("10/minute")
async def daily_practice(request: Request, uid: str = Depends(verify_firebase_token)):
    """Generate a daily practice set based on user's weak topics and activity."""
    try:
        # Get user's weak topics from progress
        weak_topics = ["algebra"]
        recent_topics = ["algebra"]
        education_level = "high_school"
        
        db = get_firestore_client()
        if db:
            try:
                doc = db.collection("users").document(uid).collection("profile").document("stats").get()
                if doc.exists:
                    data = doc.to_dict()
                    weak_topics = data.get("weak_topics", ["algebra"]) or ["algebra"]
            except Exception:
                pass
        
        prompt = DAILY_PRACTICE_PROMPT.format(
            weak_topics=", ".join(weak_topics),
            recent_topics=", ".join(recent_topics),
            education_level=education_level,
        )
        
        from backend.src.services.llm_service import MathAIEngine
        engine = MathAIEngine(session_id="daily_practice")
        raw = engine.generate(user_input=prompt, system_prompt="")
        
        import json
        import re
        
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            problems_data = json.loads(match.group(0))
            problems = [PracticeProblem(**p) for p in problems_data[:5]]
            return PracticeGenerateResponse(
                problems=problems,
                topic="mixed",
                difficulty="mixed",
            )
        
        return PracticeGenerateResponse(
            problems=[],
            topic="mixed",
            difficulty="mixed",
        )
        
    except Exception as e:
        logger.error(f"Daily practice error: {e}")
        raise HTTPException(status_code=500, detail="Couldn't generate daily practice. Please try again.")


@router.post("/mistakes/record")
@limiter.limit("30/minute")
async def record_mistake(request: Request, payload: MistakeRecordRequest, uid: str = Depends(verify_firebase_token)):
    """Record a mistake for later review."""
    mistake_id = f"{uid}_{datetime.now(timezone.utc).timestamp()}"
    mistake = {
        "id": mistake_id,
        "problem": payload.problem,
        "student_mistake": payload.student_mistake,
        "correct_concept": payload.correct_concept,
        "topic": payload.topic,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    
    db = get_firestore_client()
    if db:
        try:
            db.collection("users").document(uid).collection("mistakes").document(mistake_id).set(mistake)
        except Exception as e:
            logger.error(f"Failed to save mistake to Firestore: {e}")
            # Fall through to memory store
            if uid not in _MEMORY_MISTAKES:
                _MEMORY_MISTAKES[uid] = []
            _MEMORY_MISTAKES[uid].append(mistake)
    else:
        if uid not in _MEMORY_MISTAKES:
            _MEMORY_MISTAKES[uid] = []
        _MEMORY_MISTAKES[uid].append(mistake)
        # Keep only last 50
        _MEMORY_MISTAKES[uid] = _MEMORY_MISTAKES[uid][-50:]
    
    return {"status": "ok", "mistake_id": mistake_id}


@router.get("/mistakes", response_model=List[MistakeRecord])
async def get_mistakes(uid: str = Depends(verify_firebase_token)):
    """Get user's recorded mistakes for review."""
    db = get_firestore_client()
    if db:
        try:
            docs = db.collection("users").document(uid).collection("mistakes").order_by("timestamp").limit(20).stream()
            mistakes = []
            for doc in docs:
                data = doc.to_dict()
                mistakes.append(MistakeRecord(**data))
            return mistakes
        except Exception as e:
            logger.error(f"Failed to get mistakes from Firestore: {e}")
    
    # Memory fallback
    return [MistakeRecord(**m) for m in _MEMORY_MISTAKES.get(uid, [])[-20:]]
