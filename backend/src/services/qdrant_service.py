"""
Qdrant Vector Service — Hybrid Search (Dense + Sparse).
"""

import logging
from typing import List, Dict, Any, Optional

from qdrant_client import QdrantClient
from langchain_qdrant import QdrantVectorStore, RetrievalMode, FastEmbedSparse

from backend.src.config import settings
from backend.src.services.embedding_service import get_dense_embeddings

logger = logging.getLogger("math_assistant.qdrant")

class QdrantService:
    """Manages the Qdrant Cloud or local vector store with Hybrid Search."""

    def __init__(self):
        self.collection_name = settings.collection_name
        self.url = getattr(settings, "qdrant_url", "qdrant_data")
        self.api_key = getattr(settings, "qdrant_api_key", "")

        logger.info(f"Initializing Qdrant at {self.url}")

        # 1. Initialize Client
        if self.url == ":memory:":
            self.client = QdrantClient(location=":memory:")
        elif self.url.startswith("http"):
            self.client = QdrantClient(
                url=self.url,
                api_key=self.api_key if self.api_key else None
            )
        else:
            import os
            os.makedirs(self.url, exist_ok=True)
            self.client = QdrantClient(path=self.url)

        # 2. Get dense embeddings
        self.dense_embeddings = get_dense_embeddings()

        # 3. Setup sparse embeddings for hybrid search
        self.sparse_embeddings = FastEmbedSparse(model_name="Qdrant/bm25")

        try:
            self.vectorstore = QdrantVectorStore(
                client=self.client,
                collection_name=self.collection_name,
                embedding=self.dense_embeddings,
                sparse_embedding=self.sparse_embeddings,
                retrieval_mode=RetrievalMode.HYBRID
            )
        except ValueError as e:
            if "not found" in str(e):
                logger.warning(f"Collection {self.collection_name} not found. It will be created upon first insertion.")
                self.vectorstore = None
            else:
                raise e

    def add_documents(self, documents: List[Any]):
        """Index documents into Qdrant."""
        logger.info(f"Indexing {len(documents)} documents into Qdrant...")
        if self.vectorstore is None:
            location_arg = ":memory:" if self.url == ":memory:" else None
            url_arg = self.url if self.url.startswith("http") else None
            path_arg = self.url if not self.url.startswith("http") and self.url != ":memory:" else None
            api_key_arg = self.api_key if self.api_key and self.url.startswith("http") else None

            # Close the existing client so QdrantVectorStore can lock the file
            if path_arg and hasattr(self.client, "close"):
                self.client.close()
                import time; time.sleep(0.1) # Brief wait for lock release

            self.vectorstore = QdrantVectorStore.from_documents(
                documents,
                embedding=self.dense_embeddings,
                sparse_embedding=self.sparse_embeddings,
                location=location_arg,
                url=url_arg,
                path=path_arg,
                api_key=api_key_arg,
                collection_name=self.collection_name,
                retrieval_mode=RetrievalMode.HYBRID
            )
            # Reattach our client to the one created by QdrantVectorStore
            self.client = self.vectorstore.client
        else:
            self.vectorstore.add_documents(documents)
        logger.info("Indexing complete.")

    def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter_topic: Optional[str] = None,
        filter_class: Optional[str] = None,
        filter_chapter: Optional[str] = None,
        filter_uid: Optional[str] = None
    ) -> List[Any]:
        """Hybrid search with metadata filtering."""

        if not self.vectorstore:
            return []

        from qdrant_client.http import models as rest

        filter_conditions = []
        if filter_topic:
            filter_conditions.append(rest.FieldCondition(key="metadata.topic", match=rest.MatchValue(value=filter_topic)))
        if filter_class:
            filter_conditions.append(rest.FieldCondition(key="metadata.class_level", match=rest.MatchValue(value=filter_class)))
        if filter_chapter:
            filter_conditions.append(rest.FieldCondition(key="metadata.chapter", match=rest.MatchValue(value=filter_chapter)))

        # Security scoping: ensure custom docs are scoped by UID
        if filter_uid:
            # Condition 1: Must match the UID OR
            # Condition 2: is_custom is missing or False (system docs)
            uid_condition = rest.FieldCondition(key="metadata.uploaded_by", match=rest.MatchValue(value=filter_uid))
            system_condition = rest.IsEmptyCondition(is_empty=rest.PayloadField(key="metadata.uploaded_by"))

            # Use 'should' for OR logic in Qdrant (either matches UID, or lacks UID because it's a global system doc)
            filter_conditions.append(rest.Filter(
                should=[uid_condition, system_condition]
            ))

        qdrant_filter = rest.Filter(must=filter_conditions) if filter_conditions else None

        try:
            return self.vectorstore.similarity_search(
                query=query,
                k=k,
                filter=qdrant_filter
            )
        except Exception as e:
            logger.error(f"Qdrant search failed: {e}")
            return []

    def is_ready(self) -> bool:
        """Check if the vector store is initialized and ready."""
        return self.vectorstore is not None

    def as_retriever(self, k: int = 5, metadata_filters: Dict[str, Any] = None):
        """Return a LangChain retriever interface with dynamic filters."""
        from qdrant_client.http import models as rest

        qdrant_filter = None
        if metadata_filters:
            conditions = []
            for key, val in metadata_filters.items():
                if key == "filter_uid":
                    # Security scoping: ensure custom docs are scoped by UID
                    uid_condition = rest.FieldCondition(key="metadata.uploaded_by", match=rest.MatchValue(value=val))
                    system_condition = rest.IsEmptyCondition(is_empty=rest.PayloadField(key="metadata.uploaded_by"))
                    conditions.append(rest.Filter(should=[uid_condition, system_condition]))
                else:
                    conditions.append(rest.FieldCondition(key=f"metadata.{key}", match=rest.MatchValue(value=val)))
            qdrant_filter = rest.Filter(must=conditions)

        search_kwargs = {"k": k}
        if qdrant_filter:
            search_kwargs["filter"] = qdrant_filter

        return self.vectorstore.as_retriever(search_kwargs=search_kwargs)

    def get_document_count(self) -> int:
        """Count total documents in collection."""
        try:
            return self.client.count(self.collection_name).count
        except Exception:
            return 0
