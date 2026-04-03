import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Phone, Mail } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Patient = Tables<"patients">;

export default function PacientesLista() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("activo", true)
        .order("apellidos", { ascending: true });
      setPatients(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = patients.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(term) ||
      p.apellidos.toLowerCase().includes(term) ||
      (p.telefono && p.telefono.includes(term)) ||
      (p.curp && p.curp.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {patients.length} pacientes registrados
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo paciente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono o CURP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No se encontraron pacientes</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-border bg-card p-4 shadow-card hover:shadow-elevated transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  {p.nombre[0]}{p.apellidos[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-card-foreground truncate">
                    {p.apellidos}, {p.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.fecha_nacimiento
                      ? format(new Date(p.fecha_nacimiento), "dd/MM/yyyy", { locale: es })
                      : "Sin fecha de nacimiento"}{" "}
                    · {p.sexo === "M" ? "Masculino" : p.sexo === "F" ? "Femenino" : p.sexo || "—"}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {p.telefono && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{p.telefono}</span>
                  </div>
                )}
                {p.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{p.email}</span>
                  </div>
                )}
              </div>

              {p.tipo_sangre && (
                <span className="mt-2 inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  {p.tipo_sangre}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
