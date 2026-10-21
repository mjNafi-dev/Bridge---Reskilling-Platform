import { useEffect, useState } from "react";
import "./CyclingTagline.css";

/*
  Rotates through taglines on the same page, no refresh.
  Each word sits in its own clipping box: the old words drop down out of view one
  after another, then the new words rise up into place one after another.
  All lines share one grid cell, so the box keeps the height of the longest line
  and nothing below it jumps.
*/

export const TAGLINES = [
  "Every skill starts from one you have",
  "New skills start from old ones",
  "Bridge to the skills you'll need next",
];

const INTERVAL_MS = 4500;
const WORD_STAGGER_MS = 55;
const ENTER_DELAY_MS = 320; // new words start rising after the old ones begin to leave

export default function CyclingTagline({ className = "", lines = TAGLINES }) {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => {
        setPrevious(i);
        return (i + 1) % lines.length;
      });
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [lines.length]);

  return (
    <p className={`tagline-cycle ${className}`}>
      {/* Screen readers get one stable sentence instead of changing text */}
      <span className="visually-hidden">{lines[0]}</span>
      {lines.map((line, i) => {
        const state = i === index ? "in" : i === previous ? "out" : "idle";
        return (
          <span key={line} className={`tagline-cycle__line is-${state}`} aria-hidden="true">
            {line.split(" ").map((word, w) => (
              <span className="tagline-cycle__mask" key={w}>
                <span
                  className="tagline-cycle__word"
                  style={{
                    transitionDelay:
                      state === "in"
                        ? `${(previous === null ? 0 : ENTER_DELAY_MS) + w * WORD_STAGGER_MS}ms`
                        : state === "out"
                          ? `${w * WORD_STAGGER_MS}ms`
                          : "0ms",
                  }}
                >
                  {word}
                </span>
              </span>
            ))}
          </span>
        );
      })}
    </p>
  );
}
