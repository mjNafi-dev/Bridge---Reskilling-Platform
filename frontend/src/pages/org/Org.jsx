import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BrandMark from "../../components/BrandMark.jsx";
import { fetchOrg } from "../../api.js";
import "../data/DataSources.css"; // shared page frame (ds, ds__brand, ds-head, ds-stats, ds-section)
import "./Org.css";

/*
  Organisation view (university or HR): anonymous, combined numbers only.
  /org        → enter a join code (or open the synthetic demo)
  /org/:code  → heatmap of skills the members' likely next roles need, by department,
                where they're heading, how ready they are, and which UN SDGs those roles serve.
  The demo organisation and its members are SYNTHETIC (backend/scripts/make_org_demo.py).
*/

const DEMO_CODE = "DEMO-UNI-2026";
const VIEWS = [
  { id: "priority", label: "Workshop priority", note: "Many need it and few have it yet" },
  { id: "need", label: "Who needs it", note: "Share of members whose likely next roles need this skill" },
  { id: "have", label: "How ready", note: "Average readiness in this skill today" },
];
const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const priority = (need, have) => Math.round((need * (100 - have)) / 100);

export default function Org() {
  const { code } = useParams();
  return code ? <OrgView code={code} /> : <OrgCode />;
}

function OrgCode() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const open = (c) => c.trim() && navigate(`/org/${encodeURIComponent(c.trim().toUpperCase())}`);
  return (
    <main className="ds org-code">
      <div className="ds__brand night"><BrandMark /></div>
      <section className="ds-head night rise org-code__card">
        <p className="label-mono">For universities and HR teams</p>
        <h1 className="ds-head__title">See where your people are heading</h1>
        <p className="ds-head__sub">
          Anonymous, combined numbers only: which skills your members' likely next roles need, and where to run workshops. Nobody's own answers are ever shown.
        </p>
        <form className="org-code__form" onSubmit={(e) => (e.preventDefault(), open(value))}>
          <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Organisation code" aria-label="Organisation code" />
          <button type="submit" className="btn btn--primary">Open</button>
        </form>
        <button type="button" className="org-code__demo" onClick={() => open(DEMO_CODE)}>
          Open the demo university ({DEMO_CODE}, synthetic data)
        </button>
      </section>
    </main>
  );
}

