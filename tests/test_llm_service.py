import unittest
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.src.services.llm_service import MathAIEngine
from backend.src.config import settings

class TestLLMFallbackArchitecture(unittest.IsolatedAsyncioTestCase):
    """
    Tests for the bounded retry and provider failover logic in MathAIEngine.
    
    Ensures that 429s instantly trigger failover and that no uncontrolled sleeps occur.
    """

    def setUp(self):
        self.engine = MathAIEngine(session_id="test_session")
        self.engine._retrieve_context = MagicMock(return_value=([], "Mock context"))
        # Force settings.use_gemini to True to test primary Gemini behavior
        self.old_use_gemini = settings.use_gemini
        settings.use_gemini = True

    def tearDown(self):
        settings.use_gemini = self.old_use_gemini

    @patch("backend.src.services.llm_service.GeminiService")
    @patch("backend.src.services.llm_service._get_llm")
    def test_1_gemini_primary_succeeds(self, mock_get_llm, mock_gemini_cls):
        """TEST 1: Gemini primary succeeds. Groq is not used."""
        mock_gemini_instance = MagicMock()
        mock_gemini_instance.query.return_value = "Gemini Primary Success"
        mock_gemini_cls.return_value = mock_gemini_instance
        
        answer = self.engine.generate("Hello")
        
        self.assertEqual(answer, "Gemini Primary Success")
        mock_gemini_instance.query.assert_called_once()
        mock_get_llm.assert_not_called()

    @patch("backend.src.services.llm_service.GeminiService")
    @patch("backend.src.services.llm_service.time.sleep")
    @patch("backend.src.services.llm_service._get_llm")
    def test_2_gemini_primary_fails_fallback_groq_used(self, mock_get_llm, mock_sleep, mock_gemini_cls):
        """TEST 2: Gemini primary fails -> fallback Groq model used."""
        mock_gemini_instance = MagicMock()
        mock_gemini_instance.query.side_effect = Exception("429 Too Many Requests")
        mock_gemini_cls.return_value = mock_gemini_instance
        
        mock_primary_groq = MagicMock()
        mock_primary_groq.invoke.return_value.content = "Groq Fallback Success"

        def get_llm_side_effect(model_name):
            if model_name == settings.groq_primary_model:
                return mock_primary_groq
            return MagicMock()
        
        mock_get_llm.side_effect = get_llm_side_effect

        answer = self.engine.generate("Hello")

        self.assertEqual(answer, "Groq Fallback Success")
        mock_gemini_instance.query.assert_called_once()
        mock_primary_groq.invoke.assert_called_once()
        mock_sleep.assert_not_called()

    @patch("backend.src.services.llm_service.GeminiService")
    @patch("backend.src.services.llm_service.time.sleep")
    @patch("backend.src.services.llm_service._get_llm")
    def test_3_groq_fails_transient_then_succeeds(self, mock_get_llm, mock_sleep, mock_gemini_cls):
        """TEST 3: Gemini fails, Groq fails with 500, retries once, then Groq fallback succeeds."""
        mock_gemini_instance = MagicMock()
        mock_gemini_instance.query.side_effect = Exception("500 Internal Error")
        mock_gemini_cls.return_value = mock_gemini_instance
        
        mock_primary_groq = MagicMock()
        # Fails first with 500, then fails second time with 500
        mock_primary_groq.invoke.side_effect = [Exception("500 Internal Server Error"), Exception("500 Internal Server Error")]

        mock_fallback_groq = MagicMock()
        mock_fallback_groq.invoke.return_value.content = "Groq Secondary Fallback Success"

        def get_llm_side_effect(model_name):
            if model_name == settings.groq_primary_model:
                return mock_primary_groq
            elif model_name == settings.groq_model_fallbacks[0]:
                return mock_fallback_groq
            return MagicMock()

        mock_get_llm.side_effect = get_llm_side_effect

        answer = self.engine.generate("Hello")

        self.assertEqual(answer, "Groq Secondary Fallback Success")
        self.assertEqual(mock_primary_groq.invoke.call_count, 2)
        mock_fallback_groq.invoke.assert_called_once()
        mock_sleep.assert_called_once_with(1)

    @patch("backend.src.services.llm_service.GeminiService")
    @patch("backend.src.services.llm_service._get_llm")
    def test_5_all_providers_fail(self, mock_get_llm, mock_gemini_cls):
        """TEST 5: All providers fail. Generic error returned, no stack traces leaked."""
        mock_gemini_instance = MagicMock()
        mock_gemini_instance.query.side_effect = Exception("Some raw API Exception gemini_error")
        mock_gemini_cls.return_value = mock_gemini_instance

        mock_groq = MagicMock()
        mock_groq.invoke.side_effect = Exception("429 Too Many Requests")
        mock_get_llm.return_value = mock_groq

        answer = self.engine.generate("Hello")

        self.assertIn("temporarily unavailable", answer)
        self.assertNotIn("gemini_error", answer)
        self.assertNotIn("API Exception", answer)

    @patch("backend.src.services.llm_service.GeminiService")
    @patch("backend.src.services.llm_service._get_llm")
    async def test_6_streaming_primary_fails(self, mock_get_llm, mock_gemini_cls):
        """TEST 6: Streaming primary (Gemini) fails, safely falls back to Groq."""
        mock_gemini_instance = MagicMock()
        
        async def mock_gemini_stream(user_input, context="", chat_history=None):
            raise Exception("429 Stream Failed")
            yield
            
        mock_gemini_instance.stream = mock_gemini_stream
        mock_gemini_cls.return_value = mock_gemini_instance
        
        mock_primary_groq = MagicMock()
        async def mock_groq_astream(msgs):
            from langchain_core.messages import AIMessageChunk
            yield AIMessageChunk(content="Stream ")
            yield AIMessageChunk(content="Success")

        mock_primary_groq.astream = mock_groq_astream

        def get_llm_side_effect(model_name):
            if model_name == settings.groq_primary_model:
                return mock_primary_groq
            return MagicMock()
            
        mock_get_llm.side_effect = get_llm_side_effect

        chunks = []
        async for chunk in self.engine.astream("Hello"):
            chunks.append(chunk)

        self.assertEqual("".join(chunks), "Stream Success")
        mock_get_llm.assert_called()

if __name__ == "__main__":
    unittest.main()
