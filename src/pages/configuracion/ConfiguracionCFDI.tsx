import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, FileText, Save, CheckCircle2, AlertCircle, Loader2,
  Upload, File, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const REGIMENES = [
  { clave: "601", nombre: "General de Ley Personas Morales" },
  { clave: "603", nombre: "Personas Morales con Fines no Lucrativos" },
  { clave: "605", nombre: "Sueldos y Salarios e Ingresos Asimilados" },
  { clave: "606", nombre: "Arrendamiento" },
  { clave: "608", nombre: "Demás ingresos" },
  { clave: "610", nombre: "Residentes en el Extranjero sin EP" },
  { clave: "611", nombre: "Ingresos por Dividendos" },
  { clave: "612", nombre: "Personas Físicas con Actividades Empresariales y Profesionales" },
  { clave: "614", nombre: "Ingresos por intereses" },
  { clave: "616", nombre: "Sin obligaciones fiscales" },
  { clave: "620", nombre: "Sociedades Cooperativas de Producción" },
  { clave: "621", nombre: "Incorporación Fiscal" },
  { clave: "622", nombre: "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
  { clave: "623", nombre: "Opcional para Grupos de Sociedades" },
  { clave: "624", nombre: "Coordinados" },
  { clave: "625", nombre: "Régimen de Enajenación o Adquisición de Bienes" },
  { clave: "626", nombre: "Régimen Simplificado de Confianza (RESICO)" },
];

const PACS = [
  { value: "facturama", label: "Facturama" },
  { value: "fiscalapi", label: "FiscalAPI" },
  { value: "finkok", label: "Finkok" },
];

interface CfdiConfigRow {
  id?: string;
  rfc: string;
  razon_social: string;
  regimen_fiscal: string;
  domicilio_fiscal_cp: string;
  serie_defecto: string;
  pac_proveedor: string;
  pac_ambiente: string;
  pac_usuario: string;
  pac_contrasena: string;
  csd_cer_nombre: string;
  csd_key_nombre: string;
  csd_cer_path: string;
  csd_key_path: string;
  csd_contrasena: string;
  iva_default: string;
  zona_fronteriza: boolean;
}

const EMPTY: CfdiConfigRow = {
  rfc: "", razon_social: "", regimen_fiscal: "601", domicilio_fiscal_cp: "",
  serie_defecto: "A", pac_proveedor: "facturama", pac_ambiente: "sandbox",
  pac_usuario: "", pac_contrasena: "", csd_cer_nombre: "", csd_key_nombre: "",
  csd_cer_path: "", csd_key_path: "", csd_contrasena: "",
  iva_default: "0.16", zona_fronteriza: false,
};

export default function ConfiguracionCFDI() {
  const navigate = useNavigate();
  const { activeClinicId } = useActiveClinic();
  const [form, setForm] = useState<CfdiConfigRow>(EMPTY);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testando, setTestando] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "error" | null>(null);
  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [uploadingCsd, setUploadingCsd] = useState(false);
  const cerInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeClinicId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("cfdi_config" as any)
        .select("id, rfc, razon_social, regimen_fiscal, domicilio_fiscal_cp, serie_defecto, pac_proveedor, pac_ambiente, pac_usuario, csd_cer_nombre, csd_key_nombre, csd_cer_path, csd_key_path, iva_default, zona_fronteriza")
        .eq("clinic_id", activeClinicId)
        .maybeSingle();
      if (data) {
        const row = data as Record<string, unknown>;
        setExistingId(row.id as string);
        setForm({
          rfc: (row.rfc as string) ?? "",
          razon_social: (row.razon_social as string) ?? "",
          regimen_fiscal: (row.regimen_fiscal as string) ?? "601",
          domicilio_fiscal_cp: (row.domicilio_fiscal_cp as string) ?? "",
          serie_defecto: (row.serie_defecto as string) ?? "A",
          pac_proveedor: (row.pac_proveedor as string) ?? "facturama",
          pac_ambiente: (row.pac_ambiente as string) ?? "sandbox",
          pac_usuario: (row.pac_usuario as string) ?? "",
          pac_contrasena: "",
          csd_cer_nombre: (row.csd_cer_nombre as string) ?? "",
          csd_key_nombre: (row.csd_key_nombre as string) ?? "",
          csd_cer_path: (row.csd_cer_path as string) ?? "",
          csd_key_path: (row.csd_key_path as string) ?? "",
          csd_contrasena: "",
          iva_default: String(row.iva_default ?? "0.16"),
          zona_fronteriza: (row.zona_fronteriza as boolean) ?? false,
        });
      }
      setLoading(false);
    };
    load();
  }, [activeClinicId]);

  const set = (field: keyof CfdiConfigRow, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!activeClinicId) return;
    if (!form.rfc.trim()) { toast.error("RFC del emisor es obligatorio"); return; }
    if (!form.razon_social.trim()) { toast.error("Razón social es obligatoria"); return; }
    if (!form.domicilio_fiscal_cp.trim()) { toast.error("CP del domicilio fiscal es obligatorio"); return; }

    setSaving(true);
    // Upload CSD files if selected
    let cerPath = form.csd_cer_path;
    let keyPath = form.csd_key_path;
    if ((cerFile || keyFile) && activeClinicId) {
      setUploadingCsd(true);
      try {
        if (cerFile) {
          const path = `${activeClinicId}/emisor.cer`;
          const { error: upErr } = await supabase.storage
            .from("csd-files")
            .upload(path, cerFile, { upsert: true, contentType: "application/octet-stream" });
          if (upErr) throw new Error("Error subiendo .cer: " + upErr.message);
          cerPath = path;
        }
        if (keyFile) {
          const path = `${activeClinicId}/emisor.key`;
          const { error: upErr } = await supabase.storage
            .from("csd-files")
            .upload(path, keyFile, { upsert: true, contentType: "application/octet-stream" });
          if (upErr) throw new Error("Error subiendo .key: " + upErr.message);
          keyPath = path;
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : String(err));
        setSaving(false);
        setUploadingCsd(false);
        return;
      }
      setUploadingCsd(false);
    }

    const payload: Record<string, unknown> = {
      clinic_id: activeClinicId,
      rfc: form.rfc.toUpperCase().trim(),
      razon_social: form.razon_social.trim(),
      regimen_fiscal: form.regimen_fiscal,
      domicilio_fiscal_cp: form.domicilio_fiscal_cp.trim(),
      serie_defecto: form.serie_defecto.trim() || "A",
      pac_proveedor: form.pac_proveedor,
      pac_ambiente: form.pac_ambiente,
      pac_usuario: form.pac_usuario.trim(),
      csd_cer_nombre: cerFile ? cerFile.name : form.csd_cer_nombre.trim(),
      csd_key_nombre: keyFile ? keyFile.name : form.csd_key_nombre.trim(),
      csd_cer_path: cerPath,
      csd_key_path: keyPath,
      iva_default: parseFloat(form.iva_default) || 0.16,
      zona_fronteriza: form.zona_fronteriza,
      // pac_contrasena y csd_contrasena NUNCA se escriben aquí — van a Vault
    };

    const { error } = existingId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? await supabase.from("cfdi_config" as any).update(payload).eq("id", existingId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : await supabase.from("cfdi_config" as any).insert(payload);

    if (error) { setSaving(false); toast.error("Error al guardar: " + error.message); return; }

    // Guardar credenciales en Vault (edge function con service role)
    if (form.pac_contrasena || form.csd_contrasena) {
      const credBody: Record<string, string> = { clinic_id: activeClinicId };
      if (form.pac_contrasena) credBody.pac_contrasena = form.pac_contrasena;
      if (form.csd_contrasena) credBody.csd_contrasena = form.csd_contrasena;
      const { error: credErr } = await supabase.functions.invoke("cfdi-set-credentials", { body: credBody });
      if (credErr) {
        setSaving(false);
        toast.error("Config guardada pero error en credenciales: " + credErr.message);
        return;
      }
    }

    setSaving(false);
    toast.success("Configuración CFDI guardada");
    setCerFile(null);
    setKeyFile(null);
    setForm((prev) => ({
      ...prev,
      pac_contrasena: "",
      csd_contrasena: "",
      csd_cer_path: cerPath,
      csd_key_path: keyPath,
    }));
  };

  const handleTestPAC = async () => {
    if (!form.pac_usuario || !form.pac_contrasena) {
      toast.error("Ingresa usuario y contraseña del PAC para probar");
      return;
    }
    setTestando(true);
    setTestResult(null);
    try {
      const creds = btoa(`${form.pac_usuario}:${form.pac_contrasena}`);
      const base = form.pac_ambiente === "sandbox"
        ? "https://apisandbox.facturama.mx"
        : "https://api.facturama.mx";
      const res = await fetch(`${base}/api/profile`, {
        headers: { Authorization: `Basic ${creds}` },
      });
      setTestResult(res.ok ? "ok" : "error");
      if (res.ok) toast.success("Conexión con PAC exitosa");
      else toast.error(`PAC respondió ${res.status} — verifica credenciales`);
    } catch {
      setTestResult("error");
      toast.error("No se pudo conectar al PAC");
    }
    setTestando(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/configuracion")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-display text-xl font-bold text-foreground">Facturación y CFDI</h1>
          <p className="text-sm text-muted-foreground">Datos del emisor, CSD y conexión con el PAC</p>
        </div>
      </div>

      {/* Datos del emisor */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-card-foreground">Datos del emisor</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="rfc">RFC *</Label>
            <Input id="rfc" value={form.rfc} onChange={(e) => set("rfc", e.target.value)}
              placeholder="RFC del emisor (12 o 13 caracteres)" maxLength={13} className="uppercase" />
          </div>
          <div>
            <Label htmlFor="domicilio_fiscal_cp">CP domicilio fiscal *</Label>
            <Input id="domicilio_fiscal_cp" value={form.domicilio_fiscal_cp}
              onChange={(e) => set("domicilio_fiscal_cp", e.target.value)}
              placeholder="06600" maxLength={5} />
          </div>
        </div>

        <div>
          <Label htmlFor="razon_social">Razón social / Nombre completo *</Label>
          <Input id="razon_social" value={form.razon_social} onChange={(e) => set("razon_social", e.target.value)}
            placeholder="Exacto al registro en el SAT" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="regimen_fiscal">Régimen fiscal *</Label>
            <select
              id="regimen_fiscal"
              value={form.regimen_fiscal}
              onChange={(e) => set("regimen_fiscal", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              {REGIMENES.map((r) => (
                <option key={r.clave} value={r.clave}>{r.clave} — {r.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="serie_defecto">Serie por defecto</Label>
            <Input id="serie_defecto" value={form.serie_defecto} onChange={(e) => set("serie_defecto", e.target.value)}
              placeholder="A" maxLength={10} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="iva_default">Tasa de IVA por defecto</Label>
            <select
              id="iva_default"
              value={form.iva_default}
              onChange={(e) => set("iva_default", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="0.16">16% — Tasa general</option>
              <option value="0.08">8% — Zona fronteriza</option>
              <option value="0.00">0% — Tasa cero</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.zona_fronteriza}
                onChange={(e) => set("zona_fronteriza", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm text-foreground">Clínica en zona fronteriza (IVA 8%)</span>
            </label>
          </div>
        </div>
      </section>

      {/* CSD */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Upload className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-card-foreground">Certificado de Sello Digital (CSD)</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Archivos .cer y .key emitidos por el SAT. Se almacenan en un bucket privado cifrado.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* .cer */}
          <div>
            <Label>Archivo .cer</Label>
            <input
              ref={cerInputRef}
              type="file"
              accept=".cer,application/x-x509-ca-cert"
              className="hidden"
              onChange={(e) => setCerFile(e.target.files?.[0] ?? null)}
            />
            {cerFile ? (
              <div className="mt-1 flex items-center gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm">
                <File className="h-4 w-4 text-success shrink-0" />
                <span className="truncate text-success">{cerFile.name}</span>
                <button onClick={() => { setCerFile(null); if (cerInputRef.current) cerInputRef.current.value = ""; }}
                  className="ml-auto text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => cerInputRef.current?.click()}
                className="mt-1 flex w-full items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Upload className="h-4 w-4" />
                {form.csd_cer_path
                  ? <span className="truncate text-success">{form.csd_cer_nombre || "emisor.cer"} (subido)</span>
                  : "Seleccionar .cer"}
              </button>
            )}
          </div>

          {/* .key */}
          <div>
            <Label>Archivo .key</Label>
            <input
              ref={keyInputRef}
              type="file"
              accept=".key"
              className="hidden"
              onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
            />
            {keyFile ? (
              <div className="mt-1 flex items-center gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm">
                <File className="h-4 w-4 text-success shrink-0" />
                <span className="truncate text-success">{keyFile.name}</span>
                <button onClick={() => { setKeyFile(null); if (keyInputRef.current) keyInputRef.current.value = ""; }}
                  className="ml-auto text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => keyInputRef.current?.click()}
                className="mt-1 flex w-full items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Upload className="h-4 w-4" />
                {form.csd_key_path
                  ? <span className="truncate text-success">{form.csd_key_nombre || "emisor.key"} (subido)</span>
                  : "Seleccionar .key"}
              </button>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="csd_contrasena">Contraseña del CSD</Label>
          <Input id="csd_contrasena" type="password" value={form.csd_contrasena}
            onChange={(e) => set("csd_contrasena", e.target.value)}
            placeholder="Deja en blanco para no cambiar" autoComplete="new-password" />
          <p className="mt-1 text-xs text-muted-foreground">Se guarda de forma protegida. Solo déjala en blanco si no quieres modificarla.</p>
        </div>

        {uploadingCsd && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Subiendo archivos CSD…
          </div>
        )}
      </section>

      {/* PAC */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-card-foreground">Proveedor Autorizado de Certificación (PAC)</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pac_proveedor">PAC</Label>
            <select
              id="pac_proveedor"
              value={form.pac_proveedor}
              onChange={(e) => set("pac_proveedor", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              {PACS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="pac_ambiente">Ambiente</Label>
            <select
              id="pac_ambiente"
              value={form.pac_ambiente}
              onChange={(e) => set("pac_ambiente", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="sandbox">Sandbox (pruebas)</option>
              <option value="produccion">Producción</option>
            </select>
          </div>
        </div>

        {form.pac_ambiente === "produccion" && (
          <div className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-2.5 text-xs text-warning">
            Ambiente de producción — los CFDI timbrados tendrán validez fiscal real ante el SAT.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pac_usuario">Usuario PAC</Label>
            <Input id="pac_usuario" value={form.pac_usuario}
              onChange={(e) => set("pac_usuario", e.target.value)}
              placeholder="tu@email.com o usuario" autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="pac_contrasena">Contraseña PAC</Label>
            <Input id="pac_contrasena" type="password" value={form.pac_contrasena}
              onChange={(e) => set("pac_contrasena", e.target.value)}
              placeholder="Deja en blanco para no cambiar" autoComplete="new-password" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={handleTestPAC} disabled={testando}>
            {testando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Probar conexión PAC
          </Button>
          {testResult === "ok" && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="h-4 w-4" /> Conexión exitosa
            </span>
          )}
          {testResult === "error" && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-4 w-4" /> Error de conexión
            </span>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar configuración CFDI
        </Button>
      </div>
    </div>
  );
}
