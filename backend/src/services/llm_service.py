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
    ) -> list:
        if system_prompt is None:
            system_prompt = SYSTEM_TEMPLATE.replace("{context}", context)
        else:
            system_prompt = system_prompt.replace("{context}", context)
        llm_messages = [SystemMessage(content=system_prompt)]
        for msg in chat_history:
            llm_messages.append(msg)
        llm_messages.append(HumanMessage(content=user_input))
        return llm_messages

    def generate(
        self,
        user_input: str,
        context: str = "",
        chat_history: list = None,
        system_prompt: str = None,
    ) -> str:
        """Centralized generation using Groq Primary -> Groq Fallback -> Gemini."""
        if chat_history is None:
            chat_history = []

        llm_messages = self._build_messages(
            user_input, context, chat_history, system_prompt
        )
        if settings.use_gemini:
            try:
                gemini = GeminiService()
                answer = gemini.query(user_input, context=context, chat_history=chat_history)
                if answer:
                    return answer
            except Exception as e:
                logger.error(f"Gemini primary failed: {e}")
                last_error = e

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

        # Fallback to Gemini Server-Side
        logger.warning(
            f"All Groq models failed. Falling back to Gemini Server-Side. Last Groq Error: {last_error}"
        )
        try:
            gemini = GeminiService()  # uses server-side key
            answer = gemini.query(
                user_input, context=context, chat_history=chat_history
            )
            if answer:
                return answer
        except Exception as e:
            logger.error(f"Gemini fallback failed: {e}")
            last_error = e

        logger.error(f"All providers failed. Last error: {last_error}")
        return "⚠️ We are currently experiencing high demand and our AI providers are temporarily unavailable. Please try again in a few moments."

    async def astream(
        self,
        user_input: str,
        context: str = "",
        chat_history: list = None,
        system_prompt: str = None,
    ) -> AsyncGenerator[str, None]:
        """Centralized streaming using Groq Primary -> Groq Fallback -> Gemini."""
        if chat_history is None:
            chat_history = []

        llm_messages = self._build_messages(
            user_input, context, chat_history, system_prompt
        )
        if settings.use_gemini:
            try:
                gemini = GeminiService()
                success = False
                async for chunk in gemini.stream(user_input, context=context, chat_history=chat_history):
                    if chunk:
                        success = True
                        yield chunk
                if success:
                    return
            except Exception as e:
                logger.error(f"Gemini primary stream failed: {e}")
                last_error = e

        models_to_try = [settings.groq_primary_model] + settings.groq_model_fallbacks

        last_error = None
        for model_name in models_to_try:
            try:
                llm = _get_llm(model_name)
            except ValueError as e:
                logger.warning(f"Skipping {model_name} due to missing config: {e}")
                last_error = e
                continue

            # For streaming, we attempt once per model.
            # If 429 or any error occurs before yielding content, we catch it instantly and move to the fallback.
            try:
                success = False
                async for chunk in llm.astream(llm_messages):
                    if chunk.content:
                        success = True
                        yield chunk.content
                if success:
                    return  # Successfully streamed from this model
            except Exception as e:
                last_error = e
                logger.warning(
                    f"Groq {model_name} stream failed: {e}. Trying next model."
                )

        # Fallback to Gemini
        logger.warning(
            f"All Groq streams failed. Falling back to Gemini Server-Side. Last Groq Error: {last_error}"
        )
        try:
            gemini = GeminiService()  # uses server-side key
            success = False
            async for chunk in gemini.stream(
                user_input, context=context, chat_history=chat_history
            ):
                if chunk:
                    success = True
                    yield chunk
            if success:
                return
        except Exception as e:
            logger.error(f"Gemini fallback stream failed: {e}")
            last_error = e

        logger.error(f"All stream providers failed. Last error: {last_error}")
        yield "\n\n⚠️ We are currently experiencing high demand and our AI providers are temporarily unavailable. Please try again in a few moments."

    def query(self, user_input: str) -> Dict[str, Any]:
        """Process a user math query through the full pipeline."""
        hint = self._symbolic_hint(user_input)
        source_docs, context = self._retrieve_context(user_input)
        chat_history = self.memory.get_langchain_messages(limit=4)

        # Store human message BEFORE LLM call
        self.memory.add_message("human", user_input)

        answer = self.generate(user_input, context, chat_history)

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
