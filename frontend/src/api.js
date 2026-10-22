// Calls to the Bridge backend. Vite forwards /api to the Python server (see vite.config.js).

// pin: a job uri the server always returns as `pinned`, even if it drops out of the top 5
export async function fetchMatch(profile, comfort = 0.5, pin = null) {
  const res = await fetch("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, comfort, pin }),
  });
  if (!res.ok) throw new Error(`Match failed (${res.status})`);
  return res.json();
}
