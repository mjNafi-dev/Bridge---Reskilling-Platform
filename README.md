# Bridge - Reskilling Platform

**Every skill starts from one you have.**

Bridge shows people which skill is worth learning next for the AI era, and how much of it they already know. It reads what you've done (or your CV), matches you to roles using official skills data, and turns the gap into a short, personal learning path that starts from what's familiar.

Built for SDC Hackathon 2026, Domain 1: Aiversecity Future-Ready Workforce.

---

## Team information

| Field | Details |
| --- | --- |
| **Team name** | Stewpid |
| **Team domain** | Domain 1: Aiversecity Future-Ready Workforce |
| **SDG track** | SDG 4 (Quality Education) and SDG 8 (Decent Work and Economic Growth) |
| **Team leader** | Mahir Jabid Nafi |
| **University** | Taylor's University |
| **Number of members** | 01 |

## Links

| Resource | Link |
| --- | --- |
| GitHub repository | https://github.com/mjNafi-dev/Bridge---Reskilling-Platform |
| Replit project | https://replit.com/@stewpeed-dev/Bridge-Reskilling-Platform |
| Live demo | https://bridge-reskill.replit.app |
| RunPod | GPU pod `bridge-skill-embeddings` (ID `f2w43seqazno9r`, 1× NVIDIA A40). Proof: [`submission/RunPod Proof of Use.pdf`](submission/RunPod%20Proof%20of%20Use.pdf) |
| Slide deck | ⚠️ to add |
| Pitch video | ⚠️ to add (YouTube) |

---

## Overview

### Problem

Workers and graduates hear that AI will change their jobs, but not what to do about it. Career sites list hundreds of roles and courses without saying which ones fit *this* person, or how much they already know. A new skill feels 100% new, so people freeze, even when half of it is something they already do.

### Solution

Bridge starts from the person, not the job board. It reads their experience, matches it against the official European skills taxonomy (ESCO) by meaning, and shows, for each suggested role, how much they already know ("You're already familiar with 62%") and why. Each role gets a Bridge score built from familiarity, future demand (two AI-change scenarios), how quickly the gap closes at their weekly hours, and how well it fits the kind of work they enjoy. Picking a role turns it into a pathway that starts from what's closest to what they know.

### Key features

- **CV reading.** Upload a PDF, Word or text CV; Bridge pulls out roles, tasks, tools, education, skills, languages, courses and projects, and matches every skill to ESCO ("Photo retouching → edit photographs"). The file is read in memory and thrown away. Optional AI mode (Claude) for messier CVs.
- **Explainable matching.** Five suggested roles, each with a Bridge score you can open up: familiarity, ease, demand and interest fit, with their weights. Bubbles show which of the role's topics you already know.
- **The role you're eyeing.** Type a role in onboarding ("Video editor") and Bridge finds the closest of its roles by meaning, then always shows it next to your matches with its real rank ("#76 of 116"), even when it isn't a top match. Roles it doesn't cover are named, not guessed.
- **Comfort question.** "How far are you willing to stretch?" moves weight between familiar roles and high-demand ones. What you already know leads (familiarity 45%, demand 25% in the middle); demand only outweighs it for people who choose to stretch. The five roles come from at least two categories (at most 3 from one).
- **Future demand with sources.** Live job postings, O\*NET Bright Outlook and the ILO 2025 GenAI exposure index, as two labelled scenarios (moderate vs fast AI change).
- **UN SDG tags.** Every role shows which SDGs it serves and why; roles that serve the causes you pick get a small boost.
- **My pathway.** Up next, a path ordered from familiar to new, optional brush-ups for topics you partly know, progress that carries over when you switch roles, and a celebration when you finish.
- **Real courses for every topic.** A hand-checked catalogue of 164 courses (96 free) from official pages such as OpenLearn, MIT OpenCourseWare, Kaggle, Khan Academy, CS50, Cisco and Coursera, matched to ESCO skills by meaning. Your budget answer filters them ("Free only" hides paid ones) and your learning style orders them. Every topic also gets a YouTube search, which is the fallback when no course fits.
- **Share my journey (CV and beyond).** A read-only page for an employer: background like a CV (experience, education, courses, projects, self-rated skills, languages, interests) plus the role they're working towards and what they've learned on Bridge. The learner gets a short code (e.g. `K7M-2QX`) to give to people they choose; no scores, email or age. **Save as PDF** downloads a real PDF.
- **Hiring projects.** HR describes who they're looking for (role, must-have skills and how well, languages, education, kind of work, hobbies that help), then adds candidates' codes, several at once. Each journey shows how it lines up with the brief and why ("Wireframing: has it, from *Create website wireframe*, done on Bridge"), with chips like *Best fit for your brief*. It compares by meaning with the same embeddings, never looks at name, age or country, and is a guide, not a decision.
- **University growth dashboard.** Admins sign in and pick a programme (e.g. Bachelor of Information Technology). They see how students have grown over the semester, each module's progress (week 1 against now, weakest first, with where to focus), a students × modules heatmap, and a sortable table of every student with their own view. Mastery is how much of a module's ESCO skills a student has shown; each student's best-fit job comes from the modules they're strongest in. Students see this by name only because they agreed to it when joining with their university's code.
- **Data sources page.** Every source with its version, retrieval date and licence, and how each part of the score is built.

