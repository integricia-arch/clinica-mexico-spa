import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Users, ChevronRight, Plus, Network, Download, Upload } from "lucide-react";
import { exportReporteCsv } from "@/features/contabilidad/exportReporteCsv";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { untypedTable } from "@/lib/untypedTable";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { friendlyError } from "@/lib/errors";
import { deriveIvaTratamiento, type IvaTratamiento, type CodigoCuentaIngreso } from "@/features/contabilidad/ivaRules";
import { ArbolCuentasDialog } from "@/features/contabilidad/ArbolCuentasDialog";

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "ingreso" | "egreso";
  es_fijo: boolean;
  codigo_agrupador_sat: string | null;
  activo: boolean;
  iva_tratamiento: IvaTratamiento;
  iva_tasa_pct: number | null;
}

const IVA_LABELS: Record<IvaTratamiento, string> = {
  sin_configurar: "Sin configurar",
  exento: "Exento",
  tasa_0: "Tasa 0%",
  tasa_general: "Tasa general",
};

const emptyForm = {
  codigo: "", nombre: "", tipo: "egreso" as "ingreso" | "egreso", es_fijo: false, codigo_agrupador_sat: "",
  iva_tratamiento: "sin_configurar" as IvaTratamiento, iva_tasa_pct: "",
};

