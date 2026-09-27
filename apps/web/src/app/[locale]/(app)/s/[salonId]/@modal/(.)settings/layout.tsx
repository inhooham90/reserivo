import type { ReactNode } from "react";
import { SettingsDialog } from "@/components/settings/settings-dialog";

/**
 * Settings opened from inside the salon: Next intercepts the navigation, keeps
 * the page underneath mounted, and renders the sections here, in the salon
 * layout's @modal slot. Closing goes back to that page.
 */
export default function InterceptedSettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsDialog intercepted>{children}</SettingsDialog>;
}
