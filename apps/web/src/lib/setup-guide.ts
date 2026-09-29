"use client";

import { STORED_SETUP_STEPS, type SetupProgress, type SetupStep, type StoredSetupStep, type UpdateSetupInput } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { salonKeys } from "@/lib/salon-context";

/**
 * Where each step is done: the settings section it opens, with `?guide=` so
 * the section shows the guide banner. `share` has no screen of its own; it
 * happens on the guide card itself.
 */
export const STEP_SECTION: Record<SetupStep, string | null> = {
  business: "",
  businessHours: "/hours",
  myHours: "/hours",
  services: "/services",
  profile: "/team",
  team: "/team",
  share: null,
};

/** The element a step's section scrolls to, where the pane holds more than that step. */
export const STEP_ANCHOR: Partial<Record<SetupStep, string>> = {
  myHours: "guide-my-hours",
  profile: "guide-profile",
  team: "guide-invite",
};

export const stepHref = (salonId: string, step: SetupStep) => {
  const section = STEP_SECTION[step];
  return section === null ? null : `/s/${salonId}/settings${section}?guide=${step}`;
};

export const isStored = (step: SetupStep): step is StoredSetupStep =>
  (STORED_SETUP_STEPS as readonly string[]).includes(step);

/**
 * The first step still to do, from the top, or only after `from`. The
 * walkthrough passes `from` so that "Next" always moves forward: a step
 * someone skipped stays on the schedule's card rather than coming round again.
 */
export function nextOpenStep(progress: SetupProgress, from?: SetupStep): SetupStep | null {
  const start = from ? progress.steps.findIndex((s) => s.key === from) + 1 : 0;
  return progress.steps.slice(start).find((s) => !s.done)?.key ?? null;
}

/** Steps whose "Next" means "I have looked, this is right": seeded values that nothing else can confirm. */
export const CONFIRMABLE: readonly SetupStep[] = ["business", "businessHours", "myHours"];

export function useSetupProgress(salonId: string, enabled = true) {
  return useQuery({
    queryKey: salonKeys.setup(salonId),
    queryFn: () => api<SetupProgress>(`/salons/${salonId}/setup`),
    enabled,
  });
}

export function useUpdateSetup(salonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSetupInput) => api<SetupProgress>(`/salons/${salonId}/setup`, { method: "PATCH", json: input }),
    onSuccess: (progress) => queryClient.setQueryData(salonKeys.setup(salonId), progress),
  });
}
