"""
CV reading: turns an uploaded CV (PDF, Word or text) into onboarding answers.

1. Text out of the file (pypdf / python-docx). The file is read in memory and never saved.
2. Split the text into sections by their headings (Experience, Education, Skills...).
3. Rules pull out roles (title, years, tasks, tools), education, skills, languages,
   courses, projects and hobbies. Name, country and age range (from a birth year) pre-fill
   About you; email, phone and street address are never read.
4. Every skill is matched to the official ESCO skill list by meaning (same embeddings
   as matching), so "Photo retouching" lines up with ESCO's "edit photographs".

Optional AI mode (cv_ai.py) does step 3 with Claude instead of rules, when the server
has credentials. Steps 1, 2 and 4 stay the same, and any AI failure falls back to rules.
"""

import re
from datetime import date
from functools import lru_cache
from io import BytesIO

import numpy as np

from .embeddings import get_embeddings

ACCEPTED = (".pdf", ".docx", ".txt")
MAX_BYTES = 5 * 1024 * 1024
THIS_YEAR = date.today().year


def is_list_paragraph(p):
    style = (p.style.name if p.style is not None else "") or ""
    return "List" in style or p._p.pPr is not None and p._p.pPr.numPr is not None


class CvError(ValueError):
    """Something the user can fix (wrong type, empty or scanned file). Message is shown as-is."""


# ---------------------------------------------------------------- 1. text out of the file

def extract_text(filename, data):
    ext = filename[filename.rfind("."):].lower() if "." in filename else ""
    if ext not in ACCEPTED:
        raise CvError("Please use a PDF, Word (.docx) or text file.")
    if len(data) > MAX_BYTES:
        raise CvError("That file is over 5 MB. Try a smaller one.")
    try:
        if ext == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(data))
            text = "\n".join(page.extract_text() or "" for page in reader.pages[:10])
        elif ext == ".docx":
            import docx

            doc = docx.Document(BytesIO(data))
            # list paragraphs carry no bullet character in their text, so add one back
            lines = [("• " if is_list_paragraph(p) else "") + p.text for p in doc.paragraphs]
            for table in doc.tables:  # CV templates often lay sections out in tables
                for row in table.rows:
                    for cell in row.cells:
                        lines.extend(p.text for p in cell.paragraphs)
            text = "\n".join(lines)
        else:
            text = data.decode("utf-8", errors="replace")
    except CvError:
        raise
    except Exception:
        raise CvError("We couldn't open that file. It may be damaged or password-protected.")
    if len(re.sub(r"\s", "", text)) < 80:
        raise CvError("We couldn't find any text in that file. If it's a scanned image, try a Word or text version instead.")
    return text


# ---------------------------------------------------------------- 2. sections

SECTION_NAMES = {
    "summary": ["summary", "profile", "about me", "professional summary", "career summary", "objective",
                "career objective", "personal statement", "about"],
    "experience": ["experience", "work experience", "employment", "employment history", "professional experience",
                   "work history", "career history", "relevant experience", "internship", "internships",
                   "internship experience", "working experience"],
    "education": ["education", "academic background", "qualifications", "education & training",
                  "academic qualifications", "educational background", "academic history"],
    "skills": ["skills", "key skills", "technical skills", "core skills", "competencies", "core competencies",
               "skills & tools", "skills & abilities", "tools", "software", "tools & software",
               "technologies", "technical proficiencies", "expertise", "areas of expertise", "skill set",
               "skills & competencies", "technical skills & tools", "soft skills", "hard skills"],
    "languages": ["languages", "language", "language skills", "languages spoken"],
    "courses": ["certifications", "certificates", "certification", "courses", "training", "licenses & certifications",
                "licences & certifications", "professional development", "certifications & courses",
                "courses & certifications", "online courses", "certifications & training", "trainings"],
    "projects": ["projects", "volunteering", "volunteer experience", "volunteer work", "extracurricular activities",
                 "extra-curricular activities", "activities", "leadership", "side projects", "personal projects",
                 "projects & volunteering", "leadership & activities", "co-curricular activities", "portfolio",
                 "academic projects", "freelance work", "freelance"],
    "hobbies": ["interests", "hobbies", "hobbies & interests", "interests & hobbies", "personal interests"],
    "other": ["references", "referees", "awards", "achievements", "awards & achievements", "publications",
              "contact", "contact details", "personal details", "personal information", "personal particulars"],
}
HEADINGS = {name: section for section, names in SECTION_NAMES.items() for name in names}

BULLET_RE = re.compile(r"^\s*(?:[•●▪■◦○‣⁃∙·*\-–—>]|\d{1,2}[.)])\s+")


def heading_of(line):
    """The section a line starts, if the whole line is a heading ("WORK EXPERIENCE", "Skills:")."""
    t = line.strip().rstrip(":").strip().lower().replace(" and ", " & ")
    t = re.sub(r"[^a-z&\- ]", "", t).strip()
    t = re.sub(r"\s+", " ", t)
    if not t or len(t.split()) > 4:
        return None
    return HEADINGS.get(t)


def split_sections(text):
    """{section: [lines]}. Lines before the first heading (name, contact) go to "top" and are ignored."""
    sections, current = {"top": []}, "top"
    for raw in text.splitlines():
        line = raw.replace(" ", " ").replace("\t", " ").strip()
        if not line:
            continue
        found = heading_of(line)
        if found:
            current = found
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)
    return sections


