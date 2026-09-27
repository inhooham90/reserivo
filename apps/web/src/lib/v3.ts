import { cn } from "cn";

/*
 * Morrri v3 control shapes (DESIGN.md "Shapes" and "App surfaces"), applied
 * per call site rather than changed in components/ui: only the surfaces under
 * .theme-morrri are on the new design so far, and `cn` merges these over the
 * components' own sizes. 48px is the form height; 40px (the "sm" set) is for
 * the dense app shell and toolbars.
 */

const press = "hover:scale-[1.04] active:scale-[0.98] motion-reduce:hover:scale-100 motion-reduce:active:scale-100";

/** Tall pill input for forms. The dark: override matters: the scope is light-only. */
export const pillInput = "h-12 rounded-full bg-card px-6 text-base md:text-base dark:bg-card";
/** Compact pill input and select for toolbars and side panels. */
export const pillInputSm = "h-10 rounded-full bg-card px-4 text-sm md:text-sm dark:bg-card";
export const pillSelectSm = "h-10 rounded-full border border-input bg-card px-4 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring";

/** Navy primary pill. Keeps its colour on hover and grows a little instead. */
export const pillButton = cn("h-12 rounded-full px-6 hover:bg-primary", press);
export const pillButtonSm = cn("h-10 rounded-full px-4 hover:bg-primary", press);
/** White pill with a Line edge that darkens to Ink on hover. */
export const outlinePillSm = cn(
  "h-10 rounded-full border-border bg-card px-4 shadow-none hover:border-foreground hover:bg-card dark:border-border dark:bg-card dark:hover:bg-card",
  press,
);
/** Borderless pill; tints on hover rather than growing, as in the prototype. */
export const ghostPillSm = "h-10 rounded-full px-4 hover:bg-surface-muted dark:hover:bg-surface-muted";

export const textLink =
  "font-medium text-foreground underline decoration-border underline-offset-3 transition-colors hover:decoration-foreground";

/** The nav pill: a Surface-subtle capsule with a Line edge and 4px inner padding. */
export const navGroup = "inline-flex h-12 max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1 shadow-[inset_0_0_0_1px_var(--border)]";
/** One item in it. Selected is navy and white, the same pair as the primary button. */
export const navItem = (active: boolean) =>
  cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-surface-muted",
  );
