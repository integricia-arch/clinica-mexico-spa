import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Save, Loader2, AlertCircle, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export default function ConfiguracionConsultorio() {
  const navigate = useNavigate();
  const { activeClinicId, activeClinic, refresh } = useActiveClinic();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(activeClinic?.name ?? "");
  }, [activeClinic?.name]);

  const dirty = name.trim() !== (activeClinic?.name ?? "");

  const saveName = async () => {
    if (!activeClinicId || !name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("clinics")
      .update({ name: name.trim() })
      .eq("id", activeClinicId);
    setSaving(false);
    if (err) {
      setError(friendlyError(err));
      toast.error("No se pudo guardar: " + friendlyError(err));
      return;
    }
    toast.success("Nombre actualizado");
    await refresh();
  };

  const handleLogoPick = () => fileInputRef.current?.click();

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeClinicId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("El logo no debe pesar más de 2MB");
      return;
    }

    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop() || "png";
    const path = `${activeClinicId}/logo.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("clinic-logos")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadErr) {
      setUploading(false);
      setError(friendlyError(uploadErr));
      toast.error("No se pudo subir el logo: " + friendlyError(uploadErr));
      return;
    }

    const { data: pub } = supabase.storage.from("clinic-logos").getPublicUrl(path);
    // cache-bust: mismo path siempre, el navegador cachearía el logo viejo sin esto
    const logoUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: updateErr } = await supabase
      .from("clinics")
      .update({ logo_url: logoUrl })
      .eq("id", activeClinicId);

    setUploading(false);
    if (updateErr) {
      setError(friendlyError(updateErr));
      toast.error("No se pudo guardar el logo: " + friendlyError(updateErr));
      return;
    }
    toast.success("Logo actualizado");
    await refresh();
  };

  if (!activeClinic) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/configuracion")}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-display text-xl font-bold text-foreground">Datos del consultorio</h1>
          <p className="text-sm text-muted-foreground">
            Nombre y logotipo que se muestran en el menú, encabezado y pantalla de acceso.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-card-foreground">Identidad</h2>
        </div>

        <div className="flex items-center gap-4">
          <Logo logoUrl={activeClinic.logo_url} name={activeClinic.name} size="lg" variant="icon" />
          <div className="flex flex-col gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogoPick}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Subiendo…" : "Cambiar logo"}
            </Button>
            <p className="text-xs text-muted-foreground">JPG o PNG, máx. 2MB. Recomendado: cuadrado.</p>
          </div>
        </div>

        <div>
          <Label htmlFor="clinic_name">Nombre de la clínica</Label>
          <Input
            id="clinic_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Clínica Integral del Norte"
            disabled={saving}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={saveName} disabled={saving || !dirty} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar nombre
        </Button>
      </div>
    </div>
  );
}
