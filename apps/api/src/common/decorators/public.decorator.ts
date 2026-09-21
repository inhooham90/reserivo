import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as reachable without a JWT. The global JwtAuthGuard honours it. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
