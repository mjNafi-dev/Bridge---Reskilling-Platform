import { useEffect, useRef, useState } from "react";
import { SAMPLE_CV, CV_FIELDS } from "../../data/sampleCv.js";
import { readCv } from "../../api.js";
import { ArrowIcon } from "./Onboarding.jsx";
// 3D icons from thiings.co (free, no attribution required; credited in README anyway).
// Kept in public/cv/ and loaded by URL.
const uploadImg = "/cv/upload.png";
const folderClosedImg = "/cv/folder-closed.png";
const folderOpenImg = "/cv/folder-open.png";
const uploadingImg = "/cv/uploading.png";
const acceptedImg = "/cv/accepted.png";
const retryImg = "/cv/retry.png";

/*
  CV upload: optional, only pre-fills later questions.
  Stages: idle → uploading (progress bar) → reading (step-by-step checklist) → done.
  The server reads the file (backend/app/cv.py): roles, education, skills matched to ESCO,
  languages, courses, projects, hobbies, plus name, country and age range for About you.
  Every filled field gets a "From your CV" badge.
  The sample CV is a SYNTHETIC person (backend/scripts/make_sample_cv.py).
*/

const ACCEPTED = [".pdf", ".docx", ".txt"];
const MAX_MB = 5;
const SAMPLE_NAME = "sample-cv-graphic-designer.pdf";
const SAMPLE_URL = `/cv/${SAMPLE_NAME}`;
// Used only if the server can't be reached while trying the sample
const LOCAL_SAMPLE = { profile: SAMPLE_CV, filled: CV_FIELDS, found: { method: "sample" } };
const READ_STAGES = [
  "Reading your CV",
  "Finding your education and roles",
  "Spotting your skills and tools",
  "Matching skills to the official ESCO list",
];

