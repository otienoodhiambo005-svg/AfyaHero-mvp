import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
  beforeSend(event) {
    // Client side PII scrubbing
    if (event.user) {
      delete event.user.email;
      delete event.user.phone;
      delete event.user.ip_address;
      delete event.user.username;
    }

    // Remove all request body data
    if (event.request?.data) {
      event.request.data = '[REDACTED]';
    }

    return event;
  },
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});