import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Supervisor {
  user_id: string;
  email: string;
  full_name: string;
  has_pin: boolean;
}

interface Props {
  open: boolean;
  turnoId: string;
  cashCount: number;
  notes: string;
  diff: number;
  umbral: number;
  clinicId: string;
  mode?: "turno" | "pharmacy";
  onSuccess: (result: unknown) => void;
  onCancel: () => void;
}

const fmt = (n: number) =>
  Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function SupervisorAuthDialog({
  open, turnoId, cashCount, notes, diff, umbral, clinicId,
  mode = "turno",
  onSuccess, onCancel,
}: Props) {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !clinicId) return;
    setSupervisors([]);
    setSelectedId("");
    setPin("");
    setPassword("");
    setError(null);

    supabase
      .rpc("get_clinic_supervisors", { p_clinic_id: clinicId })
      .then(({ data, error: e }) => {
        if (e) { setError("No se pudieron cargar los supervisores"); return; }
        setSupervisors((data ?? []) as Supervisor[]);
      });
  }, [open, clinicId]);

  const selected = supervisors.find((s) => s.user_id === selectedId) ?? null;

  async function handleSubmit() {
    if (!selected) { setError("Selecciona un supervisor"); return; }
    setError(null);
    setSubmitting(true);

    if (selected.has_pin) {
      if (!pin || !/^\d{4,6}$/.test(pin)) {
        setError("PIN debe ser 4-6 dígitos numéricos");
        setSubmitting(false);
        return;
      }
      const rpcName = mode === "pharmacy" ? "pharmacy_close_shift_with_pin" : "turno_close_with_pin";
      const rpcParams = mode === "pharmacy"
        ? { p_shift_id: turnoId, p_supervisor_id: selected.user_id, p_pin: pin, p_cash_count: cashCount, p_notes: notes || null }
        : { p_turno_id: turnoId, p_supervisor_id: selected.user_id, p_pin: pin, p_cash_count: cashCount, p_notes: notes || null };
      const { data, error: e } = await supabase.rpc(rpcName, rpcParams as never);
      setSubmitting(false);
      if (e) {
        if (e.message?.includes("PIN_INCORRECT")) setError("PIN incorrecto");
        else if (e.message?.includes("PIN_NOT_CONFIGURED")) setError("PIN no configurado. Usa contraseña.");
        else setError(e.message);
        return;
      }
      toast.success("Turno cerrado con autorización de supervisor");
      onSuccess(data);
    } else {
      if (!password) { setError("Ingresa la contraseña del supervisor"); setSubmitting(false); return; }
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: selected.email,
        password,
      });
      if (authErr) {
        setError("Contraseña incorrecta");
        setSubmitting(false);
        return;
      }
      let closeData: unknown;
      let closeErr: { message: string } | null;
      if (mode === "pharmacy") {
        const res = await supabase.rpc("pharmacy_close_shift", {
          p_shift_id: turnoId,
          p_cash_count: cashCount,
          p_notes: notes || null,
          p_supervisor_override: true,
          p_supervisor_id: selected.user_id,
        } as never);
        closeData = res.data;
        closeErr = res.error;
      } else {
        const res = await supabase.rpc("turno_close", {
          p_turno_id: turnoId,
          p_cash_count: cashCount,
          p_notes: notes || null,
          p_supervisor_override: true,
          p_supervisor_id: selected.user_id,
        } as never);
        closeData = res.data;
        closeErr = res.error;
      }
      setSubmitting(false);
      if (closeErr) { setError(closeErr.message); return; }
      toast.success("Turno cerrado con autorización de supervisor");
      onSuccess(closeData);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            Autorización de supervisor requerida
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/8 p-3 text-sm space-y-1">
            <p className="font-medium text-amber-700">
              Diferencia {fmt(diff)} excede umbral {fmt(umbral)}
            </p>
            <p className="text-xs text-muted-foreground">
              Se requiere autorización de un supervisor para cerrar el turno.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Supervisor</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un supervisor…" />
              </SelectTrigger>
              <SelectContent>
                {supervisors.map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>
                    <span className="flex items-center gap-2">
                      {s.full_name}
                      {!s.has_pin && (
                        <span className="text-xs text-amber-600">(sin PIN)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
                {supervisors.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    No hay supervisores configurados
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selected?.has_pin && (
            <div className="space-y-1.5">
              <Label htmlFor="sup-pin">PIN de autorización</Label>
              <Input
                id="sup-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="4-6 dígitos"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </div>
          )}

          {selected && !selected.has_pin && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertCircle className="h-3.5 w-3.5" />
                Este supervisor no tiene PIN configurado. Ingresa su contraseña de sesión.
              </div>
              <Label htmlFor="sup-pw">Contraseña del supervisor</Label>
              <Input
                id="sup-pw"
                type="password"
                placeholder="Contraseña de acceso"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedId}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {submitting ? "Verificando…" : "Autorizar y cerrar turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
