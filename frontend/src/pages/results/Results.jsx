import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BrandMark from "../../components/BrandMark.jsx";
import { fetchMatch } from "../../api.js";
import TopicField, { TIERS } from "./TopicField.jsx";
import { pickBubbles } from "./layout.js";
import JobDetails, { causeList } from "./JobDetails.jsx";
import ConnectAI, { readAI } from "../../components/ConnectAI.jsx";
import { useGo } from "../../lib/go.js";
import "./Results.css";

/*
  Results: the matcher runs, the job's topics pop up as chips (coloured = you know
  something of it), the chips turn into bubbles and pour into one circle.
  Then the top match is shown with the other options on both sides; picking one
  slides it into the middle and the current one moves to the other side.
*/

const STEPS = ["Reading your profile", "Matching familiarities", "Checking future demand", "Mapping what you know"];
const MIN_LOADING_MS = 900;
const HOLD_CHIPS_MS = 1000;
const MORPH_MS = 650;
const TRAVEL_MS = 1300;

const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// A profile with nothing to match on (e.g. onboarding opened but not answered) counts as none
const hasEvidence = (p) =>
  !!p && ["skills", "roles", "projects", "courses"].some((k) => p[k]?.length) || !!p?.eduField;

function readProfile() {
  try {
    const p = JSON.parse(localStorage.getItem("bridge.profile") || "null");
    return hasEvidence(p) ? p : null;
  } catch {
    return null;
  }
}

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Results() {
  const navigate = useNavigate();
  const go = useGo(); // the job title flies into the pathway header
  const [profile] = useState(readProfile);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState("loading"); // loading | chips | blobs | settled
  const [uiIn, setUiIn] = useState(false);
  const [picked, setPicked] = useState(null); // position in the line; null = the best match (middle)
  const [details, setDetails] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [reduced] = useState(prefersReducedMotion);

  const stageRef = useRef(null);
  const slotRef = useRef(null);
  const toastRef = useRef(null);
  const brandRef = useRef(null);
  const [geo, setGeo] = useState({ stage: { w: 0, h: 0, vh: 0 }, slot: { cx: 0, cy: 0, size: 0 }, avoid: [], area: null });
  // The logo is a tab joined to the top of the loading toast (it slides up from behind it),
  // then glides to the top-left once the results settle
  const docked = phase === "settled" && !error;
  const brandFrom = useRef(null);

  // 1. Ask the matcher
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const started = performance.now();
    setError(null);
    // Comfort comes from onboarding (0..100); the matcher wants 0..1
    fetchMatch(profile, (profile.comfort ?? 50) / 100)
      .then((res) => {
        const wait = Math.max(0, MIN_LOADING_MS - (performance.now() - started));
        setTimeout(() => !cancelled && setData(res), reduced ? 0 : wait);
      })
      .catch(() => !cancelled && setError("We couldn't reach Bridge's matcher. Check that the backend is running, then try again."));
    return () => {
      cancelled = true;
    };
  }, [profile, attempt, reduced]);

  // The top matches, plus the role you're eyeing at the end when it isn't one of them
  const results = useMemo(() => {
    const top = data?.results || [];
    const eyed = data?.eyed;
    return eyed && !top.some((r) => r.uri === eyed.uri) ? [...top, eyed] : top;
  }, [data]);
  const topCount = data?.results?.length || 0;
  // The options sit in one line, best match in the middle, the rest alternating
  // outwards (2nd best right of it, 3rd left, 4th right...). Not circular: the ends stop.
  const line = useMemo(() => {
    const out = [];
    results.forEach((_, rank) => (rank % 2 ? out.push(rank) : out.unshift(rank)));
    return out;
  }, [results]);
  const center = line.indexOf(0);
  const active = picked ?? center;
  const job = results[line[active]];
  // One chip per bubble of the top match
  const chipCount = results[0] ? pickBubbles(results[0].topics, results[0].familiarity).length : 0;
  // Chips populate over ~2.4 s whatever their number
  const chipStagger = Math.max(30, Math.min(140, Math.round(2400 / Math.max(1, chipCount))));

  // 2. Run the animation once the results are in
  useEffect(() => {
    if (!data) return;
    if (!results.length || reduced) {
      setPhase("settled");
      setUiIn(true);
      return;
    }
    const chipsDone = chipCount * chipStagger + 500;
    const t = [];
    setPhase("chips");
    t.push(setTimeout(() => setPhase("blobs"), chipsDone + HOLD_CHIPS_MS));
    t.push(setTimeout(() => setPhase("settled"), chipsDone + HOLD_CHIPS_MS + MORPH_MS));
    t.push(setTimeout(() => setUiIn(true), chipsDone + HOLD_CHIPS_MS + MORPH_MS + TRAVEL_MS - 300));
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Measure where the circle goes and what the chips must avoid (relative to the stage)
  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const s = stage.getBoundingClientRect();
    const rel = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
    };
    const slot = rel(slotRef.current);
    setGeo({
      stage: { w: s.width, h: s.height, vh: Math.min(s.height, window.innerHeight) },
      slot: slot ? { cx: slot.x + slot.w / 2, cy: slot.y + slot.h / 2, size: Math.min(slot.w, slot.h) } : { cx: 0, cy: 0, size: 0 },
      avoid: [rel(toastRef.current), rel(brandRef.current)].filter(Boolean),
      // Chips may use the whole window, not just the content frame (in stage coordinates)
      area: { x: 24 - s.left, y: 24 - s.top, w: window.innerWidth - 48, h: window.innerHeight - 48 },
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [measure, data]);

  useLayoutEffect(() => {
    const el = brandRef.current;
    if (!el) return;
    if (!docked) {
      brandFrom.current = el.getBoundingClientRect();
      return;
    }
    const from = brandFrom.current;
    brandFrom.current = null;
    if (!from || reduced) return;
    const to = el.getBoundingClientRect();
    el.animate(
      [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: "none" }],
      { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  }, [docked, reduced, phase]); // re-measured each phase: at first the tab is still tucked behind the toast

  // 3. Switching jobs: slide cards between the middle and the sides (FLIP)
  const flipFrom = useRef(null);
  const select = useCallback((i) => {
    const rects = new Map();
    document.querySelectorAll("[data-flip]").forEach((el) => rects.set(el.dataset.flip, el.getBoundingClientRect()));
    flipFrom.current = rects;
    setPicked(i);
  }, []);

  useLayoutEffect(() => {
    const before = flipFrom.current;
    flipFrom.current = null;
    if (!before || reduced) return;
    document.querySelectorAll("[data-flip]").forEach((el) => {
      const b = before.get(el.dataset.flip);
      if (!b) return;
      const a = el.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${b.width / a.width})`, opacity: 0.4 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 560, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
    });
  }, [active, reduced]);

  // Arrow keys move between options
  const n = results.length;
  useEffect(() => {
    if (!uiIn || n < 2) return;
    const onKey = (e) => {
      if (details || e.target.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight" && active < n - 1) select(active + 1);
      if (e.key === "ArrowLeft" && active > 0) select(active - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [uiIn, n, active, details, select]);

  if (!profile) {
    return (
      <main className="results results--empty">
        <h2>No profile yet</h2>
        <p>Answer a few questions first, then Bridge can find your matches.</p>
        <Link className="btn btn--primary" to="/onboarding">Go to onboarding</Link>
      </main>
    );
  }

  // Everything before the selected one in the line sits on the left, everything after on the right
  const left = line.slice(0, active).map((rank, k) => ({ rank, pos: k }));
  const right = line.slice(active + 1).map((rank, k) => ({ rank, pos: active + 1 + k }));
  // Phones stack everything, so the other options become one list in rank order
  const narrow = useNarrow();
  const others = [...left, ...right].sort((a, b) => a.rank - b.rank);

  function choosePathway() {
    try {
      localStorage.setItem("bridge.selectedJob", JSON.stringify(job));
    } catch {
      /* storage blocked */
    }
    // Offer to connect a personal AI first (unless one is already connected); either way we land on the pathway
    setDetails(false);
    if (readAI()) go("/pathway");
    else setConnectOpen(true);
  }

  const stepIndex = phase === "loading" ? 0 : phase === "chips" ? 1 : phase === "blobs" ? 2 : 3;
  const progress = error ? 0 : [0.16, 0.7, 0.9, 1][stepIndex];

  return (
    <main className={`results${uiIn ? " results--in" : ""}`} ref={stageRef}>
      {docked && (
        <div className="results__brand night" ref={brandRef}>
          <BrandMark />
        </div>
      )}

      {/* Loading toast */}
      <div
        className={`loader${phase === "settled" && !error ? " loader--out" : ""}${error ? " loader--error" : ""}`}
        ref={toastRef}
        role="status"
        aria-live="polite"
      >
        {!docked && (
          <div className="loader__tab" ref={brandRef}>
            <BrandMark />
          </div>
        )}
        {error ? (
          <>
            <p className="loader__title">Something went wrong</p>
            <p className="loader__step loader__step--wrap">{error}</p>
            <button type="button" className="loader__retry" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </>
        ) : (
          <>
            <p className="loader__title">Analysing your profile</p>
            <span className="loader__bar">
              <span
                className="loader__fill"
                style={{
                  transform: `scaleX(${progress})`,
                  transitionDuration: phase === "chips" ? `${chipCount * chipStagger + 500 + HOLD_CHIPS_MS}ms` : "600ms",
                }}
              />
            </span>
            <p className="loader__step" key={stepIndex}>{STEPS[stepIndex]}</p>
          </>
        )}
      </div>

      {job && (
        <TopicField
          key={job.uri}
          topics={job.topics}
          familiarity={job.familiarity}
          seed={job.uri}
          phase={job === results[0] ? phase : "settled"}
          stage={geo.stage}
          slot={geo.slot}
          avoid={geo.avoid}
          area={geo.area}
          chipStagger={chipStagger}
          reduced={reduced}
        />
      )}

      {data && !results.length && (
        <section className="results__none">
          <h2>No matches yet</h2>
          <p>Add a few more skills or roles and Bridge will have more to work with.</p>
          <Link className="btn btn--primary" to="/onboarding">Edit my answers</Link>
        </section>
      )}

      {job && (
        <>
          <section className="results__hero" aria-label="How much you already know">
            <div className="results__diagram" ref={slotRef} />
            <Stat job={job} run={uiIn} />
          </section>

          <section className="results__main">
            <JobCard job={job} rank={line[active] + 1} total={topCount} />
            {data.eyed_unmatched && (
              <p className="results__eyed-note">
                “{data.eyed_unmatched}” isn’t one of the roles Bridge covers yet, so it isn’t shown. These are the closest fits to what you know.
              </p>
            )}
            <div className="results__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setDetails(true)}>
                View more details
              </button>
              <button type="button" className="btn btn--primary" onClick={choosePathway}>
                Select pathway
              </button>
            </div>
            <span className="hint" tabIndex={0}>
              <button type="button" className="results__reanalyse" disabled>
                <RefreshIcon /> Re-analyse
              </button>
              <span className="hint__bubble" role="tooltip">
                Re-analysing is off in the demo. The full version re-checks your answers against fresh job data.
              </span>
            </span>
          </section>

          {n > 1 && (
            <>
              <button type="button" className="results__arrow results__arrow--left" onClick={() => select(active - 1)} disabled={active === 0} aria-label="Previous option">
                <Chevron dir="left" />
              </button>
              <button type="button" className="results__arrow results__arrow--right" onClick={() => select(active + 1)} disabled={active === n - 1} aria-label="Next option">
                <Chevron dir="right" />
              </button>
              {narrow ? (
                <OptionList side="all" items={others} results={results} onPick={select} />
              ) : (
                <>
                  <OptionList side="left" items={left} results={results} onPick={select} />
                  <OptionList side="right" items={right} results={results} onPick={select} />
                </>
              )}
            </>
          )}

          <JobDetails job={job} open={details} onClose={() => setDetails(false)} onPathway={choosePathway} />
          <ConnectAI
            open={connectOpen}
            interests={[profile.sports?.[0], profile.hobbies?.[0]].filter(Boolean)}
            continueLabel="Go to my pathway"
            onDone={() => {
              setConnectOpen(false);
              go("/pathway");
            }}
          />
        </>
      )}
    </main>
  );
}

/* "You're already familiar with 38% of what this role needs" */
function Stat({ job, run }) {
  const value = useCountUp(job.familiarity, run);
  const known = job.topics.filter((t) => t.coverage >= 0.2);
  return (
    <div className="stat">
      <p className="stat__lead">You’re already familiar with</p>
      <p className="stat__value num">{value}<small>%</small></p>
      <p className="stat__lead">of what this role needs</p>
      <p className="stat__hint">Coloured bubbles are what you already know, grey ones are new. Hover one to see its topic.</p>
      <ul className="stat__legend">
        {TIERS.map((t) => (
          <li key={t.key}>
            <span className={`stat__dot topic--${t.key}`} />
            {t.label}
          </li>
        ))}
      </ul>
      {/* Screen readers get the bubble contents as a list */}
      <ul className="visually-hidden">
        {known.map((t) => (
          <li key={t.title}>{`${sentence(t.title)}: overlap from ${t.from}`}</li>
        ))}
      </ul>
    </div>
  );
}

function useCountUp(target, run) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!run) return;
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / 700);
      const v = Math.round(a + (target - a) * (1 - Math.pow(1 - k, 3)));
      setValue(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return value;
}

export function demandLabel(job) {
  const b = job.demand?.balanced;
  if (b == null) return "No data";
  return b >= 70 ? "High" : b >= 45 ? "Medium" : "Low";
}

export function scoreTone(score) {
  return score >= 70 ? "good" : score >= 45 ? "mid" : "low";
}

const PART_LABEL = { F: "Familiarity", E: "Ease", D: "Demand", I: "Interest fit" };

function JobCard({ job, rank, total }) {
  // Same bubbles as the diagram, so the count matches what you see
  const bubbles = pickBubbles(job.topics, job.familiarity);
  const known = bubbles.filter((b) => b.filled).length;
  return (
    <article className="job-card" data-flip={job.uri}>
      <div className="job-card__top">
        <div className="job-card__head">
          <p className={`job-card__kicker${rank === 1 ? " job-card__kicker--best" : job.eyed ? " job-card__kicker--eyed" : ""}`}>
            {rank === 1 ? (job.eyed ? "Best match · the role you’re eyeing" : "Best match") : job.eyed ? "The role you’re eyeing" : `Option ${rank} of ${total}`}
            <span className="hint hint--below job-card__score-info" tabIndex={0} aria-label="How the Bridge score is built">
              <InfoIcon />
              <span className="hint__bubble hint__bubble--wide" role="tooltip">
                <strong>How the Bridge score is built</strong>
                {Object.entries(job.breakdown).map(([k, part]) => (
                  <span className="breakdown-row" key={k}>
                    <span>{PART_LABEL[k]}</span>
                    <span className="num">{part.value} × {Math.round(part.weight * 100)}%</span>
                  </span>
                ))}
                {job.cause_boost > 0 && (
                  <span className="breakdown-row">
                    <span>Your cause</span>
                    <span className="num">+{job.cause_boost}</span>
                  </span>
                )}
              </span>
            </span>
          </p>
          <h1 className="job-card__title" title={sentence(job.title)}>{sentence(job.title)}</h1>
          {job.eyed && (
            <p className="job-card__eyed">
              #{job.eyed.rank} of {job.eyed.of} roles by Bridge score
              {job.eyed.query.trim().toLowerCase() !== job.title.toLowerCase() && ` · closest match to “${job.eyed.query.trim()}”`}
            </p>
          )}
        </div>
        <ScoreRing value={job.score} />
      </div>
      <ul className="job-card__meta">
        <li className="hint" tabIndex={0}>
          <ClockIcon />
          <span className="num">{job.hours}h</span>
          <span className="hint__bubble" role="tooltip">
            About {job.hours} hours to learn what’s missing ({job.weeks} weeks at your pace). An estimate.
          </span>
        </li>
        <li className="hint" tabIndex={0}>
          <CapIcon />
          <span className="num">{known}/{bubbles.length}</span>
          <span className="hint__bubble" role="tooltip">
            You already know {known} of the {bubbles.length} topics shown above.
          </span>
        </li>
        <li className="hint" tabIndex={0}>
          <TrendIcon />
          <span>{demandLabel(job)}</span>
          <span className="hint__bubble" role="tooltip">
            {job.demand
              ? `Future demand: ${job.demand.moderate}/100 if AI change is moderate, ${job.demand.fast}/100 if it's fast (higher is better). Estimate from job ads, O*NET and ILO data.`
              : "No demand data for this job yet."}
          </span>
        </li>
        {job.sdgs?.length > 0 && (
          <li className="hint" tabIndex={0}>
            <GlobeIcon />
            <span>SDG {job.sdgs.map((g) => g.goal).join(" · ")}</span>
            <span className="hint__bubble" role="tooltip">
              {job.sdgs.map((g) => `SDG ${g.goal}, ${g.name}: ${g.reason}`).join(" ")}
              {job.cause_boost > 0 && ` +${job.cause_boost} points because you care about ${causeList(job.causes_matched)}.`}
            </span>
          </li>
        )}
      </ul>
    </article>
  );
}

/* Bridge score ring: fills from empty whenever the score changes */
function ScoreRing({ value }) {
  const R = 33;
  const C = 2 * Math.PI * R;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className={`ring tone--${scoreTone(value)}`} role="img" aria-label={`Bridge score ${value}%`}>
      <svg viewBox="0 0 76 76" aria-hidden="true">
        <circle className="ring__track" cx="38" cy="38" r={R} />
        <circle className="ring__value" cx="38" cy="38" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - shown / 100)} />
      </svg>
      <span className="ring__text">
        <span className="ring__num num">{value}%</span>
        <span className="ring__label">Bridge</span>
      </span>
    </div>
  );
}

