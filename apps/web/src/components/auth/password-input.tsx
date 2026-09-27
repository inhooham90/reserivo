"use client";

import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { pillInput } from "./auth-card";

/** Password field with a Show/Hide toggle inside the pill. Takes react-hook-form's register() spread. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn(pillInput, "pr-24", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-controls={props.id}
        aria-pressed={visible}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        className="absolute top-1 right-1 h-10 rounded-full px-4 text-sm font-medium text-foreground transition-colors outline-none hover:bg-lavender focus-visible:ring-3 focus-visible:ring-ring"
      >
        {visible ? t("hide") : t("show")}
      </button>
    </div>
  );
}
