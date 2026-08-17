"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

/**
 * Compact pill-style trigger for a standalone/inline button (e.g. sitting
 * next to a page heading). The caller renders its own panel below,
 * however it likes — see AddChildForm for the pattern.
 */
export function DisclosureTrigger({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`on-light inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-md transition-colors ${
        active
          ? "bg-brand-50 text-brand-700"
          : "bg-surface text-foreground hover:bg-surface-muted"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden />}
      {label}
      <ChevronDown
        className={`h-4 w-4 transition-transform ${active ? "rotate-180" : ""}`}
        aria-hidden
      />
    </button>
  );
}

/**
 * A full-width settings row that expands into an attached panel directly
 * beneath it, both inside one bordered container — so it's unambiguous
 * which panel belongs to which row. For a standalone/inline button next to
 * a heading (not a settings block), use DisclosureTrigger instead.
 * Uncontrolled by default; pass open/onOpenChange to coordinate siblings
 * (e.g. only one open at a time — see KidActionsMenu).
 */
export function Disclosure({
  label,
  icon: Icon,
  children,
  open,
  onOpenChange,
  defaultOpen = false,
}: {
  label: string;
  icon?: LucideIcon;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  function toggle() {
    const next = !isOpen;
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  }

  return (
    <div className="on-light overflow-hidden rounded-2xl bg-surface shadow-lg">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors ${
          isOpen ? "bg-surface-muted" : "bg-surface hover:bg-surface-muted"
        }`}
      >
        {Icon && (
          <span className="rounded-lg bg-brand-600/10 p-2 text-brand-600">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
        <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
        <ChevronDown
          className={`h-4 w-4 text-foreground/65 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {isOpen && (
        <div className="border-t border-border bg-surface-muted p-4">{children}</div>
      )}
    </div>
  );
}
