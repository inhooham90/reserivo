import { z } from 'zod';

/** Prices are integer cents (USD for now); durations are whole minutes. */
export const serviceSchema = z.object({
  id: z.string(),
  salonId: z.string(),
  designerId: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  priceCents: z.number().int(),
  durationMin: z.number().int(),
  bufferMin: z.number().int(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Service = z.infer<typeof serviceSchema>;

export const createServiceSchema = z.object({
  /** Managers set this to create on a designer's behalf; designers may omit it. */
  designerId: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(60).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  priceCents: z.number().int().min(0).max(1_000_000),
  /** 5-minute steps keep slot math sane and match how salons actually book. */
  durationMin: z.number().int().min(5).max(600).multipleOf(5),
  bufferMin: z.number().int().min(0).max(120).multipleOf(5).default(0),
  active: z.boolean().default(true),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.omit({ designerId: true }).partial().extend({
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

/** What a customer sees on the booking page. */
export const publicServiceSchema = serviceSchema.pick({
  id: true,
  designerId: true,
  name: true,
  category: true,
  description: true,
  priceCents: true,
  durationMin: true,
});
export type PublicService = z.infer<typeof publicServiceSchema>;
