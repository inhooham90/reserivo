import { z } from 'zod';
import type { SalonRole } from './roles';

/**
 * The setup guide on the schedule, one per membership. The order here is the
 * order the guide walks through: the business first (a team member's hours
 * must fit inside its opening hours), then the person's own chair, then the
 * people and the link that bring clients in.
 */
export const SETUP_STEPS = ['business', 'businessHours', 'myHours', 'services', 'profile', 'team', 'share'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/**
 * Steps that have to be remembered, because nothing in the data says they
 * happened: seeded hours look the same whether or not anyone has checked
 * them. They are marked when the matching screen is saved or when the person
 * confirms it. The others (services, profile, team) are read off real rows,
 * though `team` can also be stored for a business that is just one person.
 */
export const STORED_SETUP_STEPS = ['business', 'businessHours', 'myHours', 'team', 'share'] as const;
export type StoredSetupStep = (typeof STORED_SETUP_STEPS)[number];

const MANAGER_STEPS: readonly SetupStep[] = ['business', 'businessHours', 'team', 'share'];
const DESIGNER_STEPS: readonly SetupStep[] = ['myHours', 'services', 'profile', 'share'];

/** Which steps a member sees: managers set up the business, whoever takes appointments sets up their own chair. */
export function setupStepsFor(roles: readonly SalonRole[]): SetupStep[] {
  const wanted = new Set<SetupStep>([
    ...(roles.includes('MANAGER') ? MANAGER_STEPS : []),
    ...(roles.includes('DESIGNER') ? DESIGNER_STEPS : []),
  ]);
  return SETUP_STEPS.filter((s) => wanted.has(s));
}

export const setupProgressSchema = z.object({
  steps: z.array(z.object({ key: z.enum(SETUP_STEPS), done: z.boolean() })),
  hidden: z.boolean(),
});
export type SetupProgress = z.infer<typeof setupProgressSchema>;

export const updateSetupSchema = z
  .object({
    done: z.array(z.enum(STORED_SETUP_STEPS)).max(STORED_SETUP_STEPS.length).optional(),
    hidden: z.boolean().optional(),
  })
  .refine((v) => v.done !== undefined || v.hidden !== undefined, { message: 'Nothing to update' });
export type UpdateSetupInput = z.infer<typeof updateSetupSchema>;
