import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Wallet, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { OpenTurno } from "@/components/TurnoGuard";

interface Caja {
  id: string;
  nombre: string;
  fondo_default: number;
  es_farmacia: boolean;
}

interface Props {
  cajaFilter?: "farmacia" | "general";
  onOpened: (turno: OpenTurno) => void;
}

type Step = "select-caja" | "fondo" | "confirm";

const fmt = (n: number) =>
  Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function CajaQuickSetup({
  cajaFilter,
  clinicId,
  onCreated,
}: {
  cajaFilter?: "farmacia" | "general";
  clinicId: string;
  onCreated: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [fondo, setFondo] = useState("0");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from("cajas").insert({
      clinic_id: clinicId,
      nombre: nombre.trim(),
      fondo_default: Number(fondo) || 0,
      es_farmacia: cajaFilter !== "general",
      activo: true,
    });
    setSaving(false);
    if (error) { toast.error(`Error al crear caja: ${error.message}`); return; }
    toast.success("Caja creada");
    onCreated();
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background p-6">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
          <Heart className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Configurar caja</h1>
        <p className="text-sm text-muted-foreground text-center">
          No hay cajas configuradas. Crea una para continuar.
        </p>
      </div>
      <form onSubmit={handleCreate} className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="caja-nombre">Nombre de la caja *</Label>
          <Input
            id="caja-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={cajaFilter === "general" ? "Ej: Caja General" : "Ej: Caja Farmacia"}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="caja-fondo">Fondo inicial sugerido (MXN)</Label>
          <Input
            id="caja-fondo"
            type="number"
            min={0}
            step="0.01"
            value={fondo}
            onChange={(e) => setFondo(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={saving || !nombre.trim()}>
          {saving ? "Creando…" : "Crear caja y continuar"}
        </Button>
      </form>
    </div>
  );
}

export default function TurnoOpenWizard({ cajaFilter, onOpened }: Props) {
  const { user } = useAuth();
  const { activeClinic } = useActiveClinic();
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [cajaId, setCajaId] = useState<string | null>(null);
  const [monto, setMonto] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>("fondo");

  useEffect(() => {
    if (!activeClinic?.id) return;
    loadCajas();
  }, [activeClinic?.id]);

  async function loadCajas() {
    setLoading(true);
    let q = (supabase as any)
      .from("cajas")
      .select("id, nombre, fondo_default, es_farmacia")
      .eq("clinic_id", activeClinic!.id)
      .eq("activo", true);
    if (cajaFilter === "farmacia") q = q.eq("es_farmacia", true);
    if (cajaFilter === "general") q = q.eq("es_farmacia", false);
    const { data } = await q;
    const rows = (data ?? []) as Caja[];
    setCajas(rows);
    if (rows.length === 1) {
      setCajaId(rows[0].id);
      setMonto(String(rows[0].fondo_default));
      setStep("fondo");
    } else {
      setStep("select-caja");
    }
    setLoading(false);
  }

  function onCajaSelect(id: string) {
    setCajaId(id);
    const found = cajas.find((c) => c.id === id);
    if (found) setMonto(String(found.fondo_default));
    setStep("fondo");
  }

  async function openTurno() {
    if (!cajaId || !activeClinic?.id || !user?.id) return;
    const amount = Number(monto);
    if (isNaN(amount) || amount < 0) { toast.error("Monto inválido"); return; }
    setSaving(true);

    const { data: newTurno, error } = await supabase
      .from("turnos")
      .insert({
        clinic_id: activeClinic.id,
        caja_id: cajaId,
        cajero_user_id: user.id,
        monto_apertura: amount,
        estado: "abierto",
      })
      .select("id, caja_id, estado, monto_apertura, abierto_at, pharmacy_shift_id")
      .single();

    if (error) { setSaving(false); toast.error(`Error: ${error.message}`); return; }

    const caja = cajas.find((c) => c.id === cajaId)!;
    let pharmacyShiftId = newTurno.pharmacy_shift_id;

    if (caja.es_farmacia) {
      const { data: shiftId, error: shiftErr } = await supabase.rpc("pharmacy_open_shift", {
        p_clinic_id: activeClinic.id,
        p_opening_amount: amount,
        p_notes: null,
      } as never);
      if (!shiftErr && shiftId) {
        await supabase.from("turnos").update({ pharmacy_shift_id: shiftId }).eq("id", newTurno.id);
        pharmacyShiftId = shiftId as string;
      } else if (shiftErr) {
        toast.warning(`Turno abierto, pero error en turno POS Farmacia: ${shiftErr.message}`);
      }
    }

    setSaving(false);
    onOpened({
      id: newTurno.id,
      caja_id: cajaId,
      caja_nombre: caja.nombre,
      estado: "abierto",
      monto_apertura: amount,
      abierto_at: newTurno.abierto_at,
      pharmacy_shift_id: pharmacyShiftId,
      es_farmacia: caja.es_farmacia,
    });
  }

  const caja = cajas.find((c) => c.id === cajaId);
  const multiCaja = cajas.length > 1;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (cajas.length === 0) {
    return <CajaQuickSetup
      cajaFilter={cajaFilter}
      clinicId={activeClinic!.id}
      onCreated={loadCajas}
    />;
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background p-6">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
          <Heart className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-display text-xl font-bold text-foreground">ClínicaMX</h1>
      </div>

      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        {multiCaja && (
          <>
            <span className={step === "select-caja" ? "font-semibold text-primary" : "opacity-50"}>
              1. Caja
            </span>
            <span>›</span>
          </>
        )}
        <span className={step === "fondo" ? "font-semibold text-primary" : step === "confirm" ? "opacity-50" : ""}>
          {multiCaja ? "2." : "1."} Fondo
        </span>
        <span>›</span>
        <span className={step === "confirm" ? "font-semibold text-primary" : ""}>
          {multiCaja ? "3." : "2."} Confirmar
        </span>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-card space-y-5">

        {step === "select-caja" && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Selecciona tu caja</h2>
              <p className="text-sm text-muted-foreground mt-1">¿En qué caja vas a trabajar hoy?</p>
            </div>
            <div className="space-y-2">
              {cajas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onCajaSelect(c.id)}
                  className="w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Wallet className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      Fondo sugerido: {fmt(c.fondo_default)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === "fondo" && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Fondo de apertura</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Cuenta el efectivo en caja antes de comenzar.
              </p>
              {caja && (
                <p className="mt-1 text-xs font-medium text-primary">{caja.nombre}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fondo-input">Efectivo en caja (MXN)</Label>
              <Input
                id="fondo-input"
                type="number"
                min={0}
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="h-12 text-xl font-semibold text-center"
                autoFocus
              />
            </div>
            <Button onClick={() => setStep("confirm")} className="w-full" size="lg">
              Continuar →
            </Button>
            {multiCaja && (
              <button
                onClick={() => setStep("select-caja")}
                className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
              >
                ← Cambiar caja
              </button>
            )}
          </>
        )}

        {step === "confirm" && caja && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Confirmar apertura</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Revisa los datos antes de abrir el turno.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caja</span>
                <span className="font-medium">{caja.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fondo inicial</span>
                <span className="font-semibold text-green-600">{fmt(Number(monto))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha</span>
                <span>
                  {new Date().toLocaleDateString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
            <Button onClick={openTurno} className="w-full" size="lg" disabled={saving}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {saving ? "Abriendo turno…" : "Abrir turno y comenzar"}
            </Button>
            <button
              onClick={() => setStep("fondo")}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
            >
              ← Editar fondo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
