import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import BrandMark from "../../components/BrandMark.jsx";
import NodeNetwork from "../../components/NodeNetwork.jsx";
import { fetchExampleProject, fetchOrg, orgLogin } from "../../api.js";
import { useGo } from "../../lib/go.js";
import { deleteProject, newProject, readAdmin, readProjects, saveAdmin, saveProject, splitCodes } from "../../lib/hire.js";
import "../Auth.css"; // the same split layout as sign-up and log-in
import "../data/DataSources.css"; // shared page frame (ds, ds__brand, ds-head, ds-stats, ds-section)
import "./Org.css";

/*
  Organisation side (university or HR).
  /org        → a sign-in page with two panels; the one in focus opens, the other
                shrinks to a bar:
                · Admin sign-in → the organisation's anonymous numbers (/org/:code)
                · Hiring → projects: a brief of who you're looking for, plus the codes
                  candidates shared (/hire/:id). ?panel=hire opens this one.
  /org/:code  → heatmap of skills the members' likely next roles need, by department,
                where they're heading, how ready they are, and which UN SDGs those roles serve.
                Needs the admin sign-in (demo: one synthetic admin, shown on the page).
  The demo organisation, its members and the example candidates are SYNTHETIC
  (backend/scripts/make_org_demo.py, backend/data/journeys_demo.json).
*/

const DEMO_ADMIN = { email: "admin@demo-uni.edu", password: "bridge-demo-2026" };
const VIEWS = [
  { id: "priority", label: "Workshop priority", note: "Many need it and few have it yet" },
  { id: "need", label: "Who needs it", note: "Share of members whose likely next roles need this skill" },
  { id: "have", label: "How ready", note: "Average readiness in this skill today" },
];
const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const priority = (need, have) => Math.round((need * (100 - have)) / 100);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function Org() {
  const { code } = useParams();
  if (!code) return <OrgGate />;
  // The numbers are for the organisation's admin: sign in first
  return readAdmin()?.code === code.toUpperCase() ? <OrgView code={code} /> : <Navigate to="/org" replace />;
}

