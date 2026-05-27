import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface SnapshotTemplate {
  consultorio_nombre?: string | null;
  consultorio_direccion?: string | null;
  consultorio_telefono?: string | null;
  consultorio_email?: string | null;
  encabezado_extra?: string | null;
  pie_pagina?: string | null;
  indicaciones_default?: string | null;
  color_primario?: string | null;
  logo_path?: string | null;
  firma_path?: string | null;
  mostrar_qr?: boolean;
  mostrar_cedula?: boolean;
  mostrar_especialidad?: boolean;
  mostrar_firma?: boolean;
  tamano_papel?: string;
}

export interface PrescriptionPrintData {
  number: string;
  issue_date: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  qr_code_value?: string | null;
  doctor: { nombre: string; apellidos: string; especialidad: string; cedula_profesional: string | null };
  patient: { nombre: string; apellidos: string; fecha_nacimiento: string | null; sexo: string | null };
  items: Array<{
    generic_name: string;
    brand_name?: string | null;
    concentration?: string | null;
    pharmaceutical_form?: string | null;
    dose: string;
    route: string;
    frequency: string;
    duration: string;
    quantity?: number | null;
    instructions: string;
  }>;
  template: SnapshotTemplate | null;
  logoUrl?: string | null;
  firmaUrl?: string | null;
}

function calcAge(dob: string | null): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  return `${years} años`;
}

export default function PrescriptionPrintView({ data }: { data: PrescriptionPrintData }) {
  const t = data.template ?? {};
  const color = t.color_primario || "#0F766E";
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!t.mostrar_qr && t.mostrar_qr !== undefined) return;
    if (!data.qr_code_value) return;
    QRCode.toDataURL(data.qr_code_value, { width: 160, margin: 0 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [data.qr_code_value, t.mostrar_qr]);

  const doctorName = `Dr(a). ${data.doctor.nombre} ${data.doctor.apellidos}`;
  const patientName = `${data.patient.nombre} ${data.patient.apellidos}`;
  const issued = data.issue_date ? new Date(data.issue_date).toLocaleString("es-MX") : "—";

  return (
    <div className="rx-sheet bg-white text-neutral-900 mx-auto" style={{ borderColor: color }}>
      <style>{`
        @media print {
          @page { size: ${t.tamano_papel === "media_carta" ? "letter portrait" : "letter portrait"}; margin: 12mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .rx-sheet { box-shadow: none !important; border: none !important; }
        }
        .rx-sheet { width: 100%; max-width: 800px; border: 1px solid; }
      `}</style>

      {/* Encabezado */}
      <div className="px-8 py-5 flex items-start gap-4 border-b-2" style={{ borderColor: color }}>
        {data.logoUrl ? (
          <img src={data.logoUrl} alt="Logo" className="h-20 w-20 object-contain" />
        ) : null}
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color }}>
            {t.consultorio_nombre || "Consultorio"}
          </h1>
          <p className="text-xs text-neutral-700">{t.consultorio_direccion}</p>
          <p className="text-xs text-neutral-700">
            {[t.consultorio_telefono, t.consultorio_email].filter(Boolean).join(" · ")}
          </p>
          {t.encabezado_extra && <p className="text-xs text-neutral-500 whitespace-pre-line">{t.encabezado_extra}</p>}
        </div>
        <div className="text-right text-xs">
          <p className="font-bold">{doctorName}</p>
          {(t.mostrar_especialidad ?? true) && <p>{data.doctor.especialidad}</p>}
          {(t.mostrar_cedula ?? true) && data.doctor.cedula_profesional && (
            <p>Céd. Prof. {data.doctor.cedula_profesional}</p>
          )}
        </div>
      </div>

      {/* Folio + paciente */}
      <div className="px-8 py-3 border-b border-neutral-200 text-xs">
        <div className="flex justify-between mb-2">
          <span><strong>Folio:</strong> {data.number}</span>
          <span><strong>Fecha de emisión:</strong> {issued}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-2"><span className="text-neutral-500">Paciente:</span> {patientName}</div>
          <div><span className="text-neutral-500">Edad:</span> {calcAge(data.patient.fecha_nacimiento)}</div>
          <div><span className="text-neutral-500">Sexo:</span> {data.patient.sexo || "—"}</div>
        </div>
        {data.diagnosis && (
          <div className="mt-2"><span className="text-neutral-500">Diagnóstico:</span> {data.diagnosis}</div>
        )}
      </div>

      {/* Cuerpo Rx */}
      <div className="px-8 py-5 min-h-[260px]">
        <p className="text-3xl italic font-serif mb-4" style={{ color }}>℞</p>
        {data.items.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin medicamentos prescritos.</p>
        ) : (
          <ol className="space-y-3 text-sm list-decimal pl-6">
            {data.items.map((it, i) => (
              <li key={i}>
                <div className="font-semibold">
                  {it.generic_name}
                  {it.concentration ? ` ${it.concentration}` : ""}
                  {it.pharmaceutical_form ? ` (${it.pharmaceutical_form})` : ""}
                  {it.brand_name ? ` — ${it.brand_name}` : ""}
                </div>
                <div className="text-xs text-neutral-700">
                  {it.dose} · {it.route} · {it.frequency} · por {it.duration}
                  {it.quantity ? ` · Cantidad: ${it.quantity}` : ""}
                </div>
                {it.instructions && (
                  <div className="text-xs text-neutral-700 italic mt-0.5">{it.instructions}</div>
                )}
              </li>
            ))}
          </ol>
        )}
        {t.indicaciones_default && (
          <div className="mt-5 text-xs text-neutral-700 whitespace-pre-line border-t pt-3">
            <p className="font-semibold mb-1">Indicaciones generales:</p>
            {t.indicaciones_default}
          </div>
        )}
        {data.notes && (
          <div className="mt-3 text-xs text-neutral-700 whitespace-pre-line">
            <p className="font-semibold mb-1">Notas:</p>
            {data.notes}
          </div>
        )}
      </div>

      {/* Cierre */}
      <div className="px-8 pb-6 pt-3 flex items-end justify-between gap-4 border-t border-neutral-200">
        <div className="text-[10px] text-neutral-600 max-w-[55%] whitespace-pre-line">
          {t.pie_pagina || "Esta receta forma parte del expediente clínico del paciente."}
        </div>
        <div className="flex items-end gap-6">
          {(t.mostrar_firma ?? true) && (
            <div className="text-center">
              {data.firmaUrl ? (
                <img src={data.firmaUrl} alt="Firma" className="h-14 object-contain mx-auto" />
              ) : (
                <div className="h-14 w-40 border-b border-neutral-400" />
              )}
              <p className="text-[10px] mt-1 font-semibold">{doctorName}</p>
              {(t.mostrar_cedula ?? true) && data.doctor.cedula_profesional && (
                <p className="text-[10px] text-neutral-500">Céd. {data.doctor.cedula_profesional}</p>
              )}
            </div>
          )}
          {(t.mostrar_qr ?? true) && qrDataUrl && (
            <div className="text-center">
              <img src={qrDataUrl} alt="QR" className="h-20 w-20" />
              <p className="text-[9px] text-neutral-500 mt-1">Folio QR interno</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
