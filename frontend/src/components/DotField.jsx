import { useEffect, useRef } from "react";

/*
  The page's dot grid, drawn on a canvas so the dots near the cursor lean towards it a
  little: a soft pull within REACH px, strongest a short way from the cursor and fading to
  nothing at the edge, so it's noticeable without pulling the eye. Same spacing, size and
  colour as the CSS grid in styles/ui.css (dots in reach also get a little darker), which stays as the fallback (and is what you
  see with reduced motion or on touch screens, where there's no cursor to follow).
*/

const GAP = 22; // matches background-size in styles/ui.css
const RADIUS = 1.1;
const REACH = 130;
const PULL = 0.3; // largest shift ~6 px, about a third of the way into REACH
const DARKEN = 0.75; // how far the nearest dots go towards --mid (0 = no change)
const SHADES = 8; // near dots are drawn in a few batches of shade, not one by one
const EASE = 0.16; // how quickly the pull follows the cursor, per 60 Hz frame (scaled by real time)

export default function DotField() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !window.matchMedia?.("(pointer: fine)").matches;
    if (!ctx || still) return;

    const css = getComputedStyle(document.documentElement);
    const color = css.getPropertyValue("--dot-grid").trim() || "#E4E4E8";
    const near = css.getPropertyValue("--mid").trim() || "#9A9AA0";
    const target = { x: 0, y: 0 };
    const at = { x: 0, y: 0 };
    let w = 0;
    let h = 0;
    let strength = 0; // 0 = no pull (cursor away), 1 = full pull
    let want = 0;
    let frame = 0;
    let last = 0;

    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.beginPath();
      const reach2 = REACH * REACH;
      const shaded = Array.from({ length: SHADES }, () => []); // [x, y] per shade step
      for (let y = GAP / 2; y < h + GAP; y += GAP) {
        for (let x = GAP / 2; x < w + GAP; x += GAP) {
          let px = x;
          let py = y;
          if (strength > 0.001) {
            const dx = at.x - x;
            const dy = at.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < reach2) {
              const f = 1 - Math.sqrt(d2) / REACH;
              const k = PULL * f * f * strength;
              px += dx * k;
              py += dy * k;
              const step = Math.floor(f * strength * SHADES);
              if (step > 0) shaded[Math.min(SHADES, step) - 1].push(px, py);
            }
          }
          ctx.moveTo(px + RADIUS, py);
          ctx.arc(px, py, RADIUS, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      // Darker shade on top for the dots in reach: more the closer they are
      ctx.fillStyle = near;
      shaded.forEach((pts, i) => {
        if (!pts.length) return;
        ctx.globalAlpha = ((i + 1) / SHADES) * DARKEN;
        ctx.beginPath();
        for (let j = 0; j < pts.length; j += 2) {
          ctx.moveTo(pts[j] + RADIUS, pts[j + 1]);
          ctx.arc(pts[j], pts[j + 1], RADIUS, 0, Math.PI * 2);
        }
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    // Only animates while something is changing; idle pages cost nothing.
    // Time-based easing, so it feels the same on 60 Hz and 120 Hz screens.
    function tick(now) {
      const a = 1 - Math.pow(1 - EASE, Math.min(100, now - (last || now - 16.7)) / 16.7);
      last = now;
      at.x += (target.x - at.x) * a;
      at.y += (target.y - at.y) * a;
      strength += (want - strength) * a;
      draw();
      const busy = Math.abs(target.x - at.x) > 0.2 || Math.abs(target.y - at.y) > 0.2 || Math.abs(want - strength) > 0.002;
      frame = busy ? requestAnimationFrame(tick) : 0;
      if (!busy) last = 0;
    }
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (strength < 0.01) {
        at.x = target.x; // coming back in: start where the cursor is, not where it left
        at.y = target.y;
      }
      want = 1;
      kick();
    };
    const onLeave = () => {
      want = 0;
      kick();
    };

    resize();
    document.documentElement.classList.add("has-dot-field"); // hides the CSS grid underneath
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("has-dot-field");
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  return <canvas ref={ref} className="dot-field" aria-hidden="true" />;
}
