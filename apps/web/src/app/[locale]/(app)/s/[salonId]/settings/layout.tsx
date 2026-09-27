import type { ReactNode } from "react";
import { SettingsDialog } from "@/components/settings/settings-dialog";

/**
 * Settings loaded directly (a link, a bookmark, a reload). The same dialog the
 * intercepted route shows, over the salon header; closing goes to the schedule.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsDialog>{children}</SettingsDialog>;
}
