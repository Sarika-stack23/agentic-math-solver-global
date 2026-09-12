"""
LLM Service — Centralized orchestrator.

Phase 2/3:
- Primary: Groq 120B
- Fallback 1: Groq 20B
- Fallback 2: Gemini server-side
"""

import re
import time
import logging
import threading
from typing import Dict, Any, Optional, Tuple, AsyncGenerator

from backend.src.config import settings, SYSTEM_TEMPLATE
from backend.src.math.symbolic_engine import SymbolicMathEngine
from backend.src.services.memory_service import MongoDBChatMemory
from backend.src.services.gemini_service import GeminiService

try:
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
except ImportError:
    from langchain.schema import HumanMessage, AIMessage, SystemMessage

logger = logging.getLogger("math_assistant.llm")

_LLM_CACHE = {}
_LLM_CACHE_LOCK = threading.Lock()

ACTION_PROMPTS = {
    "solve": (
        "\n\n════════════════════════════════════════"
        "\n🚨 ACTION OVERRIDE — SOLVE (COMPLETE TEACHER EXPLANATION)"
        "\n════════════════════════════════════════"
        "\nThe student wants you to teach them how to solve this problem completely."
        "\nProvide:"
        "\n1. What is being asked"
        "\n2. Relevant formula or concept"
        "\n3. Step-by-step reasoning with calculations"
        "\n4. Final answer"
        "\nUse clean mathematical structure with LaTeX."
        "\nDo NOT add conversational filler, greetings, or sign-offs."
        "\nDo NOT say 'Here is...', 'Let me...', 'Good luck!', 'Happy calculating!'."
    ),
    "hint": (
        "\n\n════════════════════════════════════════"
        "\n🚨 ACTION OVERRIDE — HINT ONLY"
        "\n════════════════════════════════════════"
        "\nThe student clicked HINT. They want a small clue to continue on their own."
        "\n"
        "\nYou MUST give ONLY a hint — a nudge, a direction, a relevant formula, or a guiding question."
        "\n"
        "\nA hint is 1–3 sentences maximum."
        "\n"
        "\nYou MUST NOT:"
        "\n- Solve the problem"
        "\n- Show complete derivations"
        "\n- Show full step-by-step calculations"
        "\n- Write 'Step 1:', 'Step 2:', etc."
        "\n- Write 'Final Answer:' or give the final numerical answer"
        "\n- Perform the actual calculations"
        "\n- Write more than 3 sentences"
        "\n"
        "\nGood hint examples:"
        "\n- 'Start by identifying a, b, and c from the standard quadratic form.'"
        "\n- 'The volume of a tetrahedron can be found using the scalar triple product.'"
        "\n- 'Which formula relates the edges of a tetrahedron to its volume?'"
        "\n"
        "\nAfter giving the hint, STOP. Do not continue."
    ),
    "steps": (
        "\n\n════════════════════════════════════════"
        "\n🚨 ACTION OVERRIDE — STEPS (SHORT ROADMAP ONLY)"
        "\n════════════════════════════════════════"
        "\nThe student clicked STEPS. They want a short roadmap of what to do, NOT a full solution."
        "\n"
        "\nProvide a numbered list of steps, each step being ONE short line."
        "\nA formula may appear when it helps identify what to do."
        "\n"
        "\nFormat:"
        "\nStep 1: [one short line]"
        "\nStep 2: [one short line]"
        "\nStep 3: [one short line]"
        "\nStep 4: [one short line]"
        "\n"
        "\nYou MUST NOT:"
        "\n- Perform every calculation"
        "\n- Show the complete worked-out solution"
        "\n- Give the final numerical answer"
        "\n- Write 'Final Answer:'"
        "\n- Write long paragraphs for each step"
        "\n- Turn this into a complete solution"
        "\n"
        "\nThe student should still have work left to do after reading the steps."
        "\nKeep it to 4–6 short steps. STOP after listing the steps."
    ),
    "answer": (
        "\n\n════════════════════════════════════════"
        "\n🚨 ACTION OVERRIDE — ANSWER (FINAL ANSWER ONLY)"
        "\n════════════════════════════════════════"
        "\nThe student clicked ANSWER. They want the direct final answer."
        "\nReturn ONLY the direct final answer."
        "\nIf a brief calculation is needed for clarity, keep it very short (1-2 lines)."
        "\nDo NOT reproduce the entire derivation."
        "\nDo NOT write 'Step 1:', 'Step 2:', etc."
        "\nDo NOT add conversational filler."
        "\nEnd with the final boxed answer."
    ),
    "teach": (
        "\n\n════════════════════════════════════════"
        "\n🚨 ACTION OVERRIDE — TEACH ME (CONCEPT EXPLANATION)"
        "\n════════════════════════════════════════"
        "\nThe student clicked TEACH ME. They want to understand the underlying mathematics."
        "\n"
        "\nYou MUST format your response EXACTLY with these three headings:"
        "\n### Concept"
        "\nExplain the concept and its intuition, and why the method works."
        "\n### Formula"
        "\nState the relevant formula(s) and what each variable means."
        "\n### Example"
        "\nProvide a small illustrative example."
        "\n"
        "\nCRITICAL CONSTRAINTS:"
        "\n1. Do NOT solve the user's exact problem completely."
        "\n2. Do NOT use 'Step 1', 'Step 2', etc."
        "\n3. Do NOT add conversational filler."
        "\n4. Make it feel like a teacher explaining at a whiteboard."
    ),
    "check": (
        "\n\n════════════════════════════════════════"
        "\n🚨 ACTION OVERRIDE — CHECK MY WORK"
        "\n════════════════════════════════════════"
        "\nThe student clicked CHECK MY WORK."
        "\nThey are asking: 'Is my work correct?'"
        "\n"
        "\nInspect their work carefully."
        "\n"
        "\nIf correct: confirm each step is correct and explain why."
        "\nIf incorrect: identify the first mistake, explain what went wrong, and show the corrected step."
        "\n"
        "\nDo NOT automatically provide the entire solution from scratch."
        "\nOnly give the complete solution if the student's work is missing entirely."
        "\nDo NOT add conversational filler."
    ),
    "another": (
        "\n\n════════════════════════════════════════"
        "\n🚨 ACTION OVERRIDE — ANOTHER METHOD"
        "\n════════════════════════════════════════"
        "\nThe student clicked ANOTHER METHOD."
        "\nProvide a genuinely DIFFERENT mathematical method to solve this problem."
        "\nDo NOT simply rewrite the same solution with different wording."
        "\nExplain why the alternative method works."
        "\nDo NOT add conversational filler."
    ),
    "similar": (
        "\n\n════════════════════════════════════════"
        "\n🚨 ACTION OVERRIDE — SIMILAR PROBLEM"
        "\n════════════════════════════════════════"
        "\nThe student clicked SIMILAR PROBLEM."
        "\nGenerate a NEW problem that tests the same mathematical concept."
        "\nDo NOT solve the new problem."
        "\nDo NOT repeat the original question."
        "\nJust state the new problem clearly, then say 'Your turn.'"
        "\nSTOP after stating the problem."
    ),
    "practice": (
        "\n\n════════════════════════════════════════"
        "\n🚨 ACTION OVERRIDE — PRACTICE"
        "\n════════════════════════════════════════"
        "\nThe student clicked PRACTICE."
        "\nGenerate a NEW practice question testing the same concept."
        "\nDo NOT provide the answer."
        "\nDo NOT solve the problem."
        "\nLet the student attempt it first."
        "\nJust state the problem, then STOP."
    ),
    "ask_ai": (
        "\n\n════════════════════════════════════════"
        "\n🚨 ACTION OVERRIDE — ASK AI (OPEN CONVERSATION)"
        "\n════════════════════════════════════════"
        "\nThe student clicked ASK AI."
        "\nAnswer the student's specific question directly."
        "\nUse the current problem as context."
        "\nDo NOT automatically produce the entire solution unless the student asks for it."
        "\nDo NOT add conversational filler."
    ),
}



