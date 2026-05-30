import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import DoctorPatientQueue from "@/features/panel-doctor/components/DoctorPatientQueue";
import PatientClinicalContext from "@/features/panel-doctor/components/PatientClinicalContext";
import { DoctorConfirmationPanel } from "@/features/panel-doctor/components/DoctorConfirmationPanel";
import { useDoctorQueue, type DoctorQueueItem } from "@/features/panel-doctor/hooks/useDoctorQueue";
import { usePatientClinicalSnapshot } from "@/features/panel-doctor/hooks/usePatientClinicalSnapshot";

export default function PanelDoctor() {
  const { user, roles } = useAuth();
  const [params, setParams] = useSearchParams();
  const isAdmin = roles.includes("admin");
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorInfo, setDoctorInfo] = useState<any | null>(null);
  const [noDoctorProfile, setNoDoctorProfile] = useState(false);

  useEffect(() => {
    (async () => {
      if (isAdmin) {
        const { data } = await supabase.from("doctors").select("id, nombre, apellidos, user_id, operational_status, operational_status_reason, operational_status_until").eq("activo", true);
        setDoctors(data ?? []);
        if (data && data.length > 0 && !doctorId) setDoctorId(data[0].id);
      } else if (user?.id) {
        const { data } = await supabase.from("doctors").select("id, operational_status, operational_status_reason, operational_status_until").eq("user_id", user.id).maybeSingle();
        if (data?.id) { setDoctorId(data.id); setDoctorInfo(data); }
        else setNoDoctorProfile(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (isAdmin && doctorId) {
      setDoctorInfo(doctors.find((d) => d.id === doctorId) ?? null);
    }
  }, [isAdmin, doctorId, doctors]);

  const { items, loading } = useDoctorQueue(doctorId);
  const selectedId = params.get("cita");
  const selected: DoctorQueueItem | null = useMemo(
    () => items.find((i) => i.appointment_id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );
  const snapshot = usePatientClinicalSnapshot(selected?.patient?.id ?? null, doctorId);

  if (noDoctorProfile) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-display text-xl font-semibold">Panel del doctor</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          No se encontró un perfil médico vinculado a este usuario.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-display text-2xl font-semibold">Panel del doctor</h1>
          <p className="text-sm text-muted-foreground">Atención clínica guiada · {items.length} cita{items.length !== 1 && "s"} hoy</p>
        </div>
        {isAdmin && doctors.length > 0 && (
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={doctorId ?? ""}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                Dr. {d.nombre} {d.apellidos}
              </option>
            ))}
          </select>
        )}
      </div>

      <DoctorConfirmationPanel doctorId={doctorId} />

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-0 h-full">
            <DoctorPatientQueue
              items={items}
              loading={loading}
              selectedAppointmentId={selected?.appointment_id ?? null}
              onSelect={(it) => setParams({ cita: it.appointment_id })}
            />
          </CardContent>
        </Card>

        <div className="overflow-y-auto">
          {selected ? (
            <PatientClinicalContext item={selected} snapshot={snapshot} doctorId={doctorId} />
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Selecciona un paciente para comenzar.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
