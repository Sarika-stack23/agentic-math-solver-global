"""
Chat Memory Service — Firestore-backed persistent chat history.

Provides per-session chat history with Firestore persistence and
in-memory fallback when Firestore is unavailable.
Replaces the MongoDB implementation from Phase 1.
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict

from backend.src.config import settings
from backend.src.services.firebase_service import get_firestore_client

try:
    from langchain_core.messages import HumanMessage, AIMessage
except ImportError:
    from langchain.schema import HumanMessage, AIMessage

logger = logging.getLogger("math_assistant.memory")


class FirestoreChatMemory:
    """Per-session chat memory with Firestore persistence and in-memory fallback."""

    _in_memory_store: Dict[str, List[Dict]] = {}

    def __init__(self, uid: str = "anonymous", session_id: str = "default"):
        self.uid = uid
        self.session_id = session_id
        self.db = get_firestore_client()

    def _get_collection_ref(self):
        """Get a reference to the session's messages subcollection."""
        if not self.db:
            return None
        return self.db.collection("users").document(self.uid).collection("sessions").document(self.session_id).collection("messages")

    def add_message(self, role: str, content: str):
        """Add a message to chat history."""
        msg = {
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc),
        }
        
        col_ref = self._get_collection_ref()
        if col_ref is not None:
            try:
                col_ref.add(msg)
                return
            except Exception as e:
                logger.warning(f"Failed to add message to Firestore: {e}. Falling back to memory.")

        # Fallback to in-memory
        msg["session_id"] = self.session_id
        key = f"{self.uid}_{self.session_id}"
        if key not in self._in_memory_store:
            self._in_memory_store[key] = []
        self._in_memory_store[key].append(msg)

    def get_history(self, limit: int = 20) -> List[Dict]:
        """Retrieve recent chat history for this session."""
        col_ref = self._get_collection_ref()
        if col_ref is not None:
            try:
                from firebase_admin import firestore
                docs = (
                    col_ref.order_by("timestamp", direction=firestore.Query.DESCENDING)
                    .limit(limit)
                    .stream()
                )
                msgs = [doc.to_dict() for doc in docs]
                msgs.reverse()
                return msgs
            except Exception as e:
                logger.warning(f"Failed to get history from Firestore: {e}. Falling back to memory.")

        # Fallback to in-memory
        key = f"{self.uid}_{self.session_id}"
        return self._in_memory_store.get(key, [])[-limit:]

    def get_langchain_messages(self, limit: int = 10):
        """Convert chat history to LangChain message objects."""
        history = self.get_history(limit)
        result = []
        for msg in history:
            if msg.get("role") == "human":
                result.append(HumanMessage(content=msg.get("content", "")))
            elif msg.get("role") == "assistant":
                result.append(AIMessage(content=msg.get("content", "")))
        return result

    def clear_history(self):
        """Clear all messages for this session."""
        col_ref = self._get_collection_ref()
        if col_ref is not None:
            try:
                docs = col_ref.limit(500).stream()
                batch = self.db.batch()
                count = 0
                for doc in docs:
                    batch.delete(doc.reference)
                    count += 1
                if count > 0:
                    batch.commit()
            except Exception as e:
                logger.warning(f"Failed to clear history in Firestore: {e}. Clearing memory instead.")

        key = f"{self.uid}_{self.session_id}"
        if key in self._in_memory_store:
            self._in_memory_store[key].clear()

    def get_sessions(self) -> List[Dict[str, str]]:
        """Retrieve all session IDs for the current user."""
        if self.db is not None:
            try:
                sessions_ref = self.db.collection("users").document(self.uid).collection("sessions")
                docs = sessions_ref.stream()
                return [{"session_id": doc.id, "title": f"Session {doc.id[:6]}..."} for doc in docs]
            except Exception as e:
                logger.warning(f"Failed to list sessions from Firestore: {e}. Falling back to memory.")
                
        # Fallback to in-memory
        sessions = set()
        for key in self._in_memory_store.keys():
            if key.startswith(f"{self.uid}_"):
                session_id = key[len(self.uid) + 1:]
                sessions.add(session_id)
        
        return [{"session_id": sid, "title": f"Session {sid[:6]}..."} for sid in sessions]

# Maintain backward compatibility name for the MathAIEngine import during transition
MongoDBChatMemory = FirestoreChatMemory