def is_bullet(line):
    return bool(BULLET_RE.match(line))


def unbullet(line):
    return BULLET_RE.sub("", line).strip()


# ---------------------------------------------------------------- dates

MONTH = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
ONE_DATE = rf"(?:{MONTH}\s*,?\s*)?(?:19|20)\d{{2}}|\d{{1,2}}/(?:19|20)\d{{2}}"
NOW = r"present|current|now|today|ongoing|to date|date"
RANGE_RE = re.compile(rf"\(?\s*({ONE_DATE})\s*(?:-|–|—|to|until|till)\s*({ONE_DATE}|{NOW})\s*\)?", re.I)
YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")
MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


def to_months(text, end=False):
    """'Jan 2021' -> months since year 0; a bare year counts as Jan (start) or Dec (end)."""
    t = text.lower()
    if re.search(NOW, t):
        today = date.today()
        return today.year * 12 + today.month - 1
    year = int(YEAR_RE.search(t).group())
    m = re.match(r"(\d{1,2})/", t)
    if m:
        month = int(m.group(1)) - 1
    else:
        month = next((i for i, name in enumerate(MONTHS) if name in t[:5]), 11 if end else 0)
    return year * 12 + month


def find_range(text):
    """(start_months, end_months, is_current, matched_text) or None."""
    m = RANGE_RE.search(text)
    if not m:
        return None
    start, end = to_months(m.group(1)), to_months(m.group(2), end=True)
    return start, max(end, start), bool(re.search(NOW, m.group(2), re.I)), m.group(0)


def last_used_label(end_months, current):
    if current:
        return "This year"
    years_ago = THIS_YEAR - end_months // 12
    return "This year" if years_ago < 1 else "1–3 years ago" if years_ago <= 3 else "3+ years ago"


# ---------------------------------------------------------------- vocabularies

TOOLS = [
    "Photoshop", "Illustrator", "InDesign", "Lightroom", "Premiere Pro", "After Effects", "Adobe XD", "Figma",
    "Canva", "Sketch", "CorelDRAW", "Procreate", "Blender", "Final Cut Pro", "DaVinci Resolve", "CapCut",
    "Excel", "Word", "PowerPoint", "Outlook", "Microsoft Office", "Microsoft 365", "Google Sheets", "Google Docs",
    "Google Slides", "Google Workspace", "Google Analytics", "Google Ads", "Looker Studio", "Tableau", "Power BI",
    "SQL", "MySQL", "PostgreSQL", "MongoDB", "Python", "R", "Java", "JavaScript", "TypeScript", "C++", "C#", "PHP",
    "Kotlin", "Swift", "Go", "React", "Angular", "Vue", "Node.js", "Django", "Flask", "Laravel", "Flutter",
    "HTML", "CSS", "Git", "GitHub", "GitLab", "Docker", "Kubernetes", "AWS", "Azure", "Google Cloud", "Firebase",
    "Linux", "Jira", "Trello", "Asana", "Notion", "Slack", "Airtable", "Zoom", "SAP", "Salesforce", "HubSpot",
    "Mailchimp", "Hootsuite", "Meta Business Suite", "WordPress", "Shopify", "Wix", "AutoCAD", "SolidWorks",
    "SketchUp", "Revit", "MATLAB", "SPSS", "Stata", "Pandas", "NumPy", "TensorFlow", "PyTorch", "scikit-learn",
    "Jupyter", "QuickBooks", "Xero", "MYOB", "SQL Accounting", "AutoCount", "Unity", "Unreal Engine", "Postman",
    "VS Code", "Arduino", "Raspberry Pi", "Zendesk", "Freshdesk", "Odoo", "Oracle", "Power Automate", "Zapier",
]
TOOL_RES = [(t, re.compile(rf"(?<![\w.+#]){re.escape(t)}(?![\w+#])", re.I if len(t) > 2 else 0)) for t in TOOLS]
TOOL_KEYS = {t.lower() for t in TOOLS}

TITLE_WORDS = {
    "designer", "engineer", "developer", "manager", "assistant", "executive", "officer", "analyst", "intern",
    "teacher", "lecturer", "consultant", "specialist", "coordinator", "technician", "administrator", "admin",
    "clerk", "accountant", "editor", "writer", "cashier", "supervisor", "lead", "head", "director", "associate",
    "representative", "nurse", "operator", "agent", "architect", "scientist", "researcher", "trainee",
    "programmer", "tutor", "photographer", "marketer", "planner", "chef", "cook", "driver", "barista",
    "receptionist", "secretary", "president", "founder", "owner", "freelancer", "freelance", "volunteer",
    "advisor", "adviser", "auditor", "bookkeeper", "strategist", "producer", "animator", "illustrator",
    "copywriter", "promoter", "crew", "waiter", "waitress", "server", "attendant", "mechanic", "electrician",
    "storekeeper", "merchandiser", "recruiter", "trainer", "instructor", "counsellor", "counselor", "pharmacist",
    "therapist", "doctor", "inspector", "surveyor", "draughtsman", "draftsman", "videographer", "chairperson",
    "treasurer", "member", "ambassador", "artist", "officer", "staff", "worker", "helper", "apprentice",
}
COMPANY_WORDS = re.compile(
    r"\b(sdn\.? bhd\.?|bhd\.?|berhad|ltd\.?|limited|inc\.?|llc|plc|pte\.?|corp\.?|corporation|company|co\.|group|"
    r"studio|agency|enterprise|enterprises|solutions|technologies|technology|bank|university|universiti|school|"
    r"college|kolej|hospital|clinic|hotel|resort|restaurant|cafe|café|store|mart|holdings|industries|services|"
    r"consulting|media|labs?|foundation|council|ministry|kementerian|jabatan|club)\b", re.I)

