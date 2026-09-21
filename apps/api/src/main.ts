import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const isProduction = config.get('NODE_ENV') === 'production';

  // This is a JSON API, so the browser-facing parts of helmet (CSP, frame
  // options) belong to the web app; these are the ones that matter here.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cookieParser());

  // Behind a load balancer, req.ip must come from X-Forwarded-For or every
  // caller looks like the proxy and rate limiting collapses into one bucket.
  if (isProduction) app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.enableCors({
    origin: String(config.get('CORS_ORIGIN'))
      .split(',')
      .map((o: string) => o.trim()),
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = config.get('PORT');
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
