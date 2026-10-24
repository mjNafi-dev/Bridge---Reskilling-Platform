import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

/* "View more details": everything behind one match, in a dialog. */

export const causeList = (causes = []) => causes.map((c) => c.toLowerCase()).join(" and ");

const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const PART = {
  F: ["Familiarity", "How much of the core topics you already have"],
  E: ["Ease", "How quickly the gap closes at your weekly hours"],
  D: ["Demand", "Future need, averaged over the moderate and fast AI scenarios"],
  I: ["Interest fit", "Match with the kinds of work you enjoy"],
};
const SOURCE = { postings: "Live job postings", onet_bright: "O*NET Bright Outlook", ilo_genai: "ILO GenAI exposure index (2025)" };
// The ILO's exposure groups, in plain words
const EXPOSURE = {
  "Not Exposed": "very little",
  "Minimal Exposure": "a little",
  "Exposed: Gradient 1": "somewhat",
  "Exposed: Gradient 2": "moderately",
  "Exposed: Gradient 3": "a lot",
  "Exposed: Gradient 4": "very much",
};
const fmtDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

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
      <header className="details__head ui-modal__band night">
        <div>
          <p className="label-mono">{job.category || "Role"}</p>
          <h2 id="details-title">{sentence(job.title)}</h2>
        </div>
        <button type="button" className="details__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>

      <div className="details__inner ui-modal__body">
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
          {job.cause_boost > 0 && (
            <p className="details__muted">+{job.cause_boost} points because this role serves a cause you picked: {causeList(job.causes_matched)}.</p>
          )}
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
          <div className="demand__head">
            <h3>Future demand</h3>
            {d && (
              <span className="hint hint--below hint--start" tabIndex={0} aria-label="What these numbers mean">
                <InfoIcon />
                <span className="hint__bubble demand__tip" role="tooltip">
                  <strong>What these numbers mean</strong>
                  How likely this job is to keep hiring over the next few years, scored from 0 to 100. Three public signals go into it:
                  <span className="breakdown-row"><span>Expected growth in the US (O*NET)</span><span className="num">50%</span></span>
                  <span className="breakdown-row"><span>Job ads like it today</span><span className="num">30%</span></span>
                  <span className="breakdown-row"><span>How little AI could change it (ILO)</span><span className="num">20%</span></span>
                  <span className="demand__tip-note">If AI change is fast, the AI part counts for 30%. Demand is one part of the Bridge score.</span>
                </span>
              </span>
            )}
            {d && <span className="demand__better"><ArrowUpIcon /> Higher is better</span>}
          </div>
          {d ? (
            <>
              <div className="scenarios">
                <div>
                  <span><span className="num">{d.moderate}</span><span className="scenarios__of">/100</span></span>
                  <span>If AI changes work at a moderate pace</span>
                </div>
                <div>
                  <span><span className="num">{d.fast}</span><span className="scenarios__of">/100</span></span>
                  <span>If AI changes work fast</span>
                </div>
                {d.postings_today != null && (
                  <div>
                    <span><span className="num">{d.postings_today}</span><span className="scenarios__of">{d.postings_today === 1 ? "job ad" : "job ads"}</span></span>
                    <span>
                      Match this job today{d.postings_sample ? `, out of ${d.postings_sample.toLocaleString("en-GB")} we looked at` : ""} (mostly European job boards)
                    </span>
                  </div>
                )}
              </div>
              <p className="details__muted">
                {d.growth_flags?.length ? `The US expects ${d.growth_flags.map((f) => f.toLowerCase()).join(" and ")} (O*NET). ` : "No growth flag in the US outlook (O*NET). "}
                {EXPOSURE[d.ai_exposure_category] ? `Generative AI could change this work ${EXPOSURE[d.ai_exposure_category]} (ILO, 2025). ` : ""}
                An estimate as of {fmtDate(d.as_of)}. Sources: {d.sources.filter(Boolean).map((s) => SOURCE[s] || s).join(", ")}.
              </p>
            </>
          ) : (
            <p className="details__muted">No demand data for this job yet.</p>
          )}
        </section>

        {job.sdgs?.length > 0 && (
          <section className="details__section">
            <h3>Who it helps</h3>
            <ul className="sdg-list">
              {job.sdgs.map((g) => (
                <li key={g.goal}>
                  <span className="sdg-list__badge num">SDG {g.goal}</span>
                  <span><strong>{g.name}.</strong> {g.reason}</span>
                </li>
              ))}
            </ul>
            <p className="details__muted">UN Sustainable Development Goals, matched from the role's ILO job group (ISCO-08) and title.</p>
          </section>
        )}

        <p className="details__sources">
          Skills from ESCO, interests from O*NET, demand from O*NET, live postings and the ILO. Every number is an estimate.{" "}
          <Link to="/data">See all data sources</Link>
        </p>

        <footer className="details__foot ui-modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Back to options</button>
          <button type="button" className="btn btn--primary" onClick={onPathway}>Select pathway</button>
        </footer>
      </div>
    </dialog>
  );
}

const icon = (children, size = 16) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const InfoIcon = () => icon(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>);
const ArrowUpIcon = () => icon(<path d="M12 19V5M6 11l6-6 6 6" />, 14);
