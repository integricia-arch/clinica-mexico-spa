import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Printer, Save } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

type Antecedentes = {
  id?: string;
  patient_id: string;
  clinic_id?: string | null;
  hf_diabetes: boolean;
  hf_hipertension: boolean;
  hf_cardiopatia: boolean;
  hf_cancer: boolean;
  hf_obesidad: boolean;
  hf_nefropatia: boolean;
  hf_hepatopatia: boolean;
  hf_psiquiatricos: boolean;
  hf_notas: string;
  tabaquismo: string;
  tabaquismo_cigarros_dia: string;
  tabaquismo_anos: string;
  alcoholismo: string;
  alcoholismo_bebida: string;
  drogas: boolean;
  drogas_tipo: string;
  actividad_fisica: string;
  alimentacion: string;
  vivienda: string;
  escolaridad: string;
  ocupacion: string;
  estado_civil: string;
  enfermedades_previas: string;
  cirugias_previas: string;
  hospitalizaciones: string;
  fracturas_traumatismos: string;
  transfusiones: boolean;
  transfusiones_notas: string;
  inmunizaciones: string;
  menarca_edad: string;
  ritmo_menstrual: string;
  dismenorrea: boolean;
  ivsa_edad: string;
  num_parejas_sexuales: string;
  fum: string;
  fup: string;
  gestas: string;
  partos: string;
  cesareas: string;
  abortos: string;
  hijos_vivos: string;
  metodo_anticonceptivo: string;
  papanicolaou_fecha: string;
  mastografia_fecha: string;
};

type NotaConsulta = {
  id: string;
  fecha_consulta: string;
  subjetivo: string | null;
  objetivo: string | null;
  analisis: string | null;
  plan: string | null;
  diagnostico_principal: string | null;
};

type Prescripcion = {
  id: string;
  created_at: string;
  prescription_number: string | null;
  diagnosis: string | null;
  status: string | null;
};

const EMPTY_ANT = (patient_id: string, clinic_id: string | null): Antecedentes => ({
  patient_id, clinic_id,
  hf_diabetes: false, hf_hipertension: false, hf_cardiopatia: false, hf_cancer: false,
  hf_obesidad: false, hf_nefropatia: false, hf_hepatopatia: false, hf_psiquiatricos: false,
  hf_notas: "", tabaquismo: "nunca", tabaquismo_cigarros_dia: "", tabaquismo_anos: "",
  alcoholismo: "nunca", alcoholismo_bebida: "", drogas: false, drogas_tipo: "",
  actividad_fisica: "sedentario", alimentacion: "", vivienda: "", escolaridad: "", ocupacion: "", estado_civil: "",
  enfermedades_previas: "", cirugias_previas: "", hospitalizaciones: "", fracturas_traumatismos: "",
  transfusiones: false, transfusiones_notas: "", inmunizaciones: "",
  menarca_edad: "", ritmo_menstrual: "", dismenorrea: false, ivsa_edad: "", num_parejas_sexuales: "",
  fum: "", fup: "", gestas: "", partos: "", cesareas: "", abortos: "", hijos_vivos: "",
  metodo_anticonceptivo: "", papanicolaou_fecha: "", mastografia_fecha: "",
});

function calcEdad(fn: string | null): string {
  if (!fn) return "—";
  const hoy = new Date();
  const nac = new Date(fn);
  let age = hoy.getFullYear() - nac.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate())) age--;
  return `${age} años`;
}

