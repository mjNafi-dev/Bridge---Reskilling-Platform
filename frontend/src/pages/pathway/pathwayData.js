/*
  Turns the chosen job (from the matcher) into a learning pathway:
  ordered steps, progress and resource links. Progress lives in the browser for the demo.
*/

// Same rough estimates as the backend (hours to learn one missing item)
const HOURS = { skill: 18, knowledge: 12 };
const KNOWN = 0.5; // at or above this, a topic counts as already yours

export const STATUS = ["todo", "learning", "done"];
export const STATUS_LABEL = { todo: "Not started", learning: "Learning", done: "Done" };

const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

/* What the user's progress does to a topic's coverage */
export function effectiveCoverage(topic, status) {
  if (status === "done") return 1;
  if (status === "learning") return Math.max(topic.coverage, 0.5);
  return topic.coverage;
}

/* Steps: essential topics you don't have yet, closest to what you know first */
export function buildSteps(job) {
  const essential = job.topics.filter((t) => t.relation !== "optional");
  // Something you already know to build on, when the topic itself has no direct link
  const anchors = job.overlaps.map((o) => o.from);
  return essential
    .filter((t) => t.coverage < KNOWN)
    .sort((a, b) => b.coverage - a.coverage || b.breadth - a.breadth)
    .map((t, i) => {
      // Your evidence has the same name as the topic: it's a refresher, not a bridge from elsewhere
      const sameName = t.from && t.from.trim().toLowerCase() === t.title.trim().toLowerCase();
      return {
        id: t.title,
        title: sentence(t.title),
        type: t.type,
        coverage: t.coverage,
        refresher: sameName,
        buildsOn: sameName ? null : t.from || (t.coverage > 0 ? anchors[i % Math.max(1, anchors.length)] : null),
        hours: Math.max(2, Math.round((HOURS[t.type] || 15) * (1 - t.coverage))),
      };
    });
}

export function alreadyHave(job) {
  return job.topics.filter((t) => t.relation !== "optional" && t.coverage >= KNOWN).map((t) => sentence(t.title));
}

/* Familiarity now, counting progress (average over essential topics, like the matcher) */
export function currentFamiliarity(job, progress) {
  const essential = job.topics.filter((t) => t.relation !== "optional");
  if (!essential.length) return job.familiarity;
  const sum = essential.reduce((s, t) => s + effectiveCoverage(t, progress[t.title]), 0);
  return Math.round((sum / essential.length) * 100);
}

/* Topics with progress applied, for the bubble diagram */
export function topicsWithProgress(job, progress) {
  return job.topics.map((t) => ({ ...t, coverage: effectiveCoverage(t, progress[t.title]) }));
}

/* Search links only: no scraping, no accounts. Free sources first. */
export function resourcesFor(title) {
  const q = encodeURIComponent(title);
  return [
    { label: "Free videos", where: "YouTube", free: true, url: `https://www.youtube.com/results?search_query=${q}+tutorial` },
    { label: "Free lessons", where: "Khan Academy", free: true, url: `https://www.khanacademy.org/search?page_search_query=${q}` },
    { label: "Courses", where: "Coursera (many free to audit)", free: false, url: `https://www.coursera.org/search?query=${q}` },
  ];
}

/*
  Progress is kept per topic, not per job, so it carries over when you change pathway:
  a topic you finished counts on any job that needs it. It's also copied into the
  profile as `learned`, so the matcher counts it as something you know.
*/
const KEY = "bridge.progress";

export function readProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
    const profile = JSON.parse(localStorage.getItem("bridge.profile") || "{}");
    profile.learned = Object.entries(progress)
      .filter(([, status]) => status !== "todo")
      .map(([name, status]) => ({ name, level: status === "done" ? 2 : 1 }));
    localStorage.setItem("bridge.profile", JSON.stringify(profile));
  } catch {
    /* storage blocked */
  }
}

/* Learned on Bridge: topics in progress or done, newest status first */
export function learnedTopics(progress) {
  return Object.entries(progress)
    .filter(([, status]) => status !== "todo")
    .map(([name, status]) => ({ name: sentence(name), status }));
}

/* Optional skills for this role you don't have yet, broadest first */
export function worthLookingInto(job, limit = 8) {
  return job.topics
    .filter((t) => t.relation === "optional" && t.coverage < 0.2)
    .sort((a, b) => b.breadth - a.breadth)
    .slice(0, limit)
    .map((t) => sentence(t.title));
}
