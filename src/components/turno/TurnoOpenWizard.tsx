import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Wallet, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { OpenTurno } from "@/components/TurnoGuard";
import DenominacionCounter, { type DenomBreakdown } from "@/components/turno/DenominacionCounter";

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

type Step = "select-caja" | "conteo" | "diff" | "confirm";

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
  const [conteo, setConteo] = useState("");
  const [denomBreakdown, setDenomBreakdown] = useState<DenomBreakdown>({});
  const [fondoEsperado, setFondoEsperado] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>("conteo");

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
      setStep("conteo");
    } else {
      setStep("select-caja");
    }
    setLoading(false);
  }

  async function onCajaSelect(id: string) {
    setCajaId(id);
    setStep("conteo");
  }

  async function onConteoConfirm() {
    const montoContado = Number(conteo);
    if (isNaN(montoContado) || montoContado < 0) { toast.error("Monto inválido"); return; }

    // Buscar fondo_siguiente_turno del último corte Z de esta caja
    const { data: ultimoCorte } = await (supabase as any)
      .from("cortes")
      .select("fondo_siguiente_turno")
      .eq("caja_id", cajaId)
      .not("fondo_siguiente_turno", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const esperado: number | null = ultimoCorte?.fondo_siguiente_turno ?? null;
    setFondoEsperado(esperado);
    setStep("diff");
  }

  async function openTurno() {
    if (!cajaId || !activeClinic?.id || !user?.id) return;
    const montoContado = Number(conteo);
    if (isNaN(montoContado) || montoContado < 0) { toast.error("Monto inválido"); return; }
    setSaving(true);

    const { data: newTurno, error } = await supabase
      .from("turnos")
      .insert({
        clinic_id: activeClinic.id,
        caja_id: cajaId,
        cajero_user_id: user.id,
        monto_apertura: montoContado,
        conteo_apertura: montoContado,
        fondo_esperado: fondoEsperado ?? null,
        denominaciones_apertura: Object.keys(denomBreakdown).length > 0 ? denomBreakdown : null,
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
        p_opening_amount: montoContado,
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
      monto_apertura: montoContado,
      abierto_at: newTurno.abierto_at,
      pharmacy_shift_id: pharmacyShiftId,
      es_farmacia: caja.es_farmacia,
    });
  }

  const caja = cajas.find((c) => c.id === cajaId);
  const multiCaja = cajas.length > 1;
  const montoContado = Number(conteo || 0);
  const diferencia = fondoEsperado !== null ? montoContado - fondoEsperado : null;
  const difAbsoluta = diferencia !== null ? Math.abs(diferencia) : 0;
  const difCritica = difAbsoluta > 100;

  const stepLabels: Step[] = multiCaja
    ? ["select-caja", "conteo", "diff", "confirm"]
    : ["conteo", "diff", "confirm"];
  const stepIndex = stepLabels.indexOf(step);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (cajas.length === 0) {
    return <CajaQuickSetup cajaFilter={cajaFilter} clinicId={activeClinic!.id} onCreated={loadCajas} />;
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background p-6">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
          <Heart className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-display text-xl font-bold text-foreground">ClínicaMX</h1>
      </div>

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        {stepLabels.map((s, i) => {
          const labels: Record<Step, string> = {
            "select-caja": "Caja",
            "conteo": "Conteo",
            "diff": "Verificar",
            "confirm": "Confirmar",
          };
          return (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span>›</span>}
              <span className={stepIndex === i ? "font-semibold text-primary" : stepIndex > i ? "text-green-600" : "opacity-50"}>
                {i + 1}. {labels[s]}
              </span>
            </span>
          );
        })}
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-card space-y-5">

        {/* PASO: Seleccionar caja */}
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
                      {c.es_farmacia ? "Caja farmacia" : "Caja general"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* PASO: Conteo ciego */}
        {step === "conteo" && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Conteo de apertura</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Cuenta el efectivo físico en caja <strong>sin ver el monto esperado</strong>.
              </p>
              {caja && <p className="mt-1 text-xs font-medium text-primary">{caja.nombre}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conteo-input">Efectivo contado (MXN)</Label>
              <Input
                id="conteo-input"
                type="number"
                min={0}
                step="0.01"
                value={conteo}
                onChange={(e) => { setConteo(e.target.value); setDenomBreakdown({}); }}
                className="h-12 text-xl font-semibold text-center"
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              Conteo ciego: ingresa el efectivo real. El monto esperado se mostrará en el siguiente paso.
            </div>
            <DenominacionCounter
              onTotal={(total, breakdown) => {
                setConteo(String(total));
                setDenomBreakdown(breakdown);
              }}
            />
            <Button
              onClick={onConteoConfirm}
              className="w-full"
              size="lg"
              disabled={!conteo || Number(conteo) < 0}
            >
              Verificar →
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

        {/* PASO: Diferencia vs fondo esperado */}
        {step === "diff" && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Verificación de fondo</h2>
              <p className="text-sm text-muted-foreground mt-1">Resultado del conteo vs. fondo del turno anterior.</p>
            </div>

            <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contado por ti</span>
                <span className="font-bold text-lg">{fmt(montoContado)}</span>
              </div>
              {fondoEsperado !== null ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fondo esperado (Z anterior)</span>
                    <span className="font-medium">{fmt(fondoEsperado)}</span>
                  </div>
                  <div className={`flex justify-between border-t pt-2 ${difCritica ? "text-destructive" : diferencia === 0 ? "text-green-600" : "text-yellow-600"}`}>
                    <span className="font-semibold">Diferencia</span>
                    <span className="font-bold">
                      {diferencia! > 0 ? "+" : ""}{fmt(diferencia!)}
                    </span>
                  </div>
                  {difCritica && (
                    <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>Diferencia mayor a $100. Quedará registrada para revisión del supervisor.</span>
                    </div>
                  )}
                  {!difCritica && diferencia !== 0 && (
                    <p className="text-xs text-yellow-600">Diferencia menor registrada. Puedes continuar.</p>
                  )}
                  {diferencia === 0 && (
                    <p className="text-xs text-green-600">✓ Fondo cuadrado exacto.</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sin turno anterior — primer turno de esta caja.</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("conteo")} className="flex-1">
                ← Recontar
              </Button>
              <Button onClick={() => setStep("confirm")} className="flex-1">
                Continuar →
              </Button>
            </div>
          </>
        )}

        {/* PASO: Confirmar */}
        {step === "confirm" && caja && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Confirmar apertura</h2>
              <p className="text-sm text-muted-foreground mt-1">Revisa los datos antes de abrir el turno.</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caja</span>
                <span className="font-medium">{caja.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fondo contado</span>
                <span className="font-semibold text-green-600">{fmt(montoContado)}</span>
              </div>
              {fondoEsperado !== null && diferencia !== 0 && (
                <div className={`flex justify-between ${difCritica ? "text-destructive" : "text-yellow-600"}`}>
                  <span>Diferencia</span>
                  <span className="font-semibold">{diferencia! > 0 ? "+" : ""}{fmt(diferencia!)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha</span>
                <span>
                  {new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
            <Button onClick={openTurno} className="w-full" size="lg" disabled={saving}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {saving ? "Abriendo turno…" : "Abrir turno y comenzar"}
            </Button>
            <button
              onClick={() => setStep("diff")}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
            >
              ← Volver
            </button>
          </>
        )}
      </div>
    </div>
  );
}