INDUSTRY_WORDS = [
    ("Creative & media", r"design|studio|media|agency|creative|photo|video|film|publish|advertis|print|brand|animation"),
    ("IT & software", r"software|developer|\bit\b|tech|web|data|cloud|system|programm|digital|app\b|cyber"),
    ("Education", r"school|universit|college|kolej|teacher|tutor|lecturer|academy|education|tuition"),
    ("Finance & banking", r"bank|financ|account|audit|insurance|takaful|invest|tax"),
    ("Healthcare", r"hospital|clinic|health|nurse|medical|pharma|dental|care centre"),
    ("Hospitality & tourism", r"hotel|restaurant|cafe|café|travel|touris|resort|chef|barista|catering|food & beverage|f&b"),
    ("Retail & e-commerce", r"retail|store|shop|e-?commerce|mart|mall|cashier|boutique|supermarket"),
    ("Logistics & transport", r"logistic|transport|shipping|warehouse|delivery|freight|courier|driver|airline|port"),
    ("Manufacturing", r"manufactur|factory|plant|production|assembly|semiconductor|electronics"),
    ("Oil, gas & energy", r"oil|gas|petrol|energy|power|solar|utilit"),
    ("Telecommunications", r"telecom|telco|mobile network|broadband"),
    ("Government & public sector", r"ministry|kementerian|government|council|majlis|jabatan|public sector|agency of"),
]

EDU_LEVELS = [  # highest first; labels match the onboarding options
    ("PhD", r"\bph\.?\s?d\b|doctor of philosophy|doctorate"),
    ("Master's degree", r"\bmasters?\b|\bm\.?sc\b|\bmba\b|\bm\.?eng\b|\bm\.?ed\b|\bm\.?a\.? in\b"),
    ("Bachelor's degree", r"\bbachelor|\bb\.?sc\b|\bb\.?eng\b|\bb\.?ed\b|\bbba\b|\bb\.?a\.?\s?\(?hons|\bb\.?a\.? in\b"
                          r"|\bdegree\b|\bb\.?comp|\bb\.?tech|\bllb\b|\bijazah"),
    ("Diploma", r"\bdiploma\b"),
    ("Certificate (TVET / SKM)", r"\bskm\b|\bsijil kemahiran|\btvet\b|\bcertificate\b|\bdkm\b"),
    ("STPM / A-Levels / Foundation", r"\bstpm\b|\ba[- ]?levels?\b|\bfoundation\b|matriculation|matrikulasi|\bib\b"),
    ("SPM", r"\bspm\b|\bo[- ]?levels?\b|\bigcse\b|high school|secondary school|sekolah menengah"),
]
DEGREE_WORDS = re.compile(
    r"\b(bachelor(?:'s)?|master(?:'s)?|diploma|advanced diploma|certificate|degree|foundation|ph\.?\s?d|doctorate|"
    r"b\.?sc|m\.?sc|b\.?eng|m\.?eng|b\.?a|m\.?a|b\.?ed|m\.?ed|bba|mba|b\.?comp|llb|skm|stpm|spm|"
    r"a[- ]?levels?|o[- ]?levels?|igcse|hons|honours|\(hons\)|of science|of arts|of engineering|"
    r"of business administration|in progress|expected)\b\.?", re.I)

PROVIDERS = [
    "Coursera", "Udemy", "edX", "LinkedIn Learning", "Google", "Microsoft", "AWS", "Amazon Web Services", "HRD Corp",
    "HRDF", "Khan Academy", "FutureLearn", "Cisco", "CompTIA", "IBM", "Meta", "HubSpot Academy", "HubSpot", "Adobe",
    "Skillshare", "Domestika", "Codecademy", "freeCodeCamp", "DataCamp", "PMI", "Oracle", "Alison", "Great Learning",
    "Simplilearn", "Udacity", "MDEC", "Kaggle", "Salesforce", "Tableau", "Canva", "Open University Malaysia",
]

LEVEL_WORDS = [  # skill annotations -> onboarding level index (0 heard of it .. 3 could teach it)
    (3, r"expert|advanced|mastery|professional"),
    (2, r"proficient|intermediate|strong|good|fluent|experienced"),
    (1, r"basic|beginner|elementary|familiar|working knowledge|learning"),
]
LANGUAGE_NAMES = {
    "english", "malay", "bahasa melayu", "bahasa malaysia", "mandarin", "chinese", "cantonese", "hokkien",
    "tamil", "hindi", "arabic", "japanese", "korean", "french", "german", "spanish", "indonesian",
    "bahasa indonesia", "thai", "vietnamese", "urdu", "bengali", "punjabi", "telugu", "malayalam", "tagalog",
    "filipino", "portuguese", "italian", "russian", "turkish", "dutch", "hakka", "teochew", "iban", "kadazan",
}


# ---------------------------------------------------------------- helpers

def tools_in(text):
    return [name for name, rx in TOOL_RES if rx.search(text)]


