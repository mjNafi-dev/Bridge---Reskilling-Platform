/*
  "Share my journey": a CV-style snapshot plus what the person is learning on Bridge.
  Two ways to pass it on:
  · a short code (e.g. K7M-2QX): the snapshot is saved on Bridge when the person asks for
    a code (backend/app/hire.py), so HR can type it, or several, into the organisation page
  · a long link: the snapshot lives in the link itself, after the #, which browsers never
    send to a server. Used for the preview and when Bridge can't be reached.
  No scores or rankings go in it, and no email, age or CV file.
*/

const firstName = (name) => (name || "").replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] || "";
const clean = (list, max) => (list || []).map((x) => (typeof x === "string" ? x.trim() : x)).filter(Boolean).slice(0, max);

// Drop empty fields so the link stays short
function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === "" || v === false) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (typeof v === "object" && !Array.isArray(v) && !Object.keys(compact(v)).length) continue;
    out[k] = Array.isArray(v) ? v : typeof v === "object" ? compact(v) : v;
  }
  return out;
}

/* Everything the shared page shows, picked from the profile and the pathway */
export function buildJourney({ profile = {}, role, done = [], learning = [], total = 0, strong = [] }) {
  return compact({
    name: firstName(profile.name),
    country: profile.country,
    situation: profile.situation,
    role,
    date: new Date().toISOString().slice(0, 10),
    hours: Number(profile.hoursPerWeek) || null,
    done,
    learning,
    total,
    strong: clean(strong, 16),
    education: { level: profile.eduLevel, field: profile.eduField, type: profile.eduType, year: profile.eduYear },
    noExperience: !!profile.noExperience,
    roles: clean(profile.roles, 4)
      .filter((r) => r.title)
      .map((r) => compact({ title: r.title, industry: r.industry, years: r.years, tasks: clean(r.tasks, 3), tools: clean(r.tools, 6) })),
    skills: clean(profile.skills, 16).filter((s) => s.name).map((s) => ({ name: s.name, level: s.level ?? 1 })),
    languages: clean(profile.languages, 6),
    courses: clean(profile.courses, 8).filter((c) => c.name).map((c) => compact({ name: c.name, provider: c.provider, year: c.year })),
    projects: clean(profile.projects, 4).filter((p) => p.what).map((p) => compact({ what: p.what, role: p.role, skills: clean(p.skills, 5) })),
    enjoys: clean(profile.workTypes, 6),
    causes: clean(profile.causes, 4),
    interests: {
      hobbies: clean(profile.hobbies, 6),
      sports: clean(profile.sports, 6),
      genres: clean(profile.genres, 6),
      books: clean(profile.books, 4),
      movies: clean(profile.movies, 4),
    },
  });
}

export function journeyLink(snapshot) {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 2, ...snapshot }));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const data = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${window.location.origin}/journey#${data}`;
}

export const journeyCodeLink = (code) => `${window.location.origin}/journey?c=${encodeURIComponent(code)}`;

// Reads both versions: v1 links (topics only) still open
export function readJourney(hash) {
  try {
    const data = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(data + "===".slice((data.length + 3) % 4));
    const snap = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return snap && (snap.v === 1 || snap.v === 2) && typeof snap.role === "string" ? snap : null;
  } catch {
    return null;
  }
}
