import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedTable";

// ponytail: XML SIN FIRMAR (sin e.firma). El SAT exige que estos archivos vayan
// firmados con la e.firma del contribuyente para subirse al buzón — esta app no
// toca llaves privadas de firma (fuera de alcance permanente, ver CLAUDE.md). El
// contador externo firma y sube esto con su propio software/PAC.

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function download(filename: string, xml: string) {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface CuentaRow {
  codigo: string;
  nombre: string;
  nivel: number;
  naturaleza: string;
  codigo_agrupador_sat: string | null;
  cuenta_padre_id: string | null;
}

interface BalanzaRow {
  codigo: string;
  saldo_inicial_centavos: number;
  cargos_centavos: number;
  abonos_centavos: number;
  saldo_final_centavos: number;
}

interface EmisorFiscal {
  rfc: string;
  regimen_fiscal: string;
}

async function cargarEmisor(clinicId: string): Promise<EmisorFiscal> {
  const { data, error } = await untypedTable("cfdi_config")
    .select("rfc,regimen_fiscal")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { rfc?: string; regimen_fiscal?: string } | null;
  if (!row?.rfc) throw new Error("Configura el RFC en Configuración → Facturación y CFDI antes de exportar Anexo 24.");
  return { rfc: row.rfc, regimen_fiscal: row.regimen_fiscal ?? "601" };
}

export async function exportarCatalogoCuentasAnexo24(clinicId: string, mes: number, anio: number) {
  const emisor = await cargarEmisor(clinicId);
  const { data, error } = await untypedTable("cuentas_contables")
    .select("codigo,nombre,nivel,naturaleza,codigo_agrupador_sat,cuenta_padre_id")
    .eq("activo", true)
    .order("codigo");
  if (error) throw new Error(error.message);
  const cuentas = (data ?? []) as CuentaRow[];

  const ctas = cuentas.map((c) => `    <Ctas:Ctas CodAgrup="${xmlEscape(c.codigo_agrupador_sat ?? "")}" NumCta="${xmlEscape(c.codigo)}" Desc="${xmlEscape(c.nombre)}" Nivel="${c.nivel}" Natur="${c.naturaleza === "deudora" ? "D" : "A"}"/>`).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- SIN FIRMAR: falta e.firma del contribuyente, agregarla con el software del contador antes de subir al SAT. -->
<Ctas:Catalogo xmlns:Ctas="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas"
  Version="1.3" RFC="${xmlEscape(emisor.rfc)}" Mes="${String(mes).padStart(2, "0")}" Anio="${anio}">
${ctas}
</Ctas:Catalogo>`;

  download(`catalogo_cuentas_${anio}${String(mes).padStart(2, "0")}.xml`, xml);
}

export async function exportarBalanzaAnexo24(clinicId: string, mes: number, anio: number, desde: string, hasta: string) {
  const emisor = await cargarEmisor(clinicId);
  const { data, error } = await (supabase as any).rpc("balanza_comprobacion", {
    p_clinic_id: clinicId, p_desde: desde, p_hasta: hasta,
  });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as BalanzaRow[];

  const ctas = filas.map((f) => `    <BCE:Ctas NumCta="${xmlEscape(f.codigo)}" SaldoIni="${(f.saldo_inicial_centavos / 100).toFixed(2)}" Debe="${(f.cargos_centavos / 100).toFixed(2)}" Haber="${(f.abonos_centavos / 100).toFixed(2)}" SaldoFin="${(f.saldo_final_centavos / 100).toFixed(2)}"/>`).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- SIN FIRMAR: falta e.firma del contribuyente, agregarla con el software del contador antes de subir al SAT. -->
<BCE:Balanza xmlns:BCE="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion"
  Version="1.3" RFC="${xmlEscape(emisor.rfc)}" Mes="${String(mes).padStart(2, "0")}" Anio="${anio}" TipoEnvio="N">
${ctas}
</BCE:Balanza>`;

  download(`balanza_comprobacion_${anio}${String(mes).padStart(2, "0")}.xml`, xml);
}
