import os
from backend.src.config import settings
from backend.src.services.firebase_service import init_firebase, get_auth, get_firestore_client, _FIREBASE_APP

print("CWD:", os.getcwd())
print("USE_FIREBASE:", settings.use_firebase)
print("CRED_PATH:", settings.firebase_credentials_path)
print("EXISTS:", os.path.exists(settings.firebase_credentials_path))

init_firebase()
print("_FIREBASE_APP:", _FIREBASE_APP)
print("AUTH:", get_auth())
