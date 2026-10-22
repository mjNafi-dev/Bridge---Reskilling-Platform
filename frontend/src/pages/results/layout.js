/*
  Geometry for the results animation:
  - where each topic chip lands while "analysing" (scattered, no overlaps)
  - which topics become bubbles and which are coloured
  - how the bubbles pack into one circle, filled like a water bottle
    (what you know settles at the bottom, what's new floats to the top)
*/

// Coverage tiers. 0.2 matches the backend's COVER_THRESHOLD (below it = no evidence).
export const TIERS = [
  { min: 0.5, key: "strong", label: "Strong overlap" },
  { min: 0.3, key: "good", label: "Good overlap" },
  { min: 0.2, key: "some", label: "Some overlap" },
  { min: -Infinity, key: "new", label: "New to you" },
];

export const tierOf = (coverage) => TIERS.find((t) => coverage >= t.min);

// Small seeded random generator so the same job always looks the same
export function rng(seedText) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/* Colour for a bubble that counts as known (anything known is at least "some") */
export const knownTier = (coverage) => (coverage >= 0.5 ? "strong" : coverage >= 0.3 ? "good" : "some");

/* What the hover tip calls a topic */
export function bubbleLabel(bubble, coverage) {
  if (bubble.filled) return TIERS.find((t) => t.key === knownTier(coverage)).label;
  return coverage > 0 ? "Slight overlap" : "New to you";
}

const MAX_BUBBLES = 56;

/*
  One bubble (and one chip) per topic. All of the job's essential topics, topped up with
  optional ones to give the screen plenty to show. Whole bubbles are coloured, the
  best-known first, until the coloured share matches the familiarity % (which the
  matcher works out from the essential topics). Returns one entry per bubble:
  { topic, filled, coverage, breadth, type }; coverage is 0 for uncoloured ones so they
  float to the top of the circle.
*/
export function pickBubbles(topics, familiarity) {
  const essential = topics.map((_, i) => i).filter((i) => topics[i].relation !== "optional");
  const optional = topics.map((_, i) => i).filter((i) => topics[i].relation === "optional");
  const chosen = [...essential, ...optional.slice(0, Math.max(0, MAX_BUBBLES - essential.length))];
  const want = Math.round((familiarity / 100) * chosen.length);
  const coloured = new Set(
    chosen
      .filter((i) => topics[i].coverage > 0)
      .sort((a, b) => topics[b].coverage - topics[a].coverage)
      .slice(0, want)
  );
  return chosen.map((i) => {
    const t = topics[i];
    const filled = coloured.has(i);
    return { topic: i, filled, coverage: filled ? t.coverage : 0, breadth: t.breadth, type: t.type };
  });
}

/* A spread of bubble sizes for a job: broad skills (needed by many jobs) make bigger
   bubbles, plus a little variety. Unitless. */
export function bubbleSizes(topics, seed) {
  const rand = rng(seed + ":size");
  const maxB = Math.max(2, ...topics.map((t) => t.breadth || 1));
  return topics.map((t) => {
    const breadth = Math.log(t.breadth || 1) / Math.log(maxB); // 0..1
    return 0.7 + 1.4 * Math.pow(breadth, 1.2) + (t.type === "knowledge" ? 0.15 : 0) + rand() * 0.35;
  });
}

/* 1 = perfectly round outline; lower = lumpy (shortest reach in any direction / outer radius) */
function roundness({ slots, outer }) {
  let min = Infinity;
  for (let k = 0; k < 24; k++) {
    const ux = Math.cos((k / 24) * Math.PI * 2);
    const uy = Math.sin((k / 24) * Math.PI * 2);
    min = Math.min(min, Math.max(...slots.map((s) => s.x * ux + s.y * uy + s.r)));
  }
  return min / outer;
}

