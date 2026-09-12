"""
Firebase Service — Initializes Firebase Admin SDK and provides database access.

This replaces MongoDB for database persistence in Phase 3.
"""

import os
import logging
from typing import Optional

from backend.src.config import settings

logger = logging.getLogger("math_assistant.firebase")

_FIREBASE_APP = None
_FIRESTORE_CLIENT = None

def init_firebase():
    """Initialize the Firebase Admin SDK."""
    global _FIREBASE_APP, _FIRESTORE_CLIENT
    
    if not settings.use_firebase:
        logger.info("Firebase integration disabled in config.")
        return

    if _FIREBASE_APP is not None:
        return

    import firebase_admin
    from firebase_admin import credentials
    from firebase_admin import firestore

    try:
        if os.environ.get("FIREBASE_KEY_JSON"):
            import json
            cred_dict = json.loads(os.environ.get("FIREBASE_KEY_JSON"))
            cred = credentials.Certificate(cred_dict)
            _FIREBASE_APP = firebase_admin.initialize_app(cred)
        elif settings.firebase_credentials_path and os.path.exists(settings.firebase_credentials_path):
            cred = credentials.Certificate(settings.firebase_credentials_path)
            _FIREBASE_APP = firebase_admin.initialize_app(cred)
        elif settings.firebase_project_id:
            logger.info("Initializing Firebase Admin with projectId only (Token verification mode).")
            _FIREBASE_APP = firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})
        else:
            logger.warning("No Firebase credentials or projectId found. Running in unauthenticated/memory-fallback mode.")
            return

        try:
            _FIRESTORE_CLIENT = firestore.client()
            logger.info("Firebase Admin SDK & Firestore initialized successfully.")
        except Exception as db_err:
            logger.warning(f"Could not initialize Firestore client (likely missing credentials). Proceeding without Firestore: {db_err}")
            _FIRESTORE_CLIENT = None
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}")

def get_firestore_client():
    """Get the initialized Firestore client."""
    return _FIRESTORE_CLIENT

def get_auth():
    """Get the Firebase Auth module."""
    if _FIREBASE_APP is None:
        return None
    from firebase_admin import auth
    return auth

def save_user_feedback(uid: str, session_id: str, message_id: str, is_positive: bool, comments: str = ""):
    """Save explicit human feedback to Firestore."""
    db = get_firestore_client()
    if not db:
        logger.warning("Cannot save feedback: Firebase is disabled or not initialized.")
        return
        
    try:
        from datetime import datetime, timezone
        
        feedback_data = {
            "session_id": session_id,
            "message_id": message_id,
            "is_positive": is_positive,
            "comments": comments,
            "timestamp": datetime.now(timezone.utc)
        }
        
        db.collection("users").document(uid).collection("feedback").add(feedback_data)
        logger.info(f"Feedback saved for user {uid}")
    except Exception as e:
        logger.error(f"Failed to save user feedback: {e}")
