import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandMark from "../../components/BrandMark.jsx";
import { fetchDataOverview } from "../../api.js";
import "./DataSources.css";

/*
  Data sources: where every number in Bridge comes from, with versions and retrieval
  dates, plus how each part of the score is computed. Filled from GET /api/data.
*/

const USED_FOR = {
  esco: "The roles, their skills, and which skills each role needs (essential or optional).",
  esco_onet: "Links each ESCO role to its O*NET twin, so O*NET data can be attached.",
  onet: "Interest types (Holland RIASEC) per role, for the Interest fit part of the score.",
  postings: "Today's demand signal: how many live job postings match each role.",
  onet_bright: "Roles flagged for fast growth or many openings over the next decade.",
  ilo_genai: "How exposed each role is to generative AI, for the moderate and fast scenarios.",
};

const METHODS = [
  {
    title: "Familiarity",
    text: "How much of a role's essential skills you already have. Your skills, tasks, tools, courses and projects are compared with each ESCO skill by meaning, using embeddings.",
    from: "ESCO · embeddings computed on a RunPod GPU",
  },
  {
    title: "Ease",
    text: "How quickly the gap closes at the hours you said you can spend each week. Learning hours per missing skill are estimates.",
    from: "Your answers · Bridge estimates",
  },
  {
    title: "Demand",
    text: "Future need for the role, averaged over two scenarios: AI change is moderate, or AI change is fast.",
    from: "O*NET Bright Outlook · live postings · ILO GenAI exposure",
  },
  {
    title: "Interest fit",
    text: "How well the role matches the kinds of work you enjoy.",
    from: "O*NET interest types",
  },
  {
    title: "Your causes",
    text: "Roles that serve one of the causes you picked get 3 extra points. Each role's UN SDG tags come from its ILO job group (ISCO-08) and its title.",
    from: "ISCO-08 via ESCO · UN SDGs",
  },
  {
    title: "Ahead of others",
    text: "A comparison group built from ESCO, not real people: for every other role, a typical worker who knows that role's essential skills. Labelled as an estimate.",
    from: "ESCO",
  },
];

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const fmt = (n) => (n == null ? "–" : n.toLocaleString("en-US"));

export default function DataSources() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDataOverview().then(setData).catch(() => setError("We couldn't load the data sources right now. Is the API running?"));
  }, []);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  const c = data?.counts;
  const e = data?.embeddings;

  return (
    <main className="ds">
      <div className="ds__brand night">
        <BrandMark />
      </div>

      <section className="ds-head night rise">
        <button type="button" className="ds__back" onClick={back}>← Back</button>
        <p className="label-mono">Data sources</p>
        <h1 className="ds-head__title">Where every number comes from</h1>
        <p className="ds-head__sub">
          Bridge only uses open, official data. Every score is an estimate, and this page shows what it's built on, and when we last fetched it.
        </p>
        <div className="ds-stats">
          <Stat value={fmt(c?.occupations)} label="roles" />
          <Stat value={fmt(c?.skills)} label="skills" />
          <Stat value={fmt(c?.links)} label="role–skill links" />
          <Stat value={fmt(data?.snapshot?.postings_total)} label={`live postings, ${fmtDate(data?.snapshot?.fetched_at) || "latest snapshot"}`} />
        </div>
      </section>

      {error && <p className="ds__error" role="alert">{error}</p>}

      <section className="ds-section">
        <h2 className="ds-section__title">Sources</h2>
        <div className="ds-grid">
          {(data?.sources || []).map((s, i) => (
            <article key={s.id} className="ds-card rise" style={{ "--i": i + 1 }}>
              <p className="label-mono">{s.publisher}</p>
              <h3>{s.name}</h3>
              <p className="ds-card__use">{USED_FOR[s.id] || ""}</p>
              <dl className="ds-card__facts">
                <div><dt>Version</dt><dd>{s.version}</dd></div>
                <div><dt>Retrieved</dt><dd>{fmtDate(s.retrieved_on)}</dd></div>
                <div><dt>Licence</dt><dd>{s.license}</dd></div>
              </dl>
              <div className="ds-card__links">
                {s.url.split(" · ").map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">{u.replace(/^https?:\/\//, "").split("/")[0]} ↗</a>
                ))}
              </div>
            </article>
          ))}
          {!data && !error && [0, 1, 2].map((i) => <div key={i} className="ds-card ds-card--loading" />)}
        </div>
      </section>

      <section className="ds-section">
        <h2 className="ds-section__title">How the Bridge score is built</h2>
        <div className="ds-methods">
          {METHODS.map((m) => (
            <div key={m.title} className="ds-method">
              <h3>{m.title}</h3>
              <p>{m.text}</p>
              <span className="ds-method__from">{m.from}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ds-section ds-cols">
        <div className="ds-card">
          <p className="label-mono">GPU job on RunPod</p>
          <h3>Skill embeddings</h3>
          <p className="ds-card__use">
            Every ESCO skill and role title was turned into an embedding (a list of numbers that captures meaning) once, on a GPU. Your own phrases use the same model on our server, so both sides compare fairly.
          </p>
          {e && (
            <dl className="ds-card__facts">
              <div><dt>Model</dt><dd>{e.model}</dd></div>
              <div><dt>Texts</dt><dd>{fmt(e.count)} in {e.seconds}s</dd></div>
              <div><dt>GPU</dt><dd>{e.gpu}</dd></div>
              <div><dt>Run on</dt><dd>{fmtDate(e.created_utc)}</dd></div>
            </dl>
          )}
        </div>
        <div className="ds-card">
          <p className="label-mono">Your data</p>
          <h3>What we keep, and what we don't</h3>
          <ul className="ds-list">
            <li>Your answers stay in this browser. There are no accounts in this demo.</li>
            <li>A CV is read once on the server for roles, skills and education, then thrown away. Names and contact details are never read.</li>
            <li>CV reading uses rules{data?.cv_ai ? ", with AI switched on on this server" : ""}. No AI is used for matching or scores.</li>
            <li>Organisations only ever see anonymous, combined numbers.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function Stat({ value, label }) {
  return (
    <div className="ds-stat">
      <span className="ds-stat__value num">{value}</span>
      <span className="ds-stat__label">{label}</span>
    </div>
  );
}
