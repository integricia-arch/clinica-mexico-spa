import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/errors";
import { registerStudyResult, reviewStudy, type PatientStudy } from "../services/studiesService";
import { advancePatientJourneyFromClinicalEvent } from "@/features/camino-paciente/services/clinicalEvents";
import { Upload, Link, HardDrive } from "lucide-react";

const LOCAL_SERVER_URL = import.meta.env.VITE_LOCAL_FILE_SERVER ?? "http://localhost:3001";
const LOCAL_SERVER_KEY = import.meta.env.VITE_LOCAL_FILE_SERVER_KEY ?? "clinica-local-2024";

interface Props {
  open: boolean;
  onClose: () => void;
  study: PatientStudy | null;
  journeyInstanceId?: string | null;
  onSaved?: () => void;
}

export default function StudyResultDrawer({ open, onClose, study, journeyInstanceId, onSaved }: Props) {
  const { toast } = useToast();
  const [resumen, setResumen] = useState(study?.resultado_resumen ?? "");
  const [archivoUrl, setArchivoUrl] = useState(study?.archivo_url ?? "");
  const [laboratorio, setLaboratorio] = useState(study?.laboratorio_origen ?? "");
  const [interpretacion, setInterpretacion] = useState(study?.interpretacion_medica ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadToLocal = async (file: File) => {
    setUploading(true);
    try {
      // Nombre único: timestamp + nombre original sanitizado
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const resp = await fetch(`${LOCAL_SERVER_URL}/upload/${encodeURIComponent(safeName)}`, {
        method: "PUT",
        headers: { "X-API-Key": LOCAL_SERVER_KEY, "Content-Type": "application/octet-stream" },
        body: file,
      });
      if (!resp.ok) throw new Error(`Servidor local respondió ${resp.status}`);
      const { url } = await resp.json();
      setArchivoUrl(url);
      toast({ title: "Archivo guardado localmente", description: url });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Error al subir al servidor local", description: msg + ". Verifica que el servidor esté corriendo: node scripts/local-file-server.cjs" });
    } finally {
      setUploading(false);
    }
  };

  if (!study) return null;

  const doRegister = async () => {
    setSaving(true);
    try {
      await registerStudyResult(study.id, {
        resultado_resumen: resumen || null,
        archivo_url: archivoUrl || null,
        laboratorio_origen: laboratorio || null,
      });
      if (journeyInstanceId) {
        await advancePatientJourneyFromClinicalEvent("study_received", {
          journey_instance_id: journeyInstanceId,
          study_id: study.id,
        });
      }
      toast({ title: "Resultado registrado" });
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: friendlyError(e) });
    } finally {
      setSaving(false);
    }
  };

  const doReview = async () => {
    if (!interpretacion.trim()) {
      toast({ variant: "destructive", title: "Falta interpretación médica" });
      return;
    }
    setSaving(true);
    try {
      await reviewStudy(study.id, { interpretacion_medica: interpretacion });
      if (journeyInstanceId) {
        await advancePatientJourneyFromClinicalEvent("study_reviewed", {
          journey_instance_id: journeyInstanceId,
          study_id: study.id,
        });
      }
      toast({ title: "Estudio revisado" });
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: friendlyError(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{study.nombre}</SheetTitle>
          <p className="text-xs text-muted-foreground capitalize">{study.tipo} · {study.prioridad} · {study.status}</p>
        </SheetHeader>
        <div className="space-y-3 py-4">
          {study.status === "solicitado" && (
            <>
              <div>
                <Label className="text-xs">Resumen del resultado</Label>
                <Textarea value={resumen} onChange={(e) => setResumen(e.target.value)} rows={4} />
              </div>
              <div>
                <Label className="text-xs">Archivo del estudio</Label>
                <div className="space-y-2">
                  {/* Subida al servidor local de la clínica */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm,.zip,.xml"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadToLocal(f); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <HardDrive className="h-3.5 w-3.5" />
                    {uploading ? "Subiendo…" : "Guardar en servidor local (sin nube)"}
                  </Button>
                  {/* URL manual (nube o ruta conocida) */}
                  <div className="flex items-center gap-2">
                    <Link className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <Input
                      value={archivoUrl}
                      onChange={(e) => setArchivoUrl(e.target.value)}
                      placeholder="http://192.168.x.x:3001/files/… o https://…"
                      className="text-xs"
                    />
                  </div>
                  {archivoUrl && (
                    <a href={archivoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Upload className="h-3 w-3" /> Abrir archivo
                    </a>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Laboratorio de origen</Label>
                <Input value={laboratorio} onChange={(e) => setLaboratorio(e.target.value)} />
              </div>
            </>
          )}
          {study.status === "recibido" && (
            <>
              {study.resultado_resumen && (
                <div className="rounded-md border border-border p-3 text-xs">
                  <p className="font-medium mb-1">Resultado</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{study.resultado_resumen}</p>
                </div>
              )}
              <div>
                <Label className="text-xs">Interpretación médica</Label>
                <Textarea value={interpretacion} onChange={(e) => setInterpretacion(e.target.value)} rows={5} />
              </div>
            </>
          )}
          {study.status === "revisado" && (
            <div className="text-xs text-muted-foreground space-y-2">
              <p className="rounded-md border border-border p-3"><span className="font-medium">Resultado:</span> {study.resultado_resumen ?? "—"}</p>
              <p className="rounded-md border border-border p-3"><span className="font-medium">Interpretación:</span> {study.interpretacion_medica ?? "—"}</p>
            </div>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cerrar</Button>
          {study.status === "solicitado" && (
            <Button onClick={doRegister} disabled={saving}>Registrar resultado</Button>
          )}
          {study.status === "recibido" && (
            <Button onClick={doReview} disabled={saving}>Marcar revisado</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
