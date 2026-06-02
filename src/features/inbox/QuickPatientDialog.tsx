import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Link2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversacionId: string;
  identidadCanalId: string;
  clinicId: string;
  contactoPrecargado: string;
  displayName: string | null;
  motivoInicial?: string | null;
  onLinked: (patientId: string) => void;
}

interface PatientMatch {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
}

function splitName(full: string): { nombre: string; apellidos: string } {
  const parts = (full || "").trim().split(/\s+/);
  if (parts.length === 0) return { nombre: "", apellidos: "" };
  if (parts.length === 1) return { nombre: parts[0], apellidos: "" };
  return { nombre: parts[0], apellidos: parts.slice(1).join(" ") };
}

export function QuickPatientDialog({
  open, onOpenChange, conversacionId, identidadCanalId, clinicId,
  contactoPrecargado, displayName, motivoInicial, onLinked,
}: Props) {
  const initial = splitName(displayName ?? "");
  const [nombre, setNombre] = useState(initial.nombre);
  const [apellidos, setApellidos] = useState(initial.apellidos);
  const [telefono, setTelefono] = useState(contactoPrecargado || "");
  const [fechaNac, setFechaNac] = useState("");
  const [sexo, setSexo] = useState<string>("");
  const [alergias, setAlergias] = useState("");
  const [motivo, setMotivo] = useState(motivoInicial ?? "");
  const [matches, setMatches] = useState<PatientMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const i = splitName(displayName ?? "");
    setNombre(i.nombre);
    setApellidos(i.apellidos);
    setTelefono(contactoPrecargado || "");
    setMotivo(motivoInicial ?? "");
    setFechaNac(""); setSexo(""); setAlergias("");
  }, [open, displayName, contactoPrecargado, motivoInicial]);

  // Buscar coincidencias por teléfono o nombre/apellidos
  useEffect(() => {
    if (!open) return;
    const tel = telefono.replace(/\D/g, "");
    const term = `${nombre} ${apellidos}`.trim();
    if (tel.length < 6 && term.length < 3) { setMatches([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      let q = supabase
        .from("patients")
        .select("id, nombre, apellidos, telefono, fecha_nacimiento")
        .eq("clinic_id", clinicId)
        .eq("activo", true)
        .limit(8);
      const filters: string[] = [];
      if (tel.length >= 6) filters.push(`telefono.ilike.%${tel}%`);
      if (nombre.trim().length >= 2) filters.push(`nombre.ilike.%${nombre.trim()}%`);
      if (apellidos.trim().length >= 2) filters.push(`apellidos.ilike.%${apellidos.trim()}%`);
      if (filters.length) q = q.or(filters.join(","));
      const { data } = await q;
      setMatches((data ?? []) as PatientMatch[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [open, telefono, nombre, apellidos, clinicId]);

  const linkPatient = async (patientId: string, audit: "paciente_creado_inbox" | "paciente_vinculado_inbox") => {
    // Vincular en identidades_canal y en conversaciones
    const { error: e1 } = await supabase
      .from("identidades_canal")
      .update({ patient_id: patientId })
      .eq("id", identidadCanalId);
    if (e1) { toast.error("No se pudo vincular identidad: " + e1.message); return false; }

    await supabase.from("audit_logs").insert({
      tabla: "conversaciones",
      registro_id: conversacionId,
      accion: audit,
      datos_nuevos: { patient_id: patientId, identidad_canal_id: identidadCanalId },
      clinic_id: clinicId,
    });
    return true;
  };

  const asociar = async (p: PatientMatch) => {
    setSaving(true);
    const ok = await linkPatient(p.id, "paciente_vinculado_inbox");
    setSaving(false);
    if (!ok) return;
    toast.success(`Paciente ${p.nombre} ${p.apellidos} asociado`);
    onLinked(p.id);
    onOpenChange(false);
  };

  const crear = async () => {
    if (!nombre.trim() || !apellidos.trim()) { toast.error("Nombre y apellidos son obligatorios"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("patients")
      .insert({
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        telefono: telefono.trim() || null,
        fecha_nacimiento: fechaNac || null,
        sexo: sexo || null,
        alergias: alergias.trim() || null,
        notas: motivo.trim() ? `Motivo inicial (Inbox): ${motivo.trim()}` : null,
        clinic_id: clinicId,
      })
      .select("id")
      .single();
    if (error || !data) {
      setSaving(false);
      toast.error("No se pudo crear el paciente: " + (error?.message ?? ""));
      return;
    }
    const ok = await linkPatient(data.id, "paciente_creado_inbox");
    setSaving(false);
    if (!ok) return;
    toast.success("Paciente creado y asociado");
    onLinked(data.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear o asociar paciente</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Apellidos *</Label>
            <Input value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono / contacto</Label>
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+52..." />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha de nacimiento</Label>
            <Input type="date" value={fechaNac} onChange={(e) => setFechaNac(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sexo</Label>
            <Select value={sexo} onValueChange={setSexo}>
              <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="femenino">Femenino</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Alergias</Label>
            <Input value={alergias} onChange={(e) => setAlergias(e.target.value)} placeholder="Penicilina, AINEs..." />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Motivo inicial</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>

        {(matches.length > 0 || searching) && (
          <div className="mt-2 border border-border rounded-lg p-3 bg-muted/30">
            <p className="text-xs font-semibold mb-2 text-muted-foreground">
              Posibles coincidencias {searching && "(buscando...)"}
            </p>
            <div className="space-y-2">
              {matches.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 bg-card border border-border rounded-md p-2">
                  <div className="text-xs min-w-0">
                    <p className="font-medium truncate">{m.nombre} {m.apellidos}</p>
                    <p className="text-muted-foreground truncate">
                      {m.telefono ?? "sin teléfono"}{m.fecha_nacimiento ? ` · ${m.fecha_nacimiento}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => asociar(m)} disabled={saving}>
                    <Link2 className="h-3.5 w-3.5 mr-1" /> Asociar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={crear} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
            Crear paciente nuevo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
