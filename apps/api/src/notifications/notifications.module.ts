import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { LogTransport, NotificationsService, ResendTransport } from './notifications.service.js';
import { NOTIFICATION_TRANSPORT } from './notifications.types.js';

@Global()
@Module({
  providers: [
    LogTransport,
    {
      // Real email only when a key is configured; dev and tests just log.
      provide: NOTIFICATION_TRANSPORT,
      inject: [ConfigService, LogTransport],
      useFactory: (config: ConfigService<Env, true>, log: LogTransport) => {
        if (config.get('RESEND_API_KEY')) {
          Logger.log('Email via Resend', 'Notifications');
          return new ResendTransport(config);
        }
        Logger.log('No RESEND_API_KEY — notifications are logged only', 'Notifications');
        return log;
      },
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
