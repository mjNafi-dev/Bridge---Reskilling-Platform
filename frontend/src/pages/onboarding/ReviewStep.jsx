import { SKILL_LEVELS } from "./steps.js";
import { comfortStop, validateFields } from "./fields.jsx";

/*
  Review: every answer, grouped by step, with an Edit link back to that step.
  Missing required answers are flagged so nothing slips through.
*/

function show(value) {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  if (typeof value === "boolean") return value ? "Yes" : null;
  return String(value);
}

export default function ReviewStep({ profile, steps, onEdit }) {
  return (
    <div className="review">
      <p className="review__note">
        Have a look before we run the matching. Anything marked <span className="f__cv">From your CV</span> was filled in for you, so double-check it.
      </p>

      {steps.map((s, i) => {
        if (!s.fields && s.custom !== "cv") return null;
        const missing = s.fields ? Object.keys(validateFields(s.fields, profile)).length > 0 : false;
        return (
          <section key={s.id} className={`review__block ${missing ? "is-missing" : ""}`}>
            <div className="review__head">
              <h3>{s.nav}</h3>
              {!s.required && <span className="f__opt">Optional</span>}
              {missing && s.required && <span className="review__flag">Needs answers</span>}
              <button type="button" className="link-btn" onClick={() => onEdit(i)}>Edit</button>
            </div>

            {s.custom === "cv" ? (
              <p className="review__row">{profile.cvFileName ? `Uploaded: ${profile.cvFileName}` : <span className="review__empty">Skipped</span>}</p>
            ) : (
              <dl className="review__list">
                {s.fields.map((f) => {
                  if (f.when && !f.when(profile)) return null;
                  const v = profile[f.key];
                  const cv = profile.cvFilled?.includes(f.key) && <span className="f__cv">From your CV</span>;

                  if (f.type === "repeat") {
                    return (v || []).map((item, j) => (
                      <div className="review__row" key={`${f.key}${j}`}>
                        <dt>{f.itemLabel} {j + 1} {cv}</dt>
                        <dd>{f.subfields.map((sf) => show(item[sf.key])).filter(Boolean).join(" · ")}</dd>
                      </div>
                    ));
                  }
                  if (f.type === "skills") {
                    return (
                      <div className="review__row" key={f.key}>
                        <dt>{f.label} {cv}</dt>
                        <dd>{(v || []).map((sk) => `${sk.name} (${SKILL_LEVELS[sk.level].toLowerCase()})`).join(", ") || <span className="review__empty">None yet</span>}</dd>
                      </div>
                    );
                  }
                  const text = f.type === "comfort" ? comfortStop(v ?? f.default).title : show(v);
                  if (!text && !f.required) return null;
                  return (
                    <div className="review__row" key={f.key}>
                      <dt>{f.type === "checkbox" ? "Consent" : f.label} {cv}</dt>
                      <dd>{text || <span className="review__empty">Not answered</span>}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </section>
        );
      })}
    </div>
  );
}
