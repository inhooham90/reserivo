import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { LogTransport, NotificationsService, ResendTransport } from './notifications.service.js';
import { NOTIFICATION_TRANSPORT } from './notifications.types.js';
import { LogSmsTransport, SMS_TRANSPORT, SmsService, TwilioSmsTransport } from './sms.service.js';

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
    LogSmsTransport,
    {
      provide: SMS_TRANSPORT,
      inject: [ConfigService, LogSmsTransport],
      useFactory: (config: ConfigService<Env, true>, log: LogSmsTransport) => {
        if (config.get('TWILIO_ACCOUNT_SID') && config.get('TWILIO_AUTH_TOKEN') && config.get('TWILIO_FROM_NUMBER')) {
          Logger.log('SMS via Twilio', 'Sms');
          return new TwilioSmsTransport(config);
        }
        Logger.log('Twilio not configured — reminders will be email only', 'Sms');
        return log;
      },
    },
    NotificationsService,
    SmsService,
  ],
  exports: [NotificationsService, SmsService],
})
export class NotificationsModule {}
