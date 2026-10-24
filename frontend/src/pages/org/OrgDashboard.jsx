import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BrandMark from "../../components/BrandMark.jsx";
import { fetchOrg } from "../../api.js";
import { saveAdmin } from "../../lib/hire.js";
import "../../styles/dash.css";
import "./OrgDashboard.css";

/*
  The university's growth dashboard, after the admin signs in on /org.
  Left: the programmes (pick one, e.g. Bachelor of Information Technology) and the
  sections of the page. Right, for that programme: how students have grown this
  semester, how each module is going (week 1 against now, and a students × modules
  heatmap), and a table of every student, each with their own view.
  Mastery = how much of a module's ESCO skills a student has shown on Bridge, measured
  like the matcher. Students joined with consent to staff seeing their progress by name.
  The demo university and its students are SYNTHETIC (backend/scripts/make_org_demo.py).
*/

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const overall = (s) => s.weekly[s.weekly.length - 1];
const growth = (s) => overall(s) - s.weekly[0];
const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const firstName = (name) => name.split(" ")[0];

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const STATUS = {
  support: { label: "Needs support", order: 0 },
  "on-track": { label: "On track", order: 1 },
  ahead: { label: "Ahead", order: 2 },
};
const YEARS = ["all", 1, 2, 3];
const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "growth", label: "Growth" },
  { id: "modules", label: "Modules" },
  { id: "students", label: "Students" },
];
const lastActive = (d) => (d === 0 ? "Today" : d === 1 ? "Yesterday" : d < 7 ? `${d} days ago` : `${Math.round(d / 7)} week${d >= 11 ? "s" : ""} ago`);

