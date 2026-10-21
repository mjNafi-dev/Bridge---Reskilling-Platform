"""
GPU job (runs on a RunPod pod): turn every ESCO skill and job title into an
embedding, a list of numbers that captures meaning, so the app can tell that
"colour correction" and "colour grading" are related even with different words.

Input : texts_to_embed.jsonl   (made by the backend; one {"id","kind","text"} per line)
Output: embeddings.npy         (float16, one row per input line, normalised)
        embeddings_meta.json   (model name, GPU, timing, row order)

On the pod:
    pip install -q sentence-transformers
    python embed_skills.py
"""

import json
import time
from pathlib import Path

import numpy as np
import torch
from sentence_transformers import SentenceTransformer

MODEL = "BAAI/bge-small-en-v1.5"  # same model the backend uses on CPU for users' phrases
HERE = Path(__file__).resolve().parent

rows = [json.loads(l) for l in (HERE / "texts_to_embed.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
device = "cuda" if torch.cuda.is_available() else "cpu"
gpu = torch.cuda.get_device_name(0) if device == "cuda" else "none"
print(f"{len(rows)} texts | device={device} | gpu={gpu} | model={MODEL}")

start = time.time()
model = SentenceTransformer(MODEL, device=device)
vectors = model.encode(
    [r["text"] for r in rows],
    batch_size=256,
    normalize_embeddings=True,
    show_progress_bar=True,
    convert_to_numpy=True,
)
seconds = round(time.time() - start, 2)

np.save(HERE / "embeddings.npy", vectors.astype(np.float16))
(HERE / "embeddings_meta.json").write_text(
    json.dumps(
        {
            "model": MODEL,
            "dimensions": int(vectors.shape[1]),
            "count": len(rows),
            "device": device,
            "gpu": gpu,
            "seconds": seconds,
            "created_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "rows": [{"id": r["id"], "kind": r["kind"], "text": r["text"]} for r in rows],
        },
        ensure_ascii=False,
    ),
    encoding="utf-8",
)
print(f"Done in {seconds}s -> embeddings.npy ({vectors.shape}) + embeddings_meta.json")
