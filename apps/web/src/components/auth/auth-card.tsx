import type { ReactNode } from "react";

import { textLink } from "@/lib/v3";

// The shapes live in lib/v3 now that the app shell uses them too.
export { pillButton, pillInput } from "@/lib/v3";
export const authLink = `text-sm ${textLink}`;

/**
 * The white form card on the left of the auth frame. It is the page's <main>
 * (skip-link target) and its title is the page's <h1>.
 */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex items-center rounded-lg bg-card px-6 py-8 text-card-foreground outline-none md:p-16"
    >
      <div className="mx-auto w-full max-w-[450px]">
        <h1 className="text-[28px] leading-[1.3] md:text-4xl md:leading-[1.2]">{title}</h1>
        {description && <p className="mt-2 mb-8 text-lg text-body">{description}</p>}
        {children}
      </div>
    </main>
  );
}
