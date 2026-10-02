"use client";

import { useEffect, useState } from "react";

/** True at the desktop `lg` breakpoint (1024px) and above. */
export function useLgUp(): boolean {
  const [isLg, setIsLg] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(min-width: 1024px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLg(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isLg;
}
