import { useEffect, useRef, useState } from "react";
import { SKILL_LEVELS } from "./steps.js";

/*
  Field building blocks for onboarding. Every field is wrapped in <FieldShell>,
  which shows the label, an Optional marker (required is the default), hint text, errors, and a
  "From your CV" badge when the value was pre-filled.
*/

export function isEmpty(field, value) {
  if (field.type === "checkbox") return !value;
  if (field.default != null && value == null) return false; // shows a sensible default, so it's answered
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || String(value).trim() === "";
}

// Returns { "fieldKey": "message", "roles.0.title": "message", ... } for one step
export function validateFields(fields, profile) {
  const errors = {};
  for (const f of fields) {
    if (f.when && !f.when(profile)) continue;
    const v = profile[f.key];
    if (f.required && isEmpty(f, v)) {
      errors[f.key] = f.type === "checkbox" ? "Please tick this to continue." : "This one's needed to continue.";
    }
    if (f.type === "repeat" && Array.isArray(v)) {
      v.forEach((item, i) =>
        f.subfields.forEach((sf) => {
          if (sf.required && isEmpty(sf, item[sf.key])) errors[`${f.key}.${i}.${sf.key}`] = "Needed";
        })
      );
    }
  }
  return errors;
}

export function FieldShell({ label, required, hint, error, fromCv, children, as = "div" }) {
  const Tag = as;
  return (
    <Tag className={`f ${error ? "f--error" : ""}`}>
      {label && (
        <span className="f__head">
          <span className="f__label">{label}</span>
          {!required && <span className="f__opt">Optional</span>}
          {fromCv && <span className="f__cv">From your CV</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="f__hint">{hint}</span>}
      {error && <span className="f__err" role="alert">{error}</span>}
    </Tag>
  );
}

export function Field({ field, value, onChange, errors = {}, errorKey, fromCv }) {
  const error = errors[errorKey ?? field.key];
  const shell = { label: field.label, required: field.required, hint: field.hint, error, fromCv };

  switch (field.type) {
    case "text":
    case "number":
      return (
        <FieldShell {...shell} as="label">
          <input
            className="input"
            type={field.type}
            min={field.min}
            max={field.max}
            placeholder={field.placeholder}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </FieldShell>
      );

    case "select":
      return (
        <FieldShell {...shell} as="label">
          <select className="input input--select" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
            <option value="" disabled>Choose one</option>
            {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </FieldShell>
      );

    case "checkbox":
      return (
        <FieldShell error={error}>
          <label className="check">
            <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
            <span>{field.label}</span>
          </label>
        </FieldShell>
      );

    case "cards":
      return <FieldShell {...shell}><Cards field={field} value={value} onChange={onChange} /></FieldShell>;

    case "chips":
      return <FieldShell {...shell}><Chips options={field.options} value={value ?? []} onChange={onChange} /></FieldShell>;

    case "tags":
      return <FieldShell {...shell}><Tags value={value ?? []} onChange={onChange} placeholder={field.placeholder} /></FieldShell>;

    case "slider":
      return (
        <FieldShell {...shell}>
          <HoursSlider field={field} value={value} onChange={onChange} />
        </FieldShell>
      );

    case "comfort":
      return (
        <FieldShell {...shell}>
          <ComfortSlider value={value ?? field.default} onChange={onChange} />
        </FieldShell>
      );

    case "list":
      return <FieldShell {...shell}><ListInput value={value ?? []} onChange={onChange} placeholder={field.placeholder} /></FieldShell>;

    case "repeat":
      return <FieldShell {...shell}><Repeat field={field} value={value ?? []} onChange={onChange} errors={errors} /></FieldShell>;

    case "skills":
      return <FieldShell {...shell}><SkillList value={value ?? []} onChange={onChange} brief={field.brief} /></FieldShell>;

    case "books":
      return <FieldShell {...shell} hint="Search powered by Open Library."><BookSearch value={value ?? []} onChange={onChange} /></FieldShell>;

    default:
      return null;
  }
}

/* ---------- Single/multi choice tiles ---------- */
function Cards({ field, value, onChange }) {
  const multi = field.max > 1;
  const picked = multi ? value ?? [] : value ? [value] : [];
  function toggle(o) {
    if (!multi) return onChange(o);
    if (picked.includes(o)) return onChange(picked.filter((x) => x !== o));
    if (picked.length >= field.max) return onChange([...picked.slice(1), o]); // swap out the oldest pick
    onChange([...picked, o]);
  }
  return (
    <div className="cards" role={multi ? "group" : "radiogroup"}>
      {field.options.map((o) => (
        <button
          type="button"
          key={o}
          className={`card-opt ${picked.includes(o) ? "is-on" : ""}`}
          aria-pressed={picked.includes(o)}
          onClick={() => toggle(o)}
        >
          <span className="card-opt__tick" aria-hidden="true" />
          {o}
        </button>
      ))}
    </div>
  );
}

/* ---------- Multi-select pills ---------- */
function Chips({ options, value, onChange }) {
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o} className={`chip ${value.includes(o) ? "is-on" : ""}`} aria-pressed={value.includes(o)} onClick={() => toggle(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

/* ---------- Free-text tags: type, press Enter ---------- */
function Tags({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = draft.trim().replace(/,$/, "");
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  }
  return (
    <div className="tags">
      {value.map((t) => (
        <span className="tag" key={t}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button>
        </span>
      ))}
      <input
        className="tags__input"
        value={draft}
        placeholder={value.length ? "Add more…" : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}

/* ---------- Repeatable groups (roles, courses, projects) ---------- */
function Repeat({ field, value, onChange, errors }) {
  const update = (i, key, v) => onChange(value.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  return (
    <div className="repeat">
      {value.map((item, i) => (
        <div className="repeat__item" key={i}>
          <div className="repeat__head">
            <span className="label-mono">{field.itemLabel} {i + 1}</span>
            <button type="button" className="link-btn" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button>
          </div>
          <div className="repeat__grid">
            {field.subfields.map((sf) => (
              <div key={sf.key} className={sf.type === "tags" ? "span-2" : ""}>
                <Field field={sf} value={item[sf.key]} onChange={(v) => update(i, sf.key, v)} errors={errors} errorKey={`${field.key}.${i}.${sf.key}`} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="add-btn" onClick={() => onChange([...value, {}])}>
        <span aria-hidden="true">+</span> {value.length ? field.addLabel : `Add ${field.itemLabel.toLowerCase()}`}
      </button>
    </div>
  );
}

/* ---------- Skills with a confidence level each ---------- */
// brief: a hiring brief's must-haves (the level needed, no "last used")
function SkillList({ value, onChange, brief }) {
  const [draft, setDraft] = useState("");
  function add() {
    const name = draft.trim();
    if (name && !value.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      onChange([...value, { name, level: 1, lastUsed: "This year" }]);
    }
    setDraft("");
  }
  const update = (i, patch) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="skills">
      <div className="skills__add">
        <input
          className="input"
          value={draft}
          placeholder={brief ? "Type a skill, e.g. Wireframing" : "Type a skill, e.g. Photo retouching"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <button type="button" className="btn btn--ghost" onClick={add}>Add</button>
      </div>
      {value.length > 0 && (
        <ul className="skills__list">
          {value.map((s, i) => (
            <li key={s.name} className="skill-row">
              <div className="skill-row__top">
                <span className="skill-row__name">
                  {s.name}
                  {s.esco && s.esco.toLowerCase() !== s.name.toLowerCase() && <span className="skill-row__esco" title="The matching skill in the official ESCO list">ESCO: {s.esco}</span>}
                </span>
                {brief ? (
                  <span className="skill-row__used-label">Level needed</span>
                ) : (
                  <>
                    <span className="skill-row__used-label">Last used</span>
                    <select className="input input--select input--sm" value={s.lastUsed} onChange={(e) => update(i, { lastUsed: e.target.value })} aria-label={`When you last used ${s.name}`}>
                      {["This year", "1–3 years ago", "3+ years ago"].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </>
                )}
                <button type="button" className="icon-btn" aria-label={`Remove ${s.name}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
              </div>
              <div className="levels" role="radiogroup" aria-label={brief ? `How well they need to know ${s.name}` : `How confident are you with ${s.name}?`}>
                {SKILL_LEVELS.map((lv, li) => (
                  <button type="button" key={lv} className={`level ${s.level === li ? "is-on" : ""}`} aria-pressed={s.level === li} onClick={() => update(i, { level: li })}>
                    {lv}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Book search via Open Library (free, no key) ---------- */
function BookSearch({ value, onChange }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 3) return setResults([]);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5&fields=title,author_name`);
        const data = await res.json();
        setResults((data.docs || []).map((d) => `${d.title}${d.author_name ? ` by ${d.author_name[0]}` : ""}`));
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer.current);
  }, [q]);

  function pick(b) {
    if (!value.includes(b)) onChange([...value, b]);
    setQ("");
    setResults([]);
  }

  return (
    <div className="books">
      <div className="books__search">
        <input className="input" value={q} placeholder="Search a book title" onChange={(e) => setQ(e.target.value)} />
        {loading && <span className="spinner spinner--inline" aria-label="Searching" />}
        {results.length > 0 && (
          <ul className="books__results">
            {results.map((r) => (
              <li key={r}><button type="button" onClick={() => pick(r)}>{r}</button></li>
            ))}
          </ul>
        )}
      </div>
      <ChipList value={value} onChange={onChange} />
    </div>
  );
}

/* ---------- Hours slider: drag, or tap the number to type it ---------- */
const HOURS_IN_WEEK = 168;

function HoursSlider({ field, value, onChange }) {
  const v = value ?? field.min;
  const [draft, setDraft] = useState(null); // text while typing

  function commit() {
    if (draft === null) return;
    const n = Math.round(Number(draft));
    if (Number.isFinite(n)) onChange(Math.min(Math.max(n, field.min), HOURS_IN_WEEK - 1));
    setDraft(null);
  }

  // Gentle wellbeing notes for big numbers
  let note = null;
  if (v > 60) note = { tone: "warn", text: "That's more than most full-time jobs. Learning works best with rest and sleep. A smaller, steady number usually gets you further." };
  else if (v > 30) note = { tone: "warn", text: "That's a lot on top of everything else. Make sure you leave time to rest. You can always change this later." };
  else if (v > field.max) note = { tone: "info", text: "Ambitious! Great if you have the time." };

  const fill = Math.min(1, (v - field.min) / (field.max - field.min)) * 100;

  return (
    <div className="slider">
      <label className="slider__value">
        <input
          className="slider__number num"
          type="number"
          inputMode="numeric"
          min={field.min}
          max={HOURS_IN_WEEK - 1}
          value={draft ?? v}
          aria-label="Hours per week, type a number"
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          style={{ width: `${String(draft ?? v).length + 0.6}ch` }}
        />
        <small>{field.unit}</small>
        <span className="slider__edit">tap the number to type</span>
      </label>
      <input
        type="range"
        min={field.min}
        max={field.max}
        value={Math.min(v, field.max)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--fill": `${fill}%` }}
        aria-label="Hours per week"
      />
      <span className="slider__ends"><span>{field.min}h</span><span>{field.max}h+</span></span>
      {note && <p className={`slider__note slider__note--${note.tone}`} role="status">{note.text}</p>}
    </div>
  );
}

/* ---------- Comfort slider: stay close to what I know ↔ go for brand-new ---------- */
// 0..100 in five stops. The matcher turns it into weights (familiarity/ease vs demand).
export const COMFORT_STOPS = [
  { value: 0, title: "Stay close to what I know", text: "Roles you're already near come first, even if demand for them is lower." },
  { value: 25, title: "Mostly familiar", text: "Mostly roles close to your skills, with a nod to where demand is heading." },
  { value: 50, title: "A balance", text: "What you already know leads, with real weight on where demand is growing." },
  { value: 75, title: "Open to a stretch", text: "Demand counts almost as much as what you know, so growing roles you can build towards move up." },
  { value: 100, title: "Brand-new is fine", text: "High-demand roles come first, even if they're a bigger leap." },
];

export const comfortStop = (v) =>
  COMFORT_STOPS.reduce((best, s) => (Math.abs(s.value - v) < Math.abs(best.value - v) ? s : best));

function ComfortSlider({ value, onChange }) {
  const stop = comfortStop(value);
  return (
    <div className="slider">
      <p className="slider__value comfort__title" aria-live="polite">{stop.title}</p>
      <input
        type="range"
        min={0}
        max={100}
        step={25}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--fill": `${value}%` }}
        aria-label="How far you're willing to stretch"
        aria-valuetext={stop.title}
      />
      <span className="slider__ends"><span>Stay close</span><span>Go bold</span></span>
      <p className="slider__note slider__note--info">{stop.text}</p>
    </div>
  );
}

/* ---------- Picked items shown as separate chips under the input ---------- */
function ChipList({ value, onChange }) {
  if (!value.length) return null;
  return (
    <div className="chip-list">
      {value.map((t) => (
        <span className="tag" key={t}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button>
        </span>
      ))}
    </div>
  );
}

/* ---------- Free text list: input on top, chips below (movies, sports, hobbies) ---------- */
function ListInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = draft.trim().replace(/,$/, "");
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  }
  return (
    <div className="books">
      <input
        className="input"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
        }}
        onBlur={add}
      />
      <ChipList value={value} onChange={onChange} />
    </div>
  );
}
