import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { AdminModule } from './admin/admin.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';
import { SetupModule } from './setup/setup.module.js';
import { validateEnv } from './config/env.js';
import { CustomersModule } from './customers/customers.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { MembersModule } from './members/members.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RemindersModule } from './reminders/reminders.module.js';
import { SalonHoursModule } from './salon-hours/salon-hours.module.js';
import { RatingsModule } from './ratings/ratings.module.js';
import { SalonsModule } from './salons/salons.module.js';
import { ServicesModule } from './services/services.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      // A generous ceiling for ordinary browsing; credential endpoints set
      // their own much tighter budgets with @Throttle.
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      // The e2e suite registers and logs in dozens of times in a few seconds.
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
    SalonHoursModule,
    RatingsModule,
    SalonsModule,
    MembersModule,
    InvitationsModule,
    ServicesModule,
    AvailabilityModule,
    CustomersModule,
    AppointmentsModule,
    MessagingModule,
    AdminModule,
    RemindersModule,
    CampaignsModule,
    SetupModule,
  ],
  controllers: [AppController],
  providers: [
    // Order matters: turn away floods before doing any work on them.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Every route is authenticated unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
