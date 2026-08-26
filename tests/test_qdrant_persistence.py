import pytest
import os
import shutil
from langchain_core.documents import Document
from backend.src.services.qdrant_service import QdrantService
from backend.src.config import settings

@pytest.fixture
def temp_qdrant_dir(tmp_path):
    qdrant_path = str(tmp_path / "qdrant_data_test")
    original_url = settings.qdrant_url
    settings.qdrant_url = qdrant_path
    
    yield qdrant_path
    
    settings.qdrant_url = original_url
    if os.path.exists(qdrant_path):
        shutil.rmtree(qdrant_path, ignore_errors=True)

def test_qdrant_persistence_and_idor(temp_qdrant_dir):
    # 1. Initialize Qdrant and insert data for User A
    service1 = QdrantService()
    docs = [
        Document(
            page_content="User A custom math notes on Calculus.",
            metadata={"topic": "calculus", "uploaded_by": "user-A", "is_custom": True}
        ),
        Document(
            page_content="Global math formula: E=mc^2.",
            metadata={"topic": "physics"} # No uploaded_by, system doc
        )
    ]
    service1.add_documents(docs)
    
    # Prove persistent disk reload works: 
    # Check that the directory actually contains files (it is not in-memory)
    assert os.path.exists(temp_qdrant_dir)
    assert len(os.listdir(temp_qdrant_dir)) > 0
    
    # Retrieve as User A: Should see both system docs and their custom doc
    res_a = service1.similarity_search("Calculus", filter_uid="user-A")
    print(f"RES A: {res_a}")
    assert any("User A" in d.page_content for d in res_a), f"Expected 'User A' in {res_a}"
    
    res_a_global = service1.similarity_search("E=mc^2", filter_uid="user-A")
    print(f"RES A GLOBAL: {res_a_global}")
    assert any("Global" in d.page_content for d in res_a_global), f"Expected 'Global' in {res_a_global}"
    
    # Retrieve as User B: Should NOT see User A's custom doc
    res_b = service1.similarity_search("Calculus", filter_uid="user-B")
    print(f"RES B: {res_b}")
    assert not any("User A" in d.page_content for d in res_b), f"Expected no 'User A' in {res_b}"
    
    # But User B can see global docs
    res_b_global = service1.similarity_search("E=mc^2", filter_uid="user-B")
    print(f"RES B GLOBAL: {res_b_global}")
    assert any("Global" in d.page_content for d in res_b_global), f"Expected 'Global' in {res_b_global}"
