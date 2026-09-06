import unittest
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.src.services.llm_service import MathAIEngine
from backend.src.config import settings

class TestLLMFallbackArchitecture(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.engine = MathAIEngine(session_id="test_session")
        self.engine._retrieve_context = MagicMock(return_value=([], "Mock context"))

    @patch("backend.src.services.llm_service._get_llm")
    def test_1_groq_primary_succeeds(self, mock_get_llm):
        mock_primary_groq = MagicMock()
        mock_primary_groq.invoke.return_value.content = "Groq Primary Success"

        def get_llm_side_effect(model_name):
            if model_name == settings.groq_primary_model:
                return mock_primary_groq
            return MagicMock()

        mock_get_llm.side_effect = get_llm_side_effect

        answer = self.engine.generate("Hello")

        self.assertEqual(answer, "Groq Primary Success")
        mock_primary_groq.invoke.assert_called_once()

    @patch("backend.src.services.llm_service.time.sleep")
    @patch("backend.src.services.llm_service._get_llm")
    def test_2_groq_primary_fails_fallback_groq_used(self, mock_get_llm, mock_sleep):
        mock_primary_groq = MagicMock()
        mock_primary_groq.invoke.side_effect = Exception("429 Too Many Requests")

        mock_fallback_groq = MagicMock()
        mock_fallback_groq.invoke.return_value.content = "Groq Fallback Success"

        def get_llm_side_effect(model_name):
            if model_name == settings.groq_primary_model:
                return mock_primary_groq
            elif model_name == settings.groq_model_fallbacks[0]:
                return mock_fallback_groq
            return MagicMock()

        mock_get_llm.side_effect = get_llm_side_effect

        answer = self.engine.generate("Hello")

        self.assertEqual(answer, "Groq Fallback Success")
        mock_primary_groq.invoke.assert_called_once()
        mock_fallback_groq.invoke.assert_called_once()
        mock_sleep.assert_not_called()

    @patch("backend.src.services.llm_service.time.sleep")
    @patch("backend.src.services.llm_service._get_llm")
    def test_3_groq_fails_transient_then_succeeds(self, mock_get_llm, mock_sleep):
        mock_primary_groq = MagicMock()
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

    @patch("backend.src.services.llm_service._get_llm")
    def test_4_all_providers_fail(self, mock_get_llm):
        mock_groq = MagicMock()
        mock_groq.invoke.side_effect = Exception("429 Too Many Requests")
        mock_get_llm.return_value = mock_groq

        import pytest
        with pytest.raises(Exception) as exc:
            answer = self.engine.generate("Hello")

        self.assertIn("temporarily unavailable", str(exc.value))

    @patch("backend.src.services.llm_service._get_llm")
    async def test_5_streaming_primary_fails(self, mock_get_llm):
        mock_primary_groq = MagicMock()
        async def mock_primary_astream(msgs):
            raise Exception("429 Stream Failed")
            yield

        mock_primary_groq.astream = mock_primary_astream

        mock_fallback_groq = MagicMock()
        async def mock_fallback_astream(msgs):
            from langchain_core.messages import AIMessageChunk
            yield AIMessageChunk(content="Stream ")
            yield AIMessageChunk(content="Success")

        mock_fallback_groq.astream = mock_fallback_astream

        def get_llm_side_effect(model_name):
            if model_name == settings.groq_primary_model:
                return mock_primary_groq
            elif model_name == settings.groq_model_fallbacks[0]:
                return mock_fallback_groq
            return MagicMock()

        mock_get_llm.side_effect = get_llm_side_effect

        chunks = []
        async for chunk in self.engine.astream("Hello"):
            chunks.append(chunk)

        self.assertEqual("".join(chunks), "Stream Success")

if __name__ == '__main__':
    unittest.main()
