import { useEffect, useState } from "react";

const matchesNow = (query: string) =>
  typeof matchMedia === "function" && matchMedia(query).matches;

/** Whether `query` matches, kept current as the window changes. */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => matchesNow(query));
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const media = matchMedia(query);
    const sync = () => {
      setMatches(media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, [query]);
  return matches;
};
