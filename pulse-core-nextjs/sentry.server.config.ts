import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
  beforeSend(event) {
    // Server side PII scrubbing
    if (event.request?.headers) {
      const sensitiveHeaders = ['cookie', 'authorization', 'x-api-key', 'token', 'session', 'apikey'];
      sensitiveHeaders.forEach(header => {
        if (event.request!.headers![header]) {
          event.request!.headers![header] = '[REDACTED]';
        }
      });
    }

    if (event.user) {
      delete event.user.email;
      delete event.user.phone;
      delete event.user.ip_address;
      delete event.user.username;
      // Keep only safe identifiers for multi tenant grouping
      event.user = {
        id: event.user.id,
        hospitalId: event.user.hospitalId,
        role: event.user.role
      };
    }

    return event;
  },
  integrations: [
    Sentry.prismaIntegration(),
  ],
});