class GroqLLMWrapper:
    """Wrapper around native Groq client."""

    def __init__(self, api_key: str, model_name: str):
        from groq import Groq, AsyncGroq

        self.client = Groq(api_key=api_key, max_retries=0)
        self.async_client = AsyncGroq(api_key=api_key, max_retries=0)
        self.model_name = model_name

    def invoke(self, messages):
        from langchain_core.messages import AIMessage

        groq_msgs = []

        if isinstance(messages, str):
            groq_msgs.append({"role": "user", "content": messages})
        elif isinstance(messages, list):
            for m in messages:
                if isinstance(m, str):
                    groq_msgs.append({"role": "user", "content": m})
                elif isinstance(m, dict):
                    groq_msgs.append(m)
                else:
                    role = (
                        "user"
                        if getattr(m, "type", "user") == "human"
                        else getattr(m, "type", "user")
                    )
                    content = (
                        m.content if isinstance(m.content, str) else str(m.content)
                    )
                    groq_msgs.append({"role": role, "content": content})

        chat_completion = self.client.chat.completions.create(
            messages=groq_msgs,
            model=self.model_name,
            temperature=0.1,
            max_tokens=2048,
        )

        return AIMessage(content=chat_completion.choices[0].message.content)

    async def astream(self, messages):
        from langchain_core.messages import AIMessageChunk

        groq_msgs = []

        if isinstance(messages, str):
            groq_msgs.append({"role": "user", "content": messages})
        elif isinstance(messages, list):
            for m in messages:
                if isinstance(m, str):
                    groq_msgs.append({"role": "user", "content": m})
                elif isinstance(m, dict):
                    groq_msgs.append(m)
                else:
                    role = (
                        "user"
                        if getattr(m, "type", "user") == "human"
                        else getattr(m, "type", "user")
                    )
                    content = (
                        m.content if isinstance(m.content, str) else str(m.content)
                    )
                    groq_msgs.append({"role": role, "content": content})

        stream = await self.async_client.chat.completions.create(
            messages=groq_msgs,
            model=self.model_name,
            temperature=0.1,
            max_tokens=2048,
            stream=True,
        )

        async for chunk in stream:
            content = chunk.choices[0].delta.content
            if content is not None:
                yield AIMessageChunk(content=content)