def clean(text, limit=120):
    t = re.sub(r"\s+", " ", text).strip(" .;,:-–—|•")
    if len(t) > limit:  # keep the first clause of very long lines
        t = re.split(r"[;:]|, (?:and|which|while)\b", t)[0].strip()
        t = t[:limit].rsplit(" ", 1)[0] if len(t) > limit else t
    return t


def split_items(text):
    """'A, B (x, y); C | D • E' -> items. Keeps brackets, 'UI/UX' and 'Layout & composition' whole."""
    parts, depth, cur = [], 0, ""
    for ch in re.sub(r"\s{3,}", ", ", text):
        depth += ch == "(" or -(ch == ")" and depth > 0)
        if depth == 0 and ch in ",;|•●▪·":
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [p.strip(" .-–—:") for p in parts if p.strip(" .-–—:")]


def split_label(line):
    """'Software: Photoshop, Canva' -> ('software', 'Photoshop, Canva'); short labels only."""
    m = re.match(r"^([A-Za-z&/ ]{2,30}):\s*(.+)$", line)
    return (m.group(1).strip().lower(), m.group(2)) if m and len(m.group(1).split()) <= 3 else ("", line)


def strip_label(line):
    return split_label(line)[1]


TOOL_LABEL = re.compile(r"^(?:tools?|software|applications?|apps|programs|platforms|tools & software|software & tools)$")


def level_from(text):
    t = text.lower()
    return next((lvl for lvl, rx in LEVEL_WORDS if re.search(rx, t)), None)


def strip_level(text):
    t = re.sub(r"\((?:[^)]*)\)", "", text)  # "(Advanced)", "(3 years)"
    t = re.sub(r"\s*[-–—:]\s*(expert|advanced|proficient|intermediate|basic|beginner|fluent|native|good|"
               r"conversational|elementary|professional|business|working|limited|mother tongue|first language|\d+\+? ?(?:years?|yrs?)).*$", "", t, flags=re.I)
    return t.strip(" .-–—:")


INFO_LINE = re.compile(r"^(?:tools|software|technologies|tech stack|skills|key skills)(?: used)?\s*:", re.I)


def blocks(lines):
    """Group lines into entries: header lines followed by their bullet lines."""
    out, cur = [], None
    for line in lines:
        if cur and cur["bullets"] and not is_bullet(line):
            # a wrapped bullet ("...for retail" / "clients") or a "Tools: ..." line still belongs to this entry
            if line[0].islower() and not find_range(line):
                cur["bullets"][-1] += " " + line
                continue
            if INFO_LINE.match(line):
                cur["bullets"].append(line)
                continue
        if is_bullet(line):
            if cur is None:
                cur = {"head": [], "bullets": []}
                out.append(cur)
            cur["bullets"].append(unbullet(line))
        else:
            if cur is None or cur["bullets"] or (find_range(line) and any(find_range(h) for h in cur["head"])):
                cur = {"head": [], "bullets": []}
                out.append(cur)
            cur["head"].append(line)
    return out


def merge_dateless(entries):
    """A header block with no dates and no bullets usually belongs to the next block (title above company+dates)."""
    out = []
    pending = []
    for e in entries:
        has_date = any(find_range(h) for h in e["head"])
        if not has_date and not e["bullets"] and len(e["head"]) <= 2:
            pending.extend(e["head"])
            continue
        if pending:
            e = {"head": pending + e["head"], "bullets": e["bullets"]}
            pending = []
        out.append(e)
    if pending and out:
        out[-1]["bullets"].extend(pending)
    return out


# ---------------------------------------------------------------- 3. the parts

TASK_VERB = r"^(?:\w+ed|built|wrote|led|ran|made|set|taught|kept|did|sold|drove|won|grew|cut|met|sent|took|gave|" \
            r"handled|oversaw|undertook|managing|leading|building|creating|designing|developing|supporting)\b"


def title_score(part):
    words = set(re.findall(r"[a-z]+", part.lower()))
    score = 2.0 * len(words & TITLE_WORDS)
    if COMPANY_WORDS.search(part):
        score -= 2.5
    if len(part.split()) > 6:
        score -= 1.0
    return score


def best_title(parts):
    """Pick the job title among header pieces, using title words and, as a tie-break, ESCO job names."""
    if not parts:
        return ""
    scores = np.array([title_score(p) for p in parts], dtype=np.float32)
    emb = get_embeddings()
    if emb is not None and len(parts) > 1:
        try:
            vecs = emb.encode(parts)
            occ = occupation_matrix()
            scores += 1.5 * emb.rescale((vecs @ occ.T).max(axis=1))
        except Exception:
            pass
    return parts[int(scores.argmax())]


def header_parts(head_lines):
    text = " | ".join(head_lines)
    rng = find_range(text)
    if rng:
        text = text.replace(rng[3], " | ")
    text = re.sub(r"\b(?:19|20)\d{2}\b", " ", text)
    parts = re.split(r"\s+[|–—]\s+|\s+-\s+|\s*\|\s*|,\s+|\s+@\s+|\s+at\s+(?=[A-Z])|\s{3,}", text)
    return [p.strip(" ,.-–—()") for p in parts if len(p.strip(" ,.-–—()")) > 1], rng


def guess_industry(text):
    t = text.lower()
    return next((name for name, rx in INDUSTRY_WORDS if re.search(rx, t)), None)


