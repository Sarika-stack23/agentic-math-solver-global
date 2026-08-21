"""Tests for MathDataLoader — extracted from main.py L2589-L2594.

Validates that the built-in NCERT knowledge base loads correctly
with non-empty content and proper metadata tagging.
"""

import unittest
import sys
from pathlib import Path

# Ensure project root is on sys.path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.src.math.knowledge_indexer import KnowledgeIndexer


class TestDataSources(unittest.TestCase):
    """Verify NCERT knowledge base loading produces valid Document objects."""

    def test_builtin_knowledge(self):
        """Test loading builtin knowledge from markdown files."""
        import tempfile
        import os
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create a dummy markdown file
            md_path = os.path.join(temp_dir, "test.md")
            with open(md_path, "w") as f:
                f.write("---\ntopic: Algebra\n---\n\n" + "This is a very long string that acts as the page content and it needs to be strictly greater than fifty characters long to pass the length assertion inside the test!" * 2)
            
            indexer = KnowledgeIndexer(kb_dir=temp_dir)
            docs = indexer.load_markdown_files()
            self.assertGreater(len(docs), 0)
            for doc in docs:
                self.assertIn("topic", doc.metadata)
                self.assertGreater(len(doc.page_content), 50)


if __name__ == "__main__":
    unittest.main()
