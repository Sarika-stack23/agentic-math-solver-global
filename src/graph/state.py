"""
LangGraph State Definition
"""

from typing import TypedDict, Annotated, List, Optional

class MathAgentState(TypedDict):
    """Represents the state of the math orchestration pipeline."""
    
    # Input
    user_query: str
    uid: str
    session_id: str
    
    # Mode: solve | hint | teach | check_work
    mode: str
    
    # Planner output
    question_type: str
    class_level: int
    education_level: str
    topic: str
    
    # Retrievals (Running in parallel)
    rag_context: str
    history: str
    weak_topics: List[str]
    
    # Solver Output
    raw_solution: str
    
    # Verifier Feedback
    is_correct: bool
    verification_feedback: str
    verification_status: str  # "verified" | "unverified" | "failed"
    retries: int
    
    # Formatter Output
    final_answer: str