def parse_roles(lines):
    roles = []
    for e in merge_dateless(blocks(lines)):
        parts, rng = header_parts(e["head"])
        # long or verb-first header pieces are descriptions, not titles
        is_task = lambda p: len(p.split()) > 7 or (len(p.split()) >= 4 and re.match(TASK_VERB, p, re.I))
        title_parts = [p for p in parts if not is_task(p)]
        if not title_parts:
            continue
        title = best_title(title_parts)
        rest = [p for p in parts if p != title]
        company = next((p for p in rest if COMPANY_WORDS.search(p)), rest[0] if rest else "")
        tasks = [clean(b) for b in e["bullets"]]
        tasks += [clean(s) for p in parts if is_task(p) for s in re.split(r"(?<=[.!?])\s+", p)]
        tasks = [t for t in tasks if len(t) > 3 and not re.match(r"^(tools|software|skills)\s*:", t, re.I)]
        block_text = " ".join(e["head"] + e["bullets"])
        role = {"title": clean(title, 60), "tasks": dedupe(tasks)[:8], "tools": tools_in(block_text)}
        industry = guess_industry(company) or guess_industry(title)
        if industry:
            role["industry"] = industry
        if rng:
            role["years"] = str(max(1, round((rng[1] - rng[0] + 1) / 12)))
            role["_end"], role["_current"] = rng[1], rng[2]
        roles.append(role)
    return roles


def parse_education(lines):
    if not lines:
        return {}
    best = None
    for i, line in enumerate(lines):
        for rank, (label, rx) in enumerate(EDU_LEVELS):
            if re.search(rx, line, re.I):
                if best is None or rank < best[0]:
                    best = (rank, label, i)
                break
    if best is None:
        return {}
    _, label, i = best
    edu = {"eduLevel": label}
    line = lines[i]
    block = " ".join(lines[max(0, i - 1): i + 3])

    # Field of study: the piece of the degree line that holds the degree, minus the degree words
    pieces = re.split(r"\s+[|–—]\s+|\s+-\s+|,\s+|\s{3,}", RANGE_RE.sub(" ", line))
    piece = next((p for p in pieces if re.search(EDU_LEVELS[best[0]][1], p, re.I)), line)
    m = re.search(r"\bin\s+(.+)$", piece, re.I) or re.search(r"\bof\s+(?!science\b|arts\b|engineering\b)(.+)$", piece, re.I)
    field = m.group(1) if m else DEGREE_WORDS.sub(" ", piece)
    field = re.sub(r"\((?:hons?|honours)\)|\bhons\b|\b(?:19|20)\d{2}\b|\bcgpa.*$|\bgpa.*$", " ", field, flags=re.I)
    field = clean(re.sub(r"\s+", " ", field), 60)
    if field and len(field.split()) <= 7 and not COMPANY_WORDS.search(field):
        edu["eduField"] = field[0].upper() + field[1:]

    b = block.lower()
    if re.search(r"universit", b):
        edu["eduType"] = "University"
    elif re.search(r"polytechnic|politeknik|tvet|vocational|kemahiran|\bikm\b|adtec|\bilp\b", b):
        edu["eduType"] = "TVET / polytechnic"
    elif re.search(r"college|kolej|institute|institut", b):
        edu["eduType"] = "College"
    elif re.search(r"online|coursera|udemy|self-taught|self taught", b):
        edu["eduType"] = "Online / self-taught"

    years = [int(y) for y in YEAR_RE.findall(block) if int(y) <= THIS_YEAR + 6]
    if years:
        edu["eduYear"] = str(max(years))
    return edu


def parse_skill_lines(lines):
    """Skills section -> ([(name, level or None)], [tools from 'Software:' lines])."""
    out, tools = [], []
    for line in lines:
        label, text = split_label(unbullet(line))
        if TOOL_LABEL.match(label):
            tools += [strip_level(t) for t in split_items(text)]
            continue
        text = re.sub(r"^(?:proficient|skilled|experienced|competent)\s+(?:in|with)\s+", "", text, flags=re.I)
        for item in split_items(text):
            for sub in re.split(r"\s+and\s+(?=[A-Z])", item):
                name = strip_level(sub)
                if 1 < len(name) <= 40 and len(name.split()) <= 5:
                    out.append((name[0].upper() + name[1:], level_from(sub)))
    return out, [t for t in tools if t]


def parse_languages(lines):
    out = []
    for line in lines:
        for item in split_items(strip_label(unbullet(line))):
            name = strip_level(item)
            if name and len(name.split()) <= 3 and not re.search(r"\d", name):
                out.append(name[0].upper() + name[1:])
    return dedupe(out)


def parse_courses(lines):
    courses = []
    for line in lines:
        line = unbullet(line)
        if len(line) < 4:
            continue
        course = {}
        years = YEAR_RE.findall(line)
        if years:
            course["year"] = years[-1]
        provider = next((p for p in PROVIDERS if re.search(rf"\b{re.escape(p)}\b", line)), None)
        name = RANGE_RE.sub(" ", line)
        name = YEAR_RE.sub(" ", name)
        parts = [p.strip(" ,.-–—()|") for p in re.split(r"\s+[|–—]\s+|\s+-\s+|,\s+|\(|\)|\s{3,}", name)]
        parts = [p for p in parts if len(p) > 1]
        if not parts:
            continue
        if not provider and len(parts) > 1:
            provider = parts[1]
        course["name"] = clean(parts[0], 80)
        if provider and provider != course["name"]:
            course["provider"] = clean(provider, 40)
        courses.append(course)
    return courses[:10]


