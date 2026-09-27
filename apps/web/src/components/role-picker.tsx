"use client";

import type { SalonRole } from "@reserivo/shared";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/use-format";

/** Two capability checkboxes. At least one must stay on; the API enforces the same. */
export function RolePicker({
  value,
  onChange,
  disabled,
  idPrefix,
}: {
  value: SalonRole[];
  onChange: (roles: SalonRole[]) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const f = useFormat();
  const t = useTranslations("settings.roles");
  const toggle = (role: SalonRole) => (checked: boolean) => {
    const next = checked ? Array.from(new Set([...value, role])) : value.filter((r) => r !== role);
    onChange(next);
  };
  return (
    <div className="grid gap-2 text-sm">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg p-4 shadow-[inset_0_0_0_1px_var(--border)] has-[:checked]:shadow-[inset_0_0_0_1px_var(--foreground)] has-[:disabled]:cursor-not-allowed">
        <input
          id={`${idPrefix}-manager`}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-foreground"
          checked={value.includes("MANAGER")}
          disabled={disabled}
          onChange={(e) => toggle("MANAGER")(e.target.checked)}
        />
        <span>
          <span className="font-medium">{f.role("MANAGER")}</span>
          <span className="mt-0.5 block text-muted-foreground">{t("managerHint")}</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg p-4 shadow-[inset_0_0_0_1px_var(--border)] has-[:checked]:shadow-[inset_0_0_0_1px_var(--foreground)] has-[:disabled]:cursor-not-allowed">
        <input
          id={`${idPrefix}-designer`}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-foreground"
          checked={value.includes("DESIGNER")}
          disabled={disabled}
          onChange={(e) => toggle("DESIGNER")(e.target.checked)}
        />
        <span>
          <span className="font-medium">{f.role("DESIGNER")}</span>
          <span className="mt-0.5 block text-muted-foreground">{t("designerHint")}</span>
        </span>
      </label>
      {value.length === 0 && <p className="text-xs text-destructive">{t("pickOne")}</p>}
    </div>
  );
}
