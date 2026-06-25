import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button
      onClick={copy}
      className="shrink-0 rounded p-1 opacity-60 hover:opacity-100 transition-opacity"
      title="Copiar error"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isDestructive = props.variant === "destructive";
        const copyText = [title, description]
          .filter(Boolean)
          .map(String)
          .join("\n");

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1 flex-1 min-w-0">
              {title && <ToastTitle className="select-text">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="select-text">{description}</ToastDescription>
              )}
            </div>
            {action}
            {isDestructive && copyText && <CopyButton text={copyText} />}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
