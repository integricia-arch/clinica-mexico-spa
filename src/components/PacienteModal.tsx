import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

type FormState = {
  nombre: string;
  apellidos: string;
  fecha_nacimiento: string;
  sexo: string;
  curp: string;
  rfc: string;
  telefono: string;
  email: string;
  direccion: string;
  colonia: string;
  municipio: string;
  estado: string;
  codigo_postal: string;
  tipo_sangre: string;
  alergias: string;
  notas: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
};

const EMPTY_FORM: FormState = {
  nombre: "", apellidos: "", fecha_nacimiento: "", sexo: "",
  curp: "", rfc: "", telefono: "", email: "",
  direccion: "", colonia: "", municipio: "", estado: "",
  codigo_postal: "", tipo_sangre: "", alergias: "", notas: "",
  contacto_emergencia_nombre: "", contacto_emergencia_telefono: "",
};

interface Props {
  open: boolean;
  onClose: () => void;
  patient?: Patient | null;
  onSaved: (p: Patient) => void;
}

export default function PacienteModal({ open, onClose, patient, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const isEdit = !!patient;

  useEffect(() => {
    if (patient) {
      setForm({
        nombre: patient.nombre ?? "",
        apellidos: patient.apellidos ?? "",
        fecha_nacimiento: patient.fecha_nacimiento ?? "",
        sexo: patient.sexo ?? "",
        curp: patient.curp ?? "",
        rfc: patient.rfc ?? "",
        telefono: patient.telefono ?? "",
        email: patient.email ?? "",
        direccion: patient.direccion ?? "",
        colonia: patient.colonia ?? "",
        municipio: patient.municipio ?? "",
        estado: patient.estado ?? "",
        codigo_postal: patient.codigo_postal ?? "",
        tipo_sangre: patient.tipo_sangre ?? "",
        alergias: patient.alergias ?? "",
        notas: patient.notas ?? "",
        contacto_emergencia_nombre: patient.contacto_emergencia_nombre ?? "",
        contacto_emergencia_telefono: patient.contacto_emergencia_telefono ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [patient, open]);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.nombre.trim() || !form.apellidos.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Nombre y apellidos son requeridos" });
      return;
    }

    setLoading(true);
    const payload = {
      nombre: form.nombre.trim(),
      apellidos: form.apellidos.trim(),
      fecha_nacimiento: form.fecha_nacimiento || null,
      sexo: form.sexo || null,
      curp: form.curp.toUpperCase() || null,
      rfc: form.rfc.toUpperCase() || null,
      telefono: form.telefono || null,
      email: form.email || null,
      direccion: form.direccion || null,
      colonia: form.colonia || null,
      municipio: form.municipio || null,
      estado: form.estado || null,
      codigo_postal: form.codigo_postal || null,
      tipo_sangre: form.tipo_sangre || null,
      alergias: form.alergias || null,
      notas: form.notas || null,
      contacto_emergencia_nombre: form.contacto_emergencia_nombre || null,
      contacto_emergencia_telefono: form.contacto_emergencia_telefono || null,
    };

    try {
      if (isEdit && patient) {
        const { data, error } = await supabase
          .from("patients")
          .update(payload)
          .eq("id", patient.id)
          .select()
          .single();
        if (error) throw error;
        toast({ title: "Paciente actualizado" });
        onSaved(data);
      } else {
        const { data, error } = await supabase
          .from("patients")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        toast({ title: "Paciente registrado" });
        onSaved(data);
      }
      onClose();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar paciente" : "Nuevo paciente"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Datos personales */}
          <Section title="Datos personales">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre *">
                <Input value={form.nombre} onChange={set("nombre")} placeholder="Juan" />
              </Field>
              <Field label="Apellidos *">
                <Input value={form.apellidos} onChange={set("apellidos")} placeholder="García López" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fecha de nacimiento">
                <Input type="date" value={form.fecha_nacimiento} onChange={set("fecha_nacimiento")} />
              </Field>
              <Field label="Sexo">
                <Select value={form.sexo} onValueChange={(v) => setForm((f) => ({ ...f, sexo: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CURP">
                <Input value={form.curp} onChange={set("curp")} placeholder="GARL900101HDFRCN01" className="uppercase" />
              </Field>
              <Field label="RFC">
                <Input value={form.rfc} onChange={set("rfc")} placeholder="GARL900101AB2" className="uppercase" />
              </Field>
            </div>
          </Section>

          {/* Contacto */}
          <Section title="Contacto">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Teléfono">
                <Input value={form.telefono} onChange={set("telefono")} placeholder="322 123 4567" />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={set("email")} placeholder="juan@email.com" />
              </Field>
            </div>
            <Field label="Dirección">
              <Input value={form.direccion} onChange={set("direccion")} placeholder="Calle, número" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Colonia">
                <Input value={form.colonia} onChange={set("colonia")} />
              </Field>
              <Field label="Municipio">
                <Input value={form.municipio} onChange={set("municipio")} />
              </Field>
              <Field label="Estado">
                <Input value={form.estado} onChange={set("estado")} />
              </Field>
            </div>
            <Field label="Código postal">
              <Input value={form.codigo_postal} onChange={set("codigo_postal")} className="max-w-[120px]" />
            </Field>
          </Section>

          {/* Clínico */}
          <Section title="Datos clínicos">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de sangre">
                <Select value={form.tipo_sangre} onValueChange={(v) => setForm((f) => ({ ...f, tipo_sangre: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Alergias">
              <Textarea value={form.alergias} onChange={set("alergias")} placeholder="Penicilina, látex..." rows={2} />
            </Field>
            <Field label="Notas">
              <Textarea value={form.notas} onChange={set("notas")} placeholder="Observaciones generales..." rows={2} />
            </Field>
          </Section>

          {/* Emergencia */}
          <Section title="Contacto de emergencia">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre">
                <Input value={form.contacto_emergencia_nombre} onChange={set("contacto_emergencia_nombre")} />
              </Field>
              <Field label="Teléfono">
                <Input value={form.contacto_emergencia_telefono} onChange={set("contacto_emergencia_telefono")} />
              </Field>
            </div>
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar paciente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
