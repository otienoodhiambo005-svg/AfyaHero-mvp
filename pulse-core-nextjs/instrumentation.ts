import * as Sentry from '@sentry/nextjs';

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      debug: false,
      beforeSend(event) {
        // PII Scrubbing - remove sensitive fields completely
        if (event.request?.headers) {
          const sensitiveHeaders = ['cookie', 'authorization', 'x-api-key', 'token'];
          sensitiveHeaders.forEach(header => {
            if (event.request!.headers![header]) {
              event.request!.headers![header] = '[REDACTED]';
            }
          });
        }

        // Scrub user sensitive data
        if (event.user) {
          delete event.user.email;
          delete event.user.phone;
          delete event.user.ip_address;
        }

        return event;
      },
      integrations: [
        Sentry.prismaIntegration(),
      ],
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  }
}
