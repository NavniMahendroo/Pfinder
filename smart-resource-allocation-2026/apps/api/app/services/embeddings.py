import os

import numpy as np

from app.core.config import settings


class EmbeddingService:
    def __init__(self) -> None:
        # Prevent transformers from importing TensorFlow on startup.
        os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(settings.matching_embedding_model)

    def encode(self, text: str) -> list[float]:
        return self.model.encode(text, normalize_embeddings=True).tolist()

    @staticmethod
    def cosine_similarity(left: list[float], right: list[float]) -> float:
        v1 = np.array(left)
        v2 = np.array(right)
        denominator = np.linalg.norm(v1) * np.linalg.norm(v2)
        if denominator == 0:
            return 0.0
        return float(np.dot(v1, v2) / denominator)
