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
          .select("id, prescription_number, issue_date, diagnosis, notes, qr_code_value, template_snapshot_json, doctor_id, patient_id")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        if (!rx) throw new Error("Receta no encontrada");

        const [docRes, patRes, itemsRes] = await Promise.all([
          supabase.from("doctors").select("nombre, apellidos, especialidad, cedula_profesional").eq("id", (rx as any).doctor_id).maybeSingle(),
          supabase.from("patients").select("nombre, apellidos, fecha_nacimiento, sexo").eq("id", (rx as any).patient_id).maybeSingle(),
          supabase.from("prescription_items").select("*").eq("prescription_id", id),
        ]);

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
          doctor: (docRes.data as any) ?? { nombre: "", apellidos: "", especialidad: "", cedula_profesional: null },
          patient: (patRes.data as any) ?? { nombre: "", apellidos: "", fecha_nacimiento: null, sexo: null },
          items: (itemsRes.data as any) ?? [],
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
    if (id) {
      const { countPrintEvents, logPrescriptionEvent } = await import("@/features/recetas/services/prescriptionAuditService");
      const prev = await countPrintEvents(id);
      await logPrescriptionEvent(id, prev > 0 ? "reprinted" : "printed", { print_index: prev + 1 });
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
