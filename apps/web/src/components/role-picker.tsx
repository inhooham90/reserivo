"use client";

import type { SalonRole } from "@reserivo/shared";

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
  const toggle = (role: SalonRole) => (checked: boolean) => {
    const next = checked ? Array.from(new Set([...value, role])) : value.filter((r) => r !== role);
    onChange(next);
  };
  return (
    <div className="grid gap-1.5 text-sm">
      <label className="flex items-start gap-2">
        <input
          id={`${idPrefix}-manager`}
          type="checkbox"
          className="mt-0.5"
          checked={value.includes("MANAGER")}
          disabled={disabled}
          onChange={(e) => toggle("MANAGER")(e.target.checked)}
        />
        <span>
          <span className="font-medium">Manager</span>
          <span className="block text-xs text-muted-foreground">Team, salon hours, settings, customer contact details</span>
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input
          id={`${idPrefix}-designer`}
          type="checkbox"
          className="mt-0.5"
          checked={value.includes("DESIGNER")}
          disabled={disabled}
          onChange={(e) => toggle("DESIGNER")(e.target.checked)}
        />
        <span>
          <span className="font-medium">Designer</span>
          <span className="block text-xs text-muted-foreground">Takes appointments: own services and hours, shown on the booking page</span>
        </span>
      </label>
      {value.length === 0 && <p className="text-xs text-destructive">Pick at least one.</p>}
    </div>
  );
}
