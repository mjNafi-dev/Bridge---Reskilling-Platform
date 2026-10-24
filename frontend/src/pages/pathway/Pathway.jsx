import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fetchCourses, fetchMatch, shareJourney } from "../../api.js";
import { useGo } from "../../lib/go.js";
import { buildJourney, journeyCodeLink, journeyLink } from "../../lib/journey.js";
import BrandMark from "../../components/BrandMark.jsx";
import ConnectAI, { AIIcon, AI_PROVIDERS, readAI, saveAI } from "../../components/ConnectAI.jsx";
import ProfileSheet from "../../components/ProfileSheet.jsx";
import { knownTier, packTopics, pickBubbles } from "../results/layout.js";
import { SKILL_LEVELS } from "../onboarding/steps.js";
import {
  STATUS,
  STATUS_LABEL,
  alreadyHave,
  buildSteps,
  currentFamiliarity,
  effectiveCoverage,
  extraSteps,
  learnedTopics,
  nextExtras,
  readProgress,
  resourcesFor,
  reviseSteps,
  saveProgress,
  worthLookingInto,
  youtubeSearch,
} from "./pathwayData.js";
import "./Pathway.css";

/*
  My pathway: the home page once a job is picked.
  Up next (the one thing to do now), the path of new topics, optional brush-ups for
  topics you partly know, your AI, this week's time, your skills and a read-only share
  link for employers. Finishing the new topics, then everything, each gets a celebration.
  Coming back from editing the profile (?updated=1) re-runs the matcher for this job
  automatically and says what changed; the pathway only changes if you pick another.
*/

const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// How familiar you are with the role, as a plant growing up (3D icons from thiings.co)
const STAGES = [
  { from: 0, img: "1-sprout", label: "Just sprouted", text: "Mostly new ground. Every topic you finish adds a leaf." },
  { from: 20, img: "2-seedling", label: "Taking root", text: "You already know some of the basics. Keep going." },
  { from: 40, img: "3-bonsai", label: "Taking shape", text: "About half of this role already feels familiar." },
  { from: 60, img: "4-tree", label: "Standing tall", text: "Most of this role is familiar. The rest is close." },
  { from: 80, img: "5-blossom", label: "In full bloom", text: "Nearly there. This role is within reach." },
];

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
}

