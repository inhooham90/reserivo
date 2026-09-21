import { Module } from '@nestjs/common';
import { SlotsService } from '../availability/slots.service.js';
import { CustomersModule } from '../customers/customers.module.js';
import { MyAppointmentsController, PublicBookingController, StaffAppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';

@Module({
  imports: [CustomersModule],
  controllers: [PublicBookingController, MyAppointmentsController, StaffAppointmentsController],
  providers: [AppointmentsService, SlotsService],
})
export class AppointmentsModule {}