/* Each bubble takes the free spot (touching two placed ones) that keeps the shape smallest */
function greedyPack(sizes) {
  const gap = 0.08;
  const slots = [];
  const free = (x, y, r) => slots.every((s) => Math.hypot(s.x - x, s.y - y) >= s.r + r + gap - 1e-9);
  for (const r of sizes) {
    if (!slots.length) {
      slots.push({ x: 0, y: 0, r });
      continue;
    }
    let best = null;
    const consider = (x, y) => {
      const d = Math.hypot(x, y) + r;
      if ((!best || d < best.d) && free(x, y, r)) best = { x, y, d };
    };
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];
        const ra = a.r + r + gap;
        const rb = b.r + r + gap;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > ra + rb || d < Math.abs(ra - rb) || d === 0) continue;
        const along = (ra * ra - rb * rb + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(0, ra * ra - along * along));
        const mx = a.x + (dx * along) / d;
        const my = a.y + (dy * along) / d;
        consider(mx + (dy * h) / d, my - (dx * h) / d);
        consider(mx - (dy * h) / d, my + (dx * h) / d);
      }
    }
    if (!best) {
      // only one bubble so far: sit beside it
      const s = slots[0];
      best = { x: s.x + s.r + r + gap, y: s.y };
    }
    slots.push({ x: best.x, y: best.y, r });
  }
  // Centre on the smallest enclosing circle (nudge towards the farthest edge)
  let cx = 0;
  let cy = 0;
  const reach = (s) => Math.hypot(s.x - cx, s.y - cy) + s.r;
  for (let k = 0; k < 80; k++) {
    const far = slots.reduce((m, s) => (reach(s) > reach(m) ? s : m));
    cx += (far.x - cx) * 0.04;
    cy += (far.y - cy) * 0.04;
  }
  const outer = Math.max(...slots.map(reach));
  return { slots: slots.map((s) => ({ x: s.x - cx, y: s.y - cy, r: s.r })), outer };
}

/*
  Packs the bubbles into one round shape, then fills it like a water bottle:
  the lowest spots go to the topics you know best, the top to the ones that are new.
  Greedy packing: each bubble takes the free spot closest to the centre, touching
  two bubbles already placed. Returns, per topic, its radius and centre (relative to
  0,0), plus the radius of the whole shape. All in the same unit.
*/
export function packTopics(topics, seed) {
  const n = topics.length;
  const rand = rng(seed + ":pack");
  const base = bubbleSizes(topics, seed);
  const area = base.reduce((sum, r) => sum + r * r, 0);
  // Greedy packing depends on the order, so try a few and keep the roundest
  let best = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const order = base.map((r) => [rand(), r]).sort((a, b) => a[0] - b[0]).map(([, r]) => r);
    const shape = greedyPack(order);
    const quality = (area / (shape.outer * shape.outer)) * roundness(shape);
    if (!best || quality > best.quality) best = { ...shape, quality };
  }
  const { slots, outer } = best;

  // Water fill: lowest spots (by bottom edge) to the best-known topics
  const spots = [...slots].sort((a, b) => b.y + b.r * 0.3 - (a.y + a.r * 0.3));
  const order = topics.map((_, i) => i).sort((a, b) => topics[b].coverage - topics[a].coverage);
  const radii = new Array(n);
  const points = new Array(n);
  order.forEach((ti, k) => {
    radii[ti] = spots[k].r;
    points[ti] = { x: spots[k].x, y: spots[k].y };
  });
  return { radii, points, outer };
}

/* Chip widths, measured with the real font when it's loaded */
let ctx;
export function chipWidth(text) {
  ctx = ctx || document.createElement("canvas").getContext("2d");
  ctx.font = "500 15px Switzer, 'Segoe UI', sans-serif";
  return Math.ceil(ctx.measureText(text).width) + 36;
}

/*
  Scatters chips over the stage without overlapping each other or the `avoid` boxes.
  When the screen is full, a chip overlaps the least-crowded spot it tried (a busy
  screen is fine here). Returns a centre {x, y} per chip.
*/
export function scatterChips(widths, height, area, avoid, seed) {
  const rand = rng(seed + ":scatter");
  const placed = [];
  const pad = 14;
  const overlaps = (b) =>
    [...avoid, ...placed].filter(
      (o) => b.x < o.x + o.w + pad && b.x + b.w + pad > o.x && b.y < o.y + o.h + pad && b.y + b.h + pad > o.y
    ).length;
  return widths.map((w) => {
    let best = null;
    for (let tries = 0; tries < 120; tries++) {
      const box = {
        x: area.x + rand() * Math.max(0, area.w - w),
        y: area.y + rand() * Math.max(0, area.h - height),
        w,
        h: height,
      };
      const hits = overlaps(box);
      if (!best || hits < best.hits) best = { box, hits };
      if (!hits) break;
    }
    placed.push(best.box);
    return { x: best.box.x + w / 2, y: best.box.y + height / 2 };
  });
}