function OrgGate() {
  const go = useGo(); // switching panels morphs one into the other
  const [params] = useSearchParams();
  const panel = params.get("panel") === "hire" ? "hire" : "admin";
  const [focused, setFocused] = useState(null); // "email" | "lock" | null: shapes the dots, like log-in
  const [hovered, setHovered] = useState(null); // same, while the pointer is over a field (focus wins)
  const open = (p) => p !== panel && go(p === "hire" ? "/org?panel=hire" : "/org", { replace: true });

  return (
    <main className="auth org-gate">
      <div className="auth__inner">
        <section className="auth__panel night">
          <BrandMark />
          <div className="auth__visual">
            <NodeNetwork shape={panel === "hire" ? "card" : focused || hovered} />
          </div>
          <div className="auth__panel-foot">
            <p className="auth__tagline">{panel === "hire" ? "Hire for what people can do." : "See where your people are heading."}</p>
            <p className="auth__facts">For universities and HR teams · <Link to="/data">Where the data comes from</Link></p>
          </div>
        </section>

        <section className="auth__form-side">
          <div className="gate">
            <GatePanel
              id="admin"
              open={panel === "admin"}
              onOpen={() => open("admin")}
              kicker="Organisation admin"
              title="Sign in"
              bar={{ title: "Organisation admin sign-in", sub: "Your members' anonymous, combined numbers" }}
              icon={<ChartIcon />}
            >
              <AdminForm onShape={setFocused} onHover={setHovered} />
            </GatePanel>

            <GatePanel
              id="hire"
              open={panel === "hire"}
              onOpen={() => open("hire")}
              kicker="Hiring"
              title="Candidates' journeys"
              bar={{ title: "View candidates' journeys", sub: "Line up the journeys candidates share with a brief" }}
              icon={<PeopleIcon />}
            >
              <HireProjects />
            </GatePanel>

            <p className="auth__switch">
              Learning with Bridge? <Link to="/login">Log in as a learner</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

/* One side of the page: open, it's a titled section; closed, a bar that opens it */
function GatePanel({ id, open, onOpen, kicker, title, bar, icon, children }) {
  return (
    <section className={`gate-panel${open ? " is-open" : ""}`} style={{ viewTransitionName: `gate-${id}` }} aria-labelledby={`gate-${id}-title`}>
      {open ? (
        <>
          <p className="label-mono rise" style={{ "--i": 0 }}>{kicker}</p>
          <h1 id={`gate-${id}-title`} className="auth__title rise" style={{ "--i": 1 }}>{title}</h1>
          {children}
        </>
      ) : (
        <button type="button" className="gate-bar" onClick={onOpen}>
          <span className="gate-bar__icon">{icon}</span>
          <span className="gate-bar__text">
            <strong id={`gate-${id}-title`}>{bar.title}</strong>
            <span>{bar.sub}</span>
          </span>
          <ChevronIcon />
        </button>
      )}
    </section>
  );
}

function AdminForm({ onShape, onHover }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e, creds = { email, password }) {
    e?.preventDefault();
    if (!creds.email.trim() || !creds.password) return setError("Enter your work email and password.");
    setBusy(true);
    setError("");
    try {
      const admin = await orgLogin(creds.email.trim(), creds.password);
      saveAdmin(admin);
      navigate(`/org/${admin.code}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function useDemo() {
    setEmail(DEMO_ADMIN.email);
    setPassword(DEMO_ADMIN.password);
    signIn(null, DEMO_ADMIN);
  }

  return (
    <form className="gate-form" onSubmit={signIn} noValidate>
      <label className="field rise" style={{ "--i": 2 }}>
        <span className="field__label">Work email</span>
        <input
          type="email"
          autoComplete="username"
          placeholder="you@organisation.edu"
          value={email}
          onChange={(e) => (setEmail(e.target.value), setError(""))}
          onFocus={() => onShape("email")}
          onBlur={() => onShape(null)}
          onMouseEnter={() => onHover("email")}
          onMouseLeave={() => onHover(null)}
        />
      </label>
      <label className="field rise" style={{ "--i": 3 }}>
        <span className="field__label">Password</span>
        <span className="field__password" onMouseEnter={() => onHover("lock")} onMouseLeave={() => onHover(null)}>
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => (setPassword(e.target.value), setError(""))}
            onFocus={() => onShape("lock")}
            onBlur={() => onShape(null)}
          />
          <button
            type="button"
            className="field__eye"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <EyeIcon open={showPassword} />
          </button>
        </span>
      </label>
      {error && <p className="auth__error" role="alert">{error}</p>}
      <button type="submit" className="btn btn--primary rise" style={{ "--i": 4 }} disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="gate-note rise" style={{ "--i": 5 }}>
        No account? Organisation accounts are set up for you. Ask your HR team or your university's Bridge admin.
      </p>
      <button type="button" className="btn btn--ghost auth__demo rise" style={{ "--i": 6 }} onClick={useDemo} disabled={busy}>
        Use the demo admin (made-up university)
      </button>
    </form>
  );
}

function HireProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState(readProjects);
  const [codes, setCodes] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exampleError, setExampleError] = useState(false);

  async function openExample() {
    setBusy(true);
    setExampleError(false);
    try {
      const { codes: demoCodes, ...brief } = await fetchExampleProject();
      const project = saveProject({ ...newProject(brief, demoCodes), example: true });
      navigate(`/hire/${project.id}`);
    } catch {
      setExampleError(true);
      setBusy(false);
    }
  }

  function remove(p) {
    if (!window.confirm(`Delete "${p.brief.title || "Untitled project"}"? Its brief and codes are removed from this browser.`)) return;
    deleteProject(p.id);
    setProjects(readProjects());
  }

  function viewCodes(e) {
    e.preventDefault();
    const list = splitCodes(codes);
    setCodeError(!list.length);
    if (list.length) navigate(`/journey?c=${encodeURIComponent(list.join(","))}`);
  }

  return (
    <div className="gate-hire">
      <p className="gate-hire__intro rise" style={{ "--i": 2 }}>
        Start a project: describe who you're looking for, then add the codes candidates share from their Bridge dashboard. You'll see how each one lines up with your brief, and why.
      </p>

      {projects.length > 0 && (
        <ul className="gate-projects rise" style={{ "--i": 3 }} aria-label="Your hiring projects">
          {projects.map((p) => (
            <li key={p.id}>
              <Link to={`/hire/${p.id}`} className="gate-project">
                <strong>{p.brief.title || "Untitled project"}</strong>
                <span>{[p.brief.role, plural(p.codes.length, "candidate")].filter(Boolean).join(" · ")}</span>
              </Link>
              <button type="button" className="gate-project__remove" onClick={() => remove(p)} aria-label={`Delete ${p.brief.title || "this project"}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn btn--primary rise" style={{ "--i": 4 }} onClick={() => navigate("/hire/new")}>
        New hiring project
      </button>
      {!projects.some((p) => p.example) && (
        <button type="button" className="btn btn--ghost auth__demo rise" style={{ "--i": 5 }} onClick={openExample} disabled={busy}>
          {busy ? "Opening…" : "Open the example project (made-up candidates)"}
        </button>
      )}
      {exampleError && (
        <p className="auth__error" role="alert">We couldn't load the example project right now. Check your connection and try again.</p>
      )}

      <form className="gate-quick rise" style={{ "--i": 6 }} onSubmit={viewCodes}>
        <label className="field__label" htmlFor="gate-codes">Only have a code?</label>
        <div className="gate-quick__row">
          <input
            id="gate-codes"
            className="input"
            value={codes}
            onChange={(e) => (setCodes(e.target.value), setCodeError(false))}
            placeholder="e.g. K7M-2QX, DEMO-AINA"
            aria-invalid={codeError}
          />
          <button type="submit" className="btn btn--ghost">View</button>
        </div>
        {codeError ? (
          <span className="auth__error" role="alert">Type at least one code. Separate several with commas or spaces.</span>
        ) : (
          <span className="gate-note">Several at once? Separate them with commas or spaces.</span>
        )}
      </form>
    </div>
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
          <p className="ds-head__sub">Sign in again, or check with your HR team or university.</p>
          <div><button type="button" className="btn btn--ghost org__on-night" onClick={() => (saveAdmin(null), navigate("/org"))}>Back to sign-in</button></div>
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
        <button type="button" className="ds__back" onClick={() => (saveAdmin(null), navigate("/org"))}>Sign out</button>
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

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}

const icon = (children, size = 20) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const ChartIcon = () => icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />);
const PeopleIcon = () => icon(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.9.3 5 2.6 5 5.8" /></>);
const ChevronIcon = () => icon(<path d="M9 6l6 6-6 6" />, 18);
