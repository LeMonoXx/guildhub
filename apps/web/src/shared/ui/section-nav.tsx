import { useEffect, useState } from "react";

export interface SectionLink {
  readonly id: string;
  readonly label: string;
}

interface SectionNavProps {
  readonly sections: readonly SectionLink[];
  readonly label: string;
}

/** Sticky in-page navigation that follows the section in view. */
export function SectionNav({ sections, label }: SectionNavProps) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    if (typeof globalThis.IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              left.boundingClientRect.top - right.boundingClientRect.top,
          )[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    for (const section of sections) {
      const element = globalThis.document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => {
      observer.disconnect();
    };
  }, [sections]);

  return (
    <nav className="section-nav" aria-label={label}>
      <ol>
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? "location" : undefined}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
