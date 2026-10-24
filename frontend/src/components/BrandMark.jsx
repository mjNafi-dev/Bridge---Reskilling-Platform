import { Link, useLocation } from "react-router-dom";

// Bridge logo: a simple suspension-bridge mark + wordmark.
// Placeholder until the final logo is designed.
// With `to` it links home (your dashboard, the projects list, the start page); on that
// page already, it scrolls back to the top instead.
export default function BrandMark({ to }) {
  const { pathname, search } = useLocation();
  const mark = (
    <>
      <span className="brand__icon">
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 22h26" />
          <path d="M9 22V9M23 22V9" />
          <path d="M3 13c3 0 6-4 6-4s3 7 7 7 7-7 7-7 3 4 6 4" />
          <path d="M13 16v6M19 16v6" />
        </svg>
      </span>
      <span className="brand__name">Bridge</span>
    </>
  );
  if (!to) return <div className="brand">{mark}</div>;

  const here = to === pathname || to === pathname + search;
  function onClick(e) {
    if (!here) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <Link to={to} className="brand" aria-label="Bridge home" onClick={onClick}>
      {mark}
    </Link>
  );
}

/* A learner's home: their dashboard once they've picked a pathway, otherwise `fallback` */
export function learnerHome(fallback = "/signup") {
  try {
    if (localStorage.getItem("bridge.selectedJob")) return "/pathway";
  } catch {
    /* storage blocked */
  }
  return fallback;
}
