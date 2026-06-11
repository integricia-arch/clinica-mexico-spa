import { useCallback, useEffect, useState } from "react";
import { useIsTablet } from "./use-mobile";

const STORAGE_KEY = "sidebar-collapsed";

export function useSidebarState() {
  const isTablet = useIsTablet();

  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Close drawer when switching to desktop
  useEffect(() => {
    if (!isTablet) setIsOpen(false);
  }, [isTablet]);

  const toggle = useCallback(() => {
    if (isTablet) {
      setIsOpen((v) => !v);
    } else {
      setIsCollapsed((v) => {
        const next = !v;
        try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
        return next;
      });
    }
  }, [isTablet]);

  const close = useCallback(() => setIsOpen(false), []);
  const openDrawer = useCallback(() => setIsOpen(true), []);

  return { isOpen, isCollapsed, toggle, close, openDrawer, isTablet };
}