export default function OrgDashboard({ code, admin }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [year, setYear] = useState("all");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let live = true;
    fetchOrg(code, admin?.token)
      .then((d) => live && setData(d))
      .catch((e) => {
        if (!live) return;
        if (e.signedOut) {
          saveAdmin(null);
          navigate("/org", { replace: true, state: { signedOut: true } });
        } else setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [code, admin?.token, navigate]);

  const prog = data?.programmes.find((p) => p.id === params.get("p")) || data?.programmes[0];
  const students = useMemo(() => (prog ? prog.students.filter((s) => year === "all" || s.year === year) : []), [prog, year]);
  const median = useMemo(() => (prog ? prog.students[0].weekly.map((_, w) => quantile(prog.students.map((s) => s.weekly[w]), 0.5)) : []), [prog]);
  const open = prog?.students.find((s) => s.id === openId) || null;
  const progsRef = useRef(null);

  // Phones: the programmes are one scrolling row, so bring the chosen one into view
  useEffect(() => {
    const row = progsRef.current;
    const on = row?.querySelector(".is-on");
    if (row && on && row.scrollWidth > row.clientWidth) row.scrollTo({ left: on.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft - 16 });
  }, [prog?.id]);

  function signOut() {
    saveAdmin(null);
    navigate("/org");
  }

  function pick(id) {
    setParams({ p: id }, { replace: true });
    setYear("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (error) {
    return (
      <main className="od-error">
        <div className="od-error__card night">
          <BrandMark />
          <h1>{error}</h1>
          <p>Sign in again, or check with your university's Bridge admin.</p>
          <button type="button" className="btn btn--ghost" onClick={signOut}>Back to sign-in</button>
        </div>
      </main>
    );
  }

  if (!prog) return <main className="od-loading" aria-label="Loading the dashboard" />;

  const org = data.org;
  return (
    <div className="dash">
      <aside className="dash-side night">
        <BrandMark />
        <div className="dash-side__ctx">
          <p className="dash-side__title">{org.name}</p>
          <p className="dash-side__sub">{org.unit}</p>
          {org.synthetic && <span className="dash-side__badge">Demo · every student is made up</span>}
        </div>

        <nav aria-label="Programmes" className="dash-side__group">
          <p className="dash-side__label">Programmes</p>
          <ul className="dash-items" ref={progsRef}>
            {data.programmes.map((p) => (
              <li key={p.id}>
                <button type="button" className={`dash-item${p.id === prog.id ? " is-on" : ""}`} onClick={() => pick(p.id)} aria-current={p.id === prog.id ? "page" : undefined}>
                  <span className="dash-item__badge">{p.short}</span>
                  <span className="dash-item__text">
                    <span className="dash-item__name">{p.name}</span>
                    <span className="dash-item__meta">{p.students.length} students · {Math.round(mean(p.students.map(overall)))}% mastery</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="On this page" className="dash-side__group dash-side__links">
          <p className="dash-side__label">On this page</p>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>{s.label}</a>
          ))}
        </nav>

        <div className="dash-side__foot">
          <span className="dash-side__avatar" aria-hidden="true">{admin.email.charAt(0).toUpperCase()}</span>
          <span className="dash-side__who">
            <span>{admin.email}</span>
            <span>Organisation admin</span>
          </span>
          <button type="button" className="dash-side__btn" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="dash-main od-main">
        <header className="od-head rise">
          <p className="label-mono">Growth dashboard · Semester 1, {prog.intake} · week {org.week} of {org.semester_weeks}</p>
          <h1 className="od-head__title">{prog.name}</h1>
          <p className="od-head__sub">
            {prog.students.length} students, {prog.modules.length} modules. Mastery is how much of a module's skills a student has shown on Bridge, matched to the official ESCO skills list.
          </p>
        </header>

        <div className="od-filters" role="group" aria-label="Year of study">
          {YEARS.map((y) => {
            const n = y === "all" ? prog.students.length : prog.students.filter((s) => s.year === y).length;
            return (
              <button key={y} type="button" className={`od-chip${year === y ? " is-on" : ""}`} aria-pressed={year === y} onClick={() => setYear(y)} disabled={!n}>
                {y === "all" ? "All years" : `Year ${y}`} <span className="num">{n}</span>
              </button>
            );
          })}
        </div>

        {students.length === 0 ? (
          <p className="od-empty">No students in this year.</p>
        ) : (
          <>
            <Overview students={students} />

            <section id="growth" className="od-grid od-grid--growth" aria-label="Growth">
              <GrowthChart students={students} />
              <Heading students={students} />
            </section>

            <section id="modules" className="od-grid od-grid--modules" aria-label="Modules">
              <ModuleProgress prog={prog} students={students} />
              <Heatmap prog={prog} students={students} onOpen={setOpenId} />
            </section>

            <StudentTable prog={prog} students={students} onOpen={setOpenId} />
          </>
        )}
      </main>

      <StudentSheet student={open} prog={prog} median={median} onClose={() => setOpenId(null)} />
    </div>
  );
}

/* ---------- Shared bits ---------- */

// Width of an element, kept up to date, so SVG charts draw at real pixel sizes
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// One floating readout per chart, placed next to the pointer (or the focused mark)
function useTip() {
  const box = useRef(null);
  const [tip, setTip] = useState(null);
  const show = (e, content) => {
    const r = box.current.getBoundingClientRect();
    const t = e.currentTarget.getBoundingClientRect();
    const x = e.clientX ? e.clientX - r.left : t.left + t.width / 2 - r.left;
    const y = e.clientY ? e.clientY - r.top : t.top - r.top;
    setTip({ x, y, content, flip: x > r.width - 200 });
  };
  const node = tip && (
    <div className={`od-tip${tip.flip ? " od-tip--flip" : ""}`} style={{ left: tip.x, top: tip.y }} role="tooltip">
      {tip.content}
    </div>
  );
  return { box, show, hide: () => setTip(null), node };
}

function Card({ title, sub, children, className = "", tools, ...rest }) {
  return (
    <div className={`od-card ${className}`} {...rest}>
      <div className="od-card__head">
        <div>
          <h2 className="od-card__title">{title}</h2>
          {sub && <p className="od-card__sub">{sub}</p>}
        </div>
        {tools}
      </div>
      {children}
    </div>
  );
}

function StatusChip({ status }) {
  return (
    <span className={`od-status od-status--${status}`}>
      {status === "support" ? <AlertIcon /> : status === "ahead" ? <UpIcon /> : <DotIcon />}
      {STATUS[status].label}
    </span>
  );
}

function Sparkline({ values, width = 64, height = 22 }) {
  const max = 100;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 2 - (v / max) * (height - 4)}`);
  const last = pts[pts.length - 1].split(",");
  return (
    <svg className="od-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts.join(" ")} />
      <circle cx={last[0]} cy={last[1]} r="2.5" />
    </svg>
  );
}

/* ---------- Overview tiles ---------- */

function Overview({ students }) {
  const n = students.length;
  const now = Math.round(mean(students.map(overall)));
  const week1 = Math.round(mean(students.map((s) => s.weekly[0])));
  const trend = students[0].weekly.map((_, w) => mean(students.map((s) => s.weekly[w])));
  const support = students.filter((s) => s.status === "support").length;
  const active = students.filter((s) => s.active_days_ago <= 6).length;
  const hours = mean(students.map((s) => s.hours));
  return (
    <section id="overview" className="od-kpis" aria-label="Overview">
      <div className="od-kpi">
        <span className="od-kpi__label">Average mastery</span>
        <span className="od-kpi__value">{now}%</span>
        <span className="od-kpi__delta is-up">+{now - week1} pts since week 1</span>
        <Sparkline values={trend} width={96} height={28} />
      </div>
      <div className="od-kpi">
        <span className="od-kpi__label">Need support</span>
        <span className="od-kpi__value">{support}<span className="od-kpi__of"> of {n}</span></span>
        <span className="od-kpi__delta">Under 35%, or under 50% and barely moving for 4 weeks</span>
      </div>
      <div className="od-kpi">
        <span className="od-kpi__label">Active this week</span>
        <span className="od-kpi__value">{active}<span className="od-kpi__of"> of {n}</span></span>
        <span className="od-kpi__delta">Learned something on Bridge in the last 7 days</span>
      </div>
      <div className="od-kpi">
        <span className="od-kpi__label">Learning time</span>
        <span className="od-kpi__value">{hours.toFixed(1)}<span className="od-kpi__of"> h a week</span></span>
        <span className="od-kpi__delta">Average, on top of classes</span>
      </div>
    </section>
  );
}

/* ---------- Growth over the semester: median with the middle half as a band ---------- */

function GrowthChart({ students }) {
  const [ref, width] = useWidth();
  const tip = useTip();
  const [hover, setHover] = useState(null);
  const weeks = students[0].weekly.length;
  const rows = Array.from({ length: weeks }, (_, w) => {
    const vals = students.map((s) => s.weekly[w]);
    return { week: w + 1, median: quantile(vals, 0.5), q1: quantile(vals, 0.25), q3: quantile(vals, 0.75) };
  });
  const H = 240;
  const m = { l: 36, r: 44, t: 12, b: 28 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = H - m.t - m.b;
  const x = (w) => m.l + (weeks === 1 ? 0 : (w / (weeks - 1)) * iw);
  const y = (v) => m.t + ih - (v / 100) * ih;
  const band = rows.map((r, i) => `${x(i)},${y(r.q3)}`).join(" ") + " " + [...rows].reverse().map((r, i) => `${x(weeks - 1 - i)},${y(r.q1)}`).join(" ");
  const line = rows.map((r, i) => `${x(i)},${y(r.median)}`).join(" ");
  const last = rows[weeks - 1];

  function move(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.max(0, Math.min(weeks - 1, Math.round(((e.clientX - r.left - m.l) / iw) * (weeks - 1))));
    setHover(i);
    tip.show(e, (
      <>
        <strong>{Math.round(rows[i].median)}%</strong> median, week {rows[i].week}
        <span>Middle half {Math.round(rows[i].q1)}–{Math.round(rows[i].q3)}%</span>
      </>
    ));
  }

  return (
    <Card title="Growth over the semester" sub="Median mastery across all modules, week by week. The band is the middle half of students." className="od-card--growth">
      <div className="od-chart" ref={(el) => ((ref.current = el), (tip.box.current = el))}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label={`Median mastery grew from ${Math.round(rows[0].median)}% in week 1 to ${Math.round(last.median)}% in week ${last.week}`}>
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v}>
                <line className="od-grid-line" x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} />
                <text className="od-axis" x={m.l - 8} y={y(v) + 4} textAnchor="end">{v}%</text>
              </g>
            ))}
            {rows.map((r, i) => (iw / weeks > 26 || i % 2 === 0 ? (
              <text key={r.week} className="od-axis" x={x(i)} y={H - 8} textAnchor="middle">{r.week}</text>
            ) : null))}
            <polygon className="od-band" points={band} />
            <polyline className="od-line" points={line} />
            {hover != null && <line className="od-cross" x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} />}
            <circle className="od-end" cx={x(hover ?? weeks - 1)} cy={y(rows[hover ?? weeks - 1].median)} r="5" />
            <text className="od-end-label" x={x(weeks - 1) + 10} y={y(last.median) + 4}>{Math.round(last.median)}%</text>
            <rect
              x={m.l} y={m.t} width={iw} height={ih} fill="transparent"
              onPointerMove={move}
              onPointerLeave={() => (setHover(null), tip.hide())}
            />
          </svg>
        )}
        {tip.node}
      </div>
      <details className="od-tableview">
        <summary>View as a table</summary>
        <table>
          <thead><tr><th>Week</th><th>Median</th><th>Middle half</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.week}><td>{r.week}</td><td>{Math.round(r.median)}%</td><td>{Math.round(r.q1)}–{Math.round(r.q3)}%</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}

/* ---------- Where they're heading: best-match roles ---------- */

function Heading({ students }) {
  const counts = {};
  students.forEach((s) => (counts[s.heading.role] = (counts[s.heading.role] || 0) + 1));
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(...rows.map(([, c]) => c));
  return (
    <Card title="Where they're heading" sub="Each student's best-match role on Bridge right now">
      <ul className="od-bars">
        {rows.map(([role, c]) => (
          <li key={role}>
            <span className="od-bars__label">{sentence(role)}</span>
            <span className="od-bars__track"><span style={{ width: `${(100 * c) / max}%` }} /></span>
            <span className="od-bars__value num">{c}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------- Modules: week 1 (ring) against now (dot), weakest first ---------- */

function moduleStats(prog, students) {
  return prog.modules
    .map((mod, i) => ({
      i,
      name: mod.name,
      skills: mod.skills,
      now: mean(students.map((s) => s.modules[i])),
      week1: mean(students.map((s) => s.modules_week1[i])),
      under: students.filter((s) => s.modules[i] < 40).length,
    }))
    .sort((a, b) => a.now - b.now);
}

function ModuleProgress({ prog, students }) {
  const tip = useTip();
  const stats = moduleStats(prog, students);
  const focus = stats.slice(0, 2);
  return (
    <Card
      title="Module progress"
      sub="Average mastery per module, weakest first"
      tools={
        <span className="od-legend" aria-hidden="true">
          <span><i className="od-mark od-mark--ring" /> Week 1</span>
          <span><i className="od-mark od-mark--dot" /> Now</span>
        </span>
      }
    >
      <div className="od-modules">
      <div className="od-dumbbells" ref={tip.box}>
        <div className="od-dumbbells__axis" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
        <ul>
          {stats.map((s) => (
            <li
              key={s.name}
              tabIndex={0}
              onPointerMove={(e) => tip.show(e, <><strong>{Math.round(s.now)}%</strong> {s.name}<span>Week 1: {Math.round(s.week1)}% · {s.under} of {students.length} under 40%</span></>)}
              onFocus={(e) => tip.show(e, <><strong>{Math.round(s.now)}%</strong> {s.name}<span>Week 1: {Math.round(s.week1)}% · {s.under} of {students.length} under 40%</span></>)}
              onPointerLeave={tip.hide}
              onBlur={tip.hide}
              aria-label={`${s.name}: ${Math.round(s.now)}% now, ${Math.round(s.week1)}% in week 1, ${s.under} students under 40%`}
            >
              <span className="od-db__name">{s.name}</span>
              <span className="od-db__track">
                <span className="od-db__span" style={{ left: `${s.week1}%`, width: `${Math.max(0, s.now - s.week1)}%` }} />
                <i className="od-mark od-mark--ring" style={{ left: `${s.week1}%` }} />
                <i className="od-mark od-mark--dot" style={{ left: `${s.now}%` }} />
              </span>
              <span className="od-db__value"><strong className="num">{Math.round(s.now)}%</strong> <span className="num">+{Math.round(s.now - s.week1)}</span></span>
            </li>
          ))}
        </ul>
        {tip.node}
      </div>
      <div className="od-focus">
        <p className="label-mono">Focus here first</p>
        {focus.map((f) => (
          <p key={f.name}>
            <strong>{f.name}</strong>: {f.under} of {students.length} students are under 40%. A revision workshop or lab session would reach the most people.
          </p>
        ))}
      </div>
      </div>
    </Card>
  );
}

/* ---------- Students × modules heatmap ---------- */

function Heatmap({ prog, students, onOpen }) {
  const tip = useTip();
  const [view, setView] = useState("now");
  const [all, setAll] = useState(false);
  const rows = [...students].sort((a, b) => overall(a) - overall(b));
  const shown = all ? rows : rows.slice(0, 10);
  const value = (s, i) => (view === "now" ? s.modules[i] : s.modules[i] - s.modules_week1[i]);
  const shade = (v) => (view === "now" ? v : Math.min(100, v * 2.2)); // growth tops out ~45 pts
  return (
    <Card
      title="Every student, every module"
      sub="Lowest overall first, so the students who need help are on top"
      className="od-card--heat"
      tools={
        <div className="od-seg" role="tablist" aria-label="What the colours show">
          {[["now", "Mastery now"], ["growth", "Growth since week 1"]].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? "is-on" : ""} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
      }
    >
      <div className="od-heat-wrap" ref={tip.box}>
        <table className="od-heat" style={{ "--cols": prog.modules.length }}>
          <thead>
            <tr>
              <th scope="col" className="od-heat__corner">Student</th>
              {prog.modules.map((mod) => <th key={mod.name} scope="col">{mod.name}</th>)}
              <th scope="col">Overall</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <th scope="row">
                  <button type="button" className="od-link" onClick={() => onOpen(s.id)}>{s.name}</button>
                </th>
                {prog.modules.map((mod, i) => {
                  const v = value(s, i);
                  return (
                    <td
                      key={mod.name}
                      className={shade(v) >= 58 ? "is-dark" : ""}
                      style={{ "--v": shade(v) }}
                      onPointerMove={(e) => tip.show(e, <><strong>{s.modules[i]}%</strong> {s.name}, {mod.name}<span>Week 1: {s.modules_week1[i]}% (+{s.modules[i] - s.modules_week1[i]})</span></>)}
                      onPointerLeave={tip.hide}
                    >
                      {view === "now" ? v : `+${v}`}
                    </td>
                  );
                })}
                <td className="od-heat__overall num">{overall(s)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tip.node}
      </div>
      <div className="od-heat__foot">
        {rows.length > 10 && (
          <button type="button" className="od-link" onClick={() => setAll((v) => !v)}>
            {all ? "Show the 10 lowest only" : `Show all ${rows.length} students`}
          </button>
        )}
        <span className="od-scale" aria-hidden="true">
          <span>{view === "now" ? "0%" : "+0"}</span>
          <span className="od-scale__bar" />
          <span>{view === "now" ? "100%" : "+45"}</span>
        </span>
      </div>
    </Card>
  );
}

/* ---------- Student table ---------- */

const COLUMNS = [
  { id: "name", label: "Student", get: (s) => s.name },
  { id: "year", label: "Year", get: (s) => s.year },
  { id: "mastery", label: "Mastery", get: overall },
  { id: "growth", label: "Growth", get: growth },
  { id: "weakest", label: "Weakest module", get: (s) => Math.min(...s.modules) },
  { id: "hours", label: "Learning time", get: (s) => s.hours },
  { id: "active", label: "Last active", get: (s) => s.active_days_ago },
  { id: "status", label: "Status", get: (s) => STATUS[s.status].order },
];

function StudentTable({ prog, students, onOpen }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState({ id: "mastery", dir: 1 });
  const col = COLUMNS.find((c) => c.id === sort.id);
  const rows = students
    .filter((s) => (status === "all" || s.status === status) && s.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * sort.dir;
    });
  const toggle = (id) => setSort((s) => (s.id === id ? { id, dir: -s.dir } : { id, dir: 1 }));

  return (
    <section id="students" className="od-card od-students" aria-label="Students">
      <div className="od-card__head">
        <div>
          <h2 className="od-card__title">Students</h2>
          <p className="od-card__sub">Open a student to see their modules and growth. Students agreed to staff seeing this when they joined.</p>
        </div>
      </div>
      <div className="od-students__tools">
        <input className="input od-search" type="search" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search students by name" />
        <div className="od-students__filter" role="group" aria-label="Filter by status">
          {["all", "support", "on-track", "ahead"].map((st) => (
            <button key={st} type="button" className={`od-chip${status === st ? " is-on" : ""}`} aria-pressed={status === st} onClick={() => setStatus(st)}>
              {st === "all" ? "Everyone" : STATUS[st].label} <span className="num">{st === "all" ? students.length : students.filter((s) => s.status === st).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="od-table-wrap">
        <table className="od-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.id} scope="col" aria-sort={sort.id === c.id ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => toggle(c.id)}>
                    {c.label}
                    <span className="od-sort" aria-hidden="true">{sort.id === c.id ? (sort.dir > 0 ? "↑" : "↓") : ""}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const weakest = s.modules.indexOf(Math.min(...s.modules));
              return (
                <tr key={s.id} onClick={() => onOpen(s.id)}>
                  <th scope="row">
                    <button type="button" className="od-person" onClick={(e) => (e.stopPropagation(), onOpen(s.id))}>
                      <span className="od-person__avatar" aria-hidden="true">{s.name.charAt(0)}</span>
                      <span>
                        <span className="od-person__name">{s.name}</span>
                        <span className="od-person__sub">{s.heading.role ? sentence(s.heading.role) : s.id}</span>
                      </span>
                    </button>
                  </th>
                  <td className="num">{s.year}</td>
                  <td>
                    <span className="od-meter"><span style={{ width: `${overall(s)}%` }} /></span>
                    <span className="num">{overall(s)}%</span>
                  </td>
                  <td className="od-table__growth">
                    <Sparkline values={s.weekly} />
                    <span className="num">+{growth(s)}</span>
                  </td>
                  <td>{prog.modules[weakest].name} <span className="od-muted num">{s.modules[weakest]}%</span></td>
                  <td className="num">{s.hours} h/wk</td>
                  <td>{lastActive(s.active_days_ago)}</td>
                  <td><StatusChip status={s.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="od-empty">No students match.</p>}
      </div>
    </section>
  );
}

/* ---------- One student ---------- */

function StudentSheet({ student, prog, median, onClose }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(student);
  if (student && student !== shown) setShown(student); // keep the content while it closes

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (student && !d.open) d.showModal();
    if (!student && d.open) d.close();
  }, [student]);

  const s = shown;
  return (
    <dialog ref={ref} className="od-sheet ui-modal" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="od-sheet-title">
      {s && (
        <>
          <header className="od-sheet__head ui-modal__band night">
            <span className="od-sheet__avatar" aria-hidden="true">{s.name.charAt(0)}</span>
            <div className="od-sheet__who">
              <h2 id="od-sheet-title">{s.name}</h2>
              <p>{prog.short} · year {s.year} · {s.id.toUpperCase()}</p>
            </div>
            <StatusChip status={s.status} />
            <button type="button" className="od-sheet__close" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>
          <div className="od-sheet__body ui-modal__body">
            <div className="od-sheet__stats">
              <div><span className="od-kpi__label">Mastery</span><strong>{overall(s)}%</strong><span>+{growth(s)} since week 1</span></div>
              <div><span className="od-kpi__label">Topics done</span><strong>{s.topics_done}<small> of {s.topics_total}</small></strong><span>on Bridge</span></div>
              <div><span className="od-kpi__label">Learning time</span><strong>{s.hours}<small> h</small></strong><span>a week</span></div>
              <div><span className="od-kpi__label">Last active</span><strong className="od-sheet__small">{lastActive(s.active_days_ago)}</strong></div>
            </div>
            <p className="od-sheet__heading">
              Best match right now: <strong>{sentence(s.heading.role)}</strong>, {s.heading.familiarity}% familiar.
            </p>

            <h3 className="od-sheet__h">Growth</h3>
            <CompareChart student={s} median={median} />

            <h3 className="od-sheet__h">Modules</h3>
            <span className="od-legend od-legend--block" aria-hidden="true">
              <span><i className="od-mark od-mark--ring" /> Week 1</span>
              <span><i className="od-mark od-mark--dot" /> Now</span>
            </span>
            <ul className="od-dumbbells od-dumbbells--sheet">
              {prog.modules
                .map((mod, i) => ({ name: mod.name, now: s.modules[i], week1: s.modules_week1[i] }))
                .sort((a, b) => a.now - b.now)
                .map((m) => (
                  <li key={m.name} aria-label={`${m.name}: ${m.now}% now, ${m.week1}% in week 1`}>
                    <span className="od-db__name">{m.name}</span>
                    <span className="od-db__track">
                      <span className="od-db__span" style={{ left: `${m.week1}%`, width: `${Math.max(0, m.now - m.week1)}%` }} />
                      <i className="od-mark od-mark--ring" style={{ left: `${m.week1}%` }} />
                      <i className="od-mark od-mark--dot" style={{ left: `${m.now}%` }} />
                    </span>
                    <span className="od-db__value"><strong className="num">{m.now}%</strong> <span className="num">+{m.now - m.week1}</span></span>
                  </li>
                ))}
            </ul>
          </div>
        </>
      )}
    </dialog>
  );
}

// The student's weekly mastery against the programme median
function CompareChart({ student, median }) {
  const [ref, width] = useWidth();
  const weeks = student.weekly.length;
  const H = 180;
  const m = { l: 36, r: 64, t: 10, b: 24 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = H - m.t - m.b;
  const x = (w) => m.l + (w / (weeks - 1)) * iw;
  const y = (v) => m.t + ih - (v / 100) * ih;
  const path = (vals) => vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const sEnd = student.weekly[weeks - 1];
  const mEnd = median[weeks - 1];
  const apart = Math.abs(y(sEnd) - y(mEnd)) > 14; // only label the ends when they don't collide
  return (
    <div className="od-compare">
      <span className="od-legend od-legend--block" aria-hidden="true">
        <span><i className="od-key od-key--student" /> {firstName(student.name)}</span>
        <span><i className="od-key od-key--median" /> Programme median</span>
      </span>
      <div className="od-chart" ref={ref}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label={`${student.name}: ${student.weekly[0]}% in week 1, ${sEnd}% now; programme median ${Math.round(mEnd)}%`}>
            {[0, 50, 100].map((v) => (
              <g key={v}>
                <line className="od-grid-line" x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} />
                <text className="od-axis" x={m.l - 8} y={y(v) + 4} textAnchor="end">{v}%</text>
              </g>
            ))}
            <text className="od-axis" x={m.l} y={H - 6}>Week 1</text>
            <text className="od-axis" x={m.l + iw} y={H - 6} textAnchor="end">Week {weeks}</text>
            <polyline className="od-line od-line--median" points={path(median)} />
            <polyline className="od-line" points={path(student.weekly)} />
            <circle className="od-end" cx={x(weeks - 1)} cy={y(sEnd)} r="5" />
            <text className="od-end-label" x={x(weeks - 1) + 10} y={y(sEnd) + 4}>{sEnd}%</text>
            {apart && <text className="od-end-label od-end-label--muted" x={x(weeks - 1) + 10} y={y(mEnd) + 4}>{Math.round(mEnd)}%</text>}
          </svg>
        )}
      </div>
    </div>
  );
}

const icon = (children, size = 14) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const AlertIcon = () => icon(<><path d="M12 8v5" /><path d="M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></>);
const UpIcon = () => icon(<path d="M6 14l6-6 6 6" />);
const DotIcon = () => icon(<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />);
