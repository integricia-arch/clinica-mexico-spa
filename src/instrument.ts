import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// Skip init if DSN not configured (local dev sin Sentry, CI sin secrets)
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,

    // Performance: 20% en producción para no agotar cuota (5M spans/mes gratis)
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,

    // Session replay: 5% normal, 100% en sesiones con error (50 replays/mes gratis)
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Datos médicos: enmascarar todo texto e inputs por defecto
        maskAllText: true,
        blockAllMedia: false,
      }),
    ],

    // PII: nunca enviar cuerpos de requests ni cookies (datos clínicos, tokens)
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
      }
      return event;
    },

    // Ignorar errores de red y extensiones del browser (falsos positivos comunes)
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error exception captured",
      /chrome-extension:\/\//,
      /moz-extension:\/\//,
    ],
  });
}
