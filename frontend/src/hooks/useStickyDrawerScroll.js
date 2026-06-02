import { useCallback, useEffect, useRef } from "react";

export function useStickyDrawerScroll(isOpen) {
  const savedScrollYRef = useRef(0);
  const wasOpenRef = useRef(false);

  const saveScrollPosition = useCallback(() => {
    savedScrollYRef.current = window.scrollY || window.pageYOffset || 0;
  }, []);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;

    if (wasOpen && !isOpen) {
      const timeoutId = window.setTimeout(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.scrollTo({
              top: savedScrollYRef.current,
              left: 0,
              behavior: "auto",
            });
          });
        });
      }, 180);

      wasOpenRef.current = isOpen;
      return () => window.clearTimeout(timeoutId);
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);

  return { saveScrollPosition };
}
