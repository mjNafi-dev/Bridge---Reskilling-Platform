import { useEffect, useRef } from "react";

/* "View more details": everything behind one match, in a dialog. */

const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const PART = {
  F: ["Familiarity", "How much of the core topics you already have"],
  E: ["Ease", "How quickly the gap closes at your weekly hours"],
  D: ["Demand", "Future need, averaged over the moderate and fast AI scenarios"],
  I: ["Interest fit", "Match with the kinds of work you enjoy"],
};
const SOURCE = { postings: "Live job postings", onet_bright: "O*NET Bright Outlook", ilo_genai: "ILO GenAI exposure index (2025)" };

export default function JobDetails({ job, open, onClose, onPathway }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const d = job.demand;
  return (
    <dialog
      ref={ref}
      className="details ui-modal"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // click on the backdrop closes it
      aria-labelledby="details-title"
    >
      <div className="details__inner">
        <header className="details__head ui-modal__band night">
          <div>
            <p className="label-mono">{job.category || "Role"}</p>
            <h2 id="details-title">{sentence(job.title)}</h2>
          </div>
          <button type="button" className="details__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        {job.description && <p className="details__desc">{job.description}</p>}

        <section className="details__section">
          <h3>Bridge score: {job.score}%</h3>
          {Object.entries(job.breakdown).map(([k, part]) => (
            <div className="bar-row" key={k}>
              <div className="bar-row__text">
                <span className="bar-row__name">{PART[k][0]}</span>
                <span className="bar-row__note">{PART[k][1]} · counts {Math.round(part.weight * 100)}%</span>
              </div>
              <span className="bar-row__bar"><span style={{ width: `${part.value}%` }} /></span>
              <span className="bar-row__value num">{part.value}</span>
            </div>
          ))}
        </section>

        <div className="details__cols">
          <section className="details__section">
            <h3>What you already bring</h3>
            {job.overlaps.length ? (
              <ul className="pairs">
                {job.overlaps.map((o) => (
                  <li key={o.to}>
                    <span className="pairs__from">{o.from}</span>
                    <span className="pairs__arrow" aria-hidden="true">→</span>
                    <span>{sentence(o.to)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="details__muted">No strong overlaps yet. This one is a bigger leap.</p>
            )}
          </section>
          <section className="details__section">
            <h3>What you’d learn</h3>
            <ul className="learn-tags">
              {job.gaps.map((g) => (
                <li key={g.title}>{sentence(g.title)}</li>
              ))}
            </ul>
            <p className="details__muted">About {job.hours} hours in total, {job.weeks} weeks at your pace (estimate).</p>
          </section>
        </div>

        <section className="details__section">
          <h3>Future demand</h3>
          {d ? (
            <>
              <div className="scenarios">
                <div><span className="num">{d.moderate}</span><span>If AI change is moderate</span></div>
                <div><span className="num">{d.fast}</span><span>If AI change is fast</span></div>
                {d.postings_today != null && <div><span className="num">{d.postings_today}</span><span>Matching postings in today’s sample</span></div>}
              </div>
              <p className="details__muted">
                {d.growth_flags?.length ? `O*NET flags: ${d.growth_flags.join(", ")}. ` : ""}
                {d.ai_exposure_category ? `GenAI exposure: ${d.ai_exposure_category}. ` : ""}
                Scores out of 100, an estimate as of {d.as_of}. Sources: {d.sources.filter(Boolean).map((s) => SOURCE[s] || s).join(", ")}.
              </p>
            </>
          ) : (
            <p className="details__muted">No demand data for this job yet.</p>
          )}
        </section>

        <footer className="details__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Back to options</button>
          <button type="button" className="btn btn--primary" onClick={onPathway}>Select pathway</button>
        </footer>
      </div>
    </dialog>
  );
}
