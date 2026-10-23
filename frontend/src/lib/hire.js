/*
  Hiring projects and the organisation admin's sign-in, kept in this browser.
  A project is a brief (who you're looking for) plus the codes candidates gave you.
  The key doesn't start with "bridge." on purpose: a learner signing up on the same
  browser clears those, and that mustn't wipe HR's projects.
*/

const PROJECTS_KEY = "bridge-hire.projects";
const ADMIN_KEY = "bridge-hire.admin";

export function readProjects() {
  try {
    const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeProjects(list) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  } catch {
    /* storage blocked: keep going in memory */
  }
}

export const readProject = (id) => readProjects().find((p) => p.id === id) || null;

// Insert or update; the newest change goes first in the list
export function saveProject(project) {
  const next = { ...project, updated: new Date().toISOString() };
  writeProjects([next, ...readProjects().filter((p) => p.id !== project.id)]);
  return next;
}

export function deleteProject(id) {
  writeProjects(readProjects().filter((p) => p.id !== id));
}

export function newProject(brief = {}, codes = []) {
  const id = Math.random().toString(36).slice(2, 8);
  return { id, created: new Date().toISOString(), brief, codes };
}

/* Codes typed or pasted together: commas, spaces or new lines between them. Links work too. */
export function splitCodes(text) {
  const out = [];
  for (const part of String(text || "").split(/[\s,;]+/)) {
    const m = part.match(/[?&]c=([^&#]+)/);
    for (const c of m ? decodeURIComponent(m[1]).split(",") : [part]) {
      const code = c.trim().toUpperCase();
      const bare = code.replace(/[^A-Z0-9]/g, "");
      if (bare.length >= 4 && bare.length <= 16 && !out.some((o) => o.replace(/[^A-Z0-9]/g, "") === bare)) out.push(code);
    }
  }
  return out;
}

export const sameCode = (a, b) => a.replace(/[^A-Z0-9]/gi, "").toUpperCase() === b.replace(/[^A-Z0-9]/gi, "").toUpperCase();

// Admin sign-in lasts for this browser tab only
export function readAdmin() {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveAdmin(admin) {
  try {
    if (admin) sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    else sessionStorage.removeItem(ADMIN_KEY);
  } catch {
    /* storage blocked */
  }
}