function ST({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold uppercase tracking-wide text-primary border-b border-primary/30 pb-1 mt-6 mb-3 print:text-xs print:mt-4">{children}</h3>;
}

function F({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-1 text-sm print:text-xs">
      <span className="font-medium text-muted-foreground min-w-[140px]">{label}:</span>
      <span>{value || "—"}</span>
    </div>
  );
}

export default function ExpedienteElectronico() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { activeClinicId } = useActiveClinic();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [ant, setAnt] = useState<Antecedentes | null>(null);
  const [notas, setNotas] = useState<NotaConsulta[]>([]);
  const [recetas, setRecetas] = useState<Prescripcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    Promise.all([
      supabase.from("patients").select("*").eq("id", patientId).single(),
      supabase.from("antecedentes_clinicos").select("*").eq("patient_id", patientId).maybeSingle(),
      supabase.from("expedientes").select("id").eq("patient_id", patientId),
      supabase.from("prescriptions")
        .select("id,created_at,prescription_number,diagnosis,status")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]).then(async ([patRes, antRes, expRes, rxRes]) => {
      setPatient(patRes.data as Patient | null);

      if (antRes.data) {
        const d = antRes.data as Record<string, unknown>;
        setAnt({
          id: d.id as string, patient_id: patientId, clinic_id: d.clinic_id as string | null,
          hf_diabetes: !!d.hf_diabetes, hf_hipertension: !!d.hf_hipertension,
          hf_cardiopatia: !!d.hf_cardiopatia, hf_cancer: !!d.hf_cancer,
          hf_obesidad: !!d.hf_obesidad, hf_nefropatia: !!d.hf_nefropatia,
          hf_hepatopatia: !!d.hf_hepatopatia, hf_psiquiatricos: !!d.hf_psiquiatricos,
          hf_notas: (d.hf_notas as string) ?? "",
          tabaquismo: (d.tabaquismo as string) ?? "nunca",
          tabaquismo_cigarros_dia: d.tabaquismo_cigarros_dia != null ? String(d.tabaquismo_cigarros_dia) : "",
          tabaquismo_anos: d.tabaquismo_anos != null ? String(d.tabaquismo_anos) : "",
          alcoholismo: (d.alcoholismo as string) ?? "nunca",
          alcoholismo_bebida: (d.alcoholismo_bebida as string) ?? "",
          drogas: !!d.drogas, drogas_tipo: (d.drogas_tipo as string) ?? "",
          actividad_fisica: (d.actividad_fisica as string) ?? "sedentario",
          alimentacion: (d.alimentacion as string) ?? "", vivienda: (d.vivienda as string) ?? "",
          escolaridad: (d.escolaridad as string) ?? "", ocupacion: (d.ocupacion as string) ?? "",
          estado_civil: (d.estado_civil as string) ?? "",
          enfermedades_previas: (d.enfermedades_previas as string) ?? "",
          cirugias_previas: (d.cirugias_previas as string) ?? "",
          hospitalizaciones: (d.hospitalizaciones as string) ?? "",
          fracturas_traumatismos: (d.fracturas_traumatismos as string) ?? "",
          transfusiones: !!d.transfusiones, transfusiones_notas: (d.transfusiones_notas as string) ?? "",
          inmunizaciones: (d.inmunizaciones as string) ?? "",
          menarca_edad: d.menarca_edad != null ? String(d.menarca_edad) : "",
          ritmo_menstrual: (d.ritmo_menstrual as string) ?? "", dismenorrea: !!d.dismenorrea,
          ivsa_edad: d.ivsa_edad != null ? String(d.ivsa_edad) : "",
          num_parejas_sexuales: d.num_parejas_sexuales != null ? String(d.num_parejas_sexuales) : "",
          fum: (d.fum as string) ?? "", fup: (d.fup as string) ?? "",
          gestas: d.gestas != null ? String(d.gestas) : "",
          partos: d.partos != null ? String(d.partos) : "",
          cesareas: d.cesareas != null ? String(d.cesareas) : "",
          abortos: d.abortos != null ? String(d.abortos) : "",
          hijos_vivos: d.hijos_vivos != null ? String(d.hijos_vivos) : "",
          metodo_anticonceptivo: (d.metodo_anticonceptivo as string) ?? "",
          papanicolaou_fecha: (d.papanicolaou_fecha as string) ?? "",
          mastografia_fecha: (d.mastografia_fecha as string) ?? "",
        });
      } else {
        setAnt(EMPTY_ANT(patientId, activeClinicId));
      }

      setRecetas((rxRes.data as Prescripcion[]) ?? []);

      const expIds = (expRes.data ?? []).map((e: { id: string }) => e.id);
      if (expIds.length > 0) {
        const { data: nd } = await supabase
          .from("notas_consulta")
          .select("id,fecha_consulta,subjetivo,objetivo,analisis,plan,diagnostico_principal")
          .in("expediente_id", expIds)
          .order("fecha_consulta", { ascending: false })
          .limit(50);
        setNotas((nd as NotaConsulta[]) ?? []);
      }
      setLoading(false);
    });
  }, [patientId, activeClinicId]);

  async function guardar() {
    if (!ant || !patientId) return;
    setSaving(true);
    const payload = {
      patient_id: ant.patient_id, clinic_id: ant.clinic_id,
      hf_diabetes: ant.hf_diabetes, hf_hipertension: ant.hf_hipertension,
      hf_cardiopatia: ant.hf_cardiopatia, hf_cancer: ant.hf_cancer,
      hf_obesidad: ant.hf_obesidad, hf_nefropatia: ant.hf_nefropatia,
      hf_hepatopatia: ant.hf_hepatopatia, hf_psiquiatricos: ant.hf_psiquiatricos,
      hf_notas: ant.hf_notas || null,
      tabaquismo: ant.tabaquismo || null,
      tabaquismo_cigarros_dia: ant.tabaquismo_cigarros_dia ? parseInt(ant.tabaquismo_cigarros_dia) : null,
      tabaquismo_anos: ant.tabaquismo_anos ? parseInt(ant.tabaquismo_anos) : null,
      alcoholismo: ant.alcoholismo || null, alcoholismo_bebida: ant.alcoholismo_bebida || null,
      drogas: ant.drogas, drogas_tipo: ant.drogas_tipo || null,
      actividad_fisica: ant.actividad_fisica || null, alimentacion: ant.alimentacion || null,
      vivienda: ant.vivienda || null, escolaridad: ant.escolaridad || null,
      ocupacion: ant.ocupacion || null, estado_civil: ant.estado_civil || null,
      enfermedades_previas: ant.enfermedades_previas || null,
      cirugias_previas: ant.cirugias_previas || null,
      hospitalizaciones: ant.hospitalizaciones || null,
      fracturas_traumatismos: ant.fracturas_traumatismos || null,
      transfusiones: ant.transfusiones, transfusiones_notas: ant.transfusiones_notas || null,
      inmunizaciones: ant.inmunizaciones || null,
      menarca_edad: ant.menarca_edad ? parseInt(ant.menarca_edad) : null,
      ritmo_menstrual: ant.ritmo_menstrual || null, dismenorrea: ant.dismenorrea,
      ivsa_edad: ant.ivsa_edad ? parseInt(ant.ivsa_edad) : null,
      num_parejas_sexuales: ant.num_parejas_sexuales ? parseInt(ant.num_parejas_sexuales) : null,
      fum: ant.fum || null, fup: ant.fup || null,
      gestas: ant.gestas ? parseInt(ant.gestas) : null,
      partos: ant.partos ? parseInt(ant.partos) : null,
      cesareas: ant.cesareas ? parseInt(ant.cesareas) : null,
      abortos: ant.abortos ? parseInt(ant.abortos) : null,
      hijos_vivos: ant.hijos_vivos ? parseInt(ant.hijos_vivos) : null,
      metodo_anticonceptivo: ant.metodo_anticonceptivo || null,
      papanicolaou_fecha: ant.papanicolaou_fecha || null,
      mastografia_fecha: ant.mastografia_fecha || null,
    };
    if (ant.id) {
      await supabase.from("antecedentes_clinicos").update(payload).eq("id", ant.id);
    } else {
      const { data } = await supabase.from("antecedentes_clinicos").insert(payload).select("id").single();
      if (data) setAnt(prev => prev ? { ...prev, id: (data as { id: string }).id } : prev);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function upd<K extends keyof Antecedentes>(field: K, value: Antecedentes[K]) {
    setAnt(prev => prev ? { ...prev, [field]: value } : prev);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando expediente…</div>;
  if (!patient) return <div className="flex items-center justify-center h-64 text-muted-foreground">Paciente no encontrado</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card print:hidden sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Regresar
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={guardar} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar antecedentes"}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      <div ref={printRef} className="max-w-4xl mx-auto px-6 py-6 print:px-4 print:py-2">

        {/* Encabezado */}
        <div className="text-center mb-4 print:mb-2">
          <h1 className="text-xl font-bold print:text-lg">EXPEDIENTE CLÍNICO ELECTRÓNICO</h1>
          <p className="text-xs text-muted-foreground">NOM-004-SSA3-2012 · Generado: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}</p>
        </div>

        {/* I. Identificación */}
        <ST>I. Identificación del Paciente</ST>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 print:gap-y-0.5">
          <F label="Nombre completo" value={`${patient.nombre} ${patient.apellidos}`} />
          <F label="Fecha de nacimiento" value={patient.fecha_nacimiento ? format(new Date(patient.fecha_nacimiento), "dd/MM/yyyy", { locale: es }) : null} />
          <F label="Edad" value={calcEdad(patient.fecha_nacimiento)} />
          <F label="Sexo" value={patient.sexo} />
          <F label="CURP" value={patient.curp} />
          <F label="RFC" value={patient.rfc} />
          <F label="Tipo sanguíneo" value={patient.tipo_sangre} />
          <F label="Alergias conocidas" value={patient.alergias} />
          <F label="Teléfono" value={patient.telefono} />
          <F label="Email" value={patient.email} />
          <F label="Domicilio" value={[patient.direccion, patient.colonia, patient.municipio, patient.estado, patient.codigo_postal].filter(Boolean).join(", ")} />
          <F label="Contacto emergencia" value={patient.contacto_emergencia_nombre ? `${patient.contacto_emergencia_nombre} — ${patient.contacto_emergencia_telefono ?? ""}` : null} />
        </div>

        {ant && (
          <>
            {/* II. Heredofamiliares */}
            <ST>II. Antecedentes Heredofamiliares</ST>
            <div className="grid grid-cols-4 gap-2 mb-2 print:hidden">
              {([
                ["hf_diabetes","Diabetes"],["hf_hipertension","Hipertensión"],
                ["hf_cardiopatia","Cardiopatía"],["hf_cancer","Cáncer"],
                ["hf_obesidad","Obesidad"],["hf_nefropatia","Nefropatía"],
                ["hf_hepatopatia","Hepatopatía"],["hf_psiquiatricos","Psiquiátricos"],
              ] as [keyof Antecedentes, string][]).map(([f, l]) => (
                <label key={f} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={!!ant[f]} onCheckedChange={v => upd(f, !!v as Antecedentes[typeof f])} />
                  {l}
                </label>
              ))}
            </div>
            <p className="hidden print:block text-xs mb-1">
              {(["hf_diabetes","hf_hipertension","hf_cardiopatia","hf_cancer","hf_obesidad","hf_nefropatia","hf_hepatopatia","hf_psiquiatricos"] as (keyof Antecedentes)[])
                .filter(f => ant[f])
                .map(f => f.replace("hf_","").replace("_"," "))
                .join(", ") || "Sin antecedentes relevantes"}
            </p>
            <div className="print:hidden">
              <Label className="text-xs text-muted-foreground">Notas heredofamiliares</Label>
              <Textarea rows={2} value={ant.hf_notas} onChange={e => upd("hf_notas", e.target.value)} className="mt-1 text-sm" />
            </div>
            {ant.hf_notas && <p className="hidden print:block text-xs">{ant.hf_notas}</p>}

            {/* III. No patológicos */}
            <ST>III. Antecedentes Personales No Patológicos</ST>
            <div className="grid grid-cols-2 gap-4 print:hidden">
              <div>
                <Label className="text-xs text-muted-foreground">Tabaquismo</Label>
                <Select value={ant.tabaquismo} onValueChange={v => upd("tabaquismo", v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nunca">Nunca</SelectItem>
                    <SelectItem value="exfumador">Exfumador</SelectItem>
                    <SelectItem value="activo">Activo</SelectItem>
                  </SelectContent>
                </Select>
                {ant.tabaquismo !== "nunca" && (
                  <div className="flex gap-2 mt-1">
                    <Input placeholder="Cig/día" type="number" value={ant.tabaquismo_cigarros_dia} onChange={e => upd("tabaquismo_cigarros_dia", e.target.value)} className="h-8 text-sm" />
                    <Input placeholder="Años" type="number" value={ant.tabaquismo_anos} onChange={e => upd("tabaquismo_anos", e.target.value)} className="h-8 text-sm" />
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Alcoholismo</Label>
                <Select value={ant.alcoholismo} onValueChange={v => upd("alcoholismo", v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nunca">Nunca</SelectItem>
                    <SelectItem value="ocasional">Ocasional</SelectItem>
                    <SelectItem value="frecuente">Frecuente</SelectItem>
                    <SelectItem value="diario">Diario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Actividad física</Label>
                <Select value={ant.actividad_fisica} onValueChange={v => upd("actividad_fisica", v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentario">Sedentario</SelectItem>
                    <SelectItem value="leve">Leve</SelectItem>
                    <SelectItem value="moderada">Moderada</SelectItem>
                    <SelectItem value="intensa">Intensa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Estado civil</Label>
                <Input value={ant.estado_civil} onChange={e => upd("estado_civil", e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Escolaridad</Label>
                <Input value={ant.escolaridad} onChange={e => upd("escolaridad", e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ocupación</Label>
                <Input value={ant.ocupacion} onChange={e => upd("ocupacion", e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Checkbox id="drogas" checked={ant.drogas} onCheckedChange={v => upd("drogas", !!v)} />
                <Label htmlFor="drogas" className="text-sm cursor-pointer">Uso de drogas</Label>
                {ant.drogas && <Input placeholder="Tipo" value={ant.drogas_tipo} onChange={e => upd("drogas_tipo", e.target.value)} className="h-8 text-sm flex-1" />}
              </div>
            </div>
            <div className="hidden print:grid print:grid-cols-2 print:gap-x-8 print:gap-y-0.5">
              <F label="Tabaquismo" value={ant.tabaquismo + (ant.tabaquismo !== "nunca" && ant.tabaquismo_cigarros_dia ? ` (${ant.tabaquismo_cigarros_dia} cig/día, ${ant.tabaquismo_anos ?? 0} años)` : "")} />
              <F label="Alcoholismo" value={ant.alcoholismo} />
              <F label="Actividad física" value={ant.actividad_fisica} />
              <F label="Estado civil" value={ant.estado_civil} />
              <F label="Escolaridad" value={ant.escolaridad} />
              <F label="Ocupación" value={ant.ocupacion} />
              {ant.drogas && <F label="Drogas" value={ant.drogas_tipo || "Sí"} />}
            </div>

            {/* IV. Patológicos */}
            <ST>IV. Antecedentes Personales Patológicos</ST>
            <div className="space-y-2 print:hidden">
              <div>
                <Label className="text-xs text-muted-foreground">Enfermedades previas</Label>
                <Textarea rows={2} value={ant.enfermedades_previas} onChange={e => upd("enfermedades_previas", e.target.value)} className="mt-1 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Cirugías previas</Label>
                  <Textarea rows={2} value={ant.cirugias_previas} onChange={e => upd("cirugias_previas", e.target.value)} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hospitalizaciones</Label>
                  <Textarea rows={2} value={ant.hospitalizaciones} onChange={e => upd("hospitalizaciones", e.target.value)} className="mt-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Fracturas / traumatismos</Label>
                  <Input value={ant.fracturas_traumatismos} onChange={e => upd("fracturas_traumatismos", e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Inmunizaciones</Label>
                  <Input value={ant.inmunizaciones} onChange={e => upd("inmunizaciones", e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="transfusiones" checked={ant.transfusiones} onCheckedChange={v => upd("transfusiones", !!v)} />
                <Label htmlFor="transfusiones" className="text-sm cursor-pointer">Transfusiones</Label>
                {ant.transfusiones && <Input placeholder="Detalles" value={ant.transfusiones_notas} onChange={e => upd("transfusiones_notas", e.target.value)} className="h-8 text-sm flex-1" />}
              </div>
            </div>
            <div className="hidden print:grid print:grid-cols-2 print:gap-x-8 print:gap-y-0.5">
              <F label="Enfermedades previas" value={ant.enfermedades_previas} />
              <F label="Cirugías" value={ant.cirugias_previas} />
              <F label="Hospitalizaciones" value={ant.hospitalizaciones} />
              <F label="Fracturas/traumatismos" value={ant.fracturas_traumatismos} />
              <F label="Transfusiones" value={ant.transfusiones ? `Sí — ${ant.transfusiones_notas}` : "No"} />
              <F label="Inmunizaciones" value={ant.inmunizaciones} />
            </div>

            {/* V. Gineco-obstétricos */}
            {(patient.sexo === "F" || patient.sexo === null) && (
              <>
                <ST>V. Antecedentes Gineco-Obstétricos</ST>
                <div className="grid grid-cols-3 gap-2 print:hidden">
                  {([
                    ["menarca_edad","Menarca (edad)"],["ritmo_menstrual","Ritmo menstrual"],
                    ["ivsa_edad","IVSA (edad)"],["num_parejas_sexuales","Nº parejas"],
                    ["fum","FUM"],["fup","FUP"],
                    ["gestas","Gestas"],["partos","Partos"],["cesareas","Cesáreas"],
                    ["abortos","Abortos"],["hijos_vivos","Hijos vivos"],
                    ["metodo_anticonceptivo","Método anticonceptivo"],
                  ] as [keyof Antecedentes, string][]).map(([f, l]) => (
                    <div key={f}>
                      <Label className="text-xs text-muted-foreground">{l}</Label>
                      <Input value={ant[f] as string} onChange={e => upd(f, e.target.value as never)} className="mt-1 h-8 text-sm" />
                    </div>
                  ))}
                  <div className="flex items-center gap-2 col-span-3">
                    <Checkbox id="dismenorrea" checked={ant.dismenorrea} onCheckedChange={v => upd("dismenorrea", !!v)} />
                    <Label htmlFor="dismenorrea" className="text-sm cursor-pointer">Dismenorrea</Label>
                  </div>
                </div>
                <div className="hidden print:grid print:grid-cols-3 print:gap-x-4 print:gap-y-0.5">
                  <F label="Menarca" value={ant.menarca_edad} />
                  <F label="Ritmo" value={ant.ritmo_menstrual} />
                  <F label="IVSA" value={ant.ivsa_edad} />
                  <F label="FUM" value={ant.fum} />
                  <F label="FUP" value={ant.fup} />
                  <F label="G/P/C/A" value={`${ant.gestas||0}/${ant.partos||0}/${ant.cesareas||0}/${ant.abortos||0}`} />
                  <F label="Método AC" value={ant.metodo_anticonceptivo} />
                </div>
              </>
            )}
          </>
        )}

        {/* VI. Notas SOAP */}
        <ST>VI. Notas de Consulta (SOAP)</ST>
        {notas.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin notas registradas</p>
        ) : notas.map(n => (
          <div key={n.id} className="border border-border rounded-lg p-3 mb-3 print:border-gray-400 print:p-2 print:rounded-none print:break-inside-avoid print:mb-2">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold text-primary">
                {format(new Date(n.fecha_consulta), "dd 'de' MMMM yyyy", { locale: es })}
              </span>
              {n.diagnostico_principal && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{n.diagnostico_principal}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs print:gap-y-0.5">
              {n.subjetivo && <div><span className="font-semibold">S:</span> {n.subjetivo}</div>}
              {n.objetivo && <div><span className="font-semibold">O:</span> {n.objetivo}</div>}
              {n.analisis && <div><span className="font-semibold">A:</span> {n.analisis}</div>}
              {n.plan && <div><span className="font-semibold">P:</span> {n.plan}</div>}
            </div>
          </div>
        ))}

        {/* VII. Recetas */}
        <ST>VII. Prescripciones</ST>
        {recetas.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin prescripciones registradas</p>
        ) : recetas.map(r => (
          <div key={r.id} className="flex gap-4 text-sm print:text-xs border-b border-border/40 py-1">
            <span className="text-muted-foreground min-w-[90px]">
              {r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy", { locale: es }) : "—"}
            </span>
            <span className="font-medium min-w-[100px]">{r.prescription_number ?? r.id.slice(0,8)}</span>
            <span className="text-muted-foreground truncate">{r.diagnosis ?? "—"}</span>
            <span className={`ml-auto text-xs ${r.status === "dispensed" ? "text-green-600" : "text-muted-foreground"}`}>{r.status ?? "—"}</span>
          </div>
        ))}

        {/* Pie */}
        <Separator className="mt-8 print:mt-6" />
        <div className="mt-3 grid grid-cols-3 gap-8">
          {["Firma del médico","Cédula profesional","Sello institución"].map(l => (
            <div key={l} className="text-center">
              <div className="border-t border-foreground pt-1 mt-10 print:mt-16 text-xs">{l}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-4">
          Documento generado electrónicamente conforme a la NOM-004-SSA3-2012
        </p>
      </div>

      <style>{`@media print { @page { margin: 1.5cm; } }`}</style>
    </div>
  );
}
