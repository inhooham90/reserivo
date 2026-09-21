import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type AuthResponse,
  type CurrentUser,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from '@reserivo/shared';
import type { Request, Response } from 'express';
import { CurrentUser as CurrentUserParam } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { Env } from '../config/env.js';
import { AuthService, type IssuedTokens } from './auth.service.js';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH, type AuthenticatedUser } from './auth.types.js';

const minute = 60_000;
/** Credential endpoints are the ones worth guessing at, so they get their own budgets. */
const LIMIT = {
  login: { default: { limit: 10, ttl: minute } },
  register: { default: { limit: 5, ttl: minute } },
  forgot: { default: { limit: 3, ttl: minute } },
  reset: { default: { limit: 5, ttl: minute } },
  verify: { default: { limit: 10, ttl: minute } },
  resend: { default: { limit: 3, ttl: 5 * minute } },
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle(LIMIT.register)
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.register(body, this.meta(req)));
  }

  @Public()
  @Throttle(LIMIT.login)
  @HttpCode(200)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.login(body, this.meta(req)));
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    return this.respond(res, await this.auth.refresh(this.cookie(req), this.meta(req)));
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.cookie(req));
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Get('me')
  me(@CurrentUserParam() user: AuthenticatedUser): CurrentUser {
    return this.auth.me(user);
  }

  // ---------- Email verification ----------

  /** Following the emailed link confirms the address and signs them in. */
  @Public()
  @Throttle(LIMIT.verify)
  @HttpCode(200)
  @Post('verify-email')
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.verifyEmail(body.token, this.meta(req)));
  }

  @Throttle(LIMIT.resend)
  @HttpCode(204)
  @Post('verify-email/resend')
  resendVerification(@CurrentUserParam() user: AuthenticatedUser): Promise<void> {
    return this.auth.requestVerification(user);
  }

  // ---------- Password reset ----------

  /** Always 204: whether an address has an account is not ours to disclose. */
  @Public()
  @Throttle(LIMIT.forgot)
  @HttpCode(204)
  @Post('forgot-password')
  forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput): Promise<void> {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Throttle(LIMIT.reset)
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.resetPassword(body.token, body.password, this.meta(req)));
  }

  /** Sets the refresh cookie and strips it from the JSON body. */
  private respond(res: Response, issued: IssuedTokens): AuthResponse {
    const { refreshToken, refreshExpiresAt, ...body } = issued;
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      expires: refreshExpiresAt,
    });
    return body;
  }

  private cookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_COOKIE];
  }

  private meta(req: Request) {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }
}
