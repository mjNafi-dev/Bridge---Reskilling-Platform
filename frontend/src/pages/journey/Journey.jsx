import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import BrandMark from "../../components/BrandMark.jsx";
import { fetchCandidates } from "../../api.js";
import { readJourney } from "../../lib/journey.js";
import { sameCode, splitCodes } from "../../lib/hire.js";
import { SKILL_LEVELS } from "../onboarding/steps.js";
import "../data/DataSources.css"; // header and cards
import "../../styles/dash.css";
import "./Journey.css";

/*
  Shared journeys: a CV (background, skills, interests) and more (the role they're
  working towards and what they've learned on Bridge so far).
  /journey?c=K7M-2QX,DEMO-AINA → journeys saved under share codes (one or several)
  /journey#…                   → an older share link: the snapshot is in the link itself
  Laid out like the university dashboard: a floating side panel lists the journeys (pick
  one, remove one, add more by code; the arrow keys step through them), the journey sits
  on the right. A hiring project (/hire/:id) uses the same viewer, adds its brief to the
  panel and shows how each candidate lines up with it, with reasons.
  No scores are shown. "Save as PDF" downloads the journey as a PDF file.
*/

const fmtDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};
const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const join = (...parts) => parts.filter(Boolean).join(" · ");
const keyOf = (c) => c.code || "link";
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export default function Journey() {
  const [params, setParams] = useSearchParams();
  const codes = useMemo(() => splitCodes(params.get("c") || ""), [params]);
  const codeKey = codes.join(",");
  const [linked, setLinked] = useState(() => readJourney(window.location.hash)); // older links carry the snapshot
  const [found, setFound] = useState([]);
  const [missing, setMissing] = useState([]);
  const [status, setStatus] = useState(codes.length ? "loading" : "ready");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const onHash = () => setLinked(readJourney(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!codeKey) return setStatus("ready");
    let cancelled = false;
    setStatus("loading");
    fetchCandidates(codeKey.split(","))
      .then((res) => {
        if (cancelled) return;
        setFound(res.candidates);
        setMissing(res.missing);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [codeKey, attempt]);

  const candidates = useMemo(() => [...(linked ? [{ code: null, journey: linked, fit: null }] : []), ...found], [linked, found]);

  async function add(list) {
    const res = await fetchCandidates(list);
    const fresh = res.candidates.filter((c) => !found.some((f) => sameCode(f.code, c.code)));
    if (fresh.length) {
      setFound((f) => [...f, ...fresh]);
      setParams({ c: [...found, ...fresh].map((c) => c.code).join(",") }, { replace: true });
    }
    return { missing: res.missing, added: fresh.map((c) => c.code) };
  }

  function remove(entry) {
    const rest = found.filter((f) => !sameCode(f.code, entry.code));
    setFound(rest);
    setParams(rest.length ? { c: rest.map((c) => c.code).join(",") } : {}, { replace: true });
  }

  return <JourneyViewer candidates={candidates} status={status} missing={missing} onAdd={add} onRemove={remove} onRetry={() => setAttempt((a) => a + 1)} />;
}

/* ---------- The viewer: side panel with the journeys, the chosen journey on the right ---------- */

export function JourneyViewer({ candidates, status, missing = [], onAdd, onRemove, onRetry, project = null, empty = null }) {
  const [currentKey, setCurrentKey] = useState(null);
  const [adding, setAdding] = useState(false);
  const [removed, setRemoved] = useState(null); // { code, name }, for "Undo"
  const n = candidates.length;
  const idx = Math.max(0, candidates.findIndex((c) => keyOf(c) === currentKey));
  const current = candidates[idx];
  const chips = useMemo(() => fitChips(candidates, !!project), [candidates, project]);
  const listRef = useRef(null);
  const label = project ? "Candidates" : "Journeys";

  const goTo = (i) => {
    setCurrentKey(keyOf(candidates[i]));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Arrow keys step through the journeys
  useEffect(() => {
    if (n < 2) return;
    const onKey = (e) => {
      if (adding || e.target.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight" && idx < n - 1) goTo(idx + 1);
      if (e.key === "ArrowLeft" && idx > 0) goTo(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Phones: the journeys are one scrolling row, so bring the chosen one into view
  useEffect(() => {
    const row = listRef.current;
    const on = row?.querySelector(".is-on");
    if (row && on && row.scrollWidth > row.clientWidth) row.scrollTo({ left: on.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft - 16 });
  }, [idx, n]);

  // "Removed … Undo" goes away after a few seconds
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(t);
  }, [removed]);

  async function add(list) {
    const res = await onAdd(list);
    if (res.added.length) setCurrentKey(res.added[0]);
    setRemoved(null);
    return res;
  }

  // The one after it takes its place (or the one before, at the end)
  function remove(c, i) {
    if (i === idx) {
      const next = candidates[i + 1] || candidates[i - 1];
      setCurrentKey(next ? keyOf(next) : null);
    }
    onRemove(c);
    setRemoved({ code: c.code, name: c.journey.name || c.code });
  }

  async function undo() {
    const { code } = removed;
    setRemoved(null);
    const res = await onAdd([code]);
    if (res.added.length) setCurrentKey(res.added[0]);
  }

  let body;
  if (n) body = <JourneyBody key={keyOf(current)} entry={current} chips={chips.get(keyOf(current)) || []} />;
  else if (status === "loading") body = <div className="ds-card ds-card--loading jr-loading" aria-label="Loading journeys" />;
  else if (status === "error") {
    body = (
      <section className="ds-head night">
        <p className="label-mono">Shared journeys</p>
        <h1 className="ds-head__title">We couldn't reach Bridge</h1>
        <p className="ds-head__sub">Check your connection, then try again.</p>
        <div><button type="button" className="btn btn--ghost jr-on-night" onClick={onRetry}>Try again</button></div>
      </section>
    );
  } else body = empty || <NoJourney />;

  return (
    <div className="dash jv">
      <aside className="dash-side night">
        <BrandMark to="/org?panel=hire" />
        <div>
          <p className="dash-side__title">{project ? project.brief.title || "Untitled project" : "Shared journeys"}</p>
          <p className="dash-side__sub">{project ? "Hiring project" : "Shared with you by their owners, read-only"}</p>
        </div>

        {project && <BriefSummary project={project} />}

        <nav className="dash-side__group" aria-label={label}>
          <div className="jv-side__head">
            <p className="dash-side__label">{label}{n > 0 && <span className="num"> · {n}</span>}</p>
            {n > 1 && (
              <span className="jv-step">
                <button type="button" onClick={() => goTo(idx - 1)} disabled={idx <= 0} aria-label="Previous journey">
                  <ChevronIcon dir="left" size={16} />
                </button>
                <span className="num">{idx + 1}/{n}</span>
                <button type="button" onClick={() => goTo(idx + 1)} disabled={idx >= n - 1} aria-label="Next journey">
                  <ChevronIcon dir="right" size={16} />
                </button>
              </span>
            )}
          </div>
          {project && n > 1 && <p className="jv-side__note">Best fit with your brief first</p>}

          {n > 0 && (
            <ul className="dash-items" ref={listRef}>
              {candidates.map((c, i) => {
                const name = c.journey.name || "Candidate";
                const best = chips.get(keyOf(c))?.some((ch) => ch.tone === "best");
                return (
                  <li key={keyOf(c)} className="jv-cand">
                    <button type="button" className={`dash-item${i === idx ? " is-on" : ""}`} onClick={() => goTo(i)} aria-current={i === idx ? "true" : undefined}>
                      <span className="dash-item__badge jv-cand__avatar" aria-hidden="true">{initials(name)}</span>
                      <span className="dash-item__text">
                        <span className="dash-item__name">{name}</span>
                        <span className="dash-item__meta">{c.fit?.must.of > 0 ? `${c.fit.must.has} of ${c.fit.must.of} must-haves` : c.journey.role || c.code}</span>
                        {best && <span className="jv-cand__best"><StarIcon /> Best fit</span>}
                      </span>
                    </button>
                    {onRemove && c.code && (
                      <button type="button" className="jv-cand__remove" onClick={() => remove(c, i)} aria-label={`Remove ${name}`} title={`Remove ${name}`}>
                        <MinusIcon />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {removed && (
            <p className="jv-undo" role="status">
              Removed {removed.name}. <button type="button" onClick={undo}>Undo</button>
            </p>
          )}

          {adding ? (
            <AddCodes onAdd={add} onClose={() => setAdding(false)} />
          ) : (
            <button type="button" className="jv-addbtn" onClick={() => setAdding(true)}>
              <PlusIcon size={18} /> Add by code
            </button>
          )}
        </nav>

        <div className="dash-side__foot">
          {project ? (
            <Link className="dash-side__btn" to="/org?panel=hire"><ChevronIcon dir="left" size={14} /> All projects</Link>
          ) : (
            <Link className="dash-side__btn" to="/signup">What is Bridge?</Link>
          )}
        </div>
      </aside>

      <main className="dash-main jr">
        {missing.length > 0 && (
          <p className="jr-missing" role="status">
            No journey found for {missing.join(", ")}. Check the code with the candidate.
          </p>
        )}
        {body}
      </main>
    </div>
  );
}

/* The brief in short, with the way back into it */
function BriefSummary({ project }) {
  const b = project.brief;
  const first = (v) => (Array.isArray(v) ? v[0] : v);
  const must = b.skills?.length || 0;
  const rows = [
    ["Role", b.role],
    ["Experience", first(b.experience)],
    ["Must-haves", must ? `${must} ${must === 1 ? "skill" : "skills"}` : ""],
  ].filter(([, v]) => v);
  return (
    <div className="dash-side__group">
      <p className="dash-side__label">The brief</p>
      {rows.length > 0 && (
        <dl className="jv-brief">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{keepBracket(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      <Link className="dash-side__btn jv-brief__edit" to={`/hire/${project.id}/brief`}><EditIcon /> Edit the brief</Link>
    </div>
  );
}

// "Some experience (1–2 years)": the bracket stays on one line instead of breaking at the dash
const keepBracket = (v) =>
  String(v).split(/(\([^)]*\))/).map((part, i) => (part.startsWith("(") ? <span key={i} style={{ whiteSpace: "nowrap" }}>{part}</span> : part));

/* Chips that compare candidates (relative ones only when there are two or more) */
function fitChips(list, hasBrief) {
  const out = new Map(list.map((c) => [keyOf(c), []]));
  const push = (c, label, tone = "plain") => out.get(keyOf(c)).push({ label, tone });
  const topOf = (value) => {
    if (list.length < 2) return null;
    const sorted = [...list].sort((a, b) => value(b) - value(a));
    return value(sorted[0]) > value(sorted[1]) + 1e-6 && value(sorted[0]) > 0 ? sorted[0] : null;
  };
  const withFit = list.filter((c) => c.fit);
  if (hasBrief && withFit.length) {
    const best = topOf((c) => c.fit?.score ?? -1);
    if (best) push(best, "Best fit for your brief", "best");
    const most = topOf((c) => (c.fit ? c.fit.must.has + c.fit.must.partial / 2 : -1));
    if (most && most !== best) push(most, "Most of your must-haves", "good");
  }
  const along = topOf((c) => (c.journey.total ? (c.journey.done?.length || 0) / c.journey.total : 0));
  if (along) push(along, "Furthest along on Bridge", "good");
  const hours = topOf((c) => c.journey.hours || 0);
  if (hours) push(hours, "Most learning time a week");
  for (const c of withFit) {
    if (c.fit.role.aims) push(c, "Working towards this role", "good");
    else if (c.fit.role.before) push(c, "Has done this role");
    if (c.fit.hobbies.length) push(c, "Shares hobbies you listed");
  }
  return out;
}

/* "Add by code": opens in the panel, takes one or several codes */
function AddCodes({ onAdd, onClose }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    const list = splitCodes(text);
    if (!list.length) return setError("Type at least one code.");
    setBusy(true);
    setError("");
    try {
      const res = await onAdd(list);
      if (res.missing.length) {
        setError(`No journey found for ${res.missing.join(", ")}.${res.added.length ? ` Added ${res.added.length}.` : ""}`);
        setText(res.missing.join(", "));
      } else onClose();
    } catch {
      setError("We couldn't reach Bridge. Try again.");
    }
    setBusy(false);
  }

  return (
    <form className="jv-add" onSubmit={submit} aria-label="Add journeys">
      <div className="jv-add__head">
        <label className="jv-add__label" htmlFor="jv-add-codes">Add by code</label>
        <button type="button" className="jv-add__close" onClick={onClose} aria-label="Close">
          <PlusIcon size={18} />
        </button>
      </div>
      <p className="jv-add__hint">Codes from candidates' dashboards. Several? Separate them with commas or spaces.</p>
      <div className="jv-add__row">
        <input
          id="jv-add-codes"
          className="input"
          value={text}
          autoFocus
          onChange={(e) => (setText(e.target.value), setError(""))}
          placeholder="e.g. K7M-2QX, DEMO-MEI"
          aria-invalid={!!error}
        />
        <button type="submit" className="btn btn--sm jv-add__submit" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
      </div>
      {error && <p className="jv-add__error" role="alert">{error}</p>}
    </form>
  );
}

function NoJourney() {
  return (
    <section className="ds-head night">
      <p className="label-mono">Learning journey</p>
      <h1 className="ds-head__title">No journey to show</h1>
      <p className="ds-head__sub">
        Add a code with “Add by code”, or ask the person who shared it to copy their code or link again from their Bridge dashboard.
      </p>
    </section>
  );
}

/* ---------- One journey ---------- */

function JourneyBody({ entry, chips }) {
  const { journey: snap, code, fit } = entry;
  const [saving, setSaving] = useState(false);
  const done = snap.done || [];
  const learning = snap.learning || [];
  const total = Math.max(snap.total || 0, done.length + learning.length);
  const roles = snap.roles || [];
  const edu = snap.education || {};
  const interests = snap.interests || {};
  const latest = roles[0];
  const headline = join(latest ? sentence(latest.title) : snap.situation, snap.country);
  const hasCv = snap.v >= 2;

  async function savePdf() {
    setSaving(true);
    try {
      const { downloadJourneyPdf } = await import("../../lib/journeyPdf.js"); // loads the PDF library only when needed
      await downloadJourneyPdf(snap, code);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="ds-head night rise jr-head">
        <div className="jr-head__top">
          <div>
            <p className="label-mono">Learning journey · CV and beyond{code ? ` · ${code}` : ""}</p>
            <h1 className="ds-head__title jr-name">
              {snap.name || "A Bridge learner"}
              <span className="jr-shield" tabIndex={0} aria-label="Shared by its owner: read-only, and Bridge never makes hiring decisions">
                <ShieldIcon />
                <span className="jr-shield__note" role="tooltip">
                  {snap.name || "This candidate"} shared this with you. It's read-only, and Bridge never makes hiring decisions.
                </span>
              </span>
            </h1>
            {headline && <p className="ds-head__sub">{headline}</p>}
          </div>
          <button type="button" className="jr-print" onClick={savePdf} disabled={saving}>
            <DownloadIcon /> {saving ? "Preparing…" : "Save as PDF"}
          </button>
        </div>

        {chips.length > 0 && (
          <ul className="jr-chips-fit" aria-label="How they compare">
            {chips.map((c) => (
              <li key={c.label} className={`jr-fitchip jr-fitchip--${c.tone}`}>
                {c.tone === "best" && <StarIcon />} {c.label}
              </li>
            ))}
          </ul>
        )}

        <div className="jr-goal">
          <p className="label-mono">Working towards</p>
          <p className="jr-goal__role">{snap.role}</p>
          <p className="jr-goal__meta">
            {done.length} of {total} topics done{learning.length ? `, ${learning.length} in progress` : ""}
            {snap.hours ? `, learning about ${snap.hours} hours a week` : ""}
          </p>
          <div className="jr-track" aria-label={`${done.length} of ${total} topics done`}>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`jr-track__seg${i < done.length ? " is-done" : i < done.length + learning.length ? " is-learning" : ""}`}
                style={{ "--i": i }}
              />
            ))}
          </div>
        </div>
      </section>

      {fit && <FitSection fit={fit} name={snap.name} />}

      <section className="ds-section">
        <h2 className="ds-section__title">Learning on Bridge</h2>
        <div className="jr-cols">
          <TopicCard title="Done" note="Marked done on their pathway" items={done} tone="done" />
          <TopicCard title="Learning now" note="Started, not finished yet" items={learning} tone="learning" />
          {hasCv ? (
            <TopicCard title="Already strong in" note="Role topics they knew before" items={snap.strong || []} tone="brought" />
          ) : (
            <TopicCard title="Already brought" note="Skills and topics they came in with" items={snap.brought || []} tone="brought" />
          )}
        </div>
      </section>

      {hasCv && (
        <section className="ds-section">
          <h2 className="ds-section__title">Background</h2>
          <div className="jr-cv">
            <div className="jr-cv__main">
              <div className="ds-card">
                <p className="label-mono">Experience</p>
                {roles.length ? (
                  <ol className="jr-timeline">
                    {roles.map((r, i) => (
                      <li key={`${r.title}${i}`}>
                        <h3>{sentence(r.title)}</h3>
                        <p className="jr-muted">{join(r.industry, r.years && `${r.years} ${r.years === "1" ? "year" : "years"}`)}</p>
                        {r.tasks?.length > 0 && (
                          <ul className="jr-bullets">
                            {r.tasks.map((t) => <li key={t}>{t}</li>)}
                          </ul>
                        )}
                        {r.tools?.length > 0 && <Chips items={r.tools} />}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="ds-card__use">{snap.noExperience ? "No work experience yet: starting out." : "Not shared."}</p>
                )}
              </div>

              {(edu.level || edu.field) && (
                <div className="ds-card">
                  <p className="label-mono">Education</p>
                  <h3>{edu.level && edu.field ? `${edu.level} in ${edu.field}` : edu.level || edu.field}</h3>
                  <p className="jr-muted">{join(edu.type, edu.year && (Number(edu.year) > new Date().getFullYear() ? `expected ${edu.year}` : edu.year))}</p>
                </div>
              )}

              {snap.courses?.length > 0 && (
                <div className="ds-card">
                  <p className="label-mono">Courses and certificates</p>
                  <ul className="jr-rows">
                    {snap.courses.map((c) => (
                      <li key={c.name}>
                        <span>{c.name}</span>
                        <span className="jr-muted">{join(c.provider, c.year)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {snap.projects?.length > 0 && (
                <div className="ds-card">
                  <p className="label-mono">Projects</p>
                  <ul className="jr-rows jr-rows--stack">
                    {snap.projects.map((p) => (
                      <li key={p.what}>
                        <span className="jr-strong">{p.what}</span>
                        {p.role && <span className="jr-muted">{p.role}</span>}
                        {p.skills?.length > 0 && <Chips items={p.skills} />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <aside className="jr-cv__side">
              {snap.skills?.length > 0 && (
                <div className="ds-card">
                  <p className="label-mono">Skills (self-rated)</p>
                  <ul className="jr-skills">
                    {snap.skills.map((s) => (
                      <li key={s.name}>
                        <span>{s.name}</span>
                        <span className="jr-level" title={SKILL_LEVELS[s.level]} aria-label={SKILL_LEVELS[s.level]}>
                          {SKILL_LEVELS.map((_, k) => <span key={k} className={k <= s.level ? "is-on" : ""} />)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="jr-muted jr-legend">Heard of it → could teach it</p>
                </div>
              )}

              {snap.languages?.length > 0 && (
                <div className="ds-card">
                  <p className="label-mono">Languages</p>
                  <Chips items={snap.languages} />
                </div>
              )}

              {(snap.enjoys?.length > 0 || snap.causes?.length > 0) && (
                <div className="ds-card">
                  {snap.enjoys?.length > 0 && (
                    <>
                      <p className="label-mono">Enjoys work that's</p>
                      <Chips items={snap.enjoys} />
                    </>
                  )}
                  {snap.causes?.length > 0 && (
                    <>
                      <p className="label-mono jr-gap">Wants their work to help with</p>
                      <Chips items={snap.causes} />
                    </>
                  )}
                </div>
              )}

              {Object.values(interests).some((v) => v?.length) && (
                <div className="ds-card">
                  <p className="label-mono">Outside work</p>
                  <dl className="jr-interests">
                    {INTEREST_ROWS.filter(([key]) => interests[key]?.length).map(([key, label]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd>{interests[key].join(", ")}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      <p className="jr-foot">
        A snapshot{snap.date ? ` from ${fmtDate(snap.date)}` : ""}, shared by its owner from Bridge. It doesn't update. Skill levels are their own rating;
        pathway topics come from the official ESCO skills list. <Link to="/signup">What is Bridge?</Link>
      </p>
    </>
  );
}

export const INTEREST_ROWS = [["hobbies", "Hobbies"], ["sports", "Sports"], ["books", "Reads"], ["movies", "Watches"], ["genres", "Genres"]];

/* How this candidate lines up with the project's brief, with the evidence for each part */
function FitSection({ fit, name }) {
  const mark = { has: "Has it", partial: "Partly", missing: "Not shown" };
  const rows = [];
  if (fit.role.aims != null) {
    rows.push(["Role", fit.role.aims ? "Working towards this role" : fit.role.before ? "Has done this role before" : "Heading towards a different role", fit.role.aims || fit.role.before]);
  }
  if (fit.experience.ok != null) rows.push(["Experience", `${fit.experience.years} ${fit.experience.years === 1 ? "year" : "years"} of work`, fit.experience.ok]);
  if (fit.education.ok != null) rows.push(["Education", fit.education.level, fit.education.ok]);
  if (fit.languages.of) rows.push(["Languages", fit.languages.shared.length ? `Speaks ${fit.languages.shared.join(", ")}` : "None of the ones you listed", fit.languages.shared.length === fit.languages.of]);
  if (fit.workTypes.length) rows.push(["Enjoys", `${fit.workTypes.join(" and ")} work, like this job`, true]);
  if (fit.hobbies.length) rows.push(["Hobbies", fit.hobbies.map((h) => (h.brief.toLowerCase() === h.theirs.toLowerCase() ? h.theirs : `${h.theirs} (${h.brief.toLowerCase()})`)).join(", "), true]);
  if (fit.causes.length) rows.push(["Cares about", fit.causes.join(", "), true]);

  return (
    <section className="ds-section" aria-labelledby="fit-title">
      <h2 id="fit-title" className="ds-section__title">Against your brief</h2>
      <div className="jr-fit">
        <div className="ds-card">
          <p className="label-mono">Must-have skills</p>
          <h3 className="jr-fit__count">
            {fit.must.has} of {fit.must.of}{fit.must.partial ? <span className="jr-muted"> · {fit.must.partial} partly</span> : null}
          </h3>
          <SkillChecks items={fit.must.items} mark={mark} />
          {fit.nice.of > 0 && (
            <>
              <p className="label-mono jr-gap">Nice to have · {fit.nice.has} of {fit.nice.of}</p>
              <SkillChecks items={fit.nice.items} mark={mark} />
            </>
          )}
        </div>
        <div className="ds-card">
          <p className="label-mono">The rest of the brief</p>
          {rows.length ? (
            <ul className="jr-fit__rows">
              {rows.map(([k, v, ok]) => (
                <li key={k} className={ok ? "is-ok" : "is-no"}>
                  <span className="jr-fit__dot" aria-label={ok ? "Matches" : "Doesn't match"} />
                  <span className="jr-fit__k">{k}</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ds-card__use">Your brief only lists skills.</p>
          )}
        </div>
      </div>
      <p className="jr-fit__note">
        Bridge compares only what {name || "they"} chose to share with your brief, by meaning (so “Wireframing” finds “Create website wireframe”). It never
        looks at name, age, country or photos. It's a guide to start a conversation, not a decision.
      </p>
    </section>
  );
}

function SkillChecks({ items, mark }) {
  return (
    <ul className="jr-checks">
      {items.map((it) => (
        <li key={it.skill} className={`is-${it.status}`}>
          <span className="jr-checks__mark">{mark[it.status]}</span>
          <span className="jr-checks__skill">{it.skill}</span>
          <span className="jr-checks__why">{it.status === "missing" ? "Not in what they shared" : `${it.evidence} · ${it.where}`}</span>
        </li>
      ))}
    </ul>
  );
}

function TopicCard({ title, note, items, tone }) {
  return (
    <div className="ds-card">
      <p className="label-mono">{note}</p>
      <h3>{title} <span className="num jr-count">{items.length}</span></h3>
      {items.length ? (
        <ul className={`jr-list jr-list--${tone}`}>
          {items.map((t, i) => <li key={t} style={{ "--i": i }}>{t}</li>)}
        </ul>
      ) : (
        <p className="ds-card__use">Nothing here yet.</p>
      )}
    </div>
  );
}

function Chips({ items }) {
  return (
    <ul className="jr-chips">
      {items.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );
}

const icon = (children, size = 16) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const ShieldIcon = () => icon(<><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>, 26);
const DownloadIcon = () => icon(<><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></>);
const StarIcon = () => icon(<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />, 14);
const PlusIcon = ({ size = 22 }) => icon(<path d="M12 5v14M5 12h14" />, size);
const MinusIcon = () => icon(<path d="M6 12h12" />);
const EditIcon = () => icon(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>, 14);
const ChevronIcon = ({ dir, size = 22 }) => icon(dir === "left" ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />, size);
