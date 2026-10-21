// Calls to the Bridge backend. Vite forwards /api to the Python server (see vite.config.js).

export async function fetchMatch(profile, comfort = 0.5) {
  const res = await fetch("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, comfort }),
  });
  if (!res.ok) throw new Error(`Match failed (${res.status})`);
  return res.json();
}
