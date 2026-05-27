import { QrCode } from "lucide-react";
import type { DoctorPrescriptionTemplate } from "../services/prescriptionTemplateService";

interface Props {
  template: DoctorPrescriptionTemplate;
  doctorName?: string;
  doctorEspecialidad?: string;
  doctorCedula?: string;
  logoUrl?: string | null;
  firmaUrl?: string | null;
}

/** Vista previa del machote. Muestra cómo se imprimirá la receta. */
export default function PrescriptionTemplatePreview({
  template,
  doctorName = "Dr. Nombre Apellido",
  doctorEspecialidad = "Especialidad",
  doctorCedula = "0000000",
  logoUrl,
  firmaUrl,
}: Props) {
  const color = template.color_primario || "#0F766E";

  return (
    <div
      className="rounded-lg border bg-white text-neutral-900 shadow-card overflow-hidden"
      style={{ borderColor: color }}
    >
      {/* Encabezado */}
      <div
        className="px-6 py-4 flex items-start gap-4 border-b"
        style={{ borderColor: color }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo consultorio" className="h-16 w-16 object-contain" />
        ) : (
          <div
            className="h-16 w-16 rounded-md grid place-items-center text-xs text-neutral-400 border border-dashed"
            style={{ borderColor: color }}
          >
            LOGO
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-semibold" style={{ color }}>
            {template.consultorio_nombre || "Nombre del consultorio"}
          </h2>
          <p className="text-xs text-neutral-600">
            {template.consultorio_direccion || "Dirección del consultorio"}
          </p>
          <p className="text-xs text-neutral-600">
            {[template.consultorio_telefono, template.consultorio_email].filter(Boolean).join(" · ") ||
              "Tel · Correo"}
          </p>
          {template.encabezado_extra && (
            <p className="text-xs text-neutral-500 mt-1 whitespace-pre-line">{template.encabezado_extra}</p>
          )}
        </div>
        <div className="text-right text-xs text-neutral-700">
          <p className="font-semibold">{doctorName}</p>
          {template.mostrar_especialidad && <p>{doctorEspecialidad}</p>}
          {template.mostrar_cedula && <p>Céd. Prof. {doctorCedula}</p>}
        </div>
      </div>

      {/* Datos paciente (placeholder) */}
      <div className="px-6 py-3 text-xs grid grid-cols-3 gap-2 border-b border-neutral-200">
        <div><span className="text-neutral-500">Paciente:</span> Juan Pérez García</div>
        <div><span className="text-neutral-500">Edad:</span> 35 años</div>
        <div><span className="text-neutral-500">Fecha:</span> 27/05/2026</div>
      </div>

      {/* Cuerpo: Rx */}
      <div className="px-6 py-4 min-h-[200px]">
        <p className="text-2xl italic font-serif mb-3" style={{ color }}>℞</p>
        <ol className="text-sm space-y-2 list-decimal pl-5">
          <li>
            <strong>Paracetamol 500 mg</strong> — 1 tableta vía oral cada 8 horas por 5 días.
          </li>
          <li>
            <strong>Amoxicilina 500 mg</strong> — 1 cápsula vía oral cada 8 horas por 7 días.
          </li>
        </ol>
        {template.indicaciones_default && (
          <div className="mt-4 text-xs text-neutral-700 whitespace-pre-line border-t pt-3">
            <p className="font-semibold mb-1">Indicaciones generales:</p>
            {template.indicaciones_default}
          </div>
        )}
      </div>

      {/* Cierre: firma + QR + pie */}
      <div className="px-6 pb-4 pt-2 flex items-end justify-between gap-4">
        <div className="text-xs text-neutral-600 max-w-[60%] whitespace-pre-line">
          {template.pie_pagina || "Esta receta forma parte del expediente clínico del paciente."}
        </div>
        <div className="flex items-end gap-4">
          {template.mostrar_firma && (
            <div className="text-center">
              {firmaUrl ? (
                <img src={firmaUrl} alt="Firma" className="h-12 object-contain mx-auto" />
              ) : (
                <div className="h-12 w-32 border-b border-neutral-400" />
              )}
              <p className="text-[10px] mt-1">{doctorName}</p>
              {template.mostrar_cedula && (
                <p className="text-[10px] text-neutral-500">Céd. {doctorCedula}</p>
              )}
            </div>
          )}
          {template.mostrar_qr && (
            <div className="text-center">
              <div
                className="h-16 w-16 grid place-items-center border rounded"
                style={{ borderColor: color }}
              >
                <QrCode className="h-10 w-10" style={{ color }} />
              </div>
              <p className="text-[9px] text-neutral-500 mt-1">Folio QR</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
