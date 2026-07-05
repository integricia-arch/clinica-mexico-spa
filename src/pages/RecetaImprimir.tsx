import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Printer, ArrowLeft, ShieldCheck } from "lucide-react";
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
        const { data: rx, error } = await (supabase as any)
          .from("prescriptions")
          .select("id, prescription_number, issue_date, diagnosis, notes, qr_code_value, template_snapshot_json, doctor_id, patient_id")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        if (!rx) throw new Error("Receta no encontrada");

        const rxd = rx as Record<string, unknown>;
        const [docRes, patRes, itemsRes] = await Promise.all([
          (supabase as any).from("doctors").select("nombre, apellidos, especialidad, cedula_profesional").eq("id", rxd.doctor_id as string).maybeSingle(),
          (supabase as any).from("patients").select("nombre, apellidos, fecha_nacimiento, sexo").eq("id", rxd.patient_id as string).maybeSingle(),
          (supabase as any).from("prescription_items").select("*").eq("prescription_id", id),
        ]);

        const tpl = (rxd.template_snapshot_json as { logo_path?: string | null; firma_path?: string | null } | null) ?? null;
        const [logoUrl, firmaUrl] = await Promise.all([
          getAssetSignedUrl(tpl?.logo_path ?? null),
          getAssetSignedUrl(tpl?.firma_path ?? null),
        ]);

        setData({
          number: (rxd.prescription_number as string | null) || "—",
          issue_date: rxd.issue_date as string | null,
          diagnosis: rxd.diagnosis as string | null,
          notes: rxd.notes as string | null,
          qr_code_value: rxd.qr_code_value as string | null,
          doctor: docRes.data ?? { nombre: "", apellidos: "", especialidad: "", cedula_profesional: null },
          patient: patRes.data ?? { nombre: "", apellidos: "", fecha_nacimiento: null, sexo: null },
          items: (itemsRes.data as PrescriptionPrintData["items"]) ?? [],
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
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/receta/${id}/bitacora`}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Bitácora
            </Link>
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>
      <PrescriptionPrintView data={data} />
    </div>
  );
}