def _get_llm(model=None):
    """Get or create a cached Groq LLM instance."""
    key = model or settings.groq_primary_model
    if key in _LLM_CACHE:
        return _LLM_CACHE[key]
    with _LLM_CACHE_LOCK:
        if key not in _LLM_CACHE:
            api_key = settings.groq_api_key
            if not api_key:
                raise ValueError("GROQ_API_KEY not set.")
            logger.info(f"Initializing Native Groq LLM: {key}")
            _LLM_CACHE[key] = GroqLLMWrapper(api_key=api_key, model_name=key)
    return _LLM_CACHE[key]


class MathAIEngine:
    """Orchestrates RAG retrieval, symbolic math, and LLM calls for math tutoring."""

    # Class-level action prompts — accessible as self.ACTION_PROMPTS or MathAIEngine.ACTION_PROMPTS
    ACTION_PROMPTS = ACTION_PROMPTS

    def __init__(self, vector_store=None, session_id: str = "default"):
        self.vector_store = vector_store
        self.memory = MongoDBChatMemory(session_id=session_id)
        self.symbolic = SymbolicMathEngine()
        self.session_id = session_id


    def _retrieve_context(self, query: str) -> Tuple[list, str]:
        """Retrieve relevant documents from the vector store."""
        if not self.vector_store or not self.vector_store.is_ready():
            return (
                [],
                "No knowledge base available. Using general mathematical knowledge.",
            )
        try:
            docs = self.vector_store.similarity_search(
                query, k=3, filter_uid=self.memory.uid
            )
        except TypeError:
            docs = self.vector_store.similarity_search(query, k=3)

        if not docs:
            return [], "No specific context found."
        parts = [
            f"[Reference {i+1} - {d.metadata.get('topic','math')}]\n{d.page_content}"
            for i, d in enumerate(docs)
        ]
        return docs, "\n\n---\n\n".join(parts)

    def _symbolic_hint(self, query: str) -> Optional[str]:
        """Try to get a symbolic verification hint for the query."""
        ql = query.lower()
        for pattern, action in [
            (
                r"(?:differentiate|derivative of|d/dx)\s+(.+?)(?:\s+with respect|\s*$)",
                "diff",
            ),
            (r"(?:integrate|integral of)\s+(.+?)(?:\s+with respect|\s+dx|\s*$)", "int"),
            (r"solve\s+(.+?)\s+(?:for|=)", "solve"),
        ]:
            m = re.search(pattern, ql)
            if m:
                expr = m.group(1).strip()
                result = (
                    self.symbolic.differentiate(expr)
                    if action == "diff"
                    else (
                        self.symbolic.integrate(expr)
                        if action == "int"
                        else self.symbolic.solve_equation(expr)
                    )
                )
                if result:
                    return f"[Symbolic verification: {result}]"
        return None

    def _build_messages(
        self,
        user_input: str,
        context: str,
        chat_history: list,
        system_prompt: str = None,
        action: str = None,
        student_work: str = None,
    ) -> list:
        from backend.src.services.prompt_service import PromptService
        prompt_service = PromptService()

        if system_prompt is None:
            base_prompt = prompt_service.get_system_prompt()
            system_prompt = base_prompt.replace("{context}", context)
            if action and action in self.ACTION_PROMPTS:
                action_prompt = self.ACTION_PROMPTS[action]
                system_prompt += "\n" + action_prompt
        else:
            # If a custom prompt is provided, we assume it's fully formatted
            system_prompt = system_prompt.replace("{context}", context)

        import logging
        logger = logging.getLogger("math_assistant.llm")
        logger.info(f"FINAL SYSTEM PROMPT FOR ACTION {action}: {system_prompt}")

        llm_messages = [SystemMessage(content=system_prompt)]
        for msg in chat_history:
            llm_messages.append(msg)

        user_content = user_input
        if student_work:
            user_content = f"Original Problem:\n{user_input}\n\nStudent's Attempt:\n{student_work}"

        llm_messages.append(HumanMessage(content=user_content))
        return llm_messages

    def generate(
        self,
        user_input: str,
        context: str = "",
        chat_history: list = None,
        system_prompt: str = None,
        action: str = None,
        student_work: str = None,
    ) -> str:
        """Centralized generation using Groq Primary -> Groq Fallback -> Gemini."""
        if chat_history is None:
            chat_history = []

        llm_messages = self._build_messages(
            user_input, context, chat_history, system_prompt, action, student_work
        )
        # Gemini is no longer primary. Fallbacks are configured at the end of this method.

        models_to_try = [settings.groq_primary_model] + settings.groq_model_fallbacks

        last_error = None
        for model_name in models_to_try:
            try:
                llm = _get_llm(model_name)
            except ValueError as e:
                logger.warning(f"Skipping {model_name} due to missing config: {e}")
                last_error = e
                continue

            for attempt in range(2):
                try:
                    raw = llm.invoke(llm_messages).content
                    if raw:
                        return raw
                except Exception as e:
                    last_error = e
                    err = str(e).lower()
                    logger.warning(f"Groq {model_name} attempt {attempt+1} failed: {e}")

                    if (
                        "429" in err
                        or "rate limit" in err
                        or "401" in err
                        or "invalid_api_key" in err
                    ):
                        # For rate limits or auth errors, do not retry on the same model. Immediately fallback.
                        break
                    elif (
                        "timeout" in err or "503" in err or "502" in err or "500" in err
                    ):
                        if attempt == 0:
                            time.sleep(1)  # exactly 1 second bounded retry
                            continue
                        else:
                            break
                    else:
                        break  # For other unknown errors, break attempt loop, try next model

        # We do NOT fallback to Gemini for general text tasks, per architecture rules.
        # If all Groq models fail, raise the last error.
        if last_error:
            logger.error(f"All LLM models failed. Last error: {last_error}")
            raise Exception(f"AI Provider temporarily unavailable: {last_error}")

        raise Exception("All LLM models failed for unknown reasons.")

    async def astream(
        self,
        user_input: str,
        context: str = "",
        chat_history: list = None,
        system_prompt: str = None,
        action: str = None,
        student_work: str = None,
    ) -> AsyncGenerator[str, None]:
        """Centralized streaming using Groq Primary -> Groq Fallback."""
        if chat_history is None:
            chat_history = []

        llm_messages = self._build_messages(
            user_input, context, chat_history, system_prompt, action, student_work
        )
        # Gemini is no longer the primary provider.
        # Removing Gemini block to ensure Groq is first.

        models_to_try = [settings.groq_primary_model] + settings.groq_model_fallbacks

        last_error = None
        for model_name in models_to_try:
            try:
                llm = _get_llm(model_name)
            except ValueError as e:
                logger.warning(f"Skipping {model_name} due to missing config: {e}")
                last_error = e
                continue

            for attempt in range(2):
                try:
                    success = False
                    async for chunk in llm.astream(llm_messages):
                        if chunk.content:
                            success = True
                            yield chunk.content
                    if success:
                        return
                except Exception as e:
                    last_error = e
                    err_str = str(e).lower()
                    logger.warning(
                        f"Groq {model_name} stream attempt {attempt+1} failed: {e}."
                    )
                    if success:
                        break

                    if "429" in err_str or "rate limit" in err_str or "401" in err_str or "invalid" in err_str or "decommissioned" in err_str:
                        logger.info(f"Rate limit or fatal error on {model_name}, failing over immediately.")
                        break  # Immediate failover
                    elif any(code in err_str for code in ["500", "502", "503", "504", "timeout"]):
                        if attempt == 0:
                            logger.info(f"Transient error on {model_name}, retrying once...")
                            import asyncio
                            await asyncio.sleep(1)
                            continue
                        else:
                            break
                    else:
                        break

        # We do NOT fallback to Gemini for general text tasks, per architecture rules.
        logger.error(f"All stream providers failed. Last error: {last_error}")
        yield "\n\n⚠️ We are currently experiencing high demand and our AI providers are temporarily unavailable. Please try again in a few moments."

    def query(self, user_input: str, action: str = None) -> Dict[str, Any]:
        """Process a user math query through the full pipeline."""
        hint = self._symbolic_hint(user_input)
        source_docs, context = self._retrieve_context(user_input)
        chat_history = self.memory.get_langchain_messages(limit=4)

        # Store human message BEFORE LLM call
        self.memory.add_message("human", user_input)

        answer = self.generate(user_input, context, chat_history, action=action)

        self.memory.add_message("assistant", answer)

        sources = [
            {
                "topic": d.metadata.get("topic", "unknown"),
                "source": d.metadata.get("source", "kb"),
                "difficulty": d.metadata.get("difficulty", "unknown"),
            }
            for d in source_docs
        ]

        return {
            "answer": answer,
            "sources": sources,
            "symbolic_hint": hint,
            "session_id": self.session_id,
            "context_docs": len(source_docs),
        }

    def clear_memory(self):
        """Clear chat history for this session."""
        self.memory.clear_history()

    def get_history(self):
        """Get full chat history for this session."""
        return self.memory.get_history(limit=50)
