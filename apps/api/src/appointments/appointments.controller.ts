import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  anyAvailabilityQuerySchema,
  availabilityQuerySchema,
  bookAnyAppointmentSchema,
  bookAppointmentSchema,
  type AnyAvailabilityQuery,
  type BookAnyAppointmentInput,
  staffAppointmentsQuerySchema,
  staffBookAppointmentSchema,
  updateAppointmentSchema,
  type AvailabilityQuery,
  type AvailabilityResponse,
  type BookAppointmentInput,
  type CustomerAppointment,
  type StaffAppointment,
  type StaffAppointmentsQuery,
  type StaffBookAppointmentInput,
  type UpdateAppointmentInput,
} from '@reserivo/shared';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { AppointmentsService } from './appointments.service.js';

/** Customer-facing booking on the salon's public page. */
@Controller('public/salons/:slug')
export class PublicBookingController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Public()
  @Get('availability')
  availability(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(availabilityQuerySchema)) query: AvailabilityQuery,
  ): Promise<AvailabilityResponse> {
    return this.appointments.publicAvailability(slug, query);
  }

  /** "Anyone available": every slot at which at least one of these team members is free. */
  @Public()
  @Get('availability/any')
  availabilityAny(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(anyAvailabilityQuerySchema)) query: AnyAvailabilityQuery,
  ): Promise<AvailabilityResponse> {
    return this.appointments.publicAvailabilityAny(slug, query);
  }

  /** "Anyone available": the business's side picks who; the response says who it was. */
  @OptionalAuth()
  @Post('appointments/any')
  bookAny(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(bookAnyAppointmentSchema)) body: BookAnyAppointmentInput,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<CustomerAppointment> {
    return this.appointments.bookPublicAny(slug, body, user);
  }

  /** Guests may book; a signed-in customer's booking is linked to their account. */
  @OptionalAuth()
  @Post('appointments')
  book(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(bookAppointmentSchema)) body: BookAppointmentInput,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<CustomerAppointment> {
    return this.appointments.bookPublic(slug, body, user);
  }
}

/** A signed-in customer's own bookings, across salons. */
@Controller('me/appointments')
export class MyAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<CustomerAppointment[]> {
    return this.appointments.listMine(user);
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<CustomerAppointment> {
    return this.appointments.cancelMine(user, id);
  }
}

/** The salon's calendar. */
@Controller('salons/:salonId')
@SalonRoles('MANAGER', 'DESIGNER')
export class StaffAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('availability')
  availability(
    @Tenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(availabilityQuerySchema)) query: AvailabilityQuery,
  ): Promise<AvailabilityResponse> {
    return this.appointments.staffAvailability(tenant, query);
  }

  @Get('appointments')
  list(
    @Tenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(staffAppointmentsQuerySchema)) query: StaffAppointmentsQuery,
  ): Promise<StaffAppointment[]> {
    return this.appointments.listStaff(tenant, query);
  }

  @Post('appointments')
  book(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(staffBookAppointmentSchema)) body: StaffBookAppointmentInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StaffAppointment> {
    return this.appointments.bookStaff(tenant, body, user);
  }

  @Patch('appointments/:id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAppointmentSchema)) body: UpdateAppointmentInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StaffAppointment> {
    return this.appointments.updateStaff(tenant, id, body, user);
  }
}
