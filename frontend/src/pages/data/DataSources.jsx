import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandMark, { learnerHome } from "../../components/BrandMark.jsx";
import { readAdmin } from "../../lib/hire.js";
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
  postings: "Today's demand signal: how many live job ads match each role. Titles are cleaned first (\"Senior Accountant (m/w/d)\" → accountant, common German job words translated), and each ad counts once, towards its closest role.",
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
  // The logo goes to your own home: the growth dashboard for a signed-in admin, else your pathway
  const admin = readAdmin();
  const home = admin?.code ? `/org/${admin.code}` : learnerHome();
  const c = data?.counts;
  const e = data?.embeddings;

  return (
    <main className="ds">
      <div className="ds__brand night">
        <BrandMark to={home} />
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
        <p className="ds-section__lead">
          What you already know counts most. In the middle of "How far are you willing to stretch?" the score is familiarity 45%, demand 25%, ease 15% and interest fit 15%. Staying close moves weight to familiarity and ease (demand drops to 10%); going bold moves it to demand (40%, with familiarity at 35%). The five roles you see come from at least two kinds of work.
        </p>
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

      {data?.courses && (
        <section className="ds-section">
          <h2 className="ds-section__title">Courses on your pathway</h2>
          <div className="ds-card">
            <p className="label-mono">Hand-checked catalogue</p>
            <h3>{fmt(data.courses.count)} real courses, {fmt(data.courses.free)} of them free</h3>
            <p className="ds-card__use">
              Picked from official provider pages (OpenLearn, MIT OpenCourseWare, Kaggle, Khan Academy, Harvard CS50, freeCodeCamp, Cisco, HubSpot, Microsoft, WHO, Coursera and more), each link, title and level checked on the date below. Hours are the provider's own estimate, or ours where they give none. What each course teaches is matched to ESCO skills by meaning with the same embeddings, and only close matches are kept. Your budget answer decides which courses you see (free only hides paid ones) and how you like to learn decides the order. Topics with no close match get a YouTube search instead.
            </p>
            <dl className="ds-card__facts">
              <div><dt>Providers</dt><dd>{fmt(data.courses.providers)}</dd></div>
              <div><dt>Skills</dt><dd>{fmt(data.courses.skills)} with a matching course</dd></div>
              <div><dt>Checked</dt><dd>{fmtDate(data.courses.checked)}</dd></div>
              <div><dt>Prices</dt><dd>Free, or the provider's own price in words (they change)</dd></div>
            </dl>
          </div>
        </section>
      )}

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
            <li>A university or organisation sees a student's progress by name only if the student joins it with their code and agrees to it.</li>
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
