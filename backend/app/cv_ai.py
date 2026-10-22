"""
Optional AI mode for CV reading: Claude reads the CV text and fills the same parts
the rules in cv.py do. Off unless the server sets BRIDGE_CV_AI=1 and has credentials:
  - on Replit: the Anthropic AI integration (AI_INTEGRATIONS_ANTHROPIC_API_KEY / _BASE_URL)
  - anywhere else: ANTHROPIC_API_KEY
BRIDGE_AI_MODEL picks the model (default claude-opus-5-5).
Only the CV text is sent, never the file. Any error -> cv.py falls back to the rules.
"""

import json
import os

MODEL = os.environ.get("BRIDGE_AI_MODEL", "claude-opus-5-5")
EDU_LEVELS = ["SPM", "STPM / A-Levels / Foundation", "Certificate (TVET / SKM)", "Diploma", "Bachelor's degree",
              "Master's degree", "PhD", "Self-taught"]
EDU_TYPES = ["University", "TVET / polytechnic", "College", "Online / self-taught"]
INDUSTRIES = ["Creative & media", "Education", "Finance & banking", "Government & public sector", "Healthcare",
              "Hospitality & tourism", "IT & software", "Logistics & transport", "Manufacturing",
              "Oil, gas & energy", "Retail & e-commerce", "Telecommunications", "Other"]

S = {"type": "string"}
SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["education", "roles", "skills", "languages", "courses", "projects", "hobbies"],
    "properties": {
        "education": {
            "type": "object", "additionalProperties": False,
            "required": ["level", "field", "type", "year"],
            "properties": {
                "level": {"type": "string", "enum": EDU_LEVELS + [""]},
                "field": S, "type": {"type": "string", "enum": EDU_TYPES + [""]}, "year": S,
            },
        },
        "roles": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "required": ["title", "industry", "start", "end", "current", "tasks", "tools"],
            "properties": {
                "title": S, "industry": {"type": "string", "enum": INDUSTRIES + [""]},
                "start": S, "end": S, "current": {"type": "boolean"},
                "tasks": {"type": "array", "items": S}, "tools": {"type": "array", "items": S},
            },
        }},
        "skills": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["name", "level"],
            "properties": {"name": S, "level": {"type": "integer", "enum": [0, 1, 2, 3]}},
        }},
        "languages": {"type": "array", "items": S},
        "courses": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["name", "provider", "year"],
            "properties": {"name": S, "provider": S, "year": S},
        }},
        "projects": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["what", "role", "skills"],
            "properties": {"what": S, "role": S, "skills": {"type": "array", "items": S}},
        }},
        "hobbies": {"type": "array", "items": S},
    },
}

PROMPT = """Read this CV and fill in the fields for a career-change app.

- education: the highest level only. "level" and "type" must be one of the allowed values, or "" if unknown. "field" is the subject, e.g. "Graphic design". "year" is the year finished or expected.
- roles: every job, internship or freelance role, newest first. "start" and "end" as YYYY-MM (or YYYY); "current" is true if it's ongoing. "tasks" are short phrases of what the person actually did (max 8). "tools" are software or equipment named for that role.
- skills: skills the CV lists or clearly shows, as short names (1-4 words). "level": 1 = basics, 2 = comfortable, 3 = expert/could teach. Use 2 for skills used at work, 1 if only listed.
- languages: spoken languages only. courses: certificates and courses. projects: side projects, clubs, volunteering. hobbies: from an interests section only.
- Leave a list empty when the CV has nothing for it. Never include the person's name, contact details or address anywhere.

CV text:
"""


def enabled():
    if os.environ.get("BRIDGE_CV_AI") != "1":
        return False
    return bool(os.environ.get("AI_INTEGRATIONS_ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY"))


def client():
    import anthropic

    if os.environ.get("AI_INTEGRATIONS_ANTHROPIC_API_KEY"):
        return anthropic.Anthropic(
            api_key=os.environ["AI_INTEGRATIONS_ANTHROPIC_API_KEY"],
            base_url=os.environ.get("AI_INTEGRATIONS_ANTHROPIC_BASE_URL"),
        )
    return anthropic.Anthropic()


def ask(text):
    import anthropic

    request = dict(
        model=MODEL,
        max_tokens=16000,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": PROMPT + text[:30000]}],
    )
    c = client()
    try:
        # A declined request is retried on a fallback model inside the same call
        response = c.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **request)
    except anthropic.BadRequestError:
        response = c.messages.create(**request)  # e.g. a proxy that doesn't pass the fallback beta through
    if response.stop_reason in ("refusal", "max_tokens"):
        raise RuntimeError(f"AI stopped: {response.stop_reason}")
    return json.loads(next(b.text for b in response.content if b.type == "text"))


def months(value, end=False):
    """'2021-03' or '2021' -> months since year 0 (the same unit cv.py uses)."""
    try:
        year, _, month = str(value).partition("-")
        return int(year) * 12 + (int(month) - 1 if month else (11 if end else 0))
    except ValueError:
        return None


def read(text):
    """CV text -> the raw parts cv.build_profile expects."""
    from datetime import date

    data = ask(text)
    now = date.today().year * 12 + date.today().month - 1
    roles = []
    for r in data["roles"]:
        if not r["title"].strip():
            continue
        role = {"title": r["title"].strip(), "tasks": r["tasks"][:8], "tools": r["tools"][:10]}
        if r["industry"]:
            role["industry"] = r["industry"]
        start, end = months(r["start"]), now if r["current"] else months(r["end"], end=True)
        if start is not None and end is not None and end >= start:
            role["years"] = str(max(1, round((end - start + 1) / 12)))
            role["_end"], role["_current"] = end, r["current"]
        roles.append(role)
    e = data["education"]
    edu = {k: v for k, v in (("eduLevel", e["level"]), ("eduField", e["field"]), ("eduType", e["type"]),
                              ("eduYear", e["year"][:4])) if v}
    courses = [{k: v for k, v in c.items() if v} for c in data["courses"] if c["name"]]
    projects = [{k: v for k, v in p.items() if v} for p in data["projects"] if p["what"]]
    return {
        "roles": roles,
        "edu": edu,
        "skills": [(s["name"], s["level"]) for s in data["skills"] if s["name"].strip()],
        "languages": data["languages"],
        "courses": courses[:10],
        "projects": projects[:6],
        "hobbies": data["hobbies"][:8],
    }