### What uses AI, and what doesn't

| Part | How it works |
| --- | --- |
| Skill matching | Embeddings (BAAI/bge-small-en-v1.5). ESCO skills and job titles were embedded once on a **RunPod GPU**; the user's phrases are embedded on the server's CPU with the same model. |
| Bridge score, demand, SDG tags, peer comparison | Transparent rules and maths over public data. No generative AI. |
| Course suggestions | A hand-checked course list; what each course teaches is matched to ESCO skills with the same embeddings. No generative AI. |
| Hiring brief fit | The brief's skills are matched by meaning to everything a candidate shared (same embeddings), with a shared-word-root rule for short names. The reasons are shown; the order is only a guide. No generative AI. |
| CV reading | Rules by default. Optional AI mode uses Claude (via Replit AI Integrations) with structured output; anything it fills is shown with a "From your CV" badge for the user to check. |
| "Learn with your own AI" popup | Demo only: shows how an MCP-connected assistant could explain topics with the user's interests. Nothing is connected for real. |

### Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, React Router 6, Vite 5 (plain CSS with design tokens) |
| Backend | Python 3.11+, FastAPI, Uvicorn, NumPy, fastembed |
| Database | SQLite (`backend/data/bridge.db`, built from public sources) |
| CV reading | pypdf, python-docx; optional Anthropic SDK (Claude) |
| AI / compute | RunPod GPU pod (one-off embedding job), CPU embeddings in the API |
| Hosting | Replit (one server serves the API and the built app) |

---

## Try it (demo walkthrough)

1. On the sign-up page, click **Try with a demo profile** and pick a made-up person, or create an account (any email; nothing is checked).
2. In onboarding, on **CV upload**, click **try our sample CV** (a made-up graphic designer) and watch the next pages fill in.
3. **Confirm & find my matches**: hover the bubbles, switch roles with the arrows, open **View more details**.
4. **Select pathway**: see real courses under **Up next**, open a topic's **courses** toggle, mark topics Learning or Done, open **Brush up what you know**, then **Get my share code → Preview**.
5. Back on the sign-up page: **University or HR team? Organisation view**.
   - **Use the demo admin** (`admin@demo-uni.edu`, password `bridge-demo-2026`, synthetic) for the growth dashboard: switch programmes on the left, filter by year, open a student.
   - Or **View candidates' journeys → Open the example project**: four made-up candidates against a junior UI designer brief. Use the arrows, **+** to add codes (try `DEMO-AINA, K7M-2QX`), and **Save as PDF**.
6. **ESCO, O\*NET and ILO data** (sign-up page) opens the Data sources page.

All people, CVs, candidates and the demo organisation are synthetic. Please don't upload a real CV to the demo.

---

## Run locally

You need Python 3.11+ and Node 20+.

**One server (closest to the deployed app):**

```bash
cd backend
pip install -r requirements.txt
cd ../frontend
npm install
npm run build
cd ../backend
python -m uvicorn app.main:app --port 8000
```

Then open http://localhost:8000. The API serves the built app from `frontend/dist`.

On macOS or Linux, `bash scripts/start.sh` does all of the above.

**Development (hot reload):** run the API as above, then in a second terminal:

