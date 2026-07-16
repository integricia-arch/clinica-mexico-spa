// src/components/turno/SupervisorPinDialog.tsx
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

interface Supervisor {
  user_id: string;
  email: string;
  full_name: string;
  has_pin: boolean;
}

interface Props {
  open: boolean;
  clinicId: string;
  title?: string;
  description?: string;
  onAuthorized: (supervisorId: string, pin: string) => void;
  onCancel: () => void;
}

export default function SupervisorPinDialog({
  open, clinicId, title = "Autorización de supervisor requerida",
  description = "Se requiere autorización de un supervisor para continuar.",
  onAuthorized, onCancel,
}: Props) {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !clinicId) return;
    setSupervisors([]);
    setSelectedId("");
    setPin("");
    setError(null);

    (supabase as any)
      .rpc("get_clinic_supervisors", { p_clinic_id: clinicId })
      .then(({ data, error: e }: { data: unknown; error: { message: string } | null }) => {
        if (e) { setError("No se pudieron cargar los supervisores"); return; }
        setSupervisors((data ?? []) as Supervisor[]);
      });
  }, [open, clinicId]);

  const selected = supervisors.find((s) => s.user_id === selectedId) ?? null;

  async function handleSubmit() {
    if (!selected) { setError("Selecciona un supervisor"); return; }
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      setError("PIN debe ser 4-6 dígitos numéricos");
      return;
    }
    if (!selected.has_pin) {
      setError("Este supervisor no tiene PIN configurado. Pide al administrador que le configure uno en Ajustes → Usuarios.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { error: e } = await (supabase as any).rpc("verify_supervisor_pin", {
      p_clinic_id: clinicId,
      p_supervisor_id: selected.user_id,
      p_pin: pin,
    });

    setSubmitting(false);
    if (e) {
      if (e.message?.includes("PIN_INCORRECT")) setError("PIN incorrecto");
      else if (e.message?.includes("PIN_NOT_CONFIGURED")) setError("PIN no configurado.");
      else setError(e.message);
      return;
    }
    onAuthorized(selected.user_id, pin);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-xs text-muted-foreground">{description}</p>

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

          {selected && (
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
            {submitting ? "Verificando…" : "Autorizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