def parse_projects(lines, skill_names):
    projects = []
    for e in blocks(lines):
        head = " ".join(e["head"]) if e["head"] else (e["bullets"][0] if e["bullets"] else "")
        what = clean(RANGE_RE.sub(" ", head), 90)
        if not what:
            continue
        detail = e["bullets"] if e["head"] else e["bullets"][1:]
        text = " ".join(e["head"] + e["bullets"]).lower()
        used = tools_in(text) + [s for s in skill_names if s.lower() in text]
        project = {"what": what}
        if detail:
            project["role"] = clean("; ".join(detail), 120)
        if used:
            project["skills"] = dedupe(used)[:6]
        projects.append(project)
    return projects[:6]


def parse_hobbies(lines):
    items = []
    for line in lines:
        items += [strip_level(i) for i in split_items(strip_label(unbullet(line)))]
    return dedupe([i[0].upper() + i[1:] for i in items if i and len(i.split()) <= 4])[:8]


def dedupe(items):
    seen, out = set(), []
    for item in items:
        key = item.lower() if isinstance(item, str) else item
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


def read_rules(text):
    """The whole CV -> raw parts (before ESCO matching and skill levels)."""
    sec = split_sections(text)
    roles = parse_roles(sec.get("experience", []))
    edu = parse_education(sec.get("education", []))
    if not edu:  # no Education heading: look anywhere except courses
        edu = parse_education([l for s, ls in sec.items() if s not in ("courses", "experience") for l in ls])
    skill_lines = sec.get("skills", [])
    raw_skills, listed_tools = parse_skill_lines(skill_lines)
    # Tools listed under Skills go on the newest role (or count as skills when there's no role)
    if roles:
        known = {t.lower() for r in roles for t in r["tools"]}
        newest = max(roles, key=lambda r: (r.get("_current", False), r.get("_end", 0)))
        newest["tools"] = dedupe(newest["tools"] + [t for t in listed_tools if t.lower() not in known])
    else:
        raw_skills += [(t, None) for t in listed_tools]
    langs = parse_languages(sec.get("languages", []))
    if not langs:  # "Languages: English, Malay" on a line of its own
        for line in text.splitlines():
            m = re.match(r"^\s*languages?\s*(?:spoken)?\s*:\s*(.+)$", line, re.I)
            if m and any(n in m.group(1).lower() for n in LANGUAGE_NAMES):
                langs = parse_languages([m.group(1)])
                break
    # spoken languages listed among skills move to languages
    spoken = [n for n, _ in raw_skills if strip_level(n).lower() in LANGUAGE_NAMES]
    raw_skills = [(n, lv) for n, lv in raw_skills if n not in spoken]
    langs = dedupe(langs + spoken)
    return {
        "roles": roles,
        "edu": edu,
        "skills": raw_skills,
        "languages": langs,
        "courses": parse_courses(sec.get("courses", [])),
        "projects": parse_projects(sec.get("projects", []), [n for n, _ in raw_skills]),
        "hobbies": parse_hobbies(sec.get("hobbies", [])),
    }


# ---------------------------------------------------------------- 3b. About-you pre-fill

