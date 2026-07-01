import { createContext, useContext, useState, useCallback } from "react";

export interface ComprasCtx {
  solicitud_id?: string;
  solicitud_folio?: string;
  cotizacion_id?: string;
  orden_id?: string;
  orden_folio?: string;
  recepcion_id?: string;
}

interface ComprasNavState {
  tab: string;
  ctx: ComprasCtx;
  navigateTo: (tab: string, data?: ComprasCtx) => void;
  clearCtx: () => void;
}

const ComprasNavContext = createContext<ComprasNavState>({
  tab: "dashboard",
  ctx: {},
  navigateTo: () => {},
  clearCtx: () => {},
});

export function ComprasNavProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState("dashboard");
  const [ctx, setCtx] = useState<ComprasCtx>({});

  const navigateTo = useCallback((nextTab: string, data: ComprasCtx = {}) => {
    setCtx(data);
    setTab(nextTab);
  }, []);

  const clearCtx = useCallback(() => setCtx({}), []);

  return (
    <ComprasNavContext.Provider value={{ tab, ctx, navigateTo, clearCtx }}>
      {children}
    </ComprasNavContext.Provider>
  );
}

export function useComprasNav() {
  return useContext(ComprasNavContext);
}
