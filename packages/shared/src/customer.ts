import { z } from 'zod';
import { appointmentStatusSchema, phoneSchema } from './appointment';
import { emailSchema } from './auth';

/** Staff view of a salon customer. Contact fields and notes are omitted for designers. */
export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  hasAccount: z.boolean(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()),
  createdAt: z.string(),
});
export type Customer = z.infer<typeof customerSchema>;

export const tagSchema = z.string().trim().min(1).max(30);

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
  tags: z.array(tagSchema).max(20).optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

/** Managers may change anything; designers only notes and tags (the API enforces it). */
export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: emailSchema.nullable(),
    phone: phoneSchema.nullable(),
    notes: z.string().trim().max(2000).nullable(),
    tags: z.array(tagSchema).max(20),
  })
  .partial();
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  tag: tagSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CustomersQuery = z.infer<typeof customersQuerySchema>;

/** Detail view: the record plus what the salon knows about the relationship. */
export const customerDetailSchema = customerSchema.extend({
  stats: z.object({
    visits: z.number().int(),
    noShows: z.number().int(),
    cancellations: z.number().int(),
    upcoming: z.number().int(),
    spentCents: z.number().int(),
    firstVisitAt: z.string().nullable(),
    lastVisitAt: z.string().nullable(),
  }),
  history: z.array(
    z.object({
      id: z.string(),
      startAt: z.string(),
      status: appointmentStatusSchema,
      serviceName: z.string(),
      priceCents: z.number().int(),
      designerId: z.string(),
      designerName: z.string(),
    }),
  ),
});
export type CustomerDetail = z.infer<typeof customerDetailSchema>;
