import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  loginSchema,
  registerSchema,
  type AuthResponse,
  type CurrentUser,
  type LoginInput,
  type RegisterInput,
} from '@reserivo/shared';
import type { Request, Response } from 'express';
import { CurrentUser as CurrentUserParam } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { Env } from '../config/env.js';
import { AuthService, type IssuedTokens } from './auth.service.js';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH, type AuthenticatedUser } from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.register(body, this.meta(req)));
  }

  @Public()
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
