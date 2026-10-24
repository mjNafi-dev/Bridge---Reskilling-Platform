"""
Builds "RunPod Proof of Use.pdf" and "Replit Proof of Use.pdf" from the screenshots in submission/screenshots/.
Run from the repo root:   python submission/make_proof_pdf.py
Needs Pillow (pip install pillow).
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
SHOTS = HERE / "screenshots"
META = HERE.parent / "backend" / "data" / "embeddings" / "embeddings_meta.json"

W, H = 1754, 1240  # A4 landscape at 150 dpi
MARGIN = 80


def font(size, bold=False):
    for name in (("arialbd.ttf" if bold else "arial.ttf"), "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def cover(meta):
    page = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(page)
    d.text((MARGIN, MARGIN), "RunPod Proof of Use", font=font(64, True), fill="#111111")
    d.text((MARGIN, MARGIN + 90), "Bridge · SDC Hackathon 2026 · Domain 1", font=font(30), fill="#6B6B70")
    lines = [
        ("Pod name", "bridge-skill-embeddings"),
        ("Pod ID", "f2w43seqazno9r"),
        ("GPU type", f"1x NVIDIA A40 (48 GB VRAM) · reported by the job: {meta['gpu']}"),
        ("Runtime", "Pod uptime 14m 17s at the time of the telemetry screenshot (page 2)"),
        ("Template", "RunPod PyTorch 2.8.0 (CUDA 12.8)"),
        ("What ran on the GPU", "runpod/embed_skills.py: embeds ESCO skills and job titles with "
                                 f"{meta['model']} ({meta['dimensions']} dimensions)"),
        ("Job result", f"{meta['count']} texts embedded on {meta['device'].upper()} in {meta['seconds']} s "
                       f"({meta['created_utc']})"),
        ("Output", "backend/data/embeddings/embeddings.npy + embeddings_meta.json (in this repo)"),
        ("Account", "Team's own RunPod account (username visible on page 5)"),
    ]
    y = MARGIN + 200
    for label, value in lines:
        d.text((MARGIN, y), label, font=font(28, True), fill="#111111")
        d.text((MARGIN + 380, y), value, font=font(28), fill="#3A3A3C")
        y += 58

    # Why a GPU was used
    y += 30
    d.text((MARGIN, y), "Why we used a GPU", font=font(34, True), fill="#111111")
    y += 60
    why = [
        "Bridge tells people which new skill they already partly know. To do that it must recognise that",
        "differently worded skills mean similar things (e.g. \"colour correction\" ~ \"colour grading\").",
        "Plain word matching misses most of these, so we turn every ESCO skill and job title into an",
        "embedding: a list of 384 numbers that captures meaning, computed by a neural network.",
        "Embedding the full catalogue is GPU work, so it ran once as a batch job on RunPod. The results",
        "are stored in the repo; the live app only embeds the user's few phrases on a CPU at request time.",
    ]
    for line in why:
        d.text((MARGIN, y), line, font=font(26), fill="#3A3A3C")
        y += 40
    return page


def replit_cover():
    page = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(page)
    d.text((MARGIN, MARGIN), "Replit Proof of Use", font=font(64, True), fill="#111111")
    d.text((MARGIN, MARGIN + 90), "Bridge · SDC Hackathon 2026 · Domain 1", font=font(30), fill="#6B6B70")
    lines = [
        ("Live deployment", "https://bridge-reskill.replit.app (status: Live, public)"),
        ("Replit project", "https://replit.com/@stewpeed-dev/Bridge-Reskilling-Platform"),
        ("Deployment type", "Reserved VM, 0.5 vCPU / 2 GiB RAM, region Asia"),
        ("Hosting so far", "33.55 compute hours (usage page, Oct 22 - Nov 21 period)"),
        ("Replit AI", "Replit Agent used while building ($0.36); Replit AI Integrations configured, not used"),
        ("Account", "Team's own Replit account (Stewpeed, visible on every page)"),
    ]
    y = MARGIN + 200
    for label, value in lines:
        d.text((MARGIN, y), label, font=font(28, True), fill="#111111")
        d.text((MARGIN + 380, y), value, font=font(28), fill="#3A3A3C")
        y += 58

    y += 30
    d.text((MARGIN, y), "How we use Replit", font=font(34, True), fill="#111111")
    y += 60
    how = [
        "Replit hosts the whole app: one FastAPI server serves the API and the built React app",
        "(.replit runs scripts/start.sh). Every judge-facing link in the README points at this deployment,",
        "and the logs on page 5 show real requests to the matching, pathway and course endpoints.",
    ]
    for line in how:
        d.text((MARGIN, y), line, font=font(26), fill="#3A3A3C")
        y += 40
    return page


def shot_page(path, caption):
    page = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(page)
    d.text((MARGIN, 50), caption, font=font(32, True), fill="#111111")
    img = Image.open(path).convert("RGB")
    box_w, box_h = W - 2 * MARGIN, H - 160
    img.thumbnail((box_w, box_h), Image.LANCZOS)
    page.paste(img, ((W - img.width) // 2, 120 + (box_h - img.height) // 2))
    return page


meta = json.loads(META.read_text(encoding="utf-8"))
pages = [
    cover(meta),
    shot_page(SHOTS / "runpod-1-pod-telemetry-uptime.png", "Pod telemetry: name, Pod ID, A40 GPU, uptime 14m 17s"),
    shot_page(SHOTS / "runpod-2-embedding-job-terminal.png", "Embedding job running on the pod (Jupyter terminal)"),
    shot_page(SHOTS / "runpod-3-pods-list.png", "Pods list: bridge-skill-embeddings, ID f2w43seqazno9r, A40 x1, $0.59/hr"),
    shot_page(SHOTS / "runpod-4-pods-list-account.png", "Pods list with the team's account menu open"),
]


replit_pages = [
    replit_cover(),
    shot_page(SHOTS / "replit-1-publishing-overview.png", "Publishing overview: Live, bridge-reskill.replit.app, publish history"),
    shot_page(SHOTS / "replit-2-usage-overview.png", "Account usage: spend this period, split by AI and hosting"),
    shot_page(SHOTS / "replit-3-usage-per-resource.png", "Usage per resource: 33.55 h Reserved VM deployment, Agent AI"),
    shot_page(SHOTS / "replit-4-deployment-logs.png", "Deployment logs: real requests to /api/match, /pathway, /api/courses"),
]

for name, doc in (("RunPod Proof of Use.pdf", pages), ("Replit Proof of Use.pdf", replit_pages)):
    out = HERE / name
    doc[0].save(out, save_all=True, append_images=doc[1:], resolution=150)
    print(f"Saved {out.name} ({len(doc)} pages)")
