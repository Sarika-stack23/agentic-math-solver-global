"""
Teach Me API — /api/v1/teach endpoint.

Socratic teaching mode that guides students through problems without giving answers.
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field

from backend.src.services.gemini_service import GeminiService
from backend.src.config import settings
from backend.src.api.middleware.auth import verify_firebase_token
from backend.src.api.limiter import limiter

logger = logging.getLogger("math_tutor.api.teach")

router = APIRouter(prefix="/api/v1", tags=["teach"])


class TeachRequest(BaseModel):
    """Request for guided teaching."""
    problem: str = Field(..., min_length=1, max_length=3000)
    student_response: Optional[str] = Field(default=None, max_length=2000, description="Student's answer to the last question")
    conversation_history: List[str] = Field(default=[], description="Previous Q&A exchanges in this teaching session")
    session_id: str = Field(default="default")


class TeachResponse(BaseModel):
    """A teaching interaction."""
    tutor_message: str
    is_question: bool = True
    student_was_correct: Optional[bool] = None
    is_complete: bool = False


TEACH_START_PROMPT = """You are a Socratic math tutor. The student wants to learn how to solve this problem WITHOUT you giving the answer.

Your job: Ask ONE guiding question that helps the student figure out the next step themselves.

Rules:
- Do NOT solve the problem
- Do NOT give the answer
- Ask ONE clear question
- Make the question specific and actionable
- Use LaTeX math mode ($...$) for any math expressions
- Examples of good questions:
  "What formula applies to equations of this form?"
  "What should we do first to isolate $x$?"
  "What happens when we subtract 5 from both sides?"

Problem: {problem}

Ask your first guiding question:"""

TEACH_EVALUATE_PROMPT = """You are a Socratic math tutor helping a student solve this problem step by step.

Problem: {problem}

Previous conversation:
{history}

The student's latest response: "{student_response}"

Evaluate the student's response:
1. Is it correct or on the right track? 
2. If correct: Acknowledge briefly and ask the NEXT guiding question to continue solving.
3. If incorrect: Gently point out the issue and rephrase the question to help them.
4. If the problem is now fully solved: Say so and congratulate them.

Rules:
- Do NOT solve remaining steps for them
- Keep responses short (2-3 sentences)
- Use LaTeX math mode ($...$) for any math expressions
- Be encouraging

Return ONLY a valid JSON object:
{{"tutor_message": "your response", "is_question": true/false, "student_was_correct": true/false, "is_complete": true/false}}
"""


@router.post("/teach", response_model=TeachResponse)
@limiter.limit("30/minute")
async def teach_me(request: Request, payload: TeachRequest, uid: str = Depends(verify_firebase_token)):
    """Guided Socratic teaching interaction."""
    try:
        gemini = GeminiService()
        
        if not payload.student_response and not payload.conversation_history:
            # First interaction — ask the opening question
            prompt = TEACH_START_PROMPT.format(problem=payload.problem)
            response_text = gemini.query(prompt, context="")
            
            return TeachResponse(
                tutor_message=response_text.strip(),
                is_question=True,
                student_was_correct=None,
                is_complete=False,
            )
        
        # Continuing conversation — evaluate student's response
        history = "\n".join(payload.conversation_history[-10:])  # Keep last 10 exchanges
        
        prompt = TEACH_EVALUATE_PROMPT.format(
            problem=payload.problem,
            history=history,
            student_response=payload.student_response or ""
        )
        
        raw = gemini.query(prompt, context="")
        
        import json
        import re
        
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            result = json.loads(match.group(0))
            return TeachResponse(
                tutor_message=result.get("tutor_message", "Let me think about that..."),
                is_question=result.get("is_question", True),
                student_was_correct=result.get("student_was_correct"),
                is_complete=result.get("is_complete", False),
            )
        
        # Fallback
        return TeachResponse(
            tutor_message=raw.strip(),
            is_question=True,
            is_complete=False,
        )
        
    except Exception as e:
        logger.error(f"Teach error: {e}")
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")