function OrgView({ code }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("priority");

  useEffect(() => {
    setData(null);
    setError("");
    fetchOrg(code).then(setData).catch((e) => setError(e.message));
  }, [code]);

  const cells = useMemo(() => {
    if (!data) return [];
    return data.departments.map((d) =>
      d.have ? d.have.map((have, j) => ({ have, need: d.need[j], priority: priority(d.need[j], have) })) : null
    );
  }, [data]);

  const workshops = useMemo(() => {
    if (!data) return [];
    return data.columns
      .map((c) => ({ ...c, priority: priority(c.need, c.have) }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
  }, [data]);

  if (error) {
    return (
      <main className="ds">
        <div className="ds__brand night"><BrandMark /></div>
        <section className="ds-head night">
          <p className="label-mono">Organisation view</p>
          <h1 className="ds-head__title">{error}</h1>
          <p className="ds-head__sub">Check the code with your HR team or university. The demo code is {DEMO_CODE}.</p>
          <div><button type="button" className="btn btn--ghost org__on-night" onClick={() => navigate("/org")}>Try another code</button></div>
        </section>
      </main>
    );
  }

  const org = data?.org;
  const top = data?.heading?.[0];
  const maxHeading = Math.max(1, ...(data?.heading || []).map((h) => h.count));
  const maxReady = Math.max(1, ...(data?.readiness || []).map((r) => r.count));
  const viewNote = VIEWS.find((v) => v.id === view).note;

  return (
    <main className="ds org">
      <div className="ds__brand night"><BrandMark /></div>

      <section className="ds-head night rise">
        <button type="button" className="ds__back" onClick={() => navigate("/org")}>Change code</button>
        <p className="label-mono">Organisation view{org?.synthetic ? " · synthetic demo" : ""}</p>
        <h1 className="ds-head__title">{org ? `${org.name} · ${org.unit}` : "Loading…"}</h1>
        <p className="ds-head__sub">
          Anonymous, combined numbers only. Nobody's own answers are shown, and groups under {org?.min_group || 5} people are hidden.
          {org?.synthetic && " Every member here is made up, generated and run through the real matcher."}
        </p>
        <div className="ds-stats">
          <Stat value={org?.members ?? "–"} label="members" />
          <Stat value={data ? `${data.median_familiarity}%` : "–"} label="median familiarity with their best match" />
          <Stat value={data ? `${data.avg_hours}h` : "–"} label="average learning time a week" />
          <Stat value={top ? sentence(top.role) : "–"} label={top ? `most common next role (${top.count})` : "most common next role"} small />
        </div>
      </section>

      {data && (
        <>
          <section className="ds-section">
            <div className="org-heat__head">
              <div>
                <h2 className="ds-section__title">Where to run workshops</h2>
                <p className="org__muted">
                  The skills your members' likely next roles need most, by department. {viewNote}.
                </p>
              </div>
              <div className="org-toggle" role="tablist" aria-label="What the colours show">
                {VIEWS.map((v) => (
                  <button key={v.id} type="button" role="tab" aria-selected={view === v.id} className={view === v.id ? "is-on" : ""} onClick={() => setView(v.id)}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="org-heat" style={{ "--cols": data.columns.length }}>
              <div className="org-heat__corner" />
              {data.columns.map((c) => (
                <div key={c.uri} className="org-heat__col" title={sentence(c.skill)}>{sentence(c.skill)}</div>
              ))}
              {data.departments.map((d, i) => (
                <Row key={d.name} dept={d} cells={cells[i]} view={view} columns={data.columns} />
              ))}
            </div>
            <div className="org-legend" aria-hidden="true">
              <span>0%</span><span className="org-legend__bar" /><span>100%</span>
            </div>
          </section>

          <section className="ds-section org-cols">
            <div className="ds-card">
              <p className="label-mono">Suggested first</p>
              <h3>Three workshops that would help the most people</h3>
              <ol className="org-workshops">
                {workshops.map((w) => (
                  <li key={w.uri}>
                    <strong>{sentence(w.skill)}</strong>
                    <span>Needed by {w.need}% of members' likely roles · average readiness {w.have}%</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="ds-card">
              <p className="label-mono">Where they're heading</p>
              <h3>Most common best-match roles</h3>
              <ul className="org-bars">
                {data.heading.map((h) => (
                  <li key={h.role}>
                    <span className="org-bars__label">{sentence(h.role)}</span>
                    <span className="org-bars__track"><span style={{ width: `${(100 * h.count) / maxHeading}%` }} /></span>
                    <span className="org-bars__value num">{h.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="ds-section org-cols">
            <div className="ds-card">
              <p className="label-mono">Readiness</p>
              <h3>How familiar members already are with their best match</h3>
              <div className="org-hist">
                {data.readiness.map((r) => (
                  <div key={r.range} className="org-hist__bar">
                    <span className="org-hist__value num">{r.count}</span>
                    <span className="org-hist__fill" style={{ height: `${(100 * r.count) / maxReady}%` }} />
                    <span className="org-hist__label">{r.range}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ds-card">
              <p className="label-mono">Impact</p>
              <h3>UN goals these next roles serve</h3>
              <ul className="org-sdgs">
                {data.sdgs.map((g) => (
                  <li key={g.goal}>
                    <span className="sdg-list__badge num">SDG {g.goal}</span>
                    <span>{g.name}</span>
                    <span className="num org-sdgs__count">{g.count}</span>
                  </li>
                ))}
              </ul>
              <p className="org__muted">
                From each member's best-match role. <Link to="/data">How roles are tagged</Link>
              </p>
            </div>
          </section>
        </>
      )}
      {!data && <div className="ds-section"><div className="ds-card ds-card--loading" /></div>}
    </main>
  );
}

function Row({ dept, cells, view, columns }) {
  return (
    <>
      <div className="org-heat__row">
        <strong>{dept.name}</strong>
        <span>{dept.members} members{dept.median_familiarity != null ? ` · median ${dept.median_familiarity}%` : ""}</span>
      </div>
      {cells
        ? cells.map((c, j) => {
            const v = c[view];
            return (
              <div
                key={columns[j].uri}
                className={`org-heat__cell${v >= 55 ? " is-dark" : ""}`}
                style={{ "--v": v }}
                title={`${dept.name} · ${columns[j].skill}: needed by ${c.need}% of likely roles, average readiness ${c.have}%`}
              >
                <span className="num">{v}</span>
              </div>
            );
          })
        : columns.map((c) => <div key={c.uri} className="org-heat__cell org-heat__cell--hidden" title="Hidden: fewer than 5 people">–</div>)}
    </>
  );
}

function Stat({ value, label, small }) {
  return (
    <div className="ds-stat">
      <span className={`ds-stat__value${small ? " ds-stat__value--small" : ""}`}>{value}</span>
      <span className="ds-stat__label">{label}</span>
    </div>
  );
}
