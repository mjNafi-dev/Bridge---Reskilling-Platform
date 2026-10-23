import { useEffect, useRef, useState } from "react";
import "./NodeNetwork.css";
import { buildShape } from "./nodeShapes.js";

/*
  Decorative "skills connecting" animation for the sign-up panel.
  Every dot has a 3D position. The whole cloud slowly revolves (rotation around
  the vertical axis + a gentle tilt) and is projected onto the 2D SVG with
  perspective, so near dots look bigger and brighter.
  It loops between two shapes:
    1. a loose network (dots linked to their nearest neighbours)
    2. a burst (every dot linked to one centre = the skill you're heading to)
  When a `shape` is passed ("email", "lock" or "card"), the dots fly into that icon's
  outline and the icon sways in 3D (so it stays readable) until the shape is cleared.
  Positions are written straight onto the SVG elements every frame (no React
  re-render). With "reduce motion" on, it shows a still burst.
*/

const SIZE = 600; // SVG coordinate space (scales to fit the panel)
const CENTER = SIZE / 2;
const COUNT = 64;
const PERSPECTIVE = 900; // bigger = flatter 3D
const SPIN_SECONDS = 26; // one full revolution
const MORPH_SPIN_BOOST = 1.4; // extra spin while changing shape, so the turning stays visible
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

// --nn-ink lets a dark panel turn the "ink" dots light
const COLORS = ["var(--nn-ink, var(--ink))", "var(--familiar-default)", "var(--done-default)", "var(--highlight-default)"];
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

// Icon outlines, one target point per dot
const ICONS = { email: buildShape("email", COUNT), lock: buildShape("lock", COUNT), card: buildShape("card", COUNT) };
const MAX_ICON_LINKS = Math.max(ICONS.email.links.length, ICONS.lock.links.length);
const ICON_DOT_R = 4.5;

// Rotate a 3D point and project it to 2D with perspective
function project(p, spin, tilt = TILT) {
  const cosY = Math.cos(spin), sinY = Math.sin(spin);
  const x1 = p.x * cosY - p.z * sinY;
  const z1 = p.x * sinY + p.z * cosY;
  const cosX = Math.cos(tilt), sinX = Math.sin(tilt);
  const y2 = p.y * cosX - z1 * sinX;
  const z2 = p.y * sinX + z1 * cosX;
  const scale = PERSPECTIVE / (PERSPECTIVE + z2);
  return { x: CENTER + x1 * scale, y: CENTER + y2 * scale, scale, depth: z2 };
}

export default function NodeNetwork({ shape = null }) {
  const dotRefs = useRef([]);
  const netLineRefs = useRef([]);
  const spokeRefs = useRef([]);
  const iconLineRefs = useRef([]);
  const shapeRef = useRef(shape);
  useEffect(() => {
    shapeRef.current = ICONS[shape] ? shape : null;
  }, [shape]);
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
    let last = start;
    let spin = 0.6;
    let iconMix = 0; // 0 = network/burst loop, 1 = icon
    let activeIcon = "email";
    const iconPos = NODES.map(() => ({ x: 0, y: 0, z: 0 })); // eased icon targets (smooth email <-> lock)

    const draw = (now) => {
      const time = now - start;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = reduce ? 1 : mixAt(time);

      // Ease towards the requested icon (or back to the loop)
      const wanted = shapeRef.current;
      if (wanted) activeIcon = wanted;
      const target = wanted ? 1 : 0;
      const prevMix = iconMix;
      iconMix += (target - iconMix) * Math.min(1, dt * 4.5);
      const icon = ICONS[activeIcon];
      icon.points.forEach((pt, i) => {
        iconPos[i].x += (pt.x - iconPos[i].x) * Math.min(1, dt * 6);
        iconPos[i].y += (pt.y - iconPos[i].y) * Math.min(1, dt * 6);
        iconPos[i].z += (pt.z - iconPos[i].z) * Math.min(1, dt * 6);
      });

      // Spin never stops; it speeds up while the shape is changing so the turn stays visible
      const changing = 4 * m * (1 - m) + Math.min(1, Math.abs(iconMix - prevMix) / Math.max(dt, 1e-3) / 4);
      if (!reduce) spin += ((Math.PI * 2) / SPIN_SECONDS) * (1 + MORPH_SPIN_BOOST * changing) * dt;
      // Icons sway (±32°) instead of turning edge-on; they're counter-rotated against the spin
      const sway = Math.sin(time / 1500) * 0.55;
      const a = spin - sway;
      const cosA = Math.cos(a), sinA = Math.sin(a);
      const tilt = TILT * (1 - 0.75 * iconMix);

      NODES.forEach((n, i) => {
        const float = reduce ? 0 : Math.sin(time / 1300 + n.phase) * 6 * (1 - iconMix * 0.7);
        const loop = {
          x: n.net.x + (n.burst.x - n.net.x) * m,
          y: n.net.y + (n.burst.y - n.net.y) * m + float,
          z: n.net.z + (n.burst.z - n.net.z) * m,
        };
        const ip = iconPos[i];
        const iconWorld = { x: ip.x * cosA + ip.z * sinA, y: ip.y + float, z: -ip.x * sinA + ip.z * cosA };
        const p3 = {
          x: loop.x + (iconWorld.x - loop.x) * iconMix,
          y: loop.y + (iconWorld.y - loop.y) * iconMix,
          z: loop.z + (iconWorld.z - loop.z) * iconMix,
        };
        const p = project(p3, spin, tilt);
        posRef.current[i] = p;
        // Nearer dots (negative depth) are bigger and more solid
        const near = Math.min(1, Math.max(0, 0.5 - p.depth / 400));
        const dot = dotRefs.current[i];
        if (dot) {
          dot.setAttribute("cx", p.x);
          dot.setAttribute("cy", p.y);
          dot.setAttribute("r", (n.r + (ICON_DOT_R - n.r) * iconMix) * p.scale);
          dot.style.opacity = 0.45 + near * 0.55 + iconMix * 0.2;
        }
        const spoke = spokeRefs.current[i];
        if (spoke) {
          spoke.setAttribute("x2", p.x);
          spoke.setAttribute("y2", p.y);
          spoke.style.opacity = m * (1 - iconMix) * (0.15 + near * 0.35);
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
        line.style.opacity = (1 - m) * (1 - iconMix) * 0.4;
      });

      // Icon outline lines
      for (let k = 0; k < MAX_ICON_LINKS; k++) {
        const line = iconLineRefs.current[k];
        if (!line) continue;
        const link = icon.links[k];
        if (!link) {
          line.style.opacity = 0;
          continue;
        }
        const pa = posRef.current[link[0]];
        const pb = posRef.current[link[1]];
        line.setAttribute("x1", pa.x);
        line.setAttribute("y1", pa.y);
        line.setAttribute("x2", pb.x);
        line.setAttribute("y2", pb.y);
        line.style.opacity = iconMix * 0.55;
      }

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

      frame = requestAnimationFrame(draw); // keeps running so focus shapes still appear with reduce-motion on
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
          {Array.from({ length: MAX_ICON_LINKS }, (_, k) => (
            <line key={`i${k}`} className="node-network__icon-line" ref={(el) => (iconLineRefs.current[k] = el)} style={{ opacity: 0 }} />
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
