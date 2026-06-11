import { useCallback, useState } from "react";

export function useFieldErrors() {
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());

  const markErrors = useCallback((fields: string[]) => {
    setFieldErrors(new Set(fields));
    if (fields.length === 0) return;
    // Focus first invalid field
    setTimeout(() => {
      const el = document.getElementById(`field-${fields[0]}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
    }, 50);
  }, []);

  const clearError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }, []);

  const resetErrors = useCallback(() => setFieldErrors(new Set()), []);

  const errorClass = useCallback(
    (field: string) =>
      fieldErrors.has(field)
        ? "border-destructive focus-visible:ring-destructive"
        : "",
    [fieldErrors]
  );

  const hasError = useCallback(
    (field: string) => fieldErrors.has(field),
    [fieldErrors]
  );

  return { fieldErrors, markErrors, clearError, resetErrors, errorClass, hasError };
}
