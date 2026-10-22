import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReviewStep from "../pages/onboarding/ReviewStep.jsx";
import { STEPS } from "../pages/onboarding/steps.js";
import { AI_PROVIDERS } from "./ConnectAI.jsx";
import "./ProfileSheet.css";

/*
  Profile overlay: who you are, your pathway, your AI, and every onboarding answer
  with an Edit link. Editing opens that onboarding step in "edit mode"; saving brings
  you back to the dashboard, which recalibrates automatically.
*/

const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export default function ProfileSheet({ open, onClose, profile, job, ai, onConnectAI }) {
  const ref = useRef(null);
  const navigate = useNavigate();
  const account = readJSON("bridge.account", {});
  const provider = ai && AI_PROVIDERS.find((p) => p.id === ai.provider);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function edit(stepIndex) {
    try {
      localStorage.setItem("bridge.onboardingStep", JSON.stringify(stepIndex));
    } catch {
      /* storage blocked */
    }
    navigate("/onboarding?from=pathway");
  }

  const name = profile.name || "You";

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="sheet-title"
    >
      <div className="sheet__inner">
        <header className="sheet__head">
          <span className="sheet__avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
          <div className="sheet__who">
            <h2 id="sheet-title">{name}</h2>
            <p>{account.email || "guest"} · {account.demo ? "Demo account" : "Guest account"}</p>
          </div>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div className="sheet__cards">
          <section className="sheet__card">
            <p className="label-mono">Pathway</p>
            <p className="sheet__value">{job ? sentence(job.title) : "None picked yet"}</p>
            <Link to="/results" className="sheet__link">See other choices</Link>
          </section>
          <section className="sheet__card">
            <p className="label-mono">Your AI</p>
            <p className="sheet__value">{provider ? `Connected to ${provider.name}` : "Not connected"}</p>
            {!provider && (
              <button type="button" className="sheet__link" onClick={onConnectAI}>Connect your AI</button>
            )}
          </section>
        </div>

        <section className="sheet__about">
          <div className="sheet__about-head">
            <h3>About you</h3>
            <p>Added something new, like a course or a skill? Edit it here and your pathway recalibrates on its own.</p>
          </div>
          <ReviewStep profile={profile} steps={STEPS} onEdit={edit} note={false} />
        </section>
      </div>
    </dialog>
  );
}
