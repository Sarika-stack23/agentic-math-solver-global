import logging
from google.cloud import firestore
from backend.src.config import settings, SYSTEM_TEMPLATE

logger = logging.getLogger("math_assistant.prompt")

DEFAULT_SYSTEM_PROMPT = SYSTEM_TEMPLATE

class PromptService:
    def __init__(self):
        self.db = None
        if settings.use_firebase:
            try:
                self.db = firestore.Client()
            except Exception as e:
                logger.warning(f"Could not initialize Firestore client for prompts: {e}")

    def get_system_prompt(self, version: str = "latest", ab_test_group: str = None) -> str:
        """Fetch the system prompt from Firestore with optional A/B testing variations."""
        if not self.db:
            return DEFAULT_SYSTEM_PROMPT
            
        try:
            # For A/B testing, fetch from the "prompts" collection
            # Using document ID "system_prompt_A" or "system_prompt_B" based on group
            doc_id = f"system_prompt_{ab_test_group}" if ab_test_group else "system_prompt"
            doc_ref = self.db.collection("prompts").document(doc_id)
            doc = doc_ref.get()
            
            if doc.exists:
                data = doc.to_dict()
                # Check if specific version requested, otherwise use 'latest' or 'active' pointer
                target_version = version
                if target_version == "latest":
                    target_version = data.get("active_version", "v1")
                
                template = data.get("versions", {}).get(target_version)
                if template:
                    return template
                else:
                    logger.warning(f"Version {target_version} not found in Firestore. Using fallback.")
            else:
                logger.warning(f"Prompt document {doc_id} not found in Firestore. Using fallback.")
                
        except Exception as e:
            logger.error(f"Error fetching prompt from Firestore: {e}. Using fallback.")
            
        return DEFAULT_SYSTEM_PROMPT