# Same English names as the onboarding country list (frontend steps.js, from Intl.DisplayNames)
COUNTRIES = (
    'Afghanistan|Albania|Algeria|Andorra|Angola|Antigua & Barbuda|Argentina|Armenia|Australia|Austria|Aze'
    'rbaijan|Bahamas|Bahrain|Bangladesh|Barbados|Belarus|Belgium|Belize|Benin|Bhutan|Bolivia|Bosnia &'
    'Herzegovina|Botswana|Brazil|Brunei|Bulgaria|Burkina Faso|Burundi|Cape'
    'Verde|Cambodia|Cameroon|Canada|Central African Republic|Chad|Chile|China|Colombia|Comoros|Congo -'
    'Brazzaville|Congo - Kinshasa|Costa Rica|Côte'
    'd’Ivoire|Croatia|Cuba|Cyprus|Czechia|Denmark|Djibouti|Dominica|Dominican Republic|Ecuador|Egypt|El'
    'Salvador|Equatorial Guinea|Eritrea|Estonia|Eswatini|Ethiopia|Fiji|Finland|France|Gabon|Gambia|Georgi'
    'a|Germany|Ghana|Greece|Grenada|Guatemala|Guinea|Guinea-Bissau|Guyana|Haiti|Honduras|Hong Kong SAR Ch'
    'ina|Hungary|Iceland|India|Indonesia|Iran|Iraq|Ireland|Israel|Italy|Jamaica|Japan|Jordan|Kazakhstan|K'
    'enya|Kiribati|Kuwait|Kyrgyzstan|Laos|Latvia|Lebanon|Lesotho|Liberia|Libya|Liechtenstein|Lithuania|Lu'
    'xembourg|Macao SAR China|Madagascar|Malawi|Malaysia|Maldives|Mali|Malta|Marshall Islands|Mauritania|'
    'Mauritius|Mexico|Micronesia|Moldova|Monaco|Mongolia|Montenegro|Morocco|Mozambique|Myanmar'
    '(Burma)|Namibia|Nauru|Nepal|Netherlands|New Zealand|Nicaragua|Niger|Nigeria|North Korea|North'
    'Macedonia|Norway|Oman|Pakistan|Palau|Palestinian Territories|Panama|Papua New'
    'Guinea|Paraguay|Peru|Philippines|Poland|Portugal|Puerto Rico|Qatar|Romania|Russia|Rwanda|St. Kitts &'
    'Nevis|St. Lucia|St. Vincent & Grenadines|Samoa|San Marino|São Tomé & Príncipe|Saudi'
    'Arabia|Senegal|Serbia|Seychelles|Sierra Leone|Singapore|Slovakia|Slovenia|Solomon'
    'Islands|Somalia|South Africa|South Korea|South Sudan|Spain|Sri Lanka|Sudan|Suriname|Sweden|Switzerla'
    'nd|Syria|Taiwan|Tajikistan|Tanzania|Thailand|Timor-Leste|Togo|Tonga|Trinidad &'
    'Tobago|Tunisia|Türkiye|Turkmenistan|Tuvalu|Uganda|Ukraine|United Arab Emirates|United Kingdom|United'
    'States|Uruguay|Uzbekistan|Vanuatu|Vatican City|Venezuela|Vietnam|Yemen|Zambia|Zimbabwe'
).split("|")
COUNTRY_ALIASES = {
    "uk": "United Kingdom", "u.k.": "United Kingdom", "england": "United Kingdom", "great britain": "United Kingdom",
    "usa": "United States", "u.s.a.": "United States", "united states of america": "United States",
    "uae": "United Arab Emirates", "korea": "South Korea", "republic of korea": "South Korea",
    "myanmar": "Myanmar (Burma)", "hong kong": "Hong Kong SAR China", "macau": "Macao SAR China",
    "viet nam": "Vietnam", "turkiye": "Turkey", "türkiye": "Turkey", "czech republic": "Czechia",
}
# Big cities that often stand in for the country on a CV's top line
CITY_COUNTRY = {
    "kuala lumpur": "Malaysia", "petaling jaya": "Malaysia", "selangor": "Malaysia", "shah alam": "Malaysia",
    "penang": "Malaysia", "johor bahru": "Malaysia", "cyberjaya": "Malaysia", "putrajaya": "Malaysia",
    "ipoh": "Malaysia", "kota kinabalu": "Malaysia", "kuching": "Malaysia", "jakarta": "Indonesia",
    "bangkok": "Thailand", "manila": "Philippines", "dhaka": "Bangladesh", "mumbai": "India",
    "bangalore": "India", "bengaluru": "India", "chennai": "India", "new delhi": "India", "london": "United Kingdom",
}
_COUNTRY_TERMS = sorted(
    [(c.lower(), c) for c in COUNTRIES] + list(COUNTRY_ALIASES.items()) + list(CITY_COUNTRY.items()),
    key=lambda t: -len(t[0]),
)
AGE_RANGES = [(18, 24, "18–24"), (25, 34, "25–34"), (35, 44, "35–44"), (45, 54, "45–54"), (55, 200, "55+")]
NOT_A_NAME = {"curriculum", "vitae", "resume", "résumé", "cv", "profile", "sample", "page"}
PERSONAL_HINT = re.compile(r"\b(name|address|location|based in|lives? in|nationality|citizenship|country|"
                           r"date of birth|d\.?o\.?b|born|age)\b", re.I)


def find_country(lines):
    for line in lines:
        low = " " + re.sub(r"[|,;/()·•]", " ", line.lower()) + " "
        for term, country in _COUNTRY_TERMS:
            if re.search(r"(?<![a-z])" + re.escape(term) + r"(?![a-z])", low):
                return country
    return None


def find_name(lines):
    for line in lines:
        m = re.match(r"^\s*(?:full\s+)?name\s*:\s*(.+)$", line, re.I)
        if m:
            return clean(m.group(1), 60)
    for line in lines[:3]:  # a CV's first line is usually the person's name
        words = line.split()
        if (2 <= len(words) <= 5 and len(line) <= 60 and not re.search(r"[@\d|:/]", line)
                and all(re.fullmatch(r"[A-Za-zÀ-ÿ'’.\-]+", w) for w in words)
                and not NOT_A_NAME & {w.lower().strip(".") for w in words}):
            return " ".join(w.title() if w.isupper() else w for w in words)  # "AINA RAHMAN" -> "Aina Rahman"
    return None


def find_age_range(lines, today=None):
    year_now = (today or date.today()).year
    for line in lines:
        m = re.search(r"\bage\s*:?\s*(\d{2})\b", line, re.I)
        age = int(m.group(1)) if m else None
        if age is None and re.search(r"date of birth|d\.?o\.?b|\bborn\b", line, re.I):
            y = re.search(r"\b(19[3-9]\d|20[0-2]\d)\b", line)
            age = year_now - int(y.group(1)) if y else None
        if age:
            return next((label for lo, hi, label in AGE_RANGES if lo <= age <= hi), None)
    return None


def read_personal(text):
    """Name, country and age range for the About-you step, from the CV's top lines and any
    personal-details lines. Email, phone and street address are never read or kept."""
    sec = split_sections(text)
    top = sec.get("top", [])
    personal = [l for l in text.splitlines() if PERSONAL_HINT.search(l)][:12]
    out = {}
    name = find_name(top + personal)
    country = find_country(top + personal)
    age = find_age_range(top + personal)
    if name:
        out["name"] = name
    if country:
        out["country"] = country
    if age:
        out["ageRange"] = age
    return out


# ---------------------------------------------------------------- 4. ESCO matching + final profile

@lru_cache(maxsize=1)
def skill_matrix():
    emb = get_embeddings()
    uris = list(emb.skill_vec)
    return uris, np.stack([emb.skill_vec[u] for u in uris])


