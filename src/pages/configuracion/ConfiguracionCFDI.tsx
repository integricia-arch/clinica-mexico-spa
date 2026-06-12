import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Save, CheckCircle2, AlertCircle, Loader2, Upload } from "lucide-react";
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
  csd_contrasena: string;
  iva_default: string;
  zona_fronteriza: boolean;
}

const EMPTY: CfdiConfigRow = {
  rfc: "", razon_social: "", regimen_fiscal: "601", domicilio_fiscal_cp: "",
  serie_defecto: "A", pac_proveedor: "facturama", pac_ambiente: "sandbox",
  pac_usuario: "", pac_contrasena: "", csd_cer_nombre: "", csd_key_nombre: "",
  csd_contrasena: "", iva_default: "0.16", zona_fronteriza: false,
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

  useEffect(() => {
    if (!activeClinicId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("cfdi_config" as any)
        .select("*")
        .eq("clinic_id", activeClinicId)
        .maybeSingle();
      if (data) {
        setExistingId((data as any).id);
        setForm({
          rfc: (data as any).rfc ?? "",
          razon_social: (data as any).razon_social ?? "",
          regimen_fiscal: (data as any).regimen_fiscal ?? "601",
          domicilio_fiscal_cp: (data as any).domicilio_fiscal_cp ?? "",
          serie_defecto: (data as any).serie_defecto ?? "A",
          pac_proveedor: (data as any).pac_proveedor ?? "facturama",
          pac_ambiente: (data as any).pac_ambiente ?? "sandbox",
          pac_usuario: (data as any).pac_usuario ?? "",
          pac_contrasena: "",
          csd_cer_nombre: (data as any).csd_cer_nombre ?? "",
          csd_key_nombre: (data as any).csd_key_nombre ?? "",
          csd_contrasena: "",
          iva_default: String((data as any).iva_default ?? "0.16"),
          zona_fronteriza: (data as any).zona_fronteriza ?? false,
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
    const payload: Record<string, any> = {
      clinic_id: activeClinicId,
      rfc: form.rfc.toUpperCase().trim(),
      razon_social: form.razon_social.trim(),
      regimen_fiscal: form.regimen_fiscal,
      domicilio_fiscal_cp: form.domicilio_fiscal_cp.trim(),
      serie_defecto: form.serie_defecto.trim() || "A",
      pac_proveedor: form.pac_proveedor,
      pac_ambiente: form.pac_ambiente,
      pac_usuario: form.pac_usuario.trim(),
      csd_cer_nombre: form.csd_cer_nombre.trim(),
      csd_key_nombre: form.csd_key_nombre.trim(),
      iva_default: parseFloat(form.iva_default) || 0.16,
      zona_fronteriza: form.zona_fronteriza,
    };
    if (form.pac_contrasena) payload.pac_contrasena = form.pac_contrasena;
    if (form.csd_contrasena) payload.csd_contrasena = form.csd_contrasena;

    const { error } = existingId
      ? await supabase.from("cfdi_config" as any).update(payload).eq("id", existingId)
      : await supabase.from("cfdi_config" as any).insert(payload);

    setSaving(false);
    if (error) { toast.error("Error al guardar: " + error.message); return; }
    toast.success("Configuración CFDI guardada");
    setForm((prev) => ({ ...prev, pac_contrasena: "", csd_contrasena: "" }));
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
          Los archivos .cer y .key los proporciona el SAT. La carga directa de archivos estará disponible en la siguiente versión.
          Por ahora registra los nombres de los archivos para referencia.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="csd_cer_nombre">Nombre archivo .cer</Label>
            <Input id="csd_cer_nombre" value={form.csd_cer_nombre}
              onChange={(e) => set("csd_cer_nombre", e.target.value)}
              placeholder="mi_certificado.cer" />
          </div>
          <div>
            <Label htmlFor="csd_key_nombre">Nombre archivo .key</Label>
            <Input id="csd_key_nombre" value={form.csd_key_nombre}
              onChange={(e) => set("csd_key_nombre", e.target.value)}
              placeholder="mi_llave.key" />
          </div>
        </div>

        <div>
          <Label htmlFor="csd_contrasena">Contraseña del CSD</Label>
          <Input id="csd_contrasena" type="password" value={form.csd_contrasena}
            onChange={(e) => set("csd_contrasena", e.target.value)}
            placeholder="Deja en blanco para no cambiar" autoComplete="new-password" />
          <p className="mt-1 text-xs text-muted-foreground">Se guarda de forma protegida. Solo déjala en blanco si no quieres modificarla.</p>
        </div>
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
