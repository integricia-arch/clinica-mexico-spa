import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Printer, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/errors";
import { getAssetSignedUrl } from "@/features/recetas/services/prescriptionTemplateService";
import PrescriptionPrintView, { type PrescriptionPrintData } from "@/features/recetas/components/PrescriptionPrintView";

export default function RecetaImprimir() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PrescriptionPrintData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data: rx, error } = await supabase
          .from("prescriptions")
          .select(`
            id, prescription_number, issue_date, diagnosis, notes, qr_code_value,
            template_snapshot_json,
            doctor:doctors!prescriptions_doctor_id_fkey(nombre, apellidos, especialidad, cedula_profesional),
            patient:patients!prescriptions_patient_id_fkey(nombre, apellidos, fecha_nacimiento, sexo),
            items:prescription_items(*)
          `)
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        if (!rx) throw new Error("Receta no encontrada");

        const tpl = (rx as any).template_snapshot_json ?? null;
        const [logoUrl, firmaUrl] = await Promise.all([
          getAssetSignedUrl(tpl?.logo_path ?? null),
          getAssetSignedUrl(tpl?.firma_path ?? null),
        ]);

        setData({
          number: (rx as any).prescription_number || "—",
          issue_date: (rx as any).issue_date,
          diagnosis: (rx as any).diagnosis,
          notes: (rx as any).notes,
          qr_code_value: (rx as any).qr_code_value,
          doctor: (rx as any).doctor,
          patient: (rx as any).patient,
          items: (rx as any).items ?? [],
          template: tpl,
          logoUrl,
          firmaUrl,
        });
      } catch (err) {
        toast.error("No se pudo cargar la receta: " + friendlyError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handlePrint = async () => {
    window.print();
    // Registra evento de impresión en auditoría
    if (id) {
      await supabase.rpc("log_audit", {
        _accion: "actualizar",
        _tabla: "prescriptions",
        _registro_id: id,
        _datos_nuevos: { event: "printed", at: new Date().toISOString() } as never,
      }).then(() => {/* mejor esfuerzo */}, () => {});
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando receta…</div>;
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Receta no disponible.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <Link to="/farmacia" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <Button onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" /> Imprimir
        </Button>
      </div>
      <PrescriptionPrintView data={data} />
    </div>
  );
}
