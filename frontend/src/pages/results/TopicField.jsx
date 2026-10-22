import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TIERS, bubbleLabel, chipWidth, knownTier, packTopics, pickBubbles, rng, scatterChips } from "./layout.js";

/*
  The topics of one job, drawn in the results stage. Phases:
    chips    topic chips pop in, scattered, drifting gently together
    blobs    chips shrink into bubbles where they are
    settled  bubbles travel into one circle: known ones at the bottom, new ones on top.
             No drift here, so the finished diagram stays calm.
  One chip = one bubble = one topic, so every bubble in the circle came from a chip.
  Whole bubbles are coloured so the coloured share matches the familiarity %.
  Hovering any chip or bubble shows its topic.
*/

const CHIP_H = 38;
const DRIFT_PX = 6;

const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const short = (s, n = 34) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export default function TopicField({ topics, familiarity, seed, phase, stage, slot, avoid, area, chipStagger = 60, reduced }) {
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState(null);
  const driftRefs = useRef([]);

  // Bubbles, the finished circle, and which topics get a chip (depends on the job only)
  const shape = useMemo(() => {
    const units = pickBubbles(topics, familiarity);
    const { radii, points, outer } = packTopics(units, seed);
    const rand = rng(seed + ":chips");
    const chipOrder = units.map((_, u) => [rand(), u]).sort((a, b) => a[0] - b[0]).map(([, u]) => u);
    return { units, radii, points, outer, chipOrder };
  }, [topics, familiarity, seed]);

  // Pixel positions (depend on the screen size too)
  const geo = useMemo(() => {
    if (!stage.w || !slot.size || !area) return null;
    const scale = slot.size / 2 / shape.outer;
    const labels = shape.units.map((b) => short(sentence(topics[b.topic].title)));
    const widths = shape.chipOrder.map((u) => chipWidth(labels[u]));
    const spots = scatterChips(widths, CHIP_H, area, avoid, seed);
    const chip = new Array(shape.units.length);
    shape.chipOrder.forEach((u, k) => (chip[u] = { ...spots[k], w: widths[k], order: k }));
    const blob = shape.units.map((_, u) => ({
      x: slot.cx + shape.points[u].x * scale,
      y: slot.cy + shape.points[u].y * scale,
      r: shape.radii[u] * scale,
    }));
    return { labels, chip, blob };
  }, [topics, seed, shape, stage.w, slot.cx, slot.cy, slot.size, avoid, area]);

  // Start invisible, then let the pop-in transitions run
  useLayoutEffect(() => {
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setMounted(true))));
    return () => cancelAnimationFrame(id);
  }, []);

  // Gentle shared drift while analysing; fades out once settled
  const settledRef = useRef(phase === "settled");
  settledRef.current = phase === "settled";
  useEffect(() => {
    if (reduced) return;
    let amp = settledRef.current ? 0 : 1;
    let raf;
    const tick = (t) => {
      amp += ((settledRef.current ? 0 : 1) - amp) * 0.04;
      driftRefs.current.forEach((el, i) => {
        if (!el) return;
        const ph = (i % 7) * 0.35; // small phase spread: everyone moves roughly the same way
        const dx = Math.sin(t / 1900 + ph) * DRIFT_PX * amp;
        const dy = Math.sin(t / 2600 + ph + 1.3) * DRIFT_PX * 0.7 * amp;
        el.style.transform = amp < 0.01 ? "" : `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
      });
      if (settledRef.current && amp < 0.01) return; // stop the loop once calm
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, reduced]);

  if (!geo) return null;

  const settled = phase === "settled";
  const asBlob = phase === "blobs" || settled;
  const hoveredBubble = hover != null ? shape.units[hover] : null;
  const hovered = hoveredBubble ? topics[hoveredBubble.topic] : null;

  let tip = null;
  if (hovered) {
    const chip = geo.chip[hover];
    const at = settled ? geo.blob[hover] : chip;
    const half = asBlob ? geo.blob[hover].r : chip.w / 2;
    const flip = at.x + half > stage.w - 300; // no room on the right: show it on the left
    tip = { x: flip ? at.x - half - 12 : at.x + half + 12, y: at.y, flip };
  }

  return (
    <div className={`topics topics--${phase}`} aria-hidden="true">
      {shape.units.map((unit, u) => {
        const t = topics[unit.topic];
        const chip = geo.chip[u];
        const blob = geo.blob[u];
        const visible = mounted && (settled || phase !== "loading");
        const pos = settled ? blob : chip; // bubbles form where their chip was, then travel
        const w = asBlob ? blob.r * 2 : chip.w;
        const h = asBlob ? blob.r * 2 : CHIP_H;
        const tier = unit.filled ? knownTier(t.coverage) : "new";
        // Pop-in order: chips one by one; in the circle, bottom-up like filling a bottle
        // (chips that are already showing don't re-run it)
        const popDelay = settled
          ? Math.round((1 - (blob.y - slot.cy + slot.size / 2) / slot.size) * 450) + 150
          : chip.order * chipStagger;
        // Travel into the circle with a slight stagger so it reads as a flow
        const moveDelay = settled ? Math.round(chip.order * 12) : 0;
        return (
          <div
            key={u}
            className={`topic topic--${tier}`}
            style={{
              width: w,
              height: h,
              transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`,
              transitionDelay: `${moveDelay}ms, 0ms, 0ms`,
              pointerEvents: visible ? "auto" : "none",
            }}
            onMouseEnter={() => setHover(u)}
            onMouseLeave={() => setHover((cur) => (cur === u ? null : cur))}
          >
            <div className={`topic__pop${visible ? " is-in" : ""}`} style={{ transitionDelay: `${popDelay}ms` }}>
              <div className="topic__body" ref={(el) => (driftRefs.current[u] = el)}>
                <span className="topic__label">{geo.labels[u]}</span>
              </div>
            </div>
          </div>
        );
      })}

      {hovered && tip && (
        <div
          className={`topic-tip${tip.flip ? " topic-tip--flip" : ""}`}
          style={{ left: tip.x, top: tip.y }}
        >
          <span className={`topic-tip__dot topic--${hoveredBubble.filled ? knownTier(hovered.coverage) : "new"}`} />
          <span className="topic-tip__text">
            <span className="topic-tip__title">{sentence(hovered.title)}</span>
            <span className="topic-tip__meta">
              {bubbleLabel(hoveredBubble, hovered.coverage)} · {Math.round(hovered.coverage * 100)}% known
              {hovered.from ? ` · from “${short(hovered.from, 28)}”` : ""}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

export { TIERS };
