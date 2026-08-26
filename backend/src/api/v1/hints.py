"""
Hints API — /api/v1/hints endpoint.

Progressive hint system that gradually reveals solution approach.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel, Field

from backend.src.config import settings
from backend.src.api.middleware.auth import verify_firebase_token
from backend.src.api.limiter import limiter

logger = logging.getLogger("math_tutor.api.hints")

router = APIRouter(prefix="/api/v1", tags=["hints"])


class HintRequest(BaseModel):
    """Request for a hint."""
    problem: str = Field(..., min_length=1, max_length=3000)
    hint_level: int = Field(default=1, ge=1, le=4, description="1=gentle nudge, 2=formula hint, 3=approach, 4=full solution")
    session_id: str = Field(default="default")


class HintResponse(BaseModel):
    """A progressive hint."""
    hint: str
    hint_level: int
    total_hints: int = 4
    has_more: bool
    is_full_solution: bool = False


HINT_PROMPTS = {
    1: """You are a math tutor giving a VERY GENTLE HINT for this problem.
Do NOT reveal any formulas or methods. Just nudge the student in the right direction.
Say something like: "Think about what type of problem this is" or "What do you notice about the numbers?"
Keep it to 1-2 sentences max.

Problem: {problem}

Give hint level 1 (gentle nudge):""",

    2: """You are a math tutor giving a FORMULA HINT for this problem.
Tell the student which formula, theorem, or concept applies. Do NOT solve it.
Example: "You'll need the quadratic formula here: x = (-b ± √(b²-4ac)) / 2a"
Keep it to 2-3 sentences max.

Problem: {problem}

Give hint level 2 (formula/concept hint):""",

    3: """You are a math tutor giving an APPROACH HINT for this problem.
Show the student the first 1-2 steps, but stop before the final answer.
Show how to set up the problem, but let them finish it.

Problem: {problem}

Give hint level 3 (approach — first steps only, stop before the answer):""",

    4: """You are a math tutor giving the FULL SOLUTION for this problem.
Solve it step-by-step in clean whiteboard style.
Use LaTeX math mode ($...$ for inline, $$...$$ for block).

Problem: {problem}

Give the full step-by-step solution:""",
}


@router.post("/hints", response_model=HintResponse)
@limiter.limit("30/minute")
async def get_hint(request: Request, payload: HintRequest, uid: str = Depends(verify_firebase_token)):
    """Get a progressive hint for a math problem."""
    try:
        level = min(payload.hint_level, 4)
        is_full = level >= 4

        prompt = HINT_PROMPTS[level].format(problem=payload.problem)

        from backend.src.services.llm_service import MathAIEngine
        engine = MathAIEngine(session_id="hints")
        hint_text = engine.generate(user_input=prompt, system_prompt="")

        return HintResponse(
            hint=hint_text,
            hint_level=level,
            total_hints=4,
            has_more=level < 4,
            is_full_solution=is_full,
        )

    except Exception as e:
        logger.error(f"Hint error: {e}")
        raise HTTPException(status_code=500, detail="Something went wrong while generating a hint. Please try again.")
