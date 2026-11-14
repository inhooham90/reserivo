import { Module } from '@nestjs/common';
import { SlotsService } from '../availability/slots.service.js';
import { BillingModule } from '../billing/billing.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { MyAppointmentsController, PublicBookingController, StaffAppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';

@Module({
  imports: [CustomersModule, BillingModule],
  controllers: [PublicBookingController, MyAppointmentsController, StaffAppointmentsController],
  providers: [AppointmentsService, SlotsService],
})
export class AppointmentsModule {}
