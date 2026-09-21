import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { validateEnv } from './config/env.js';
import { CustomersModule } from './customers/customers.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { MembersModule } from './members/members.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SalonHoursModule } from './salon-hours/salon-hours.module.js';
import { SalonsModule } from './salons/salons.module.js';
import { ServicesModule } from './services/services.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
    SalonHoursModule,
    SalonsModule,
    MembersModule,
    InvitationsModule,
    ServicesModule,
    AvailabilityModule,
    CustomersModule,
    AppointmentsModule,
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [
    // Every route is authenticated unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
