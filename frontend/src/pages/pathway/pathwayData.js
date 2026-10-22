/*
  Turns the chosen job (from the matcher) into a learning pathway:
  ordered steps, progress and resource links. Progress lives in the browser for the demo.
*/

// Same rough estimates as the backend (hours to learn one missing item)
const HOURS = { skill: 18, knowledge: 12 };
const KNOWN = 0.5; // at or above this, a topic is off the main path (you partly know it)
const SOLID = 0.9; // at or above this, a topic needs no brushing up either

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

/* Topics you already know well (nothing to do) */
export function alreadyHave(job) {
  return job.topics.filter((t) => t.relation !== "optional" && t.coverage >= SOLID).map((t) => sentence(t.title));
}

/* Topics you partly know: optional brush-ups, weakest first */
export function reviseSteps(job) {
  return job.topics
    .filter((t) => t.relation !== "optional" && t.coverage >= KNOWN && t.coverage < SOLID)
    .sort((a, b) => a.coverage - b.coverage)
    .map((t) => ({
      id: t.title,
      title: sentence(t.title),
      type: t.type,
      coverage: t.coverage,
      revise: true,
      hours: Math.max(1, Math.round((HOURS[t.type] || 15) * (1 - t.coverage))),
    }));
}

/* Familiarity now: starts at the matcher's number and closes the gap as path topics and
   brush-ups get done. 100% only once every one of them is done, never just by finishing
   the new topics. */
export function currentFamiliarity(job, progress) {
  const work = [...buildSteps(job), ...reviseSteps(job)];
  const gap = work.reduce((g, s) => g + (1 - s.coverage), 0);
  if (!gap) return job.familiarity;
  const closed = work.reduce((g, s) => g + (effectiveCoverage(s, progress[s.id]) - s.coverage), 0);
  return Math.min(100, Math.round(job.familiarity + (100 - job.familiarity) * (closed / gap)));
}

/* Optional topics the user chose to learn as extras (started or done) */
export function extraSteps(job, progress) {
  return job.topics
    .filter((t) => t.relation === "optional" && progress[t.title] && progress[t.title] !== "todo")
    .map((t) => ({
      id: t.title,
      title: sentence(t.title),
      type: t.type,
      extra: true,
      hours: Math.max(2, Math.round((HOURS[t.type] || 15) * (1 - t.coverage))),
    }));
}

/* Optional topics worth adding next, broadest first, skipping ones already started */
export function nextExtras(job, progress, limit = 3) {
  return job.topics
    .filter((t) => t.relation === "optional" && t.coverage < 0.2 && (progress[t.title] || "todo") === "todo")
    .sort((a, b) => b.breadth - a.breadth)
    .slice(0, limit)
    .map((t) => ({ id: t.title, title: sentence(t.title) }));
}

/* A YouTube search for a topic: always offered next to the checked courses, and on its own
   when no course in the catalogue fits. A plain search link: no API, no key. */
export function youtubeSearch(title) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} tutorial`)}`;
}

/* Search links, used only if the course catalogue can't be reached. Free sources first. */
export function resourcesFor(title) {
  const q = encodeURIComponent(title);
  return [
    { label: "Free videos", where: "YouTube", free: true, url: youtubeSearch(title) },
    { label: "Free lessons", where: "Khan Academy", free: true, url: `https://www.khanacademy.org/search?page_search_query=${q}` },
    { label: "Courses", where: "Coursera", free: false, url: `https://www.coursera.org/search?query=${q}` },
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

/* Optional skills for this role you don't have yet (and haven't started), broadest first */
export function worthLookingInto(job, limit = 8, progress = {}) {
  return job.topics
    .filter((t) => t.relation === "optional" && t.coverage < 0.2 && (progress[t.title] || "todo") === "todo")
    .sort((a, b) => b.breadth - a.breadth)
    .slice(0, limit)
    .map((t) => sentence(t.title));
}
