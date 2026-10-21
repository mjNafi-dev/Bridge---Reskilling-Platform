import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandMark from "../../components/BrandMark.jsx";
import { STEPS } from "./steps.js";
import { Field, validateFields } from "./fields.jsx";
import CvStep from "./CvStep.jsx";
import ReviewStep from "./ReviewStep.jsx";
import "./Onboarding.css";

/*
  Onboarding shell: step list on the left, the current step on the right.
  The whole profile lives in one object, saved to the browser after every change
  so a refresh never loses answers.
*/

const STORAGE_KEY = "bridge.profile";
const STEP_KEY = "bridge.onboardingStep";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: keep going in memory */
  }
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(() => load(STORAGE_KEY, { hoursPerWeek: 5, cvFilled: [] }));
  const [stepIndex, setStepIndex] = useState(() => Math.min(load(STEP_KEY, 0), STEPS.length - 1));
  const [visited, setVisited] = useState(() => new Set(STEPS.slice(0, stepIndex + 1).map((s) => s.id)));
  const [errors, setErrors] = useState({});
  const contentRef = useRef(null);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => save(STORAGE_KEY, profile), [profile]);
  useEffect(() => {
    save(STEP_KEY, stepIndex);
    setVisited((v) => new Set(v).add(STEPS[stepIndex].id));
    contentRef.current?.scrollTo({ top: 0 });
  }, [stepIndex]);

  const setField = (key, value) => {
    setProfile((p) => ({ ...p, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
  };

  // A step counts as done when it was visited and its required fields are filled
  const isComplete = (s) => visited.has(s.id) && (!s.fields || Object.keys(validateFields(s.fields, profile)).length === 0);

  function goTo(i) {
    setErrors({});
    setStepIndex(i);
  }

  function next() {
    if (step.fields) {
      const found = validateFields(step.fields, profile);
      if (Object.keys(found).length) {
        setErrors(found);
        contentRef.current?.querySelector(".f--error")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    goTo(stepIndex + 1);
  }

  function finish() {
    const firstMissing = STEPS.findIndex((s) => s.required && s.fields && Object.keys(validateFields(s.fields, profile)).length);
    if (firstMissing !== -1) {
      goTo(firstMissing);
      setErrors(validateFields(STEPS[firstMissing].fields, profile));
      return;
    }
    navigate("/results");
  }

  // Optional steps that were passed without any answers show a dash instead of a tick
  const isSkipped = (s) => {
    if (s.required || !visited.has(s.id) || s.id === STEPS[stepIndex].id) return false;
    if (s.custom === "cv") return !profile.cvFileName;
    return (s.fields || []).every((f) => {
      const v = profile[f.key];
      return v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    });
  };

  const doneCount = STEPS.filter(isComplete).length;

  return (
    <main className="ob">
      <aside className="ob__panel">
        <BrandMark />
        <div className="ob__panel-head">
          <h1 className="ob__panel-title">Build your profile</h1>
          <p className="ob__panel-sub">About 8–10 minutes. Your answers save as you go.</p>
        </div>

        <div className="ob__progress" aria-hidden="true">
          <span style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
        </div>

        <ol className="ob__steps">
          {STEPS.map((s, i) => {
            const state = i === stepIndex ? "current" : isSkipped(s) ? "skipped" : isComplete(s) ? "done" : "todo";
            return (
              <li key={s.id}>
                <button type="button" className={`ob-step ob-step--${state}`} onClick={() => goTo(i)} aria-current={i === stepIndex ? "step" : undefined}>
                  <span className="ob-step__mark">{state === "done" ? <CheckIcon /> : state === "skipped" ? "–" : i + 1}</span>
                  <span className="ob-step__name">{s.nav}</span>
                  {!s.required && <span className="ob-step__opt">Optional</span>}
                </button>
              </li>
            );
          })}
        </ol>

        <p className="ob__legend"><span className="ob__legend-dot" /> Steps without a tag are required</p>
      </aside>

      <section className="ob__main" ref={contentRef}>
        <div className="ob__content" key={step.id}>
          <header className="ob__head">
            <p className="label-mono">
              Step {stepIndex + 1} of {STEPS.length}{step.required ? "" : " · Optional"}
            </p>
            <h2 className="ob__title">{step.title}</h2>
            {step.intro && <p className="ob__intro">{step.intro}</p>}
          </header>

          {step.custom === "cv" && (
            <CvStep profile={profile} setProfile={setProfile} onContinue={() => goTo(stepIndex + 1)} onBack={() => goTo(stepIndex - 1)} />
          )}

          {step.custom === "review" && <ReviewStep profile={profile} steps={STEPS} onEdit={goTo} />}

          {step.fields && (
            <div className="ob__fields">
              {step.fields.map((f) =>
                f.when && !f.when(profile) ? null : (
                  <Field
                    key={f.key}
                    field={f}
                    value={profile[f.key]}
                    onChange={(v) => setField(f.key, v)}
                    errors={errors}
                    fromCv={profile.cvFilled?.includes(f.key)}
                  />
                )
              )}
            </div>
          )}

          {step.custom !== "cv" && (
            <footer className="ob__nav">
              {stepIndex > 0 ? (
                <button type="button" className="btn-secondary" onClick={() => goTo(stepIndex - 1)}>
                  <ArrowIcon dir="left" /> Back
                </button>
              ) : <span />}
              {isLast ? (
                <button type="button" className="btn-primary" onClick={finish}>Confirm & find my matches</button>
              ) : (
                <button type="button" className="btn-primary" onClick={next}>
                  {step.required ? "Next" : "Next (or skip)"} <ArrowIcon dir="right" />
                </button>
              )}
            </footer>
          )}
        </div>
      </section>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export function ArrowIcon({ dir }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {dir === "left" ? <path d="M10 3L5 8l5 5" /> : <path d="M6 3l5 5-5 5" />}
    </svg>
  );
}
