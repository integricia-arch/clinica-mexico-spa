import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save, Upload, History, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { friendlyError } from "@/lib/errors";
import {
  getCurrentDoctorId,
  getOrCreateTemplate,
  saveTemplate,
  publishTemplateVersion,
  uploadDoctorAsset,
  getAssetSignedUrl,
  listVersions,
  type DoctorPrescriptionTemplate,
} from "@/features/recetas/services/prescriptionTemplateService";
import PrescriptionTemplatePreview from "@/features/recetas/components/PrescriptionTemplatePreview";

export default function MachoteReceta() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorMeta, setDoctorMeta] = useState<{ nombre: string; apellidos: string; especialidad: string; cedula_profesional: string | null } | null>(null);
  const [template, setTemplate] = useState<DoctorPrescriptionTemplate | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null);
  const [versions, setVersions] = useState<Array<{ id: string; version_number: number; published_at: string; publish_reason: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [adminDoctors, setAdminDoctors] = useState<Array<{ id: string; nombre: string; apellidos: string; especialidad: string }>>([]);
  const [selectedAdminDoctorId, setSelectedAdminDoctorId] = useState<string>("");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const firmaInputRef = useRef<HTMLInputElement>(null);

  // Para administradores: cargar lista de médicos disponibles
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id, nombre, apellidos, especialidad")
        .eq("activo", true)
        .order("apellidos");
      setAdminDoctors((data as any) ?? []);
    })();
  }, [isAdmin]);

  const loadForDoctor = async (dId: string) => {
    setLoading(true);
    setTemplate(null);
    setLogoUrl(null);
    setFirmaUrl(null);
    setVersions([]);
    setDirty(false);
    try {
      setDoctorId(dId);
      const { data: doc } = await supabase
        .from("doctors")
        .select("nombre, apellidos, especialidad, cedula_profesional")
        .eq("id", dId)
        .maybeSingle();
      setDoctorMeta(doc as any);

      const tpl = await getOrCreateTemplate(dId);
      setTemplate(tpl);
      const [logoSigned, firmaSigned, vs] = await Promise.all([
        getAssetSignedUrl(tpl.logo_path),
        getAssetSignedUrl(tpl.firma_path),
        listVersions(tpl.id),
      ]);
      setLogoUrl(logoSigned);
      setFirmaUrl(firmaSigned);
      setVersions(vs as any);
    } catch (err) {
      toast.error("No se pudo cargar el machote: " + friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const dId = await getCurrentDoctorId();
        if (!dId) {
          if (!isAdmin) {
            toast.error("Tu cuenta no está vinculada a un médico. Pide a un administrador que la vincule.");
          }
          setLoading(false);
          return;
        }
        await loadForDoctor(dId);
      } catch (err) {
        toast.error("No se pudo cargar el machote: " + friendlyError(err));
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  const patch = (p: Partial<DoctorPrescriptionTemplate>) => {
    setTemplate((t) => (t ? { ...t, ...p } : t));
    setDirty(true);
  };

  const validationErrors = useMemo(() => {
    if (!template) return [] as string[];
    const errs: string[] = [];
    if (!template.consultorio_nombre?.trim()) errs.push("Nombre del consultorio");
    if (!template.consultorio_direccion?.trim()) errs.push("Dirección del consultorio");
    if (!template.consultorio_telefono?.trim()) errs.push("Teléfono del consultorio");
    if (template.mostrar_cedula && !doctorMeta?.cedula_profesional) errs.push("Cédula profesional del médico (en su perfil)");
    if (template.mostrar_firma && !template.firma_path) errs.push("Firma escaneada");
    return errs;
  }, [template, doctorMeta]);

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      const { id, doctor_id, updated_at, current_version_id, current_version_number, ...patchData } = template;
      await saveTemplate(template.id, patchData);
      setDirty(false);
      toast.success("Cambios guardados");
    } catch (err) {
      toast.error("No se pudo guardar: " + friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!template) return;
    if (validationErrors.length > 0) {
      toast.error("Completa los campos obligatorios antes de publicar.");
      return;
    }
    setPublishing(true);
    try {
      if (dirty) {
        const { id, doctor_id, updated_at, current_version_id, current_version_number, ...patchData } = template;
        await saveTemplate(template.id, patchData);
        setDirty(false);
      }
      const { version_number } = await publishTemplateVersion(template);
      toast.success(`Versión v${version_number} publicada`);
      const fresh = await getOrCreateTemplate(template.doctor_id);
      setTemplate(fresh);
      const vs = await listVersions(fresh.id);
      setVersions(vs as any);
    } catch (err) {
      toast.error("No se pudo publicar: " + friendlyError(err));
    } finally {
      setPublishing(false);
    }
  };

  const handleUpload = async (kind: "logo" | "firma", file: File | null) => {
    if (!file || !template || !doctorId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen debe pesar máximo 2 MB");
      return;
    }
    try {
      const path = await uploadDoctorAsset(doctorId, kind, file);
      patch(kind === "logo" ? { logo_path: path } : { firma_path: path });
      const url = await getAssetSignedUrl(path);
      if (kind === "logo") setLogoUrl(url);
      else setFirmaUrl(url);
      toast.success(`${kind === "logo" ? "Logo" : "Firma"} cargada`);
    } catch (err) {
      toast.error("No se pudo subir: " + friendlyError(err));
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando machote…</div>;
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <Link to="/configuracion" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> Volver a Configuración
        </Link>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            No se encontró un médico vinculado a tu cuenta. Pide a un administrador que vincule tu usuario a un registro de médico.
          </p>
        </div>
      </div>
    );
  }

  const doctorName = doctorMeta ? `Dr(a). ${doctorMeta.nombre} ${doctorMeta.apellidos}` : "Médico";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/configuracion" className="inline-flex items-center gap-1 text-sm text-primary mb-2">
            <ArrowLeft className="h-4 w-4" /> Volver a Configuración
          </Link>
          <h1 className="text-display text-2xl font-bold text-foreground">Mi machote de receta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personaliza encabezado, logo, firma y cierre. Cada vez que <strong>publiques</strong> una versión,
            las recetas nuevas usarán ese diseño y guardarán una copia exacta para reimpresiones fieles.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={!dirty || saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Guardando…" : "Guardar borrador"}
            </Button>
            <Button onClick={handlePublish} disabled={publishing || validationErrors.length > 0}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {publishing ? "Publicando…" : `Publicar v${(template.current_version_number ?? 0) + 1}`}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Versión vigente: <strong>v{template.current_version_number || "—"}</strong>
          </p>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs text-warning-foreground flex gap-2">
          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Faltan datos para publicar:</p>
            <ul className="list-disc pl-5 mt-1">
              {validationErrors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="rounded-xl border border-border bg-card p-4">
          <Tabs defaultValue="encabezado">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="encabezado">Encabezado</TabsTrigger>
              <TabsTrigger value="assets">Logo y firma</TabsTrigger>
              <TabsTrigger value="cuerpo">Cuerpo</TabsTrigger>
              <TabsTrigger value="opciones">Opciones</TabsTrigger>
            </TabsList>

            <TabsContent value="encabezado" className="space-y-3 mt-4">
              <div>
                <Label>Nombre del consultorio *</Label>
                <Input value={template.consultorio_nombre ?? ""} onChange={(e) => patch({ consultorio_nombre: e.target.value })} />
              </div>
              <div>
                <Label>Dirección *</Label>
                <Input value={template.consultorio_direccion ?? ""} onChange={(e) => patch({ consultorio_direccion: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Teléfono *</Label>
                  <Input value={template.consultorio_telefono ?? ""} onChange={(e) => patch({ consultorio_telefono: e.target.value })} placeholder="+52 55 0000 0000" />
                </div>
                <div>
                  <Label>Correo</Label>
                  <Input type="email" value={template.consultorio_email ?? ""} onChange={(e) => patch({ consultorio_email: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Líneas adicionales del encabezado</Label>
                <Textarea rows={3} value={template.encabezado_extra ?? ""} onChange={(e) => patch({ encabezado_extra: e.target.value })} placeholder="Horarios, redes, sitio web…" />
              </div>
              <div>
                <Label>Color principal</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={template.color_primario ?? "#0F766E"} onChange={(e) => patch({ color_primario: e.target.value })} className="h-10 w-14 rounded border" />
                  <Input value={template.color_primario ?? ""} onChange={(e) => patch({ color_primario: e.target.value })} className="w-32" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="assets" className="space-y-4 mt-4">
              <div>
                <Label>Logo del consultorio (PNG/JPG, máx 2 MB)</Label>
                <div className="flex items-center gap-3 mt-1">
                  {logoUrl && <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain border rounded" />}
                  <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={(e) => handleUpload("logo", e.target.files?.[0] ?? null)} />
                  <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> {logoUrl ? "Reemplazar logo" : "Subir logo"}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Firma escaneada (PNG con fondo transparente recomendado, máx 2 MB)</Label>
                <div className="flex items-center gap-3 mt-1">
                  {firmaUrl && <img src={firmaUrl} alt="Firma" className="h-12 object-contain border rounded bg-white p-1" />}
                  <input ref={firmaInputRef} type="file" accept="image/*" hidden onChange={(e) => handleUpload("firma", e.target.files?.[0] ?? null)} />
                  <Button variant="outline" size="sm" onClick={() => firmaInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> {firmaUrl ? "Reemplazar firma" : "Subir firma"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  La firma es una imagen de respaldo. No sustituye una firma electrónica avanzada oficial.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="cuerpo" className="space-y-3 mt-4">
              <div>
                <Label>Indicaciones generales precargadas</Label>
                <Textarea rows={5} value={template.indicaciones_default ?? ""} onChange={(e) => patch({ indicaciones_default: e.target.value })} placeholder="Ej. Acudir a urgencias en caso de fiebre persistente…" />
                <p className="text-xs text-muted-foreground mt-1">Se mostrarán al final del cuerpo de cada receta. El médico puede editarlas por consulta.</p>
              </div>
              <div>
                <Label>Pie de página / cierre</Label>
                <Textarea rows={3} value={template.pie_pagina ?? ""} onChange={(e) => patch({ pie_pagina: e.target.value })} placeholder="Esta receta forma parte del expediente clínico…" />
              </div>
            </TabsContent>

            <TabsContent value="opciones" className="space-y-3 mt-4">
              <Toggle label="Mostrar QR interno" checked={template.mostrar_qr} onChange={(v) => patch({ mostrar_qr: v })} />
              <Toggle label="Mostrar cédula profesional" checked={template.mostrar_cedula} onChange={(v) => patch({ mostrar_cedula: v })} />
              <Toggle label="Mostrar especialidad" checked={template.mostrar_especialidad} onChange={(v) => patch({ mostrar_especialidad: v })} />
              <Toggle label="Mostrar firma" checked={template.mostrar_firma} onChange={(v) => patch({ mostrar_firma: v })} />
              <div>
                <Label>Tamaño de papel</Label>
                <select
                  value={template.tamano_papel}
                  onChange={(e) => patch({ tamano_papel: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="carta">Carta (215 × 279 mm)</option>
                  <option value="media_carta">Media carta (215 × 140 mm)</option>
                </select>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Vista previa */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            Vista previa en vivo
          </h3>
          <PrescriptionTemplatePreview
            template={template}
            doctorName={doctorName}
            doctorEspecialidad={doctorMeta?.especialidad ?? ""}
            doctorCedula={doctorMeta?.cedula_profesional ?? "—"}
            logoUrl={logoUrl}
            firmaUrl={firmaUrl}
          />
        </div>
      </div>

      {/* Historial */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold flex items-center gap-2 mb-3"><History className="h-4 w-4" /> Historial de versiones publicadas</h3>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no has publicado ninguna versión.</p>
        ) : (
          <ul className="text-sm divide-y">
            {versions.map((v) => (
              <li key={v.id} className="py-2 flex items-center justify-between">
                <span>
                  <strong>v{v.version_number}</strong> · {new Date(v.published_at).toLocaleString("es-MX")}
                </span>
                <span className="text-xs text-muted-foreground">{v.publish_reason ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
