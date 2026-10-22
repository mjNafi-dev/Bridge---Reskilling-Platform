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
      if (!document.startViewTransition || reduce) {
        navigate(to, options);
        return;
      }
      document.startViewTransition(() => flushSync(() => navigate(to, options)));
    },
    [navigate]
  );
}
