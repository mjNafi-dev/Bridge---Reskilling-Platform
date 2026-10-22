import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BrandMark from "../../components/BrandMark.jsx";
import { readJourney } from "../../lib/journey.js";
import "../data/DataSources.css"; // shared page frame
import "./Journey.css";

/*
  Read-only "learning journey" a user shares with an employer or HR team.
  Everything shown comes from the link itself (see lib/journey.js): no account,
  no server copy, no scores or rankings. It's a snapshot and doesn't update.
*/

const fmtDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

export default function Journey() {
  const [snap, setSnap] = useState(() => readJourney(window.location.hash));

  useEffect(() => {
    const onHash = () => setSnap(readJourney(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (!snap) {
    return (
      <main className="ds">
        <div className="ds__brand night"><BrandMark /></div>
        <section className="ds-head night">
          <p className="label-mono">Learning journey</p>
          <h1 className="ds-head__title">This link is broken or incomplete</h1>
          <p className="ds-head__sub">Ask the person who shared it to copy the link again from their Bridge dashboard.</p>
        </section>
      </main>
    );
  }

  const done = snap.done || [];
  const learning = snap.learning || [];
  const total = Math.max(snap.total || 0, done.length + learning.length);
  const owner = snap.name ? `${snap.name}'s` : "A";

  return (
    <main className="ds jr">
      <div className="ds__brand night"><BrandMark /></div>

      <section className="ds-head night rise">
        <p className="label-mono">Learning journey · shared read-only</p>
        <h1 className="ds-head__title">{owner} path to {snap.role.toLowerCase()}</h1>
        <p className="ds-head__sub">
          {done.length} of {total} topics done{learning.length ? `, ${learning.length} in progress` : ""}
          {snap.hours ? `, learning about ${snap.hours} hours a week` : ""}.
        </p>
        <div className="jr-track" aria-label={`${done.length} of ${total} topics done`}>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`jr-track__seg${i < done.length ? " is-done" : i < done.length + learning.length ? " is-learning" : ""}`}
              style={{ "--i": i }}
            />
          ))}
        </div>
      </section>

      <section className="ds-section jr-cols">
        <TopicCard title="Done" note="Marked done on their pathway" items={done} tone="done" />
        <TopicCard title="Learning now" note="Started, not finished yet" items={learning} tone="learning" />
        <TopicCard title="Already brought" note="Skills and topics they came in with" items={snap.brought || []} tone="brought" />
      </section>

      <p className="jr-foot">
        A snapshot{snap.date ? ` from ${fmtDate(snap.date)}` : ""}, shared by its owner from Bridge. It doesn't update, and it holds no scores or rankings.
        Topics come from the official ESCO skills list. <Link to="/signup">What is Bridge?</Link>
      </p>
    </main>
  );
}

function TopicCard({ title, note, items, tone }) {
  return (
    <div className="ds-card">
      <p className="label-mono">{note}</p>
      <h3>{title} <span className="num jr-count">{items.length}</span></h3>
      {items.length ? (
        <ul className={`jr-list jr-list--${tone}`}>
          {items.map((t, i) => <li key={t} style={{ "--i": i }}>{t}</li>)}
        </ul>
      ) : (
        <p className="ds-card__use">Nothing here yet.</p>
      )}
    </div>
  );
}
