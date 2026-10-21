// Bridge logo: a simple suspension-bridge mark + wordmark.
// Placeholder until the final logo is designed.
export default function BrandMark() {
  return (
    <div className="brand">
      <span className="brand__icon">
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 22h26" />
          <path d="M9 22V9M23 22V9" />
          <path d="M3 13c3 0 6-4 6-4s3 7 7 7 7-7 7-7 3 4 6 4" />
          <path d="M13 16v6M19 16v6" />
        </svg>
      </span>
      <span className="brand__name">Bridge</span>
    </div>
  );
}
