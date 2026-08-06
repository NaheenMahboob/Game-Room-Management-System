/**
 * Shared scroll panel for lists that grow over time (rosters, inventory, users).
 * Caps visible height so the page layout stays manageable; overflow scrolls inside.
 *
 * @author Muhammad Naheen Mahboob
 */

import type { ReactNode } from "react";

/**
 * Props for {@link ScrollPanel}.
 *
 * @author Muhammad Naheen Mahboob
 */
type ScrollPanelProps = {
  children: ReactNode;
  /** Accessible name for the scroll region (screen readers). */
  label?: string;
  /** Extra Tailwind classes merged onto the panel. */
  className?: string;
  /**
   * `rows` — compact table-like rows (~10 × 2.75rem, matches audit log).
   * `cards` — taller list cards (~8–10 desk items within 36rem / 70vh).
   * `section` — mid height for nested lists (per equipment type, per-member loans).
   */
  density?: "rows" | "cards" | "section";
};

/**
 * Constrains children to a fixed max height with vertical (and horizontal) scroll.
 *
 * @author Muhammad Naheen Mahboob
 */
export function ScrollPanel({
  children,
  label,
  className = "",
  density = "cards",
}: ScrollPanelProps) {
  // rows / cards for top-level lists; section for type- or member-scoped nested lists.
  const heightClass =
    density === "rows"
      ? "max-h-[calc(2.75rem*11)]"
      : density === "section"
        ? "max-h-[min(20rem,50vh)]"
        : "max-h-[min(36rem,70vh)]";

  return (
    <div
      role="region"
      aria-label={label}
      className={`overflow-x-auto overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/30 p-2 ${heightClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
