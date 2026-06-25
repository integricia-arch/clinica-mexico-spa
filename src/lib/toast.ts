import { toast as sonnerToast } from "sonner";

type SonnerToastOptions = Parameters<typeof sonnerToast>[1];

function withCopyAction(message: string, options?: SonnerToastOptions): SonnerToastOptions {
  return {
    action: {
      label: "Copiar",
      onClick: () => void navigator.clipboard.writeText(message),
    },
    ...options,
  };
}

export const toast = Object.assign(
  (message: string, options?: SonnerToastOptions) => sonnerToast(message, options),
  {
    ...sonnerToast,
    error: (message: string, options?: SonnerToastOptions) =>
      sonnerToast.error(message, withCopyAction(message, options)),
    warning: (message: string, options?: SonnerToastOptions) =>
      sonnerToast.warning(message, withCopyAction(message, options)),
  }
);
