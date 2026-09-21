import { Body, Controller, Delete, Get, HttpCode, Param, Patch } from '@nestjs/common';
import { updateMemberSchema, type Member, type UpdateMemberInput } from '@reserivo/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { assertCanManageMember } from '../tenancy/access.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { MembersService } from './members.service.js';

@Controller('salons/:salonId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @SalonRoles('MANAGER', 'DESIGNER')
  @Get()
  list(@Tenant() tenant: TenantContext): Promise<Member[]> {
    return this.members.list(tenant);
  }

  @SalonRoles('MANAGER', 'DESIGNER')
  @Get(':memberId')
  get(@Tenant() tenant: TenantContext, @Param('memberId') memberId: string): Promise<Member> {
    return this.members.get(tenant, memberId);
  }

  /** Members edit their own profile; managers edit anyone (and roles). */
  @SalonRoles('MANAGER', 'DESIGNER')
  @Patch(':memberId')
  update(
    @Tenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(updateMemberSchema)) body: UpdateMemberInput,
  ): Promise<Member> {
    assertCanManageMember(tenant, memberId);
    return this.members.update(tenant, memberId, body);
  }

  @SalonRoles('MANAGER')
  @HttpCode(204)
  @Delete(':memberId')
  remove(@Tenant() tenant: TenantContext, @Param('memberId') memberId: string): Promise<void> {
    return this.members.remove(tenant, memberId);
  }
}