const NARROW = "(max-width: 760px)";

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(NARROW).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW);
    if (!mq) return;
    const update = () => setNarrow(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

function OptionList({ side, items, results, onPick }) {
  if (!items.length) return <div className={`options options--${side}`} />;
  return (
    <nav className={`options options--${side}`} aria-label={side === "all" ? "Other options" : `Other options (${side})`}>
      <p className="options__heading">Other options</p>
      <ul>
        {items.map(({ rank, pos }) => (
          <li key={results[rank].uri}>
            <button type="button" className="option" data-flip={results[rank].uri} onClick={() => onPick(pos)} title={sentence(results[rank].title)}>
              <span className="option__title">
                {results[rank].eyed && <span className="option__eyed">You’re eyeing</span>}
                {sentence(results[rank].title)}
              </span>
              <span className="option__score num">{results[rank].score}%</span>
              <span className="option__bar" aria-hidden="true"><span style={{ width: `${results[rank].score}%` }} /></span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* Icons (stroke, 18px) */
const svg = (children, size = 18) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const ClockIcon = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
const CapIcon = () => svg(<><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /></>);
const GlobeIcon = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></>);
const TrendIcon = () => svg(<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>);
const InfoIcon = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>, 16);
const RefreshIcon = () => svg(<><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>, 16);
const Chevron = ({ dir }) => svg(dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />, 28);
