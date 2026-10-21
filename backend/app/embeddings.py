"""
Meaning-based similarity using embeddings.

- ESCO skills and job titles were embedded ONCE on a RunPod GPU
  (runpod/embed_skills.py -> data/embeddings/embeddings.npy).
- At request time we only embed the user's own phrases, on the CPU, with the
  same model (BAAI/bge-small-en-v1.5 via fastembed), so both sides are comparable.

Raw cosine scores from this model sit around 0.6-0.7 even for unrelated phrases,
so they're rescaled: <= LOW counts as 0, >= HIGH counts as 1, linear in between.
"""

import json
from functools import lru_cache
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parents[1] / "data"
MODEL = "BAAI/bge-small-en-v1.5"
LOW, HIGH = 0.62, 0.85  # measured: unrelated phrases ~0.57 median, real transfers ~0.70-0.75


class Embeddings:
    def __init__(self):
        vectors = np.load(DATA / "embeddings" / "embeddings.npy").astype(np.float32)
        meta = json.loads((DATA / "embeddings" / "embeddings_meta.json").read_text(encoding="utf-8"))
        self.model_name = meta["model"]
        self.skill_vec = {}  # ESCO skill URI -> vector
        self.occ_vecs = {}  # ESCO occupation URI -> vectors for its title + other names
        for row, vec in zip(meta["rows"], vectors):
            if row["kind"] == "skill":
                self.skill_vec[row["id"]] = vec
            else:
                self.occ_vecs.setdefault(row["id"], []).append(vec)
        self.occ_vecs = {k: np.stack(v) for k, v in self.occ_vecs.items()}
        self._model = None

    def _encoder(self):
        if self._model is None:  # load lazily: ~5 s the first time, cached in data/models
            from fastembed import TextEmbedding

            self._model = TextEmbedding(MODEL, cache_dir=str(DATA / "models"))
        return self._model

    def encode(self, texts):
        """Embed the user's phrases (normalised, so a dot product = cosine)."""
        if not texts:
            return np.zeros((0, 384), dtype=np.float32)
        vecs = np.array(list(self._encoder().embed(list(texts))), dtype=np.float32)
        return vecs / np.linalg.norm(vecs, axis=1, keepdims=True)

    @staticmethod
    def rescale(cos):
        return np.clip((cos - LOW) / (HIGH - LOW), 0.0, 1.0)

    def skill_matrix(self, skill_uris):
        return np.stack([self.skill_vec[u] for u in skill_uris])


@lru_cache(maxsize=1)
def get_embeddings():
    try:
        return Embeddings()
    except FileNotFoundError:
        return None  # matching falls back to word overlap