@lru_cache(maxsize=1)
def occupation_matrix():
    emb = get_embeddings()
    return np.concatenate(list(emb.occ_vecs.values()))


@lru_cache(maxsize=1)
def skill_titles():
    import sqlite3

    from .matching import DB_PATH

    db = sqlite3.connect(DB_PATH)
    titles = dict(db.execute("SELECT uri, title FROM skills"))
    db.close()
    return titles


ESCO_MIN = 0.8  # rescaled similarity needed to tag a phrase with an ESCO skill (lower bars gave odd tags)


def esco_matches(phrases):
    """phrase -> (ESCO title, 0..1 score) or None, by meaning."""
    emb = get_embeddings()
    if emb is None or not phrases:
        return [None] * len(phrases)
    from .similarity import similarity

    uris, mat = skill_matrix()
    titles = skill_titles()
    out = []
    for phrase, row in zip(phrases, emb.encode(phrases) @ mat.T):
        near = [j for j in np.argsort(-row)[:5] if row[j] >= row.max() - 0.02 and uris[j] in titles]
        if not near:
            out.append(None)
            continue
        j = max(near, key=lambda j: row[j] + 0.05 * similarity(phrase, titles[uris[j]]))
        score = float(emb.rescale(row[j]))
        out.append((titles[uris[j]], score) if score >= ESCO_MIN else None)
    return out


def build_profile(parts, method):
    """Raw parts -> onboarding answers + a summary of what was found."""
    roles = parts["roles"]
    role_text = [(" ".join([r["title"]] + r.get("tasks", []) + r.get("tools", [])).lower(), r) for r in roles]
    newest_end = max((r.get("_end", 0) for r in roles), default=0)

    def where_used(name):
        """The most recent role that mentions a skill, for 'last used' and a confidence boost."""
        hits = [r for text, r in role_text if name.lower() in text]
        return max(hits, key=lambda r: (r.get("_current", False), r.get("_end", 0))) if hits else None

    skills = []
    for name, level in dedupe(parts["skills"]):
        role = where_used(name)
        if level is None:
            level = 2 if role else 1  # used at work = comfortable, otherwise the basics
        used = last_used_label(role["_end"], role["_current"]) if role and "_end" in role else "This year"
        skills.append({"name": name, "level": level, "lastUsed": used})

    # No skills section: the skills ESCO spots in the tasks stand in, so the step isn't empty
    if not skills and roles:
        tasks = [(t, r) for r in roles for t in r.get("tasks", [])]
        found = {}
        for (task, role), m in zip(tasks, esco_matches([t for t, _ in tasks])):
            if m and m[0] not in found:
                found[m[0]] = (m[1], role)
        for title, (score, role) in sorted(found.items(), key=lambda kv: -kv[1][0])[:8]:
            used = last_used_label(role["_end"], role["_current"]) if "_end" in role else "This year"
            skills.append({"name": title[0].upper() + title[1:], "level": 2, "lastUsed": used})

    for s, m in zip(skills, esco_matches([s["name"] for s in skills])):
        if m:
            s["esco"] = m[0]

    profile = {}
    if parts["edu"]:
        profile.update(parts["edu"])
    if roles:
        roles.sort(key=lambda r: (r.get("_current", False), r.get("_end", 0)), reverse=True)
        profile["roles"] = [{k: v for k, v in r.items() if not k.startswith("_")} for r in roles[:6]]
        profile["noExperience"] = False
    for key in ("languages", "courses", "projects", "hobbies"):
        if parts[key]:
            profile[key] = parts[key]
    if skills:
        profile["skills"] = skills[:20]

    matched = [s for s in skills if s.get("esco")]
    summary = {
        "method": method,
        "education": " in ".join(v for v in (parts["edu"].get("eduLevel"), parts["edu"].get("eduField")) if v) or None,
        "roles": len(profile.get("roles", [])),
        "tasks": sum(len(r.get("tasks", [])) for r in profile.get("roles", [])),
        "tools": len({t for r in profile.get("roles", []) for t in r.get("tools", [])}),
        "skills": len(profile.get("skills", [])),
        "esco": len(matched),
        "examples": [{"skill": s["name"], "esco": s["esco"]} for s in matched
                     if s["name"].lower() not in s["esco"].lower() and s["esco"].lower() not in s["name"].lower()][:3],
        "languages": len(profile.get("languages", [])),
        "courses": len(profile.get("courses", [])),
        "projects": len(profile.get("projects", [])),
        "hobbies": len(profile.get("hobbies", [])),
        "newestRoleYear": newest_end // 12 if newest_end else None,
    }
    filled = [k for k in profile if k != "noExperience"]  # no "From your CV" badge on the no-experience box
    return {"profile": profile, "filled": filled, "found": summary}


def read_cv(filename, data):
    text = extract_text(filename, data)
    from . import cv_ai

    result = None
    if cv_ai.enabled():
        try:
            result = build_profile(cv_ai.read(text), "ai")
        except Exception:
            pass  # any AI problem: fall back to the rules below
    result = result or build_profile(read_rules(text), "rules")
    # About-you answers always come from the rules, so the AI never sees a reason to keep them
    personal = read_personal(text)
    result["profile"] = {**personal, **result["profile"]}
    result["filled"] = list(personal) + result["filled"]
    result["found"]["personal"] = list(personal)
    return result
