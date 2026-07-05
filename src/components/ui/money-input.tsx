import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function sanitizeMoneyText(raw: string): string {
  let cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  const [intPart, decPart] = cleaned.split(".");
  if (decPart !== undefined) {
    cleaned = `${intPart}.${decPart.slice(0, 2)}`;
  }
  return cleaned;
}

interface MoneyInputProps
  extends Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> {
  value: string;
  onValueChange: (raw: string) => void;
  onBlurFormat?: boolean;
}

/** Text input for money amounts: no spinner arrows, allows "300" -> 300 (not 3.00). */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, onBlurFormat = true, className, onBlur, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(className)}
        value={value}
        onChange={(e) => onValueChange(sanitizeMoneyText(e.target.value))}
        onBlur={(e) => {
          if (onBlurFormat && e.target.value !== "") {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onValueChange(n.toFixed(2));
          }
          onBlur?.(e);
        }}
        {...props}
      />
    );
  },
);
MoneyInput.displayName = "MoneyInput";
