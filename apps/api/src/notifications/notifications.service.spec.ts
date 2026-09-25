import { NotificationsService, type NotificationEvent } from './notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * "Turn off every email" is enforced in one place, emit(). These pin the two
 * things it must get right: booking email to that address stops, and the
 * account links the person asked for still go out.
 */
describe('NotificationsService suppression', () => {
  const booked: NotificationEvent = {
    type: 'appointment.booked',
    to: { email: 'Rita@Example.com', name: 'Rita' },
    data: {
      appointmentId: 'a1',
      salonName: 'Glow',
      designerName: 'Mia',
      serviceName: 'Cut',
      startAt: '2026-10-01T17:00:00Z',
      timezone: 'America/New_York',
    },
  };
  const reset: NotificationEvent = {
    type: 'auth.password_reset',
    to: { email: 'rita@example.com', name: 'Rita' },
    data: { link: 'https://morrri.com/reset-password?token=x', expiresInMinutes: 60 },
  };

  const setup = (scope: 'MARKETING' | 'ALL' | null) => {
    const send = vi.fn().mockResolvedValue(undefined);
    const findUnique = vi.fn().mockResolvedValue(scope ? { scope } : null);
    const prisma = { emailSuppression: { findUnique } } as unknown as PrismaService;
    return { service: new NotificationsService({ send }, prisma), send, findUnique };
  };

  // emit() is fire-and-forget, so let its promise chain settle before asserting.
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('sends normally when nothing is suppressed', async () => {
    const { service, send } = setup(null);
    service.emit(booked);
    await settle();
    expect(send).toHaveBeenCalledWith(booked);
  });

  it('stops booking email to an address that turned everything off, whatever its case', async () => {
    const { service, send, findUnique } = setup('ALL');
    service.emit(booked);
    await settle();
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'rita@example.com' } }));
    expect(send).not.toHaveBeenCalled();
  });

  it('does not treat a promotions-only opt-out as stopping booking email', async () => {
    const { service, send } = setup('MARKETING');
    service.emit(booked);
    await settle();
    expect(send).toHaveBeenCalledWith(booked);
  });

  it('still sends a password reset the person asked for', async () => {
    const { service, send, findUnique } = setup('ALL');
    service.emit(reset);
    await settle();
    expect(findUnique).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(reset);
  });
});
