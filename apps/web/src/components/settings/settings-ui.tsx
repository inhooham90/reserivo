import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";

/*
 * The building blocks of every settings pane (DESIGN.md "App surfaces",
 * Dialog): a titled group of white rows separated by Line dividers, each row a
 * label and description on the left and its control on the right. Rows stack
 * under md, where the dialog is full screen.
 */

/** One titled group. `action` sits at the right of the title, e.g. a picker or an Add button. */
export function SettingsSection({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid grid-cols-[minmax(0,1fr)] gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {/* h3 inside the pane's h2; Geist, not the display serif, as in the design. */}
          <h3 className="font-sans text-base font-semibold tracking-normal">{title}</h3>
          {hint && <p className="mt-0.5 max-w-[62ch] text-sm text-body">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The white container rows sit in. Separated from the pane by a Line edge, not a shadow. */
export function SettingsRows({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("divide-y divide-border rounded-lg bg-card shadow-[inset_0_0_0_1px_var(--border)]", className)}>
      {children}
    </div>
  );
}

/** Label and description left, control right. `wide` gives the control the whole row under the label. */
export function SettingsRow({
  label,
  htmlFor,
  description,
  children,
  compact,
}: {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Control sized to its content (a switch, a button) rather than a 280px column. */
  compact?: boolean;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div
      className={cn(
        "grid items-center gap-3 px-4 py-4 md:gap-6 md:px-6",
        compact ? "grid-cols-[minmax(0,1fr)_auto]" : "md:grid-cols-[minmax(0,1fr)_minmax(0,280px)]",
      )}
    >
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="block text-sm font-medium">
          {label}
        </Label>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex min-w-0 items-center gap-2 md:justify-end">{children}</div>}
    </div>
  );
}

/**
 * An on/off switch. A real checkbox with role="switch", so it is keyboard and
 * screen-reader operable; the track and thumb are drawn by its sibling. On is
 * Ink, never Navy (DESIGN.md "Selected state").
 */
export function Switch({ className, ...props }: Omit<ComponentProps<"input">, "type" | "role">) {
  return (
    <span className={cn("relative inline-flex h-[26px] w-11 shrink-0", className)}>
      <input type="checkbox" role="switch" className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" {...props} />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full border border-input bg-card transition-colors peer-checked:border-foreground peer-checked:bg-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring peer-disabled:opacity-50"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-[4px] left-[4px] size-[18px] rounded-full bg-input transition-transform peer-checked:translate-x-[18px] peer-checked:bg-card motion-reduce:transition-none"
      />
    </span>
  );
}

/** A number (or other) field with its unit written after it, as in "60 minutes". */
export function WithUnit({ unit, children }: { unit: ReactNode; children: ReactNode }) {
  return (
    <span className="flex w-full items-center gap-2">
      {children}
      <span className="min-w-[5.5rem] text-sm whitespace-nowrap text-body">{unit}</span>
    </span>
  );
}