function CuentasCrud() {
  const { activeClinicId } = useActiveClinic();
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CuentaContable | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cfdiConfig, setCfdiConfig] = useState<{ regimen_fiscal: string; tipo_persona: "fisica" | "moral" | null } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await untypedTable("cuentas_contables")
      .select("id,codigo,nombre,tipo,es_fijo,codigo_agrupador_sat,activo,iva_tratamiento,iva_tasa_pct")
      .order("codigo");
    if (err) setError(friendlyError(err));
    else setCuentas((data ?? []) as CuentaContable[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!activeClinicId) return;
    untypedTable("cfdi_config")
      .select("regimen_fiscal,tipo_persona")
      .eq("clinic_id", activeClinicId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) { console.error("[CatalogosTab] cfdi_config", err); return; }
        setCfdiConfig(data as typeof cfdiConfig);
      });
  }, [activeClinicId]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (c: CuentaContable) => {
    setEditing(c);
    setForm({
      codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, es_fijo: c.es_fijo, codigo_agrupador_sat: c.codigo_agrupador_sat ?? "",
      iva_tratamiento: c.iva_tratamiento, iva_tasa_pct: c.iva_tasa_pct != null ? String(c.iva_tasa_pct) : "",
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) { toast.error("Código y nombre son obligatorios"); return; }
    const requiereTasa = form.tipo === "ingreso" && form.iva_tratamiento !== "sin_configurar" && form.iva_tratamiento !== "exento";
    if (requiereTasa && !form.iva_tasa_pct.trim()) { toast.error("Captura la tasa de IVA (%) para este tratamiento"); return; }
    setSaving(true);
    const ivaPayload = form.tipo === "ingreso" ? {
      iva_tratamiento: form.iva_tratamiento,
      iva_tasa_pct: requiereTasa ? parseFloat(form.iva_tasa_pct) : (form.iva_tratamiento === "tasa_0" ? 0 : null),
    } : {};
    const { error: err } = editing
      ? await untypedTable("cuentas_contables").update({
          nombre: form.nombre.trim(),
          es_fijo: form.es_fijo,
          codigo_agrupador_sat: form.codigo_agrupador_sat.trim() || null,
          ...ivaPayload,
        }).eq("id", editing.id)
      : await untypedTable("cuentas_contables").insert({
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          es_fijo: form.es_fijo,
          codigo_agrupador_sat: form.codigo_agrupador_sat.trim() || null,
          ...ivaPayload,
        });
    setSaving(false);
    if (err) { toast.error(friendlyError(err)); return; }
    toast.success(editing ? "Cuenta actualizada" : "Cuenta creada");
    setModalOpen(false);
    load();
  };

  const toggleActivo = async (c: CuentaContable) => {
    const { error: err } = await untypedTable("cuentas_contables").update({ activo: !c.activo }).eq("id", c.id);
    if (err) { toast.error(friendlyError(err)); return; }
    load();
  };

  const exportarCatalogo = () => {
    exportReporteCsv(
      "catalogo_cuentas",
      ["codigo", "nombre", "tipo", "es_fijo", "codigo_agrupador_sat", "activo", "iva_tratamiento", "iva_tasa_pct"],
      cuentas.map((c) => [
        c.codigo, c.nombre, c.tipo, c.es_fijo ? "true" : "false",
        c.codigo_agrupador_sat ?? "", c.activo ? "true" : "false",
        c.iva_tratamiento, c.iva_tasa_pct != null ? String(c.iva_tasa_pct) : "",
      ]),
    );
  };

  // ponytail: parser CSV simple (split por coma, sin comillas embebidas) — mismo patrón
  // que parseEstadoCuentaCsv.ts. Import NUNCA toca iva_tratamiento/iva_tasa_pct: ese
  // campo requiere confirmación explícita con contador (regla dura del proyecto), no se
  // puede masificar por CSV. Solo codigo/nombre/tipo/es_fijo/codigo_agrupador_sat.
  const importarCatalogo = async (file: File) => {
    const texto = await file.text();
    const filas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const inicio = /codigo/i.test(filas[0] ?? "") ? 1 : 0;
    const errores: string[] = [];
    let creadas = 0;
    let actualizadas = 0;

    setImporting(true);
    for (let i = inicio; i < filas.length; i++) {
      const cols = filas[i].split(",").map((c) => c.trim());
      const [codigo, nombre, tipo, esFijoStr, sat] = cols;
      if (!codigo || !nombre) { errores.push(`Línea ${i + 1}: código y nombre requeridos`); continue; }
      if (tipo && tipo !== "ingreso" && tipo !== "egreso") { errores.push(`Línea ${i + 1}: tipo "${tipo}" inválido (ingreso|egreso)`); continue; }
      const existente = cuentas.find((c) => c.codigo === codigo);
      const esFijo = /^(true|si|sí|1)$/i.test(esFijoStr ?? "");

      if (existente) {
        const { error: err } = await untypedTable("cuentas_contables").update({
          nombre, es_fijo: esFijo, codigo_agrupador_sat: sat || null,
        }).eq("id", existente.id);
        if (err) { errores.push(`Línea ${i + 1} (${codigo}): ${friendlyError(err)}`); continue; }
        actualizadas++;
      } else {
        if (!tipo) { errores.push(`Línea ${i + 1}: tipo requerido para cuenta nueva (${codigo})`); continue; }
        const { error: err } = await untypedTable("cuentas_contables").insert({
          codigo, nombre, tipo, es_fijo: esFijo, codigo_agrupador_sat: sat || null,
        });
        if (err) { errores.push(`Línea ${i + 1} (${codigo}): ${friendlyError(err)}`); continue; }
        creadas++;
      }
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (errores.length > 0) {
      toast.error(`${errores.length} línea(s) con error — ver consola`);
      console.error("[CatalogosTab] errores importación:", errores);
    }
    if (creadas || actualizadas) {
      toast.success(`Importación: ${creadas} cuenta(s) creada(s), ${actualizadas} actualizada(s)`);
      load();
    }
  };

  const aplicarSugerido = async (c: CuentaContable, sugerido: { tratamiento: IvaTratamiento; tasaPct: number | null }) => {
    const { error: err } = await untypedTable("cuentas_contables").update({
      iva_tratamiento: sugerido.tratamiento,
      iva_tasa_pct: sugerido.tasaPct,
    }).eq("id", c.id);
    if (err) { toast.error(friendlyError(err)); return; }
    toast.success(`IVA de ${c.nombre} actualizado`);
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-sm">Cuentas contables</CardTitle>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importarCatalogo(f); }}
          />
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5"
            disabled={importing} onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" /> {importing ? "Importando…" : "Importar CSV"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={cuentas.length === 0} onClick={exportarCatalogo}>
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
          <Button size="sm" onClick={openCreate} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nueva cuenta
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive mb-2">Error: {error}</p>}
        {loading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Código</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Nombre</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Tipo</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Fijo</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">SAT</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">IVA</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Activo</th>
                  <th className="pb-2 font-medium text-muted-foreground" />
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={c.id} className={`border-b border-border/40 last:border-0 ${!c.activo ? "opacity-50" : ""}`}>
                    <td className="py-2 pr-4 font-mono text-xs">{c.codigo}</td>
                    <td className="py-2 pr-4">{c.nombre}</td>
                    <td className="py-2 pr-4 capitalize">{c.tipo}</td>
                    <td className="py-2 pr-4">{c.es_fijo ? "Sí" : "No"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{c.codigo_agrupador_sat ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {c.tipo === "ingreso" ? (
                        <div className="flex items-center gap-2">
                          <span className={c.iva_tratamiento === "sin_configurar" ? "text-amber-600" : "text-muted-foreground"}>
                            {IVA_LABELS[c.iva_tratamiento]}{c.iva_tratamiento === "tasa_general" && c.iva_tasa_pct != null ? ` (${c.iva_tasa_pct}%)` : ""}
                          </span>
                          {(() => {
                            if (!cfdiConfig || !["ING_CONSULTAS", "ING_FARMACIA", "ING_OTROS"].includes(c.codigo)) return null;
                            const sugerido = deriveIvaTratamiento(cfdiConfig.regimen_fiscal, cfdiConfig.tipo_persona, c.codigo as CodigoCuentaIngreso);
                            if (!sugerido) {
                              return <span className="text-xs text-muted-foreground">Define tipo de persona en Facturación</span>;
                            }
                            if (sugerido.tratamiento === c.iva_tratamiento && sugerido.tasaPct === c.iva_tasa_pct) return null;
                            return (
                              <Button
                                size="sm" variant="outline" className="h-6 px-2 text-xs"
                                onClick={() => aplicarSugerido(c, sugerido)}
                              >
                                Aplicar: {IVA_LABELS[sugerido.tratamiento]}{sugerido.tasaPct ? ` (${sugerido.tasaPct}%)` : ""}
                              </Button>
                            );
                          })()}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="py-2 pr-4">{c.activo ? "Activo" : "Inactivo"}</td>
                    <td className="py-2 text-right space-x-2">
                      <Button size="sm" variant="outline" className="h-7" onClick={() => openEdit(c)}>Editar</Button>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => toggleActivo(c)}>
                        {c.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="field-codigo">Código *</Label>
              <Input id="field-codigo" value={form.codigo} disabled={!!editing}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <Label htmlFor="field-nombre">Nombre *</Label>
              <Input id="field-nombre" value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Tipo *</Label>
              <Select value={form.tipo} disabled={!!editing} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as "ingreso" | "egreso" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="field-codigo_agrupador_sat">Código SAT</Label>
              <Input id="field-codigo_agrupador_sat" value={form.codigo_agrupador_sat} placeholder="Opcional"
                onChange={(e) => setForm((f) => ({ ...f, codigo_agrupador_sat: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="field-es_fijo" checked={form.es_fijo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, es_fijo: !!v }))} />
              <Label htmlFor="field-es_fijo" className="text-sm font-normal">Gasto fijo (punto de equilibrio)</Label>
            </div>
            {form.tipo === "ingreso" && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Tratamiento de IVA de este ingreso — confírmalo con tu contador antes de
                  configurarlo (afecta si se retiene IVA al cobrar).
                </p>
                <div>
                  <Label className="text-sm">Tratamiento IVA</Label>
                  <Select value={form.iva_tratamiento} onValueChange={(v) => setForm((f) => ({ ...f, iva_tratamiento: v as IvaTratamiento, iva_tasa_pct: v === "tasa_general" ? f.iva_tasa_pct : "" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(IVA_LABELS) as IvaTratamiento[]).map((k) => (
                        <SelectItem key={k} value={k}>{IVA_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.iva_tratamiento === "tasa_general" && (
                  <div>
                    <Label htmlFor="field-iva_tasa_pct">Tasa de IVA (%) *</Label>
                    <Input id="field-iva_tasa_pct" type="number" step="0.01" placeholder="16"
                      value={form.iva_tasa_pct} onChange={(e) => setForm((f) => ({ ...f, iva_tasa_pct: e.target.value }))} />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function OtrosCatalogos() {
  const links = [
    { to: "/ajustes", icon: Package, title: "Proveedores e Insumos", desc: "Catálogo de insumos, kits y proveedores" },
    { to: "/admin/usuarios", icon: Users, title: "Doctores y Enfermeras", desc: "Alta y administración de personal clínico" },
  ];
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {links.map(({ to, icon: Icon, title, desc }) => (
        <Link key={to} to={to}>
          <Card className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="shrink-0 rounded-lg p-2 bg-slate-100">
                <Icon className="h-4 w-4 text-slate-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground truncate">{desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function CatalogosTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [arbolOpen, setArbolOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setArbolOpen(true)}>
          <Network className="h-3.5 w-3.5" /> Ver árbol de cuentas
        </Button>
      </div>
      <ArbolCuentasDialog open={arbolOpen} onOpenChange={setArbolOpen} />

      {isAdmin ? (
        <CuentasCrud />
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Solo administradores pueden crear o editar cuentas contables.
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-sm font-medium mb-2">Otros catálogos</h2>
        <OtrosCatalogos />
      </div>
    </div>
  );
}
