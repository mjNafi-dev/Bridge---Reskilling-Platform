import { useCallback } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";

/*
  Navigate with a page transition. Browsers with the View Transitions API cross-fade
  the pages and morph shared pieces (anything with the same view-transition-name, e.g.
  the side panel or the job title). Others just navigate.
*/
export function useGo() {
  const navigate = useNavigate();
  return useCallback(
    (to, options) => {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      // A hidden tab never paints, so a transition would hold the navigation until it's shown
      if (!document.startViewTransition || reduce || document.visibilityState !== "visible") {
        navigate(to, options);
        return;
      }
      let done = false;
      const update = () => {
        if (done) return;
        done = true;
        flushSync(() => navigate(to, options));
      };
      const transition = document.startViewTransition(update);
      // A skipped transition rejects these; it's expected, so don't report it as an error
      transition.ready?.catch(() => {});
      transition.finished?.catch(() => {});
      // Safety net: if the browser hasn't started the transition soon (no frame drawn), just go
      setTimeout(() => {
        if (!done) {
          transition.skipTransition?.();
          update();
        }
      }, 400);
    },
    [navigate]
  );
}
