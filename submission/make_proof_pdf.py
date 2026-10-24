"""
Builds "Replit Proof of Use.pdf" and "RunPod Proof of Use.pdf" from the screenshots in submission/screenshots/.
Each PDF is one page: the screenshots in a 2 x 2 grid, no text.
Run from the repo root:   python submission/make_proof_pdf.py
Needs Pillow (pip install pillow).
"""

from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SHOTS = HERE / "screenshots"
GAP = 24


def collage(prefix, out):
    shots = [Image.open(p).convert("RGB") for p in sorted(SHOTS.glob(f"{prefix}-*.png"))]
    w = max(s.width for s in shots)
    h = max(s.height for s in shots)
    page = Image.new("RGB", (2 * w + 3 * GAP, 2 * h + 3 * GAP), "white")
    for i, s in enumerate(shots[:4]):
        s.thumbnail((w, h))
        x = GAP + (i % 2) * (w + GAP) + (w - s.width) // 2
        y = GAP + (i // 2) * (h + GAP) + (h - s.height) // 2
        page.paste(s, (x, y))
    page.save(HERE / out, resolution=200)


collage("replit", "Replit Proof of Use.pdf")
collage("runpod", "RunPod Proof of Use.pdf")
