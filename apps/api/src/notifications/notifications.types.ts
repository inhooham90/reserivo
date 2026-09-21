/**
 * The outbound-message seam. Rule that every transport must honour: a message
 * addressed to a DESIGNER never carries customer contact fields — only the
 * customer's display name. Bodies of relayed chat messages are never emailed
 * either; the email is a nudge with a link.
 */
export interface Recipient {
  email: string | null;
  name: string;
}

export type NotificationEvent =
  | {
      type: 'appointment.booked' | 'appointment.cancelled' | 'appointment.rescheduled';
      to: Recipient;
      data: {
        appointmentId: string;
        salonName: string;
        designerName: string;
        serviceName: string;
        startAt: string;
        timezone: string;
      };
    }
  | {
      /** Account links. `link` carries a single-use token and is never logged. */
      type: 'auth.verify_email' | 'auth.password_reset';
      to: Recipient;
      data: { link: string; expiresInMinutes: number };
    }
  | {
      type: 'appointment.reminder';
      to: Recipient;
      data: {
        appointmentId: string;
        salonName: string;
        designerName: string;
        serviceName: string;
        startAt: string;
        timezone: string;
        /** How far ahead this reminder is going out, so the wording can match. */
        hoursBefore: number;
        /** Where the customer can cancel or reschedule. */
        link: string;
      };
    }
  | {
      type: 'message.received';
      to: Recipient;
      data: {
        conversationId: string;
        /** Display name of the sender as the recipient should see it. */
        fromName: string;
        salonName: string;
        /** Absolute URL to the thread in the recipient's own UI. */
        link: string;
      };
    };

export interface NotificationTransport {
  send(event: NotificationEvent): Promise<void>;
}

export const NOTIFICATION_TRANSPORT = Symbol('NOTIFICATION_TRANSPORT');
