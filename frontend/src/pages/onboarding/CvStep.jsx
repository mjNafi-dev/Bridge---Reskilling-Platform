import { useEffect, useRef, useState } from "react";
import { SAMPLE_CV, CV_FIELDS } from "../../data/sampleCv.js";
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
  Demo: real CV reading comes with the backend (text extraction + OCR + AI).
  For now every upload fills the SYNTHETIC sample profile, and the page says so.
*/

const ACCEPTED = [".pdf", ".docx", ".txt"];
const MAX_MB = 5;
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

  function start(name) {
    setError("");
    setFileName(name);
    setStage("uploading");
    setProgress(0);
    // Upload progress (simulated until the backend exists)
    for (let i = 1; i <= 20; i++) later(() => setProgress(i * 5), i * 60);
    later(() => {
      setStage("reading");
      setReadStep(0);
      READ_STAGES.forEach((_, i) => later(() => setReadStep(i + 1), (i + 1) * 900));
      later(() => {
        setProfile((p) => ({ ...p, ...SAMPLE_CV, cvFileName: name, cvFilled: CV_FIELDS }));
        setStage("done");
      }, READ_STAGES.length * 900 + 400);
    }, 1300);
  }

  function handleFile(file) {
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED.includes(ext)) return setError("Please use a PDF, Word (.docx) or text file.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is over ${MAX_MB} MB. Try a smaller one.`);
    start(file.name);
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    setProfile((p) => {
      const cleared = { ...p };
      CV_FIELDS.forEach((k) => delete cleared[k]);
      delete cleared.cvFileName;
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
              {dragging ? "Let go to upload" : dragInWindow ? "Bring it over here" : error ? "Let's try that again" : <>Drop your CV here, or <u>browse</u></>}
            </span>
            <span className="drop__meta">PDF, Word or text · up to {MAX_MB} MB</span>
            <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} hidden onChange={(e) => handleFile(e.target.files[0])} />
          </div>
          {error && <p className="f__err" role="alert">{error}</p>}
          <p className="cv__demo-note">
            Demo version: please don't upload a real CV. Uploads fill in a made-up sample profile, or{" "}
            <button type="button" className="link-btn" onClick={() => start("sample-cv-graphic-designer.pdf")}>use the sample CV</button>.
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
          <p className="cv-done__title">Done. We filled in:</p>
          <ul className="cv-done__list">
            <li>Education</li>
            <li>{profile.roles?.length || 0} role{profile.roles?.length === 1 ? "" : "s"} with tasks and tools</li>
            <li>{profile.skills?.length || 0} skills</li>
            <li>Languages and courses</li>
          </ul>
          <p className="f__hint">Look for the <span className="f__cv">From your CV</span> badge on the next pages and fix anything that's off.</p>
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
