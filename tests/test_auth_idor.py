import pytest
from fastapi.testclient import TestClient
from backend.src.main import app
from backend.src.api.middleware.auth import verify_firebase_token
import os

@pytest.fixture
def override_auth_a():
    app.dependency_overrides[verify_firebase_token] = lambda: "user-A"
    yield
    app.dependency_overrides = {}

@pytest.fixture
def override_auth_b():
    app.dependency_overrides[verify_firebase_token] = lambda: "user-B"
    yield
    app.dependency_overrides = {}

def test_idor_progress_isolation(override_auth_a):
    client = TestClient(app)
    # User A creates progress
    res_a = client.post("/api/v1/progress/increment", json={"topic": "algebra"})
    assert res_a.status_code == 200
    assert res_a.json()["total_solved"] >= 1
    
    # Switch to User B
    app.dependency_overrides[verify_firebase_token] = lambda: "user-B"
    res_b = client.get("/api/v1/progress/")
    assert res_b.status_code == 200
    assert res_b.json()["total_solved"] == 0

def test_idor_chat_history_isolation(override_auth_a):
    client = TestClient(app)
    # User A chats
    session_id = "test-session-idor"
    res_a = client.post("/api/v1/chat", json={"query": "What is 2+2?", "session_id": session_id})
    assert res_a.status_code == 200
    
    # Verify User A can see their own history
    hist_a = client.get(f"/api/v1/history/{session_id}")
    assert len(hist_a.json()["messages"]) > 0

    # User B checks history for User A's session
    app.dependency_overrides[verify_firebase_token] = lambda: "user-B"
    hist_b = client.get(f"/api/v1/history/{session_id}")
    
    assert hist_b.status_code == 200, f"Expected 200, got {hist_b.status_code}: {hist_b.text}"
    # MongoDBChatMemory is scoped by session ID AND uid. If uid differs, history should be empty.
    assert len(hist_b.json()["messages"]) == 0

from unittest.mock import patch, MagicMock

@patch("backend.src.api.middleware.auth.get_auth")
def test_reject_missing_token(mock_get_auth):
    mock_auth = MagicMock()
    mock_get_auth.return_value = mock_auth
    app.dependency_overrides = {}  # Remove all overrides
    client = TestClient(app)
    res = client.get("/api/v1/progress/")
    assert res.status_code == 401

@patch("backend.src.api.middleware.auth.get_auth")
def test_reject_invalid_token(mock_get_auth):
    mock_auth = MagicMock()
    # verify_id_token raises ValueError when token is invalid
    mock_auth.verify_id_token.side_effect = ValueError("Invalid token")
    mock_get_auth.return_value = mock_auth
    app.dependency_overrides = {}
    client = TestClient(app)
    res = client.get("/api/v1/progress/", headers={"Authorization": "Bearer invalid-token"})
    assert res.status_code == 401
