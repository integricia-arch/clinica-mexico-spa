import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ShieldCheck, Search, Users as UsersIcon } from "lucide-react";

type AppRole = "admin" | "receptionist" | "doctor" | "nurse" | "patient";

const ROLE_OPTIONS: AppRole[] = ["admin", "receptionist", "doctor", "nurse", "patient"];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  receptionist: "Recepción",
  doctor: "Médico",
  nurse: "Enfermería",
  patient: "Paciente",
};

const ROLE_BADGE: Record<AppRole, string> = {
  admin: "bg-primary text-primary-foreground",
  receptionist: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  doctor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  nurse: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  patient: "bg-muted text-muted-foreground",
};

interface UsuarioRow {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  roles: AppRole[];
}

export default function AdminUsuarios() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UsuarioRow[]>([]);
  const [query, setQuery] = useState("");
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", { body: {} });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error("No se pudieron cargar los usuarios");
      return;
    }
    setUsers(((data as any)?.users ?? []) as UsuarioRow[]);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.email?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
    );
  }, [users, query]);

  const toggleRole = async (user: UsuarioRow, role: AppRole) => {
    const has = user.roles.includes(role);
    setBusyUser(user.id);
    try {
      if (has) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", user.id)
          .eq("role", role);
        if (error) throw error;
        setUsers((prev) => prev.map((u) =>
          u.id === user.id ? { ...u, roles: u.roles.filter((r) => r !== role) } : u
        ));
        toast.success(`Rol "${ROLE_LABELS[role]}" removido`);
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role });
        if (error) throw error;
        setUsers((prev) => prev.map((u) =>
          u.id === user.id ? { ...u, roles: [...u.roles, role] } : u
        ));
        toast.success(`Rol "${ROLE_LABELS[role]}" asignado`);
      }
    } catch (err: any) {
      toast.error(err.message || "No se pudo actualizar el rol");
    } finally {
      setBusyUser(null);
    }
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Gestión de usuarios y roles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Asigna o remueve roles para cada usuario registrado en el sistema.
          </p>
        </div>
        <Button variant="outline" onClick={fetchUsers} disabled={loading}>
          Recargar
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por correo o ID…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Usuario</th>
                <th className="text-left px-4 py-3 font-medium">Roles actuales</th>
                <th className="text-left px-4 py-3 font-medium">Último acceso</th>
                <th className="text-left px-4 py-3 font-medium">Asignar / Remover</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-8 w-64" /></td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    <UsersIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    Sin usuarios para mostrar
                  </td>
                </tr>
              )}

              {!loading && filtered.map((u) => (
                <tr key={u.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.email ?? "(sin correo)"}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{u.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sin rol</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles.map((r) => (
                          <Badge key={r} className={ROLE_BADGE[r as AppRole]}>
                            {ROLE_LABELS[r as AppRole] ?? r}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {fmt(u.last_sign_in_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {ROLE_OPTIONS.map((role) => {
                        const has = u.roles.includes(role);
                        return (
                          <Button
                            key={role}
                            size="sm"
                            variant={has ? "default" : "outline"}
                            disabled={busyUser === u.id}
                            onClick={() => toggleRole(u, role)}
                            className="h-7 text-xs"
                          >
                            {has ? "✓ " : "+ "}{ROLE_LABELS[role]}
                          </Button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