```bash
cd frontend
npm run dev
```

Vite serves the app on http://localhost:5173 and forwards `/api` to port 8000.

The first request that needs embeddings downloads the model (about 65 MB) into `backend/data/models/`.

### Optional AI mode for CV reading

Off by default. To turn it on, set these environment variables (Replit Secrets, or your shell). See [`.env.example`](.env.example).

| Variable | Value |
| --- | --- |
| `BRIDGE_CV_AI` | `1` |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` + `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Set by Replit's Anthropic AI integration, or use `ANTHROPIC_API_KEY` elsewhere |
| `BRIDGE_AI_MODEL` | Optional, default `claude-opus-5-5` |

If AI mode fails for any reason, Bridge falls back to the rules. Never commit keys.

## Deploy on Replit

1. Import this GitHub repository into Replit.
2. **Run** uses `.replit` → `scripts/start.sh`: installs Python packages, builds the React app, pre-downloads the embedding model, then starts the server on port 8000.
3. **Deploy**: the deployment builds with `scripts/build.sh` and runs `uvicorn app.main:app` on `$PORT`.
4. Optional: add the Anthropic AI integration and set `BRIDGE_CV_AI=1` for AI CV reading.

Proof of use goes in `submission/Replit Proof of Use.pdf`.

## RunPod

The GPU job in [`runpod/embed_skills.py`](runpod/embed_skills.py) embedded 3,943 ESCO skills and job titles with BAAI/bge-small-en-v1.5 on one NVIDIA A40 (6.23 s of compute). Its output (`backend/data/embeddings/`) is committed, so the app runs without a GPU. Proof: [`submission/RunPod Proof of Use.pdf`](submission/RunPod%20Proof%20of%20Use.pdf).

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app: /api routes + serves the built frontend
│   │   ├── matching.py      # Bridge score: familiarity, ease, demand, interest fit, peers
│   │   ├── embeddings.py    # Meaning-based similarity (fastembed, same model as RunPod)
│   │   ├── similarity.py    # Word-overlap fallback when embeddings are missing
│   │   ├── cv.py            # CV reading: text extraction, sections, rules, ESCO matching
│   │   ├── cv_ai.py         # Optional Claude CV reading (off unless BRIDGE_CV_AI=1)
│   │   ├── sdg.py           # UN SDG tags per role + the causes boost
│   │   ├── courses.py       # Course suggestions: budget filter, learning-style order
│   │   └── hire.py          # Share codes for journeys + how a candidate fits a hiring brief
│   ├── data/                # bridge.db, embeddings, courses, demo organisation, demo candidates
│   ├── scripts/             # build_db, fetch_trends, build_course_map, make_org_demo, make_sample_cv
│   └── requirements.txt
├── frontend/
│   ├── public/cv/           # CV-step icons + the synthetic sample CV (PDF)
│   └── src/
│       ├── pages/           # Auth, onboarding, results, pathway, data, org, journey, hire
│       ├── components/      # Brand mark, node network, dot grid, AI connect, profile sheet
│       ├── lib/             # page transitions, journey snapshots + PDF, hiring projects
│       └── styles/          # tokens.css, base.css, ui.css
├── runpod/                  # GPU embedding job + its input
├── scripts/                 # build.sh / start.sh for Replit
├── submission/              # Proof PDFs and their screenshots
├── docs/style-guide.md
├── .replit
├── .env.example
└── LICENSE
```

## API

| Route | What it does |
| --- | --- |
| `GET /api/health` | Status, number of roles, whether AI CV reading is on |
| `POST /api/match` | Profile → five ranked roles with scores, topics, demand, SDGs, peers |
| `POST /api/cv` | CV file → onboarding answers (file never stored) |
| `POST /api/courses` | Pathway topics + budget + learning style → up to 3 checked courses per topic |
| `GET /api/data` | Sources, catalogue size, course catalogue, live snapshot, RunPod job details |
| `POST /api/org/login` | Organisation admin sign-in (demo: one synthetic admin) → the organisation's code and a session token |
| `GET /api/org/{code}` | A university's growth dashboard: programmes, modules, students' progress (needs the admin's sign-in token; demo: `DEMO-UNI-2026`) |
| `POST /api/journeys` | A "Share my journey" snapshot → a short code (the same snapshot always gets the same code) |
| `POST /api/hire/candidates` | Codes (+ optional brief) → each shared journey, with how it fits the brief and why |
| `GET /api/hire/example` | The made-up example hiring project |
| `GET /api/sources` | Data sources with retrieval dates |

## Rebuilding the data

Run from the repo root. Everything comes from public sources; nothing is invented.

| Script | What it does |
| --- | --- |
| `python backend/scripts/build_db.py` | Rebuilds `bridge.db` from the ESCO API, the ESCO–O\*NET crosswalk (an O\*NET job with the same name wins over the match type) and O\*NET interest types |
| `python backend/scripts/fetch_trends.py` | New dated demand snapshot: live postings (titles cleaned and common German job words translated, each ad counted once towards its closest role), O\*NET Bright Outlook, ILO GenAI exposure (needs `openpyxl`) |
| `python backend/scripts/build_course_map.py` | After editing `courses.json`: re-matches courses to ESCO skills (`--check` also tests every link) |
| `python backend/scripts/make_org_demo.py` | Regenerates the synthetic Demo University: 4 programmes, 126 made-up students, 12 weeks of progress on a learning-curve model, best-fit jobs from each student's strongest modules |
| `python backend/scripts/make_sample_cv.py` | Regenerates the synthetic sample CV PDF (needs `fpdf2`) |

## Data and privacy

- Answers stay in the user's browser (demo: no server accounts). Creating an account starts fresh.
- CVs are read once in memory for name, country (and age range, if a birth year is there), roles, skills and education, then discarded. Email, phone and address are never read.
- A university sees a student's progress by name (programme, module mastery, best-match role, learning time) only if the student joins with its code and ticks the consent. The data needs the admin's sign-in.
- Share codes: a snapshot is saved on the server (`backend/data/journeys.db`, not in git) only when the learner asks for a code, and holds only what the share page shows. Anyone with the code can see it, so learners give it only to people they choose. The long link fallback carries its snapshot after the `#`, which browsers never send to a server.
- Hiring projects live in the HR person's browser. The brief fit ignores name, age, country and anything personal.
- Every demo person, CV and organisation is synthetic.

