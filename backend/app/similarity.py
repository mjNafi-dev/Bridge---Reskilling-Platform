"""
How similar are two short skill phrases? Returns 0..1.

Current method: word overlap (with light word-stemming) blended with
character-trigram overlap, so "colour correction" ~ "apply colour corrections".
This is the simple, explainable baseline. It will be swapped for meaning-based
embeddings (computed once on a RunPod GPU) without changing anything else.
"""

import re
from functools import lru_cache

STOPWORDS = {
    "a", "an", "and", "or", "the", "of", "to", "in", "on", "for", "with", "by", "at", "as",
    "use", "using", "apply", "perform", "manage", "work", "ensure", "carry", "out", "basic",
    "e", "g", "etc", "my", "i", "me",
}


def stem(word):
    for suffix in ("ations", "ation", "ings", "ing", "ers", "er", "ies", "es", "ed", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


@lru_cache(maxsize=50_000)
def words(text):
    tokens = re.findall(r"[a-z0-9+#]+", text.lower().replace("colour", "color"))
    return frozenset(stem(t) for t in tokens if t not in STOPWORDS)


@lru_cache(maxsize=50_000)
def trigrams(text):
    t = " " + re.sub(r"\s+", " ", text.lower().replace("colour", "color")).strip() + " "
    return frozenset(t[i : i + 3] for i in range(len(t) - 2))


def similarity(a, b):
    wa, wb = words(a), words(b)
    if not wa or not wb:
        return 0.0
    # Dice overlap: shared words relative to both phrases, so one shared generic
    # word ("photo") doesn't make two different skills look the same
    word_score = 2 * len(wa & wb) / (len(wa) + len(wb))
    ta, tb = trigrams(a), trigrams(b)
    tri_score = len(ta & tb) / len(ta | tb) if ta and tb else 0.0
    return min(1.0, 0.75 * word_score + 0.25 * min(1.0, tri_score * 2))
