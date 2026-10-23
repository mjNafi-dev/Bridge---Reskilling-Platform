import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BrandMark from "../../components/BrandMark.jsx";
import { Field, validateFields } from "../onboarding/fields.jsx";
import ReviewStep from "../onboarding/ReviewStep.jsx";
import { ArrowIcon, CheckIcon } from "../onboarding/Onboarding.jsx";
import { newProject, readProject, saveProject } from "../../lib/hire.js";
import { BRIEF_STEPS } from "./briefSteps.js";
import "../onboarding/Onboarding.css";
import "./Hire.css";

/*
  The hiring brief: the same step-by-step shell as onboarding, but HR describes the
  person they're looking for. /hire/new starts a project; /hire/:id/brief edits one.
  It saves to this browser after every change (once something is typed).
*/

export default function HireBrief() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(() => (id && readProject(id)) || newProject());
  const [stepIndex, setStepIndex] = useState(0);
  const [visited, setVisited] = useState(() => new Set([BRIEF_STEPS[0].id]));
  const [errors, setErrors] = useState({});
  const [dir, setDir] = useState("next");
  const stepRefs = useRef([]);
  const [pill, setPill] = useState(null);
  const brief = project.brief;
  const editing = !!id; // /hire/new has no id

  useLayoutEffect(() => {
    const measure = () => {
      const el = stepRefs.current[stepIndex];
      if (el) setPill({ top: el.offsetTop, height: el.offsetHeight });
    };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [stepIndex]);

  // Save once there's something in it, so an abandoned "New project" leaves nothing behind
  useEffect(() => {
    if (Object.keys(brief).length) saveProject(project);
  }, [project, brief]);

  useEffect(() => {
    setVisited((v) => new Set(v).add(BRIEF_STEPS[stepIndex].id));
    window.scrollTo({ top: 0 });
  }, [stepIndex]);

  const step = BRIEF_STEPS[stepIndex];
  const isLast = stepIndex === BRIEF_STEPS.length - 1;

  const setField = (key, value) => {
    setProject((p) => ({ ...p, brief: { ...p.brief, [key]: value } }));
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
  };

  const isComplete = (s) => visited.has(s.id) && (!s.fields || Object.keys(validateFields(s.fields, brief)).length === 0);

  function goTo(i) {
    setErrors({});
    setDir(i < stepIndex ? "back" : "next");
    setStepIndex(i);
  }

  function next() {
    const found = step.fields ? validateFields(step.fields, brief) : {};
    if (Object.keys(found).length) return setErrors(found);
    goTo(stepIndex + 1);
  }

  function finish() {
    const missing = BRIEF_STEPS.findIndex((s) => s.required && s.fields && Object.keys(validateFields(s.fields, brief)).length);
    if (missing !== -1) {
      goTo(missing);
      setErrors(validateFields(BRIEF_STEPS[missing].fields, brief));
      return;
    }
    saveProject(project);
    navigate(`/hire/${project.id}`);
  }

  return (
    <main className="ob">
      <aside className="ob__panel night">
        <BrandMark />
        <div className="ob__panel-head">
          <h1 className="ob__panel-title">{editing ? "Edit the brief" : "New hiring project"}</h1>
          <p className="ob__panel-sub">Describe who you're looking for. Saved in this browser as you go.</p>
        </div>

        <div className="ob__progress" aria-hidden="true">
          {BRIEF_STEPS.map((s, i) => (
            <span key={s.id} className={`ob__progress-dot${i === stepIndex ? " is-current" : isComplete(s) ? " is-done" : ""}`} />
          ))}
        </div>

        <ol className="ob__steps">
          {pill && <span className="ob__steps-pill" style={{ transform: `translateY(${pill.top}px)`, height: pill.height }} />}
          {BRIEF_STEPS.map((s, i) => {
            const state = i === stepIndex ? "current" : isComplete(s) ? "done" : "todo";
            return (
              <li key={s.id} ref={(el) => (stepRefs.current[i] = el)}>
                <button type="button" className={`ob-step ob-step--${state}`} onClick={() => goTo(i)} aria-current={i === stepIndex ? "step" : undefined}>
                  <span className="ob-step__mark">{state === "done" ? <CheckIcon /> : i + 1}</span>
                  <span className="ob-step__name">{s.nav}</span>
                  {!s.required && <span className="ob-step__opt">Optional</span>}
                </button>
              </li>
            );
          })}
        </ol>

        <p className="ob__legend">
          <Link to={editing ? `/hire/${project.id}` : "/org?panel=hire"} className="ob__back-link">
            {editing ? "Back to the candidates" : "Back to hiring projects"}
          </Link>
        </p>
      </aside>

      <section className="ob__main">
        <div className="ob__content" key={step.id} data-dir={dir}>
          <header className="ob__head">
            <p className="label-mono">
              Step {stepIndex + 1} of {BRIEF_STEPS.length}{step.required ? "" : " · Optional"}
            </p>
            <h2 className="ob__title">{step.title}</h2>
            {step.intro && <p className="ob__intro">{step.intro}</p>}
          </header>

          {step.custom === "review" && <ReviewStep profile={brief} steps={BRIEF_STEPS} onEdit={goTo} note={false} />}

          {step.fields && (
            <div className="ob__fields">
              {step.fields.map((f) => (
                <Field key={f.key} field={f} value={brief[f.key]} onChange={(v) => setField(f.key, v)} errors={errors} />
              ))}
            </div>
          )}

          <footer className="ob__nav">
            {stepIndex > 0 ? (
              <button type="button" className="btn btn--ghost" onClick={() => goTo(stepIndex - 1)}>
                <ArrowIcon dir="left" /> Back
              </button>
            ) : <span />}
            {isLast ? (
              <button type="button" className="btn btn--primary" onClick={finish}>
                {editing ? "Save the brief" : "Save & add candidates"}
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={next}>
                {step.required ? "Next" : "Next (or skip)"} <ArrowIcon dir="right" />
              </button>
            )}
          </footer>
        </div>
      </section>
    </main>
  );
}
