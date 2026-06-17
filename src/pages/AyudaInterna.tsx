import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Estado = "abierta" | "escalada" | "cerrada";

interface Sesion {
  id: string;
  user_id: string;
  estado: Estado;
  atendido_por: string | null;
  ruta_origen: string | null;
  started_at: string;
  closed_at: string | null;
}

interface Mensaje {
  id: string;
  sesion_id: string;
  rol: "usuario" | "asistente_ia" | "humano" | "sistema";
  contenido: string;
  created_at: string;
  autor_id: string | null;
}

interface UsuarioInfo {
  email: string | null;
  full_name: string | null;
}

const FILTROS: { key: "todas" | Estado; label: string }[] = [
  { key: "escalada", label: "Escaladas" },
  { key: "abierta", label: "Abiertas" },
  { key: "cerrada", label: "Cerradas" },
  { key: "todas", label: "Todas" },
];

export default function AyudaInterna() {
  const { user } = useAuth();
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [usuarios, setUsuarios] = useState<Record<string, UsuarioInfo>>({});
  const [filtro, setFiltro] = useState<"todas" | Estado>("escalada");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchSesiones = async () => {
    const { data, error } = await supabase
      .from("ayuda_chat_sesiones")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Error cargando sesiones de ayuda");
      return;
    }
    setSesiones((data ?? []) as Sesion[]);

    const ids = Array.from(new Set((data ?? []).map((s) => s.user_id)));
    if (ids.length) {
      const { data: resolved } = await supabase.rpc("ayuda_chat_resolver_usuarios", { p_user_ids: ids });
      const map: Record<string, UsuarioInfo> = {};
      (resolved ?? []).forEach((r: { user_id: string; email: string | null; full_name: string | null }) => {
        map[r.user_id] = { email: r.email, full_name: r.full_name };
      });
      setUsuarios(map);
    }
  };

  useEffect(() => {
    fetchSesiones();
    const ch = supabase
      .channel("ayuda-chat-sesiones-staff")
      .on("postgres_changes", { event: "*", schema: "public", table: "ayuda_chat_sesiones" }, fetchSesiones)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const loadMensajes = async (sesionId: string) => {
    const { data } = await supabase
      .from("ayuda_chat_mensajes")
      .select("*")
      .eq("sesion_id", sesionId)
      .order("created_at", { ascending: true });
    setMensajes((data ?? []) as Mensaje[]);
  };

  useEffect(() => {
    if (!selectedId) return;
    loadMensajes(selectedId);
    const ch = supabase
      .channel(`ayuda-chat-staff-${selectedId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ayuda_chat_mensajes", filter: `sesion_id=eq.${selectedId}` }, (payload) => {
        setMensajes((prev) => [...prev, payload.new as Mensaje]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const tomarSesion = async (s: Sesion) => {
    const { error } = await supabase
      .from("ayuda_chat_sesiones")
      .update({ atendido_por: user!.id, estado: "abierta" })
      .eq("id", s.id);
    if (error) toast.error("No se pudo tomar la sesión");
  };

  const cerrarSesion = async (s: Sesion) => {
    const { error } = await supabase
      .from("ayuda_chat_sesiones")
      .update({ estado: "cerrada", closed_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) toast.error("No se pudo cerrar la sesión");
    else if (selectedId === s.id) setSelectedId(null);
  };

  const handleReply = async () => {
    if (!reply.trim() || !selectedId || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("ayuda_chat_mensajes").insert({
        sesion_id: selectedId,
        rol: "humano",
        autor_id: user.id,
        contenido: reply.trim(),
      });
      if (error) {
        toast.error("No se pudo enviar la respuesta");
        return;
      }
      setReply("");
    } finally {
      setSending(false);
    }
  };

  const visibles = sesiones.filter((s) => filtro === "todas" || s.estado === filtro);
  const selected = sesiones.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <LifeBuoy className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Ayuda interna</h2>
        </div>
        <div className="flex gap-1 border-b border-border p-2">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                filtro === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {visibles.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">Sin sesiones en este filtro.</p>
          )}
          {visibles.map((s) => {
            const info = usuarios[s.user_id];
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left hover:bg-muted/60",
                  selectedId === s.id && "bg-muted",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">{info?.full_name || info?.email || "Usuario"}</span>
                  <Badge variant={s.estado === "escalada" ? "destructive" : s.estado === "cerrada" ? "outline" : "secondary"} className="text-[10px]">
                    {s.estado}
                  </Badge>
                </div>
                <span className="truncate text-xs text-muted-foreground">{s.ruta_origen || "—"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col rounded-lg border border-border bg-card">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Selecciona una sesión para ver la conversación.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border p-3">
              <div>
                <p className="text-sm font-semibold">
                  {usuarios[selected.user_id]?.full_name || usuarios[selected.user_id]?.email || "Usuario"}
                </p>
                <p className="text-xs text-muted-foreground">Pantalla de origen: {selected.ruta_origen || "—"}</p>
              </div>
              <div className="flex gap-2">
                {selected.estado !== "cerrada" && !selected.atendido_por && (
                  <Button size="sm" variant="outline" onClick={() => tomarSesion(selected)}>Tomar</Button>
                )}
                {selected.estado !== "cerrada" && (
                  <Button size="sm" variant="outline" onClick={() => cerrarSesion(selected)}>Cerrar</Button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {mensajes.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                    m.rol === "humano" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  {m.contenido}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            {selected.estado !== "cerrada" && (
              <div className="flex items-end gap-2 border-t border-border p-3">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                  placeholder="Responder…"
                  className="min-h-[40px] resize-none text-sm"
                  rows={1}
                />
                <Button size="icon" onClick={handleReply} disabled={sending || !reply.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