export default function Pathway() {
  const navigate = useNavigate();
  const go = useGo();
  const [params] = useSearchParams();
  const [job, setJob] = useState(() => readJSON("bridge.selectedJob", null));
  const [profileOpen, setProfileOpen] = useState(false);
  const [recal, setRecal] = useState(null); // { state: "running" | "done" | "error", before, after, better }
  const [profile] = useState(() => readJSON("bridge.profile", {}));
  const [progress, setProgress] = useState(readProgress);
  const [ai, setAi] = useState(readAI);
  const [connectOpen, setConnectOpen] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [weekHours, setWeekHours] = useState(() => readJSON("bridge.weekHours", 0));
  const [share, setShare] = useState(() => ({ code: readJSON("bridge.shareCode", null), state: "idle", copied: null })); // state: idle | making | error
  const [showAll, setShowAll] = useState(false); // the path shows the next few topics until expanded
  const [courses, setCourses] = useState(null); // { checked, topics: { [topic]: { courses, hidden } } } | "error"
  const [openCourses, setOpenCourses] = useState(null); // topic whose courses are shown under its row
  const [compact, setCompact] = useState(false); // top bar shrinks into an island once you scroll
  const [skillsOpen, setSkillsOpen] = useState(false); // "Your skills" starts packed away in its toolbox
  const [resourcesOpen, setResourcesOpen] = useState(false); // so does "Resources", in its box
  const nextRef = useRef(null);

  const steps = useMemo(() => (job ? buildSteps(job) : []), [job]);
  const revise = useMemo(() => (job ? reviseSteps(job) : []), [job]); // optional brush-ups
  const isDone = (s) => progress[s.id] === "done";
  const coreDone = steps.length > 0 && steps.every(isDone); // every new topic learned
  const allDone = steps.length + revise.length > 0 && steps.every(isDone) && revise.every(isDone); // 100%
  const nothingToDo = !!job && steps.length + revise.length === 0; // already know every core topic well
  const milestone = !job ? null : allDone ? "all" : coreDone ? "core" : null;
  const [burst, setBurst] = useState(0); // bumps to launch confetti
  const [reviseOpen, setReviseOpen] = useState(null); // null = open only when there's nothing new to learn
  const reviseRef = useRef(null);

  // Celebrate each milestone once (new topics all learned, then everything at 100%)
  useEffect(() => {
    if (!job) return;
    const key = milestone && `${job.uri}|${milestone}`;
    const seen = readJSON("bridge.celebrated", null);
    try {
      if (key && seen !== key) {
        localStorage.setItem("bridge.celebrated", JSON.stringify(key));
        setBurst((b) => b + 1);
      } else if (!key && seen?.startsWith(job.uri)) {
        localStorage.removeItem("bridge.celebrated");
      }
    } catch {
      /* storage blocked */
    }
  }, [milestone, job]);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Checked courses for every topic of this role, once per role (budget and learning style from onboarding)
  useEffect(() => {
    if (!job) return;
    let live = true;
    setCourses(null);
    fetchCourses(job.topics.map((t) => t.title), profile.budget, profile.learnStyle)
      .then((res) => live && setCourses(res))
      .catch(() => live && setCourses("error"));
    return () => {
      live = false;
    };
  }, [job, profile]);

  // Recalibrate automatically after the profile was edited
  useEffect(() => {
    if (!job || params.get("updated") !== "1") return;
    navigate("/pathway", { replace: true });
    const before = { familiarity: job.familiarity, score: job.score, hours: job.hours };
    setRecal({ state: "running", before });
    const latest = readJSON("bridge.profile", profile);
    fetchMatch(latest, (latest.comfort ?? 50) / 100, job.uri)
      .then((res) => {
        const updated = res.pinned || job;
        setJob(updated);
        try {
          localStorage.setItem("bridge.selectedJob", JSON.stringify(updated));
        } catch {
          /* storage blocked */
        }
        // A different role that now fits clearly better? Mention it, but don't switch.
        const top = res.results.find((r) => r.uri !== job.uri);
        const better = top && top.score > updated.score + 2 ? top : null;
        setRecal({ state: "done", before, after: { familiarity: updated.familiarity, score: updated.score, hours: updated.hours }, better });
      })
      .catch(() => setRecal({ state: "error", before }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!job) {
    return (
      <main className="pw pw--empty">
        <h2>No pathway yet</h2>
        <p>Pick a role on your results first.</p>
        <Link className="btn btn--primary" to="/results">See my options</Link>
      </main>
    );
  }

  const familiarity = currentFamiliarity(job, progress);
  // Next thing to do: a new topic; or, when the role has nothing new, a brush-up
  const upNext = steps.find((s) => !isDone(s)) || (steps.length === 0 ? revise.find((s) => !isDone(s)) : undefined);
  const doneCount = steps.filter(isDone).length;
  const reviseDone = revise.filter(isDone).length;
  const pathCourses = courses && courses !== "error"
    ? [...new Map([...steps, ...revise].flatMap((t) => courses.topics[t.id]?.courses || []).map((c) => [c.id, c])).values()]
    : [];
  const resourceSummary = courses === "error"
    ? "Video searches and trusted sites for every topic"
    : !courses
      ? "Finding courses for your topics…"
      : `${pathCourses.length} checked course${pathCourses.length === 1 ? "" : "s"} · ${pathCourses.filter((c) => c.cost === "free").length} free · a video search for every topic`;
  const showRevise = reviseOpen ?? steps.length === 0;
  const openRevise = () => {
    setReviseOpen(true);
    setTimeout(() => reviseRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };
  // Path list: always show a few past the topic you're on
  const shownSteps = Math.max(6, steps.indexOf(upNext) + 3);
  const hoursLeft = steps.filter((s) => progress[s.id] !== "done").reduce((h, s) => h + s.hours, 0);
  const perWeek = Number(profile.hoursPerWeek) || 5;
  const weeksLeft = Math.ceil(hoursLeft / perWeek);
  const interest = profile.sports?.[0] || profile.hobbies?.[0] || profile.genres?.[0] || "football";
  const provider = ai && AI_PROVIDERS.find((p) => p.id === ai.provider);

  function setStatus(id, status) {
    const next = { ...progress, [id]: status };
    setProgress(next);
    saveProgress(next);
  }

  const toNext = () => nextRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  const cycle = (id) => setStatus(id, STATUS[(STATUS.indexOf(progress[id] || "todo") + 1) % STATUS.length]);

  // Every topic row can open its courses underneath (one at a time)
  function courseToggle(s) {
    const n = courses && courses !== "error" ? courses.topics[s.id]?.courses.length ?? 0 : null;
    const open = openCourses === s.id;
    return (
      <button
        type="button"
        className={`pw-step__courses${open ? " is-open" : ""}`}
        onClick={() => setOpenCourses(open ? null : s.id)}
        aria-expanded={open}
      >
        {n === null ? "Courses" : n ? `${n} course${n > 1 ? "s" : ""}` : "Videos"}
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
    );
  }

  const coursePanel = (s) =>
    openCourses === s.id && (
      <div className="pw-step__panel">
        <CourseList topic={s} courses={courses} budget={profile.budget} compact />
      </div>
    );

  function logHour(delta = 1) {
    const h = Math.max(0, weekHours + delta);
    setWeekHours(h);
    try {
      localStorage.setItem("bridge.weekHours", JSON.stringify(h));
    } catch {
      /* storage blocked */
    }
  }

  function startOver() {
    if (!window.confirm("Start from scratch? This clears your answers, pathway and progress in this browser.")) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("bridge.") && k !== "bridge.account")
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage blocked */
    }
    navigate("/onboarding");
  }

  const toggleAI = () => {
    if (provider) {
      saveAI(null);
      setAi(null);
    } else setConnectOpen(true);
  };

  const menu = [
    { label: "Change pathway", run: () => go("/results") },
    { label: "Edit my details", run: () => setProfileOpen(true) },
    { label: provider ? `Disconnect ${provider.name}` : "Connect your AI", run: toggleAI },
    { label: "Start from scratch", run: startOver, danger: true },
  ];

  // Everything you came in with: skills (with level) and the tools from your roles
  const skillNames = new Set((profile.skills || []).map((sk) => (sk.name || "").toLowerCase()));
  const brought = [
    ...(profile.skills || []).filter((sk) => sk.name).map((sk) => `${sk.name} · ${SKILL_LEVELS[sk.level]?.toLowerCase() || "basics"}`),
    // tools from roles, unless already listed as a skill
    ...new Set((profile.roles || []).flatMap((r) => r.tools || []).filter((t) => !skillNames.has(t.toLowerCase()))),
  ];
  const learned = learnedTopics(progress);
  const extras = worthLookingInto(job, 8, progress);
  const extraPath = extraSteps(job, progress);
  const suggestions = nextExtras(job, progress);

  // Read-only snapshot for an employer: their background like a CV, plus what they're
  // learning here. No scores or rankings.
  function snapshot() {
    return buildJourney({
      profile: readJSON("bridge.profile", profile), // edits made since the page opened
      role: sentence(job.title),
      done: [...steps, ...revise].filter(isDone).map((s) => s.title),
      learning: [...steps, ...revise].filter((s) => progress[s.id] === "learning").map((s) => s.title),
      total: steps.length + revise.length,
      strong: alreadyHave(job),
    });
  }

  const copy = (text, what) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setShare((s) => ({ ...s, copied: what }));
  };

  // A short code for today's snapshot (the same snapshot always gets the same code).
  // If Bridge can't be reached, the long link still works: the snapshot is inside it.
  async function makeCode({ copyLink = false } = {}) {
    setShare((s) => ({ ...s, state: "making", copied: null }));
    try {
      const code = await shareJourney(snapshot());
      writeJSON("bridge.shareCode", code);
      setShare({ code, state: "idle", copied: null });
      if (copyLink) copy(journeyCodeLink(code), "link");
    } catch {
      setShare((s) => ({ ...s, state: "error" }));
      if (copyLink) copy(journeyLink(snapshot()), "long");
    }
  }

  const prompt = upNext
    ? `Explain "${upNext.title}" to me using a ${interest.toLowerCase()} analogy. I already know ${upNext.buildsOn || "graphic design"}, so start from there. Then give me 3 quick questions to check I've got it.`
    : "";

  return (
    <main className="pw">
      {/* Top bar: logo and profile at the top; once you scroll it shrinks into a centred
          island that also shows the role, how familiar you are and what's next */}
      <header className={`pw-top${compact ? " is-compact" : ""}`}>
        <div className="pw-top__bar">
          <div className="pw__brand night">
            <BrandMark to="/pathway" />
          </div>
          <div className="pw-top__status" aria-hidden={!compact}>
            <span className="pw-top__role">{sentence(job.title)}</span>
            <span className="pw-top__meter" aria-hidden="true"><span style={{ width: `${familiarity}%` }} /></span>
            <span className="pw-top__pct num">{familiarity}%<span className="pw-top__pct-word"> familiar</span></span>
            {upNext && (
              <button type="button" className="pw-top__next" tabIndex={compact ? 0 : -1} onClick={toNext}>
                Up next: {upNext.title}
              </button>
            )}
          </div>
          <button type="button" className="pw__me" onClick={() => setProfileOpen(true)} aria-label="Open my profile">
            <span className="pw__me-avatar" aria-hidden="true">{(profile.name || "Y").charAt(0).toUpperCase()}</span>
            <span className="pw__me-name">{profile.name || "My profile"}</span>
          </button>
        </div>
      </header>

      {recal && <RecalBanner recal={recal} onClose={() => setRecal(null)} />}

      {/* ---------- Header ---------- */}
      <section className="pw-head night rise">
        <MoreMenu items={menu} />
        <MiniBubbles job={job} progress={progress} complete={allDone || nothingToDo} />
        <div className="pw-head__text">
          <p className="label-mono">My pathway</p>
          <h1 className="pw-head__title">{sentence(job.title)}</h1>
          <p className="pw-head__meta">
            Bridge score <strong className="num">{job.score}%</strong> ·{" "}
            {allDone
              ? `${steps.length + revise.length} topics covered · path complete`
              : coreDone
                ? `${steps.length} new topics learned · ${revise.length - reviseDone} to brush up (optional)`
                : steps.length === 0
                  ? `Nothing brand-new to learn · ${revise.length - reviseDone} topics to brush up`
                  : `${steps.length} topics to learn · about ${weeksLeft} weeks at ${perWeek}h a week`}
          </p>
          <div className="pw-progress">
            <div className="pw-progress__row">
              <span>Familiar now</span>
              <span className="num"><CountUp value={familiarity} />% → 100%</span>
            </div>
            <span className="pw-progress__bar"><span style={{ width: `${familiarity}%` }} /></span>
            <span className="pw-progress__note">
              Started at {job.familiarity}% ·{" "}
              {steps.length ? `${doneCount} of ${steps.length} new topics done` : `${reviseDone} of ${revise.length} brushed up`}
            </span>
          </div>
          <button type="button" className="pw__link" onClick={() => go("/results")}>← Back to my options</button>
        </div>
        <GrowthStage familiarity={familiarity} />
      </section>

      <div className="pw-grid">
        {/* ---------- Main column ---------- */}
        <div className="pw-main">
          {upNext ? (
            <section className="pw-card pw-next rise" style={{ "--i": 1 }} aria-label="Up next" ref={nextRef}>
              <p className="label-mono">{upNext.revise ? "Brush up" : "Up next"}</p>
              <h2 className="pw-next__title">{upNext.title}</h2>
              <p className="pw-next__bridge">
                {upNext.revise ? (
                  <span className="pw-next__new">
                    You already know about {Math.round(upNext.coverage * 100)}% of this. A short revision makes it solid.
                  </span>
                ) : upNext.buildsOn ? (
                  <>
                    <span className="pw-chip pw-chip--known">{upNext.buildsOn}</span>
                    {/* the arrow travels with the new topic, so a wrapped line starts with it */}
                    <span className="pw-next__to">
                      <span className="pw-next__link" aria-hidden="true" />
                      <span className="pw-chip">{upNext.title}</span>
                    </span>
                  </>
                ) : upNext.refresher ? (
                  <span className="pw-next__new">You've touched on this before, so this one is a refresher.</span>
                ) : (
                  <span className="pw-next__new">New ground: nothing you know maps to this yet.</span>
                )}
              </p>
              <p className="pw-next__meta">About {upNext.hours} hours · {upNext.type === "knowledge" ? "Knowledge" : "Skill"}</p>

              <CourseList topic={upNext} courses={courses} budget={profile.budget} />

              <div className="pw-next__actions">
                <button type="button" className={`pw-status pw-status--${progress[upNext.id] || "todo"}`} onClick={() => cycle(upNext.id)}>
                  <StatusDot status={progress[upNext.id] || "todo"} /> {STATUS_LABEL[progress[upNext.id] || "todo"]}
                </button>
                {provider ? (
                  <button type="button" className="btn btn--ghost" onClick={() => setAskOpen((v) => !v)}>
                    Ask {provider.name} to explain it with {interest.toLowerCase()}
                  </button>
                ) : (
                  <button type="button" className="btn btn--ghost" onClick={() => setConnectOpen(true)}>
                    Connect your AI for personal examples
                  </button>
                )}
              </div>

              {askOpen && provider && (
                <div className="pw-ask">
                  <p className="pw-ask__label">In the full version this opens {provider.name} with:</p>
                  <p className="pw-ask__prompt">{prompt}</p>
                  <button type="button" className="pw__link" onClick={() => navigator.clipboard?.writeText(prompt).catch(() => {})}>
                    Copy prompt
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="pw-card pw-next pw-done rise" aria-label="Path complete">
              <span className="pw-done__badge" aria-hidden="true"><TickIcon /></span>
              <p className="label-mono">{allDone || nothingToDo ? "Path complete" : "New topics done"}</p>
              <h2 className="pw-next__title">
                {allDone || nothingToDo ? `You know every core topic for ${job.title.toLowerCase()}.` : `You've learned every new topic for ${job.title.toLowerCase()}.`}
              </h2>
              <p className="pw-done__lead">
                {nothingToDo
                  ? `You came in already ${familiarity}% familiar, with nothing left to learn or brush up. Pick something below to keep growing.`
                  : allDone
                  ? `From ${job.familiarity}% to ${familiarity}% familiar. That's real progress, well done.`
                  : `You're at ${familiarity}% now. Brushing up the ${revise.length - reviseDone} topics you partly know takes you to 100%. That part's optional.`}
              </p>
              {!allDone && revise.length > reviseDone && (
                <button type="button" className="btn btn--ghost btn--sm pw-done__revise" onClick={openRevise}>
                  Show topics to brush up
                </button>
              )}
              {suggestions.length > 0 && (
                <>
                  <p className="pw-done__label">Make your stack stronger next</p>
                  <ul className="pw-done__next">
                    {suggestions.map((t) => (
                      <li key={t.id}>
                        <span>{t.title}</span>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(t.id, "learning")}>
                          Start learning
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="pw-next__actions">
                <button type="button" className="btn btn--primary" onClick={() => go("/results")}>See roles you can reach now</button>
                <button type="button" className="btn btn--ghost" onClick={() => makeCode({ copyLink: true })}>
                  {share.copied ? "Link copied" : "Share my journey"}
                </button>
                <button type="button" className="pw__link" onClick={() => setBurst((b) => b + 1)}>Celebrate again</button>
              </div>
            </section>
          )}

          <section className="pw-card pw-card--path rise" style={{ "--i": 2 }} aria-label="Your path">
            <div className="pw-card__head">
              <span className="pw-card__title">
                <img className="pw-card__icon" src="/icons/path.webp" alt="" width="40" height="40" />
                <h3>Your path</h3>
              </span>
              <span className="pw-card__note">Closest to what you know first</span>
            </div>
            <ol className="pw-path">
              {steps.slice(0, showAll ? steps.length : shownSteps).map((s, i) => {
                const status = progress[s.id] || "todo";
                return (
                  <li
                    key={s.id}
                    className={`pw-step pw-step--${status}${s === upNext ? " is-next" : ""}${i >= shownSteps ? " rise" : ""}`}
                    style={i >= shownSteps ? { "--i": i - shownSteps } : undefined}
                  >
                    <span className="pw-step__num num">{status === "done" ? <TickIcon /> : i + 1}</span>
                    <div className="pw-step__text">
                      <span className="pw-step__title">{s.title}</span>
                      <span className="pw-step__sub">
                        {s.buildsOn ? `Builds on ${s.buildsOn}` : s.refresher ? "Refresher" : "New ground"} · {s.hours}h
                        {courseToggle(s)}
                      </span>
                    </div>
                    <button type="button" className={`pw-status pw-status--${status}`} onClick={() => cycle(s.id)} aria-label={`${s.title}: ${STATUS_LABEL[status]}. Change status`}>
                      <StatusDot status={status} /> {STATUS_LABEL[status]}
                    </button>
                    {coursePanel(s)}
                  </li>
                );
              })}
            </ol>
            {steps.length > shownSteps && (
              <button type="button" className="pw-more" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                {showAll ? "Show fewer" : `Show all ${steps.length} topics`}
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>
            )}
            {extraPath.length > 0 && (
              <>
                <p className="pw-path__label">Extras you added</p>
                <ol className="pw-path pw-path--extra">
                  {extraPath.map((s) => {
                    const status = progress[s.id] || "todo";
                    return (
                      <li key={s.id} className={`pw-step pw-step--${status}`}>
                        <span className="pw-step__num num">{status === "done" ? <TickIcon /> : "+"}</span>
                        <div className="pw-step__text">
                          <span className="pw-step__title">{s.title}</span>
                          <span className="pw-step__sub">Extra · {s.hours}h{courseToggle(s)}</span>
                        </div>
                        <button type="button" className={`pw-status pw-status--${status}`} onClick={() => cycle(s.id)} aria-label={`${s.title}: ${STATUS_LABEL[status]}. Change status`}>
                          <StatusDot status={status} /> {STATUS_LABEL[status]}
                        </button>
                        {coursePanel(s)}
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            {steps.length === 0 && (
              <p className="pw-empty">Nothing brand-new on this path: you already know part of every core topic. Brush up below to go deeper.</p>
            )}
            {revise.length > 0 && (
              <div className={`pw-revise${showRevise ? " is-open" : ""}`} ref={reviseRef}>
                <button type="button" className="pw-revise__toggle" onClick={() => setReviseOpen(!showRevise)} aria-expanded={showRevise}>
                  <span className="pw-revise__name">Brush up what you know</span>
                  <span className="pw-revise__count num">{reviseDone}/{revise.length}</span>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>
                {showRevise && (
                  <>
                    <p className="pw-revise__note">Optional. Topics you partly know, weakest first. Revising them is what takes you to 100%.</p>
                    <ol className="pw-path pw-path--revise">
                      {revise.map((s) => {
                        const status = progress[s.id] || "todo";
                        return (
                          <li key={s.id} className={`pw-step pw-step--${status}${s === upNext ? " is-next" : ""}`}>
                            <span className="pw-step__num num">{status === "done" ? <TickIcon /> : `${Math.round(s.coverage * 100)}`}</span>
                            <div className="pw-step__text">
                              <span className="pw-step__title">{s.title}</span>
                              <span className="pw-step__sub">
                                You know about {Math.round(s.coverage * 100)}% · {s.hours}h to revise{courseToggle(s)}
                              </span>
                            </div>
                            <button type="button" className={`pw-status pw-status--${status}`} onClick={() => cycle(s.id)} aria-label={`${s.title}: ${STATUS_LABEL[status]}. Change status`}>
                              <StatusDot status={status} /> {STATUS_LABEL[status]}
                            </button>
                            {coursePanel(s)}
                          </li>
                        );
                      })}
                    </ol>
                  </>
                )}
              </div>
            )}
            {alreadyHave(job).length > 0 && (
              <p className="pw-have">
                <strong>Already yours:</strong> {alreadyHave(job).join(", ")}
              </p>
            )}
          </section>
        </div>

        {/* ---------- Side column ---------- */}
        <aside className="pw-side">
          <section className="pw-card pw-card--ai rise" style={{ "--i": 2 }} aria-label="Your AI">
            <div className="pw-card__head">
              <span className="pw-card__title">
                <img className="pw-card__icon" src="/icons/ai.webp" alt="" width="40" height="40" />
                <h3>Your AI</h3>
              </span>
              <span className="pw-ai-status">
                {provider && (
                  <span className="pw-ai-chip" style={provider.color ? { "--ai": provider.color } : undefined}>
                    <AIIcon id={provider.id} size={14} />
                    {provider.id === "other" ? "MCP assistant" : provider.name}
                  </span>
                )}
                <span className={`pw-pill${provider ? " pw-pill--on" : ""}`}>{provider ? "Connected" : "Not connected"}</span>
              </span>
            </div>
            {provider ? (
              <>
                <p className="pw-card__text">
                  {provider.name} can see your interests, pathway and progress. Examples will lean on {interest.toLowerCase()}.
                </p>
                {upNext && !suggestionDismissed && (progress[upNext.id] || "todo") === "todo" && (
                  <div className="pw-suggest">
                    <p>
                      <strong>{provider.name} suggests:</strong> you've got the basics of {upNext.title.toLowerCase()} from your last chat. Mark it as learning?
                    </p>
                    <div className="pw-suggest__actions">
                      <button type="button" className="btn btn--primary btn--sm" onClick={() => setStatus(upNext.id, "learning")}>
                        Accept
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSuggestionDismissed(true)}>
                        Not yet
                      </button>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className="pw__link"
                  onClick={() => {
                    saveAI(null);
                    setAi(null);
                  }}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <p className="pw-card__text">
                  Connect Claude, ChatGPT, Gemini or any MCP assistant to learn with examples from your own interests.
                </p>
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setConnectOpen(true)}>
                  Connect your AI
                </button>
              </>
            )}
          </section>

          <section className="pw-card rise" style={{ "--i": 3 }} aria-label="This week">
            <div className="pw-card__head">
              <h3>This week</h3>
              <span className="pw-card__note num">
                {weekHours} / {perWeek}h
              </span>
            </div>
            <span className="pw-progress__bar"><span style={{ width: `${Math.min(100, (weekHours / perWeek) * 100)}%` }} /></span>
            <div className="pw-week__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => logHour(1)}>
                + Log an hour
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => logHour(-1)}
                disabled={weekHours === 0}
                aria-label="Remove an hour"
              >
                − Undo
              </button>
            </div>
            {weekHours > perWeek * 1.5 && (
              <p className="pw-note">You're well past your goal. Great effort, and remember to rest too.</p>
            )}
          </section>

          <section className="pw-card pw-missing rise" style={{ "--i": 4 }} aria-label="Edit my details">
            <h3>Something missing?</h3>
            <p className="pw-card__text">
              Finished a course or picked up a new skill? Add it and your pathway recalibrates on its own.
            </p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setProfileOpen(true)}>
              Edit my details
            </button>
          </section>

          <section className="pw-card pw-card--share rise" style={{ "--i": 5 }} aria-label="Share my journey">
            <span className="pw-card__title">
              <img className="pw-card__icon" src="/icons/share.webp" alt="" width="40" height="40" />
              <h3>Share my journey</h3>
            </span>
            <p className="pw-card__text">
              A read-only page for an employer or HR, like a CV and more: your background, skills, interests and what you're learning here. No scores, no email or age. Give the code only to people you choose.
            </p>
            {share.code ? (
              <div className="pw-code">
                <span className="pw-code__label">Your code</span>
                <span className="pw-code__value num">{share.code}</span>
                <div className="pw-share">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => copy(share.code, "code")}>
                    {share.copied === "code" ? "Code copied" : "Copy code"}
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => copy(journeyCodeLink(share.code), "link")}>
                    {share.copied === "link" ? "Link copied" : "Copy link"}
                  </button>
                  <a className="pw__link" href={journeyCodeLink(share.code)} target="_blank" rel="noreferrer">Preview</a>
                </div>
                <p className="pw-code__note">
                  A snapshot of what you shared. Learned more since?{" "}
                  <button type="button" className="pw__link" onClick={() => makeCode()} disabled={share.state === "making"}>
                    {share.state === "making" ? "Updating…" : "Update my code"}
                  </button>
                </p>
              </div>
            ) : (
              <div className="pw-share">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => makeCode()} disabled={share.state === "making"}>
                  {share.state === "making" ? "Making your code…" : "Get my share code"}
                </button>
                <a className="pw__link" href={journeyLink(snapshot())} target="_blank" rel="noreferrer">Preview</a>
              </div>
            )}
            {share.state === "error" && (
              <p className="pw-code__note pw-code__note--error" role="alert">
                We couldn't make a code right now.{" "}
                <button type="button" className="pw__link" onClick={() => copy(journeyLink(snapshot()), "long")}>
                  {share.copied === "long" ? "Long link copied" : "Copy a long link instead"}
                </button>
              </p>
            )}
          </section>
        </aside>
      </div>

      {/* ---------- Resources: every course and video search on this path ---------- */}
      <section className={`pw-card pw-skills pw-resources rise${resourcesOpen ? " is-open" : ""}`} style={{ "--i": 3 }} aria-label="Resources">
        <button
          type="button"
          className="pw-skills__toggle"
          onClick={() => setResourcesOpen((v) => !v)}
          aria-expanded={resourcesOpen}
          aria-controls="pw-resources-body"
        >
          <span className="pw-skills__title">
            <span className="pw-skills__h">Resources</span>
            <span className="pw-card__text">{resourceSummary}</span>
          </span>
          <UnpackBox open={resourcesOpen} items={RESOURCES} folder="resources" packed="box-packed" empty="box-empty" />
          <span className="pw-skills__chevron" aria-hidden="true" />
        </button>
        <div className="pw-skills__body" id="pw-resources-body" inert={resourcesOpen ? undefined : ""}>
          <div className="pw-skills__inner">
            <p className="pw-card__text pw-resources__intro">
              Everything on your path in one place, in the same order: checked courses that fit your budget
              {profile.budget === "Free only" ? " (free only)" : ""}, and a video search for every topic.
              {courses && courses !== "error" && <> Courses checked {shortDate(courses.checked)} · <Link to="/data">how we pick them</Link></>}
            </p>
            <ol className="pw-resources__list">
              {[...steps, ...revise].map((t, i) => (
                <li key={t.id}>
                  <div className="pw-resources__topic">
                    <span className="pw-resources__num num">{i + 1}</span>
                    <strong>{t.title}</strong>
                    <span className={`pw-resources__tag pw-resources__tag--${progress[t.id] || "todo"}`}>
                      {i >= steps.length ? "Brush up · " : ""}{STATUS_LABEL[progress[t.id] || "todo"]}
                    </span>
                  </div>
                  <CourseList topic={t} courses={courses} budget={profile.budget} compact note={false} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------- Your skills ---------- */}
      <section className={`pw-card pw-skills rise${skillsOpen ? " is-open" : ""}`} style={{ "--i": 3 }} aria-label="Your skills">
        <button
          type="button"
          className="pw-skills__toggle"
          onClick={() => setSkillsOpen((v) => !v)}
          aria-expanded={skillsOpen}
          aria-controls="pw-skills-body"
        >
          <span className="pw-skills__title">
            <span className="pw-skills__h">Your skills</span>
            <span className="pw-card__text">
              {brought.length} brought · {learned.length} learned here · {extras.length} worth a look
            </span>
          </span>
          <UnpackBox open={skillsOpen} items={TOOLS} folder="tools" packed="toolbox-full" empty="toolbox-empty" />
          <span className="pw-skills__chevron" aria-hidden="true" />
        </button>
        <div className="pw-skills__body" id="pw-skills-body" inert={skillsOpen ? undefined : ""}>
          <div className="pw-skills__inner">
        <div className="pw-skills__head">
          <p className="pw-card__text">What you came in with, what you've learned here, and what's worth a look next.</p>
          {job.peers && (
            <div className="pw-peers">
              <span className="pw-peers__value num">{job.peers.ahead_of}%</span>
              <span className="pw-peers__text">
                You're ahead of {job.peers.ahead_of}% of people coming from other jobs into {sentence(job.title).toLowerCase()}.
              </span>
              <span className="pw-peers__note">
                Estimate: compared with a typical worker from each of {job.peers.group_size} other jobs, using their ESCO skill sets.
              </span>
            </div>
          )}
        </div>
        <div className="pw-skills__cols">
          <div>
            <h4>Skills you brought <span className="num">{brought.length}</span></h4>
            {brought.length ? (
              <ul className="pw-tags">{brought.map((b) => <li key={b}>{b}</li>)}</ul>
            ) : (
              <p className="pw-empty">None added yet.</p>
            )}
          </div>
          <div>
            <h4>Learned on Bridge <span className="num">{learned.length}</span></h4>
            {learned.length ? (
              <ul className="pw-tags">
                {learned.map((l) => (
                  <li key={l.name} className={`pw-tags__${l.status}`}>{l.name} · {STATUS_LABEL[l.status].toLowerCase()}</li>
                ))}
              </ul>
            ) : (
              <p className="pw-empty">Nothing yet. Mark a topic as Learning or Done and it shows up here, and it counts on any pathway.</p>
            )}
          </div>
          <div>
            <h4>Worth looking into</h4>
            {extras.length ? (
              <ul className="pw-tags pw-tags--extra">{extras.map((e) => <li key={e}>{e}</li>)}</ul>
            ) : (
              <p className="pw-empty">No extras for this role.</p>
            )}
            <p className="pw-empty">Optional skills for this role that would make you stand out.</p>
          </div>
        </div>
          </div>
        </div>
      </section>

      {/* ---------- Useful links ---------- */}
      <footer className="pw-foot">
        <span className="pw-foot__label">Useful links</span>
        {menu.map((m) => (
          <button key={m.label} type="button" className={`pw__link${m.danger ? " pw__link--danger" : ""}`} onClick={m.run}>
            {m.label}
          </button>
        ))}
        <Link className="pw__link" to="/data">Data sources</Link>
      </footer>

      {burst > 0 && <Confetti key={burst} />}

      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        job={job}
        ai={ai}
        onConnectAI={() => {
          setProfileOpen(false);
          setConnectOpen(true);
        }}
      />

      <ConnectAI
        open={connectOpen}
        interests={[profile.sports?.[0], profile.hobbies?.[0]].filter(Boolean)}
        continueLabel="Back to my pathway"
        onDone={() => {
          setConnectOpen(false);
          setAi(readAI());
        }}
      />
    </main>
  );
}

const FORMAT_LABEL = { video: "Videos", reading: "Reading", "hands-on": "Hands-on" };
const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

/* Checked courses for one topic (budget-filtered, ordered by learning style), always with a
   YouTube search beside them. If the catalogue can't be reached, plain search links instead. */
function CourseList({ topic, courses, budget, compact = false, note = true }) {
  const cls = `pw-courses${compact ? " pw-courses--compact" : ""}`;
  if (courses === "error") {
    return (
      <div className={cls}>
        <ul className="pw-res">
          {resourcesFor(topic.title).map((r) => (
            <li key={r.where}>
              <a href={r.url} target="_blank" rel="noreferrer">
                <span className="pw-res__label">{r.label}</span>
                <span className="pw-res__where">{r.where}</span>
                {r.free && <span className="pw-res__free">Free</span>}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const entry = courses?.topics[topic.id];
  const list = entry?.courses || [];
  const hidden = entry?.hidden || 0;
  return (
    <div className={cls}>
      <ul className="pw-res">
        {!courses && [0, 1].map((i) => <li key={i} className="pw-res__ghost" aria-hidden="true" />)}
        {list.map((c) => (
          <li key={c.id}>
            <a href={c.url} target="_blank" rel="noreferrer">
              <span className="pw-res__label">{c.title}</span>
              <span className="pw-res__where">
                {c.provider} ·{" "}
                <span title={c.hoursEstimate ? "Our estimate: the provider doesn't give one" : "The provider's own estimate"}>
                  about {c.hours}h
                </span>{" "}
                · {c.level} · {FORMAT_LABEL[c.format] || c.format}
              </span>
              {c.cost === "free" ? (
                <span className="pw-res__free">Free</span>
              ) : (
                <span className="pw-res__price">{c.price}</span>
              )}
            </a>
          </li>
        ))}
        <li>
          <a href={youtubeSearch(topic.title)} target="_blank" rel="noreferrer">
            <span className="pw-res__label">Videos on YouTube</span>
            <span className="pw-res__where">Search for “{topic.title.toLowerCase()} tutorial”</span>
            <span className="pw-res__free">Free</span>
          </a>
        </li>
      </ul>
      {courses && note && (
        <p className="pw-courses__note">
          {list.length === 0 && hidden > 0
            ? `${hidden} paid course${hidden > 1 ? "s fit" : " fits"} this topic, hidden because your budget is free only. `
            : list.length === 0
            ? "No checked course fits this exact topic yet, so here's a video search. "
            : budget === "Free only"
            ? "Free courses only, from your budget answer. "
            : ""}
          Courses checked {shortDate(courses.checked)} · <Link to="/data">how we pick them</Link>
        </p>
      )}
    </div>
  );
}

/* After editing the profile: what the automatic recalibration changed */
function RecalBanner({ recal, onClose }) {
  const { state, before, after, better } = recal;
  let text;
  if (state === "running") text = "Recalibrating your pathway with your new details…";
  else if (state === "error") text = "Your details are saved, but we couldn't recalibrate right now. Try again later.";
  else if (after.familiarity === before.familiarity && after.score === before.score) text = "Your details are saved. Your pathway stays the same.";
  else
    text = `Recalibrated with your new details: familiar ${before.familiarity}% → ${after.familiarity}%, Bridge score ${before.score}% → ${after.score}%, about ${before.hours}h → ${after.hours}h to learn.`;
  return (
    <div className={`pw-recal pw-recal--${state}`} role="status">
      <p>{text}</p>
      {state === "done" && (
        <Link to="/results" className="pw-recal__link">
          {better ? `${sentence(better.title)} now fits you a bit better (${better.score}%). See other choices` : "See other choices"}
        </Link>
      )}
      {state !== "running" && (
        <button type="button" className="pw-recal__close" onClick={onClose} aria-label="Dismiss">×</button>
      )}
    </div>
  );
}

/* The "⋯" menu on the pathway header */
function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="pw-menu" ref={ref}>
      <button type="button" className="pw-menu__btn" aria-haspopup="menu" aria-expanded={open} aria-label="More options" onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <ul className="pw-menu__list" role="menu">
          {items.map((m) => (
            <li key={m.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={m.danger ? "is-danger" : ""}
                onClick={() => {
                  setOpen(false);
                  m.run();
                }}
              >
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusDot({ status }) {
  // keyed by status so the pop animation replays on every change
  return <span key={status} className={`pw-dot pw-dot--${status} pop`} aria-hidden="true" />;
}

function TickIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

/* Number that counts towards its new value instead of jumping */
function CountUp({ value }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current;
    if (a === value) return;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / 600);
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3)));
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

/* The same bubble circle as the results page, static, with progress coloured in */
function MiniBubbles({ job, progress, complete }) {
  const shape = useMemo(() => {
    // Starts as the exact picture on the results page; topics you start or finish turn green.
    // Once the path is complete, optional topics you never started go plain grey.
    const topics = job.topics.map((t) => {
      const status = progress[t.title] || "todo";
      return status === "todo" ? t : { ...t, coverage: effectiveCoverage(t, status) };
    });
    const bubbles = pickBubbles(job.topics, job.familiarity).map((b) => {
      const t = topics[b.topic];
      if ((progress[t.title] || "todo") !== "todo") return { ...b, filled: true };
      return complete && t.relation === "optional" ? { ...b, filled: false } : b;
    });
    const { radii, points, outer } = packTopics(bubbles, job.uri);
    return { topics, bubbles, radii, points, outer };
  }, [job, progress, complete]);
  const size = 220;
  const k = size / 2 / shape.outer;
  return (
    <svg className="pw-bubbles" viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} width={size} height={size} aria-hidden="true">
      {shape.bubbles.map((b, i) => (
        <circle
          key={i}
          cx={shape.points[i].x * k}
          cy={shape.points[i].y * k}
          r={shape.radii[i] * k}
          className={`pw-bubble topic--${b.filled ? knownTier(shape.topics[b.topic].coverage) : "new"}`}
          style={{ "--i": i }}
        >
          <title>{sentence(shape.topics[b.topic].title)}</title>
        </circle>
      ))}
    </svg>
  );
}

/* Confetti: ~70 small shapes fall across the screen for a few seconds, then it removes itself */
const CONFETTI_COLOURS = ["var(--done-default)", "var(--familiar-default)", "var(--sky-default)", "var(--highlight-default)", "var(--ink)"];

function Confetti() {
  const [on, setOn] = useState(true);
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 240,
        spin: (Math.random() - 0.5) * 1440,
        size: 6 + Math.random() * 8,
        round: i % 3 === 0,
        colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
      })),
    []
  );
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 4500);
    return () => clearTimeout(t);
  }, []);
  if (!on || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((c, i) => (
        <span
          key={i}
          className={`confetti__piece${c.round ? " confetti__piece--round" : ""}`}
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.round ? c.size : c.size * 0.45,
            background: c.colour,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            "--drift": `${c.drift}px`,
            "--spin": `${c.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}

/* Right side of the header: the growth stage for today's familiarity */
function GrowthStage({ familiarity }) {
  const i = STAGES.findLastIndex((st) => familiarity >= st.from);
  const stage = STAGES[i];
  return (
    <div className="pw-stage" aria-label={`Growth stage: ${stage.label}`}>
      <img key={stage.img} className="pw-stage__img" src={`/stages/${stage.img}.webp`} alt="" width="128" height="128" />
      <p className="label-mono">Stage {i + 1} of {STAGES.length}</p>
      <p className="pw-stage__label">{stage.label}</p>
      <p className="pw-stage__text">{stage.text}</p>
    </div>
  );
}

/* A box that unpacks: closed, its things are inside (Your skills: tools in a toolbox;
   Resources: a globe, video, papers in a shipping box); open, they arc out, the empty box
   fades away and they spread over the whole strip. 3D icons from thiings.co; the empty toolbox and the packed box are our edits. */
const TOOLS = [
  // where each tool lands, from the box's opening (px), and its tilt
  { img: "wrench", x: -236, y: -6, r: -32 },
  { img: "screwdriver", x: -194, y: 34, r: 24 },
  { img: "claw-hammer", x: -152, y: -10, r: -14 },
  { img: "nail", x: -110, y: 30, r: 48 },
  { img: "adjustable-wrench", x: -68, y: -8, r: 18 },
  { img: "screw", x: -26, y: 34, r: -22 },
  { img: "hammer", x: 16, y: -4, r: 10 },
];

const RESOURCES = [
  { img: "globe", x: -236, y: -8, r: -10 },
  { img: "book", x: -194, y: 32, r: 8 },
  { img: "video", x: -152, y: -10, r: -12 },
  { img: "document", x: -110, y: 30, r: 14 },
  { img: "laptop", x: -68, y: -6, r: -6 },
  { img: "certificate", x: -26, y: 32, r: 12 },
  { img: "graduation", x: 16, y: -4, r: -8 },
];

function UnpackBox({ open, items, folder, packed, empty }) {
  return (
    <span className={`pw-toolbox${open ? " is-open" : ""}`} aria-hidden="true">
      {items.map((t, i) => (
        <span
          key={t.img}
          className="pw-tool"
          style={{ "--tx": `${t.x}px`, "--ty": `${t.y}px`, "--rot": `${t.r}deg`, "--d": `${(open ? i : items.length - 1 - i) * 45}ms` }}
        >
          <img src={`/${folder}/${t.img}.webp`} alt="" width="40" height="40" />
        </span>
      ))}
      <img className="pw-toolbox__box pw-toolbox__box--empty" src={`/${folder}/${empty}.webp`} alt="" width="96" height="96" />
      <img className="pw-toolbox__box pw-toolbox__box--full" src={`/${folder}/${packed}.webp`} alt="" width="96" height="96" />
    </span>
  );
}
