import { useEffect, useRef, useState } from "react";
import "./NodeNetwork.css";

/*
  Decorative "skills connecting" animation for the sign-up panel.
  Every dot has a 3D position. The whole cloud slowly revolves (rotation around
  the vertical axis + a gentle tilt) and is projected onto the 2D SVG with
  perspective, so near dots look bigger and brighter.
  It loops between two shapes:
    1. a loose network (dots linked to their nearest neighbours)
    2. a burst (every dot linked to one centre = the skill you're heading to)
  Positions are written straight onto the SVG elements every frame (no React
  re-render). With "reduce motion" on, it shows a still burst.
*/

const SIZE = 600; // SVG coordinate space (scales to fit the panel)
const CENTER = SIZE / 2;
const COUNT = 64;
const PERSPECTIVE = 900; // bigger = flatter 3D
const SPIN_SECONDS = 36; // one full revolution
const TILT = 0.32; // radians, how much we look down onto the cloud

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
const COLOR_ODDS = [0.4, 0.25, 0.17, 0.18];

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
    [-90, -70, -60], [80, -100, 40], [0, 60, 90], [110, 110, -50], [-110, 110, 20],
  ];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const nodes = [];
  for (let i = 0; i < COUNT; i++) {
    const [cx, cy, cz] = clusters[i % clusters.length];
    const big = rand() < 0.14;
    // Burst: points spread evenly over a sphere (Fibonacci sphere), random radius
    const y = 1 - (i / (COUNT - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const dist = 120 + rand() * 120;
    nodes.push({
      net: { x: cx + (rand() - 0.5) * 160, y: cy + (rand() - 0.5) * 140, z: cz + (rand() - 0.5) * 160 },
      burst: { x: Math.cos(theta) * ring * dist, y: y * dist, z: Math.sin(theta) * ring * dist },
      r: big ? 9 + rand() * 6 : 2.5 + rand() * 4.5,
      color: pickColor(rand()),
      phase: rand() * Math.PI * 2, // gentle individual floating
      label: PAIRS[i % PAIRS.length],
    });
  }
  // Network links: each dot connects to its 2 nearest neighbours (in 3D)
  nodes.forEach((n, i) => {
    n.links = nodes
      .map((m, j) => ({ j, d: Math.hypot(m.net.x - n.net.x, m.net.y - n.net.y, m.net.z - n.net.z) }))
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
const HOLD_NET = 2600;
const MORPH = 2200;
const HOLD_BURST = 3400;
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

// Rotate a 3D point and project it to 2D with perspective
function project(p, spin) {
  const cosY = Math.cos(spin), sinY = Math.sin(spin);
  const x1 = p.x * cosY - p.z * sinY;
  const z1 = p.x * sinY + p.z * cosY;
  const cosX = Math.cos(TILT), sinX = Math.sin(TILT);
  const y2 = p.y * cosX - z1 * sinX;
  const z2 = p.y * sinX + z1 * cosX;
  const scale = PERSPECTIVE / (PERSPECTIVE + z2);
  return { x: CENTER + x1 * scale, y: CENTER + y2 * scale, scale, depth: z2 };
}

export default function NodeNetwork() {
  const dotRefs = useRef([]);
  const netLineRefs = useRef([]);
  const spokeRefs = useRef([]);
  const tipRef = useRef(null);
  const posRef = useRef(NODES.map(() => ({ x: CENTER, y: CENTER, scale: 1, depth: 0 })));
  const hoverRef = useRef(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame;
    const start = performance.now();

    const draw = (now) => {
      const time = now - start;
      const m = reduce ? 1 : mixAt(time);
      const spin = reduce ? 0.6 : (time / 1000 / SPIN_SECONDS) * Math.PI * 2;

      NODES.forEach((n, i) => {
        const float = reduce ? 0 : Math.sin(time / 1300 + n.phase) * 6;
        const p3 = {
          x: n.net.x + (n.burst.x - n.net.x) * m,
          y: n.net.y + (n.burst.y - n.net.y) * m + float,
          z: n.net.z + (n.burst.z - n.net.z) * m,
        };
        const p = project(p3, spin);
        posRef.current[i] = p;
        // Nearer dots (negative depth) are bigger and more solid
        const near = Math.min(1, Math.max(0, 0.5 - p.depth / 400));
        const dot = dotRefs.current[i];
        if (dot) {
          dot.setAttribute("cx", p.x);
          dot.setAttribute("cy", p.y);
          dot.setAttribute("r", n.r * p.scale);
          dot.style.opacity = 0.45 + near * 0.55;
        }
        const spoke = spokeRefs.current[i];
        if (spoke) {
          spoke.setAttribute("x2", p.x);
          spoke.setAttribute("y2", p.y);
          spoke.style.opacity = m * (0.15 + near * 0.35);
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
        line.style.opacity = (1 - m) * 0.4;
      });

      // Keep the hover label attached to its moving dot, flipped left near the right edge
      const h = hoverRef.current;
      const tip = tipRef.current;
      if (tip && h !== null) {
        const p = posRef.current[h];
        const flip = p.x > SIZE * 0.55;
        tip.style.left = `${(p.x / SIZE) * 100}%`;
        tip.style.top = `${(p.y / SIZE) * 100}%`;
        tip.style.transform = flip ? "translate(calc(-100% - 14px), -50%)" : "translate(14px, -50%)";
      }

      if (!reduce) frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

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
      {hover !== null && (
        <div className="node-network__tip" ref={tipRef}>
          <span className="node-network__tip-dot" style={{ background: NODES[hover].color }} />
          {NODES[hover].label}
        </div>
      )}
    </div>
  );
}
