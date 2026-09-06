import pytest
from backend.src.config import settings

# Force in-memory Qdrant for tests to prevent DB lock errors
settings.qdrant_url = ":memory:"
settings.use_firebase = False

from backend.src.main import app
from backend.src.api.middleware.auth import verify_firebase_token

def mock_verify_firebase_token():
    return "test-user-uid"

@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[verify_firebase_token] = mock_verify_firebase_token
    yield
    app.dependency_overrides = {}
