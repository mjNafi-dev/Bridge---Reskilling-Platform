import { useEffect, useRef, useState } from "react";
import "./NodeNetwork.css";

/*
  Decorative "skills connecting" animation for the sign-up panel.
  It loops between two shapes:
    1. a loose network (dots linked to their nearest neighbours)
    2. a radial burst (every dot linked to one centre = the skill you're heading to)
  Colours follow the design tokens: ink, amber (familiar), olive (done), orange (new).
  Positions are updated directly on the SVG elements every frame (no React re-render)
  so it stays smooth. With "reduce motion" on, it just shows the burst, still.
*/

const SIZE = 600; // SVG coordinate space (scales to fit the panel)
const CENTER = SIZE / 2;
const COUNT = 64;

// Example skill pairs shown on hover. Illustrative only, not real recommendations.
const PAIRS = [
  "Colour correction → Colour grading",
  "Layer masks → Video masking",
  "Excel formulas → Python basics",
  "Customer service → UX research",
  "Inventory tracking → Supply-chain analytics",
  "Lesson planning → Instructional design",
  "Sales pitches → Prompt writing",
  "Photography → Motion design",
];

const COLORS = ["var(--ink)", "var(--familiar-default)", "var(--done-default)", "var(--highlight-default)"];
const COLOR_ODDS = [0.45, 0.25, 0.15, 0.15];

// Small seeded random so the layout is the same on every load
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pickColor(r) {
  let acc = 0;
  for (let i = 0; i < COLORS.length; i++) {
    acc += COLOR_ODDS[i];
    if (r < acc) return COLORS[i];
  }
  return COLORS[0];
}

function buildNodes() {
  const rand = seeded(42);
  const clusters = [
    [210, 230], [380, 200], [300, 360], [420, 420], [190, 420],
  ];
  const nodes = [];
  for (let i = 0; i < COUNT; i++) {
    const [cx, cy] = clusters[i % clusters.length];
    const big = rand() < 0.12;
    const angle = (i / COUNT) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const dist = 90 + rand() * 180;
    nodes.push({
      net: { x: cx + (rand() - 0.5) * 170, y: cy + (rand() - 0.5) * 150 },
      burst: { x: CENTER + Math.cos(angle) * dist, y: CENTER + Math.sin(angle) * dist },
      r: big ? 9 + rand() * 7 : 3 + rand() * 5,
      color: pickColor(rand()),
      phase: rand() * Math.PI * 2, // for the gentle floating motion
      label: PAIRS[i % PAIRS.length],
    });
  }
  // Network links: each dot connects to its 2 nearest neighbours
  nodes.forEach((n, i) => {
    n.links = nodes
      .map((m, j) => ({ j, d: Math.hypot(m.net.x - n.net.x, m.net.y - n.net.y) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .map((o) => o.j);
  });
  return nodes;
}

const NODES = buildNodes();
const NET_LINKS = NODES.flatMap((n, i) => n.links.map((j) => [i, j]));

// Timeline in ms: hold network → morph → hold burst → morph back
const HOLD_NET = 3500;
const MORPH = 1800;
const HOLD_BURST = 4500;
const CYCLE = HOLD_NET + MORPH + HOLD_BURST + MORPH;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// 0 = network, 1 = burst
function mixAt(time) {
  const t = time % CYCLE;
  if (t < HOLD_NET) return 0;
  if (t < HOLD_NET + MORPH) return ease((t - HOLD_NET) / MORPH);
  if (t < HOLD_NET + MORPH + HOLD_BURST) return 1;
  return 1 - ease((t - HOLD_NET - MORPH - HOLD_BURST) / MORPH);
}

export default function NodeNetwork() {
  const dotRefs = useRef([]);
  const netLineRefs = useRef([]);
  const spokeRefs = useRef([]);
  const posRef = useRef(NODES.map((n) => ({ ...n.burst })));
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame;
    const start = performance.now();

    const draw = (now) => {
      const time = now - start;
      const m = reduce ? 1 : mixAt(time);

      NODES.forEach((n, i) => {
        const float = reduce ? 0 : Math.sin(time / 1400 + n.phase) * 3;
        const x = n.net.x + (n.burst.x - n.net.x) * m + float;
        const y = n.net.y + (n.burst.y - n.net.y) * m + float * 0.6;
        posRef.current[i] = { x, y };
        const dot = dotRefs.current[i];
        if (dot) {
          dot.setAttribute("cx", x);
          dot.setAttribute("cy", y);
        }
        const spoke = spokeRefs.current[i];
        if (spoke) {
          spoke.setAttribute("x2", x);
          spoke.setAttribute("y2", y);
          spoke.style.opacity = m * 0.45;
        }
      });

      NET_LINKS.forEach(([a, b], k) => {
        const line = netLineRefs.current[k];
        if (!line) return;
        const pa = posRef.current[a];
        const pb = posRef.current[b];
        line.setAttribute("x1", pa.x);
        line.setAttribute("y1", pa.y);
        line.setAttribute("x2", pb.x);
        line.setAttribute("y2", pb.y);
        line.style.opacity = (1 - m) * 0.35;
      });

      if (!reduce) frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  const hovered = hover !== null ? posRef.current[hover] : null;

  return (
    <div className="node-network" aria-hidden="true">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} preserveAspectRatio="xMidYMid meet">
        <g className="node-network__lines">
          {NET_LINKS.map((_, k) => (
            <line key={`n${k}`} ref={(el) => (netLineRefs.current[k] = el)} />
          ))}
          {NODES.map((_, i) => (
            <line key={`s${i}`} x1={CENTER} y1={CENTER} ref={(el) => (spokeRefs.current[i] = el)} />
          ))}
        </g>
        {NODES.map((n, i) => (
          <circle
            key={i}
            ref={(el) => (dotRefs.current[i] = el)}
            r={n.r}
            fill={n.color}
            className="node-network__dot"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {hovered && (
        <div
          className="node-network__tip"
          style={{ left: `${(hovered.x / SIZE) * 100}%`, top: `${(hovered.y / SIZE) * 100}%` }}
        >
          <span className="node-network__tip-dot" style={{ background: NODES[hover].color }} />
          {NODES[hover].label}
        </div>
      )}
    </div>
  );
}
