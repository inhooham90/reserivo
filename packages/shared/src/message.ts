import { z } from 'zod';

export const messageBodySchema = z.string().trim().min(1).max(2000);

export const sendMessageSchema = z.object({ body: messageBodySchema });
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** A customer opens a thread with a designer at a salon they have booked with. */
export const startConversationSchema = z.object({
  salonId: z.uuid(),
  designerId: z.uuid(),
  body: messageBodySchema.optional(),
});
export type StartConversationInput = z.infer<typeof startConversationSchema>;

/** Staff open a thread with a customer (who must have an account). */
export const staffStartConversationSchema = z.object({
  customerId: z.uuid(),
  /** Managers choose which designer the thread belongs to; designers may omit (themselves). */
  designerId: z.uuid().optional(),
  body: messageBodySchema.optional(),
});
export type StaffStartConversationInput = z.infer<typeof staffStartConversationSchema>;

export const messageSchema = z.object({
  id: z.string(),
  sender: z.enum(['CUSTOMER', 'STAFF']),
  body: z.string(),
  createdAt: z.string(),
  /** Display name of who it appears from: the customer, or the thread's designer. */
  fromName: z.string(),
  /**
   * Staff view only: when a manager wrote on the designer's behalf, their name.
   * Never sent to customers.
   */
  writtenBy: z.string().optional(),
  /** Staff view only: true when the current caller wrote it. */
  mine: z.boolean().optional(),
});
export type Message = z.infer<typeof messageSchema>;

/** Customer's list item. */
export const customerConversationSchema = z.object({
  id: z.string(),
  salon: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  designer: z.object({ id: z.string(), displayName: z.string(), photoUrl: z.string().nullable() }),
  lastMessage: z.object({ body: z.string(), sender: z.enum(['CUSTOMER', 'STAFF']), createdAt: z.string() }).nullable(),
  unread: z.number().int(),
});
export type CustomerConversation = z.infer<typeof customerConversationSchema>;

/** Staff list item. Customer contact never rides along here — use the CRM endpoint. */
export const staffConversationSchema = z.object({
  id: z.string(),
  customer: z.object({ id: z.string(), name: z.string() }),
  designer: z.object({ id: z.string(), displayName: z.string() }),
  lastMessage: z.object({ body: z.string(), sender: z.enum(['CUSTOMER', 'STAFF']), createdAt: z.string() }).nullable(),
  unread: z.number().int(),
});
export type StaffConversation = z.infer<typeof staffConversationSchema>;

export const threadSchema = z.object({
  conversationId: z.string(),
  messages: z.array(messageSchema),
});
export type Thread = z.infer<typeof threadSchema>;

/**
 * Unread messages for the signed-in person: their own inbox as a client, and
 * one count per business where they are staff (scoped like the staff inbox: a
 * manager counts the whole business, anyone else their own conversations).
 */
export const unreadCountsSchema = z.object({
  personal: z.number().int(),
  salons: z.record(z.string(), z.number().int()),
});
export type UnreadCounts = z.infer<typeof unreadCountsSchema>;

/**
 * What the live stream (`GET /me/events`) pushes. Deliberately just ids: the
 * browser refetches through the ordinary endpoints, which apply every access
 * rule, so the stream can never leak a message body or a contact field.
 * `salonId` is set when the receiver sees the conversation as staff.
 */
export const liveEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), conversationId: z.string(), salonId: z.string().optional() }),
  z.object({ type: z.literal('ping') }),
]);
export type LiveEvent = z.infer<typeof liveEventSchema>;