---

## Credits

**Data:** [ESCO](https://esco.ec.europa.eu) (European Commission), [O\*NET](https://www.onetcenter.org) (US Department of Labor, CC BY 4.0), [ILO 2025 GenAI exposure index](https://github.com/pgmyrek/2025_GenAI_scores_ISCO08) (Gmyrek et al., ILO Working Paper 140, CC BY 4.0), job posting counts from the [Remotive](https://remotive.com) and [Arbeitnow](https://www.arbeitnow.com) public APIs, UN [Sustainable Development Goals](https://sdgs.un.org/goals).

**Courses:** links only, to each provider's own page (OpenLearn, MIT OpenCourseWare, Kaggle, Khan Academy, Harvard CS50, freeCodeCamp, The Odin Project, MDN, Cisco Networking Academy, HubSpot Academy, Microsoft Learn, OpenWHO, Coursera and others; full list in `backend/data/courses.json`). Bridge copies no course content.

**Model:** [BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) (MIT).

**Assets:** 3D icons (CV upload states and the pathway's five growth stages, the toolbox and tools in Your skills, and the AI sparkle, share paper plane and path clipboard, and the Resources box with its globe, video, book, laptop, document, certificate and graduation cap; the empty toolbox, the packed box and the blue plane are our edits of theirs) from [thiings.co](https://www.thiings.co), free to use, credited anyway. Claude, ChatGPT (OpenAI), Gemini and Model Context Protocol marks in the "Learn with your own AI" demo from [Simple Icons](https://simpleicons.org) (CC0); the marks belong to their owners and only show which assistant you'd connect. Fonts: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (Google Fonts, OFL), [Switzer](https://www.fontshare.com/fonts/switzer) (Fontshare). Book search: [Open Library](https://openlibrary.org/developers/api) API.

**Libraries:** React, React Router, Vite, [jsPDF](https://github.com/parallax/jsPDF) (MIT, journey PDFs), FastAPI, Uvicorn, NumPy, fastembed, pypdf, python-docx, Anthropic Python SDK.

## License

Apache License 2.0. See [LICENSE](LICENSE).
