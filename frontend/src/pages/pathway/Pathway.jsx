import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fetchMatch } from "../../api.js";
import BrandMark from "../../components/BrandMark.jsx";
import ConnectAI, { AI_PROVIDERS, readAI, saveAI } from "../../components/ConnectAI.jsx";
import ProfileSheet from "../../components/ProfileSheet.jsx";
import { knownTier, packTopics, pickBubbles } from "../results/layout.js";
import { SKILL_LEVELS } from "../onboarding/steps.js";
import {
  STATUS,
  STATUS_LABEL,
  alreadyHave,
  buildSteps,
  currentFamiliarity,
  learnedTopics,
  readProgress,
  resourcesFor,
  saveProgress,
  topicsWithProgress,
  worthLookingInto,
} from "./pathwayData.js";
import "./Pathway.css";

/*
  My pathway: the home page once a job is picked. Rough first version for review.
  Up next (the one thing to do now), the full path, your AI, this week's time,
  and a read-only share link for employers.
  Coming back from editing the profile (?updated=1) re-runs the matcher for this job
  automatically and says what changed; the pathway only changes if you pick another.
*/

const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export default function Pathway() {
  const navigate = useNavigate();
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
  const [shared, setShared] = useState(false);

  const steps = useMemo(() => (job ? buildSteps(job) : []), [job]);

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
        <Link className="pw__btn pw__btn--primary" to="/results">See my options</Link>
      </main>
    );
  }

  const familiarity = currentFamiliarity(job, progress);
  const upNext = steps.find((s) => progress[s.id] !== "done");
  const doneCount = steps.filter((s) => progress[s.id] === "done").length;
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

  const cycle = (id) => setStatus(id, STATUS[(STATUS.indexOf(progress[id] || "todo") + 1) % STATUS.length]);

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
    { label: "Change pathway", run: () => navigate("/results") },
    { label: "Edit my details", run: () => setProfileOpen(true) },
    { label: provider ? `Disconnect ${provider.name}` : "Connect your AI", run: toggleAI },
    { label: "Start from scratch", run: startOver, danger: true },
  ];

  // Everything you came in with: skills (with level) and the tools from your roles
  const brought = [
    ...(profile.skills || []).filter((sk) => sk.name).map((sk) => `${sk.name} · ${SKILL_LEVELS[sk.level]?.toLowerCase() || "basics"}`),
    ...new Set((profile.roles || []).flatMap((r) => r.tools || [])),
  ];
  const learned = learnedTopics(progress);
  const extras = worthLookingInto(job);

  function share() {
    const link = `${window.location.origin}/journey/demo`;
    navigator.clipboard?.writeText(link).catch(() => {});
    setShared(true);
  }

  const prompt = upNext
    ? `Explain "${upNext.title}" to me using a ${interest.toLowerCase()} analogy. I already know ${upNext.buildsOn || "graphic design"}, so start from there. Then give me 3 quick questions to check I've got it.`
    : "";

  return (
    <main className="pw">
      <div className="pw__brand">
        <BrandMark />
      </div>

      <button type="button" className="pw__me" onClick={() => setProfileOpen(true)} aria-label="Open my profile">
        <span className="pw__me-avatar" aria-hidden="true">{(profile.name || "Y").charAt(0).toUpperCase()}</span>
        <span className="pw__me-name">{profile.name || "My profile"}</span>
      </button>

      {recal && <RecalBanner recal={recal} onClose={() => setRecal(null)} />}

      {/* ---------- Header ---------- */}
      <section className="pw-head">
        <MoreMenu items={menu} />
        <MiniBubbles job={job} progress={progress} />
        <div className="pw-head__text">
          <p className="label-mono">My pathway</p>
          <h1 className="pw-head__title">{sentence(job.title)}</h1>
          <p className="pw-head__meta">
            Bridge score <strong className="num">{job.score}%</strong> · {steps.length} topics to learn · about {weeksLeft} weeks at {perWeek}h a week
          </p>
          <div className="pw-progress">
            <div className="pw-progress__row">
              <span>Familiar now</span>
              <span className="num">{familiarity}% → 100%</span>
            </div>
            <span className="pw-progress__bar"><span style={{ width: `${familiarity}%` }} /></span>
            <span className="pw-progress__note">
              Started at {job.familiarity}% · {doneCount} of {steps.length} topics done
            </span>
          </div>
          <Link to="/results" className="pw__link">← Back to my options</Link>
        </div>
      </section>

      <div className="pw-grid">
        {/* ---------- Main column ---------- */}
        <div className="pw-main">
          {upNext ? (
            <section className="pw-card pw-next" aria-label="Up next">
              <p className="label-mono">Up next</p>
              <h2 className="pw-next__title">{upNext.title}</h2>
              <p className="pw-next__bridge">
                {upNext.buildsOn ? (
                  <>
                    <span className="pw-chip pw-chip--known">{upNext.buildsOn}</span>
                    <span className="pw-next__arrow" aria-hidden="true">→</span>
                    <span className="pw-chip">{upNext.title}</span>
                  </>
                ) : upNext.refresher ? (
                  <span className="pw-next__new">You've touched on this before, so this one is a refresher.</span>
                ) : (
                  <span className="pw-next__new">New ground: nothing you know maps to this yet.</span>
                )}
              </p>
              <p className="pw-next__meta">About {upNext.hours} hours · {upNext.type === "knowledge" ? "Knowledge" : "Skill"}</p>

              <ul className="pw-res">
                {resourcesFor(upNext.title).map((r) => (
                  <li key={r.where}>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      <span className="pw-res__label">{r.label}</span>
                      <span className="pw-res__where">{r.where}</span>
                      {r.free && <span className="pw-res__free">Free</span>}
                    </a>
                  </li>
                ))}
              </ul>

              <div className="pw-next__actions">
                <button type="button" className={`pw-status pw-status--${progress[upNext.id] || "todo"}`} onClick={() => cycle(upNext.id)}>
                  <StatusDot status={progress[upNext.id] || "todo"} /> {STATUS_LABEL[progress[upNext.id] || "todo"]}
                </button>
                {provider ? (
                  <button type="button" className="pw__btn pw__btn--ghost" onClick={() => setAskOpen((v) => !v)}>
                    Ask {provider.name} to explain it with {interest.toLowerCase()}
                  </button>
                ) : (
                  <button type="button" className="pw__btn pw__btn--ghost" onClick={() => setConnectOpen(true)}>
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
            <section className="pw-card pw-next">
              <p className="label-mono">All done</p>
              <h2 className="pw-next__title">You've covered every topic on this path.</h2>
            </section>
          )}

          <section className="pw-card" aria-label="Your path">
            <div className="pw-card__head">
              <h3>Your path</h3>
              <span className="pw-card__note">Closest to what you know first</span>
            </div>
            <ol className="pw-path">
              {steps.map((s, i) => {
                const status = progress[s.id] || "todo";
                return (
                  <li key={s.id} className={`pw-step pw-step--${status}${s === upNext ? " is-next" : ""}`}>
                    <span className="pw-step__num num">{i + 1}</span>
                    <div className="pw-step__text">
                      <span className="pw-step__title">{s.title}</span>
                      <span className="pw-step__sub">
                        {s.buildsOn ? `Builds on ${s.buildsOn}` : s.refresher ? "Refresher" : "New ground"} · {s.hours}h
                      </span>
                    </div>
                    <button type="button" className={`pw-status pw-status--${status}`} onClick={() => cycle(s.id)} aria-label={`${s.title}: ${STATUS_LABEL[status]}. Change status`}>
                      <StatusDot status={status} /> {STATUS_LABEL[status]}
                    </button>
                  </li>
                );
              })}
            </ol>
            {alreadyHave(job).length > 0 && (
              <p className="pw-have">
                <strong>Already yours:</strong> {alreadyHave(job).join(", ")}
              </p>
            )}
          </section>
        </div>

        {/* ---------- Side column ---------- */}
        <aside className="pw-side">
          <section className="pw-card" aria-label="Your AI">
            <div className="pw-card__head">
              <h3>Your AI</h3>
              <span className={`pw-pill${provider ? " pw-pill--on" : ""}`}>{provider ? "Connected" : "Not connected"}</span>
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
                      <button type="button" className="pw__btn pw__btn--primary pw__btn--sm" onClick={() => setStatus(upNext.id, "learning")}>
                        Accept
                      </button>
                      <button type="button" className="pw__btn pw__btn--ghost pw__btn--sm" onClick={() => setSuggestionDismissed(true)}>
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
                <button type="button" className="pw__btn pw__btn--primary pw__btn--sm" onClick={() => setConnectOpen(true)}>
                  Connect your AI
                </button>
              </>
            )}
          </section>

          <section className="pw-card" aria-label="This week">
            <div className="pw-card__head">
              <h3>This week</h3>
              <span className="pw-card__note num">
                {weekHours} / {perWeek}h
              </span>
            </div>
            <span className="pw-progress__bar"><span style={{ width: `${Math.min(100, (weekHours / perWeek) * 100)}%` }} /></span>
            <div className="pw-week__actions">
              <button type="button" className="pw__btn pw__btn--ghost pw__btn--sm" onClick={() => logHour(1)}>
                + Log an hour
              </button>
              <button
                type="button"
                className="pw__btn pw__btn--ghost pw__btn--sm"
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

          <section className="pw-card pw-missing" aria-label="Edit my details">
            <h3>Something missing?</h3>
            <p className="pw-card__text">
              Finished a course or picked up a new skill? Add it and your pathway recalibrates on its own.
            </p>
            <button type="button" className="pw__btn pw__btn--ghost pw__btn--sm" onClick={() => setProfileOpen(true)}>
              Edit my details
            </button>
          </section>

          <section className="pw-card" aria-label="Share my journey">
            <h3>Share my journey</h3>
            <p className="pw-card__text">
              A read-only link for an employer or HR: your chosen path and progress. Only you decide who gets it.
            </p>
            <button type="button" className="pw__btn pw__btn--ghost pw__btn--sm" onClick={share}>
              {shared ? "Link copied (demo)" : "Copy share link"}
            </button>
          </section>
        </aside>
      </div>

      {/* ---------- Your skills ---------- */}
      <section className="pw-card pw-skills" aria-label="Your skills">
        <div className="pw-skills__head">
          <div>
            <h3>Your skills</h3>
            <p className="pw-card__text">What you came in with, what you've learned here, and what's worth a look next.</p>
          </div>
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
      </section>

      {/* ---------- Useful links ---------- */}
      <footer className="pw-foot">
        <span className="pw-foot__label">Useful links</span>
        {menu.map((m) => (
          <button key={m.label} type="button" className={`pw__link${m.danger ? " pw__link--danger" : ""}`} onClick={m.run}>
            {m.label}
          </button>
        ))}
      </footer>

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
  return <span className={`pw-dot pw-dot--${status}`} aria-hidden="true" />;
}

/* The same bubble circle as the results page, static, with progress coloured in */
function MiniBubbles({ job, progress }) {
  const shape = useMemo(() => {
    const topics = topicsWithProgress(job, progress);
    const bubbles = pickBubbles(topics, currentFamiliarity(job, progress));
    const { radii, points, outer } = packTopics(bubbles, job.uri);
    return { topics, bubbles, radii, points, outer };
  }, [job, progress]);
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
        >
          <title>{sentence(shape.topics[b.topic].title)}</title>
        </circle>
      ))}
    </svg>
  );
}
