"use client";

import { useId, useState, type ReactNode } from "react";

type ExpandableSectionProps = {
  title: string;
  summary: string;
  /** Collapsed by default — keeps Home scannable. */
  defaultExpanded?: boolean;
  children: ReactNode;
};

export function ExpandableSection({
  title,
  summary,
  defaultExpanded = false,
  children,
}: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();

  return (
    <section className="home-expandable">
      <button
        type="button"
        className="home-expandable-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="home-expandable-chevron" aria-hidden>
          {expanded ? "▼" : "▶"}
        </span>
        <span className="home-expandable-text">
          <span className="home-expandable-title">{title}</span>
          <span className="home-expandable-summary">{summary}</span>
        </span>
      </button>
      {expanded ? (
        <div id={panelId} className="home-expandable-panel">
          {children}
        </div>
      ) : null}
    </section>
  );
}
