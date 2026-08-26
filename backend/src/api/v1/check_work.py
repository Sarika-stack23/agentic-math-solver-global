"""
Check My Work API — /api/v1/check-work endpoint.

Analyzes a student's solution attempt and identifies errors step-by-step.
"""

import logging
from typing import Optional, List

from fastapi import (
    APIRouter,
    HTTPException,
    UploadFile,
    File,
    Form,
    Depends,
    Request,
    Header,
)
from pydantic import BaseModel, Field

from backend.src.services.gemini_service import GeminiVisionService
from backend.src.config import settings
from backend.src.api.middleware.auth import verify_firebase_token
from backend.src.api.limiter import limiter
from backend.src.api.concurrency import validate_upload

logger = logging.getLogger("math_tutor.api.check_work")

router = APIRouter(prefix="/api/v1", tags=["check-work"])


class StepAnalysis(BaseModel):
    """Analysis of a single step in the student's work."""

    step_number: int
    student_step: str
    is_correct: bool
    feedback: str = ""


class CheckWorkRequest(BaseModel):
    """Request body for text-based check-my-work."""

    problem: str = Field(
        ..., min_length=1, max_length=3000, description="The original math problem"
    )
    student_solution: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="The student's attempted solution",
    )


class CheckWorkResponse(BaseModel):
    """Response from check-my-work analysis."""

    is_fully_correct: bool
    steps: List[StepAnalysis]
    first_error_step: Optional[int] = None
    first_error_explanation: str = ""
    how_to_fix: str = ""
    key_concept: str = ""
    correct_answer: str = ""


CHECK_WORK_PROMPT = """You are an expert math tutor reviewing a student's work. Your goal is to help them learn, NOT to simply replace their solution.

PROBLEM:
{problem}

STUDENT'S SOLUTION:
{student_solution}

Analyze the student's work step by step.

Return ONLY a valid JSON object with these keys:
- "is_fully_correct": boolean — true if every step is correct
- "steps": array of objects, each with:
  - "step_number": integer (1-based)
  - "student_step": string (what the student wrote)
  - "is_correct": boolean
  - "feedback": string (brief note, empty if correct)
- "first_error_step": integer or null (step number of first mistake)
- "first_error_explanation": string (why the first mistake is wrong)
- "how_to_fix": string (how to correct the mistake)
- "key_concept": string (what mathematical concept caused the mistake)
- "correct_answer": string (the correct final answer)

If the student's work is fully correct, set first_error_step to null and leave error fields empty.
Be encouraging but honest. Focus on the FIRST error — don't overwhelm with all errors at once.
"""


@router.post("/check-work", response_model=CheckWorkResponse)
@limiter.limit("15/minute")
async def check_work(
    request: Request,
    payload: CheckWorkRequest,
    uid: str = Depends(verify_firebase_token),
):
    """Analyze a student's solution and identify errors."""
    try:
        prompt = CHECK_WORK_PROMPT.format(
            problem=payload.problem, student_solution=payload.student_solution
        )

        from backend.src.services.llm_service import MathAIEngine

        engine = MathAIEngine(session_id="check_work")
        raw_response = engine.generate(user_input=prompt, system_prompt="")

        import json
        import re

        # Extract JSON from response
        match = re.search(r"\{.*\}", raw_response, re.DOTALL)
        if match:
            result = json.loads(match.group(0))
            return CheckWorkResponse(
                is_fully_correct=result.get("is_fully_correct", False),
                steps=[StepAnalysis(**s) for s in result.get("steps", [])],
                first_error_step=result.get("first_error_step"),
                first_error_explanation=result.get("first_error_explanation", ""),
                how_to_fix=result.get("how_to_fix", ""),
                key_concept=result.get("key_concept", ""),
                correct_answer=result.get("correct_answer", ""),
            )

        # Fallback if JSON parsing fails
        return CheckWorkResponse(
            is_fully_correct=False,
            steps=[],
            first_error_explanation="I couldn't fully analyze your work. Please try again.",
            correct_answer="",
        )

    except Exception as e:
        logger.error(f"Check work error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Something went wrong while checking your work. Please try again.",
        )


@router.post("/check-work/image", response_model=CheckWorkResponse)
@limiter.limit("10/minute")
async def check_work_image(
    request: Request,
    problem: str = Form(...),
    file: UploadFile = File(...),
    uid: str = Depends(verify_firebase_token),
):
    """Analyze a student's handwritten solution from an image."""
    try:
        image_bytes = await validate_upload(file, allow_pdf=False)

        # First, extract the student's work from the image
        if settings.use_gemini:
            vision = GeminiVisionService()
        else:
            from backend.src.services.gemini_service import GroqVisionService

            vision = GroqVisionService()

        extracted = vision.extract_math_from_image(
            image_bytes, mime_type=file.content_type
        )

        if extracted.startswith("REJECTED:"):
            raise HTTPException(
                status_code=400,
                detail="The uploaded image doesn't appear to contain mathematical work.",
            )

        # Then analyze it
        prompt = CHECK_WORK_PROMPT.format(
            problem=problem,
            student_solution=f"(Extracted from handwritten image):\n{extracted}",
        )

        from backend.src.services.llm_service import MathAIEngine

        engine = MathAIEngine(session_id="check_work_image")
        raw_response = engine.generate(user_input=prompt, system_prompt="")

        import json
        import re

        match = re.search(r"\{.*\}", raw_response, re.DOTALL)
        if match:
            result = json.loads(match.group(0))
            return CheckWorkResponse(
                is_fully_correct=result.get("is_fully_correct", False),
                steps=[StepAnalysis(**s) for s in result.get("steps", [])],
                first_error_step=result.get("first_error_step"),
                first_error_explanation=result.get("first_error_explanation", ""),
                how_to_fix=result.get("how_to_fix", ""),
                key_concept=result.get("key_concept", ""),
                correct_answer=result.get("correct_answer", ""),
            )

        return CheckWorkResponse(
            is_fully_correct=False,
            steps=[],
            first_error_explanation="I couldn't fully analyze your handwritten work. Try uploading a clearer image.",
            correct_answer="",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Check work image error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Something went wrong while checking your work. Please try again.",
        )
