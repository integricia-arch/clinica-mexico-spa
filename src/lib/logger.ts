import { Logtail } from "@logtail/browser";

const token = import.meta.env.VITE_BETTERSTACK_TOKEN as string | undefined;

const logtail = token ? new Logtail(token) : null;

type LogCtx = Record<string, unknown>;

function enrich(ctx?: LogCtx): LogCtx {
  return {
    app: "integriclinica",
    env: import.meta.env.MODE,
    url: window.location.pathname,
    ...ctx,
  };
}

export const logger = {
  info(msg: string, ctx?: LogCtx) {
    if (logtail) logtail.info(msg, enrich(ctx));
    else console.info(msg, ctx);
  },
  warn(msg: string, ctx?: LogCtx) {
    if (logtail) logtail.warn(msg, enrich(ctx));
    else console.warn(msg, ctx);
  },
  error(msg: string, ctx?: LogCtx) {
    if (logtail) logtail.error(msg, enrich(ctx));
    else console.error(msg, ctx);
  },
  flush() {
    return logtail?.flush();
  },
};

export function initGlobalErrorCapture() {
  window.addEventListener("error", (e) => {
    logger.error("Uncaught error", {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason instanceof Error
      ? { message: e.reason.message, stack: e.reason.stack }
      : { reason: String(e.reason) };
    logger.error("Unhandled promise rejection", reason);
  });
}