export default function CvStep({ profile, setProfile, onContinue, onBack }) {
  const [stage, setStage] = useState(profile.cvFileName ? "done" : "idle");
  const [fileName, setFileName] = useState(profile.cvFileName || "");
  const [progress, setProgress] = useState(0);
  const [readStep, setReadStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [askSkip, setAskSkip] = useState(false);
  const inputRef = useRef(null);
  const timers = useRef([]);

  const [dragInWindow, setDragInWindow] = useState(false);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Know when a file is being dragged anywhere over the page (shows the closed folder)
  useEffect(() => {
    let depth = 0;
    const enter = (e) => { if (e.dataTransfer?.types?.includes("Files")) { depth++; setDragInWindow(true); } };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setDragInWindow(false); };
    const end = () => { depth = 0; setDragInWindow(false); setDragging(false); };
    const over = (e) => e.preventDefault(); // stops the browser opening the file if dropped outside the box
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", end);
    window.addEventListener("dragover", over);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", end);
      window.removeEventListener("dragover", over);
    };
  }, []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const wait = (ms) => new Promise((resolve) => later(resolve, ms));
  const run = useRef(0); // bumps on every upload or reset, so a stale read never lands

  // Upload → read on the server → fill the answers it found. The checklist is paced so
  // each line is readable; the last one waits for the server.
  async function start(file, isSample = false) {
    const id = ++run.current;
    const alive = () => run.current === id;
    setError("");
    setFileName(file.name);
    setStage("uploading");
    setProgress(0);
    setReadStep(0);
    const began = Date.now();
    let uploaded;
    const sent = new Promise((resolve) => (uploaded = resolve));
    const reading = readCv(file, (pct) => {
      if (alive()) setProgress(pct);
      if (pct >= 100) uploaded();
    });
    reading.catch(() => {}); // handled where it's awaited
    try {
      await Promise.race([sent, reading]);
      await wait(Math.max(300, 900 - (Date.now() - began)));
      if (!alive()) return;
      setStage("reading");
      for (let i = 1; i < READ_STAGES.length; i++) {
        await wait(650);
        if (!alive()) return;
        setReadStep(i);
      }
      const result = await reading;
      if (!alive()) return;
      setReadStep(READ_STAGES.length);
      await wait(450);
      if (alive()) apply(result, file.name);
    } catch (e) {
      if (!alive()) return;
      if (isSample) return apply(LOCAL_SAMPLE, file.name); // server down: the sample still works
      setStage("idle");
      setError(e.message);
    }
  }

  function apply(result, name) {
    setProfile((p) => {
      const next = { ...p };
      (p.cvFilled || []).forEach((k) => delete next[k]); // answers from an earlier CV
      return { ...next, ...result.profile, cvFileName: name, cvFilled: result.filled, cvFound: result.found };
    });
    setStage("done");
  }

  async function trySample() {
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error();
      start(new File([await res.blob()], SAMPLE_NAME, { type: "application/pdf" }), true);
    } catch {
      apply(LOCAL_SAMPLE, SAMPLE_NAME);
    }
  }

  function handleFile(file) {
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED.includes(ext)) return setError("Please use a PDF, Word (.docx) or text file.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is over ${MAX_MB} MB. Try a smaller one.`);
    start(file);
  }

  function reset() {
    run.current++;
    timers.current.forEach(clearTimeout);
    setProfile((p) => {
      const cleared = { ...p };
      (p.cvFilled?.length ? p.cvFilled : CV_FIELDS).forEach((k) => delete cleared[k]);
      delete cleared.cvFileName;
      delete cleared.cvFound;
      cleared.cvFilled = [];
      return cleared;
    });
    setFileName("");
    setStage("idle");
  }

  const busy = stage === "uploading" || stage === "reading";

  return (
    <div className="cv">
      <div className="cv__why">
        <p><strong>This only pre-fills some of the next questions.</strong> It's optional, but highly recommended: it saves you time, and you'll check every answer before anything is used.</p>
      </div>

      {stage === "idle" && (
        <>
          <div
            className={`drop ${dragging ? "is-drag" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          >
            <img
              className="drop__img"
              src={dragging ? folderOpenImg : dragInWindow ? folderClosedImg : error ? retryImg : uploadImg}
              alt=""
              width="112"
              height="112"
            />
            <span className="drop__title">
              {dragging ? "Let go to upload" : dragInWindow ? "Bring it over here" : error ? "Let's try that again" : <><span className="if-pointer">Drop your CV here, or <u>browse</u></span><span className="if-touch"><u>Choose your CV</u></span></>}
            </span>
            <span className="drop__meta">PDF, Word or text · up to {MAX_MB} MB</span>
            <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} hidden onChange={(e) => handleFile(e.target.files[0])} />
          </div>
          {error && <p className="f__err" role="alert">{error}</p>}
          <p className="cv__demo-note">
            We read your file once for your name, country, roles, skills and education, then throw it away. We never
            keep the file or read your email, phone or address. This is a hackathon demo, so please use a made-up CV, or{" "}
            <button type="button" className="link-btn" onClick={trySample}>try our sample CV</button>{" "}
            (<a className="link-btn" href={SAMPLE_URL} download>download it</a> to see what it says).
          </p>
        </>
      )}

      {stage === "uploading" && (
        <div className="cv-status" aria-live="polite">
          <img className="cv-status__img cv-status__img--busy" src={uploadingImg} alt="" width="88" height="88" />
          <FileRow name={fileName} />
          <div className="bar"><span style={{ width: `${progress}%` }} /></div>
          <p className="cv-status__label num">Uploading… {progress}%</p>
        </div>
      )}

      {stage === "reading" && (
        <div className="cv-status" aria-live="polite">
          <img className="cv-status__img cv-status__img--busy" src={uploadingImg} alt="" width="88" height="88" />
          <FileRow name={fileName} />
          <ul className="read-steps">
            {READ_STAGES.map((s, i) => {
              const state = readStep > i ? "done" : readStep === i ? "active" : "todo";
              return (
                <li key={s} className={`read-step read-step--${state}`}>
                  <span className="read-step__mark">{state === "done" ? "✓" : state === "active" ? <span className="spinner" /> : ""}</span>
                  {s}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {stage === "done" && (
        <div className="cv-status cv-status--done">
          <img className="cv-status__img cv-status__img--pop" src={acceptedImg} alt="" width="88" height="88" />
          <FileRow name={fileName} done />
          <CvSummary profile={profile} />
          <button type="button" className="link-btn" onClick={reset}>Remove and start over</button>
        </div>
      )}

      <footer className="ob__nav">
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={onBack}>
          <ArrowIcon dir="left" /> Back
        </button>
        <div className="ob__nav-right">
          {stage !== "done" && (
            <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setAskSkip(true)}>
              Skip for now
            </button>
          )}
          <button type="button" className="btn btn--primary" disabled={stage !== "done"} onClick={onContinue}>
            Continue <ArrowIcon dir="right" />
          </button>
        </div>
      </footer>

      {askSkip && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="skip-title" onClick={() => setAskSkip(false)}>
          <div className="modal__box" onClick={(e) => e.stopPropagation()}>
            <h3 id="skip-title">Continue without a CV?</h3>
            <p>Uploading a CV fills most of the next pages for you. Without it, you'll start those pages empty and fill them in yourself.</p>
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => { setAskSkip(false); onContinue(); }}>Continue anyway</button>
              <button type="button" className="btn btn--primary" onClick={() => { setAskSkip(false); inputRef.current?.click(); }}>Upload CV</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* What the CV filled in. Counts come from the current answers, so edits on later pages show here too. */
function CvSummary({ profile }) {
  const found = profile.cvFound || {};
  const roles = profile.roles || [];
  const skills = profile.skills || [];
  const tasks = roles.reduce((n, r) => n + (r.tasks?.length || 0), 0);
  const tools = new Set(roles.flatMap((r) => r.tools || [])).size;
  const matched = skills.filter((s) => s.esco).length;
  const education = [profile.eduLevel, profile.eduField].filter(Boolean).join(" in ");
  const about = [
    ["name", "your name"], ["country", "country"], ["ageRange", "age range"],
  ].filter(([k]) => profile.cvFilled?.includes(k) && profile[k]).map(([, label]) => label);
  const extras = [
    profile.languages?.length && plural(profile.languages.length, "language"),
    profile.courses?.length && plural(profile.courses.length, "course"),
    profile.projects?.length && plural(profile.projects.length, "project"),
    profile.hobbies?.length && plural(profile.hobbies.length, "hobby").replace("hobbys", "hobbies"),
  ].filter(Boolean);
  const missing = [!education && "education", !roles.length && "work experience", !skills.length && "skills"].filter(Boolean);
  const filled = profile.cvFilled || [];

  if (!filled.length) {
    return (
      <>
        <p className="cv-done__title">We couldn't pick much out of this one.</p>
        <p className="f__hint">No problem: fill in the next pages yourself, or try a Word or text version of your CV.</p>
      </>
    );
  }
  return (
    <>
      <p className="cv-done__title">Done. We filled in:</p>
      <ul className="cv-done__list">
        {about.length > 0 && <li>About you: {about.join(", ")}</li>}
        {education && <li>Education: {education}</li>}
        {roles.length > 0 && <li>{plural(roles.length, "role")} with {plural(tasks, "task")}{tools ? ` and ${plural(tools, "tool")}` : ""}</li>}
        {skills.length > 0 && <li>{plural(skills.length, "skill")}{matched ? `, ${matched} matched to the official ESCO skills list` : ""}</li>}
        {extras.length > 0 && <li>{extras.join(", ")}</li>}
      </ul>
      {found.examples?.length > 0 && (
        <div className="cv-esco">
          <p className="label-mono">How the ESCO list names your skills</p>
          <div className="cv-esco__pairs">
            {found.examples.map((e, i) => (
              <span key={e.skill} className="cv-esco__pair" style={{ "--i": i }}>
                {e.skill} <span aria-hidden="true">→</span> <em>{e.esco}</em>
              </span>
            ))}
          </div>
        </div>
      )}
      {missing.length > 0 && <p className="f__hint">Not found in your CV: {missing.join(", ")}. You'll fill {missing.length === 1 ? "it" : "those"} in yourself.</p>}
      <p className="f__hint">
        Look for the <span className="f__cv">From your CV</span> badge on the next pages and fix anything that's off.
        {found.method === "ai" && " Read with AI."}
      </p>
    </>
  );
}

function FileRow({ name, done }) {
  return (
    <div className="file-row">
      <span className="file-row__icon" aria-hidden="true"><DocIcon small /></span>
      <span className="file-row__name">{name}</span>
      {done && <span className="file-row__ok">Ready</span>}
    </div>
  );
}

function DocIcon({ small }) {
  const s = small ? 18 : 28;
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
