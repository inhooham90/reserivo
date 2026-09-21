"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import type { Locale } from "@/i18n/routing";
import {
  formatCents,
  formatDuration,
  formatInTz,
  formatLocalDate,
  formatLocalDateParts,
  hourLabel,
  minutesLabel,
  summarizeHours,
  timezoneLabel,
  weekdayNames,
  type DateStyle,
} from "./format";

type Role = "MANAGER" | "DESIGNER";

/**
 * Every formatter, pre-bound to the active locale, plus the labels that come
 * from the message tables rather than from `Intl`.
 *
 * The split matters. Dates, times, money and durations are *derived* from the
 * locale and need no translator — `Intl` already knows them in every language.
 * Roles, statuses and payment methods are product vocabulary: they are stored
 * as enum values and have to be written out by hand per language, so they live
 * in `messages/*.json` under `labels`.
 */
export function useFormat() {
  const locale = useLocale() as Locale;
  const t = useTranslations("labels");

  return useMemo(
    () => ({
      locale,

      cents: (c: number) => formatCents(c, locale),
      duration: (min: number) => formatDuration(min, locale),
      inTz: (iso: string | Date, timeZone: string, style?: DateStyle) => formatInTz(iso, timeZone, locale, style),
      localDate: (ymd: string, style?: DateStyle) => formatLocalDate(ymd, locale, style),
      localDateParts: (ymd: string) => formatLocalDateParts(ymd, locale),
      minutes: (m: number) => minutesLabel(m, locale),
      hour: (m: number) => hourLabel(m, locale),
      hours: (rules: { weekday: number; startMinutes: number; endMinutes: number }[]) =>
        summarizeHours(rules, locale),
      timezone: (tz: string) => timezoneLabel(tz, locale),
      weekdays: (width: "long" | "short" = "long") => weekdayNames(locale, width),

      role: (role: Role) => t(`role.${role}`),
      /** "Owner-stylist" reads better than "Manager · Designer" for the both-roles case. */
      roles: (list: readonly Role[]) =>
        list.includes("MANAGER") && list.includes("DESIGNER")
          ? t("role.OWNER_STYLIST")
          : list.map((r) => t(`role.${r}`)).join(" · "),
      /**
       * Appointment status. Taken from a table rather than derived from the
       * enum: the old version title-cased the value and swapped an underscore
       * for a hyphen, which only ever produced English.
       */
      status: (status: string) => t(`status.${status}`),
      payment: (method: string) => t(`payment.${method}`),
    }),
    [locale, t],
  );
}
