import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import TurnoOpenWizard from "@/components/turno/TurnoOpenWizard";
import TurnoCloseWizard from "@/components/turno/TurnoCloseWizard";

export interface OpenTurno {
  id: string;
  caja_id: string;
  caja_nombre: string;
  estado: string;
  monto_apertura: number;
  abierto_at: string;
  pharmacy_shift_id: string | null;
  es_farmacia: boolean;
}

interface TurnoContextValue {
  openTurno: OpenTurno;
  initiateClose: () => void;
}

const TurnoContext = createContext<TurnoContextValue | null>(null);

export function useTurno(): TurnoContextValue | null {
  return useContext(TurnoContext);
}

type GuardState = "loading" | "no-turno" | "open" | "closing";

interface Props {
  children: React.ReactNode;
  cajaFilter?: "farmacia" | "general";
}

export default function TurnoGuard({ children, cajaFilter }: Props) {
  const { user, loading: authLoading } = useAuth();
  const { activeClinic, loading: clinicLoading } = useActiveClinic();
  const [state, setState] = useState<GuardState>("loading");
  const [openTurno, setOpenTurno] = useState<OpenTurno | null>(null);

  useEffect(() => {
    if (authLoading || clinicLoading) return;
    if (user?.id && activeClinic?.id) {
      checkTurno();
    } else {
      // Auth/clinic loaded but no clinic assigned — go straight to wizard
      setState("no-turno");
    }
  }, [user?.id, activeClinic?.id, authLoading, clinicLoading]);

  async function checkTurno() {
    setState("loading");
    const { data } = await (supabase as any)
      .from("turnos")
      .select("id, caja_id, estado, monto_apertura, abierto_at, pharmacy_shift_id, cajas(nombre, es_farmacia)")
      .eq("cajero_user_id", user!.id)
      .eq("clinic_id", activeClinic!.id)
      .eq("estado", "abierto")
      .maybeSingle();

    if (data) {
      const caja = data.cajas as { nombre: string; es_farmacia: boolean } | null;
      setOpenTurno({
        id: data.id,
        caja_id: data.caja_id,
        caja_nombre: caja?.nombre ?? "Caja",
        estado: data.estado,
        monto_apertura: data.monto_apertura,
        abierto_at: data.abierto_at,
        pharmacy_shift_id: data.pharmacy_shift_id,
        es_farmacia: caja?.es_farmacia ?? false,
      });
      setState("open");
    } else {
      setOpenTurno(null);
      setState("no-turno");
    }
  }

  if (state === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (state === "no-turno") {
    return (
      <TurnoOpenWizard
        cajaFilter={cajaFilter}
        onOpened={(t) => {
          setOpenTurno(t);
          setState("open");
        }}
      />
    );
  }

  if (state === "closing" && openTurno) {
    return (
      <TurnoCloseWizard
        turno={openTurno}
        onClosed={() => {
          setOpenTurno(null);
          setState("no-turno");
        }}
        onCancel={() => setState("open")}
      />
    );
  }

  return (
    <TurnoContext.Provider
      value={{
        openTurno: openTurno!,
        initiateClose: () => setState("closing"),
      }}
    >
      {children}
    </TurnoContext.Provider>
  );
}
