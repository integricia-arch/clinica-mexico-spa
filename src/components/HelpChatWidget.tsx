import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { LifeBuoy, X, Send, Bot, User, Users, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const MANUAL_MODULES = import.meta.glob("/docs/manual-usuario/*.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

// Mapeo ruta → slug del manual
const RUTA_MANUAL: Record<string, string> = {
  "/": "panel-principal",
  "/recepcion": "recepcion",
  "/pacientes": "pacientes",
  "/agenda": "agenda",
  "/citas": "citas",
  "/panel-doctor": "panel-doctor",
  "/expedientes": "expedientes",
  "/recetas": "recetas",
  "/recordatorios": "recordatorios",
  "/farmacia": "farmacia",
  "/caja": "farmacia",
  "/facturacion": "facturacion",
  "/conversaciones": "conversaciones",
  "/inteligencia": "inteligencia-bi",
  "/admin/usuarios": "admin-usuarios",
  "/auditoria": "auditoria",
  "/configuracion": "configuracion",
  "/configuracion/notificaciones": "configuracion-notificaciones",
  "/ayuda-interna": "ayuda-interna",
};

function slugForRuta(pathname: string): string | null {
  // Coincidencia exacta primero, luego prefijo más largo
  if (RUTA_MANUAL[pathname]) return RUTA_MANUAL[pathname];
  let best = "";
  for (const [ruta, slug] of Object.entries(RUTA_MANUAL)) {
    if (pathname.startsWith(ruta) && ruta.length > best.length) best = ruta;
  }
  return RUTA_MANUAL[best] ?? null;
}

async function loadManual(slug: string): Promise<string | null> {
  const key = `/docs/manual-usuario/${slug}.md`;
  if (!MANUAL_MODULES[key]) return null;
  try {
    const raw = await MANUAL_MODULES[key]();
    // Cortar la sección de implementación (solo mostrar parte de usuario)
    return (raw as string).split(/\n##\s+Implementaci[oó]n\b/i)[0].trim();
  } catch {
    return null;
  }
}

interface Mensaje {
  id: string;
  rol: "usuario" | "asistente_ia" | "humano" | "sistema";
  contenido: string;
  created_at: string;
  autor_id: string | null;
}

interface Sesion {
  id: string;
  estado: "abierta" | "escalada" | "cerrada";
}

export default function HelpChatWidget() {
  const { user, roles } = useAuth();
  const { activeClinicId } = useActiveClinic();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [iaThinking, setIaThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sesionIdRef = useRef<string | null>(null);

  const INACTIVITY_MS = 5 * 60 * 1000;

  const ensureSesion = async (): Promise<Sesion | null> => {
    if (!user) return null;
    const { data: existing } = await supabase
      .from("ayuda_chat_sesiones")
      .select("id, estado")
      .eq("user_id", user.id)
      .eq("estado", "abierta")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing as Sesion;

    const { data: created, error } = await supabase
      .from("ayuda_chat_sesiones")
      .insert({ user_id: user.id, clinic_id: activeClinicId, ruta_origen: location.pathname })
      .select("id, estado")
      .single();
    if (error) {
      toast.error("No se pudo abrir el chat de ayuda");
      return null;
    }
    return created as Sesion;
  };

  useEffect(() => {
    sesionIdRef.current = sesion?.id ?? null;
  }, [sesion?.id]);

  const despedirseYCerrar = async () => {
    const sid = sesionIdRef.current;
    if (!sid) return;
    const despedida = "No recibí respuesta en 5 minutos. Si necesitas más ayuda, abre una nueva consulta. ¡Hasta luego!";
    await supabase.from("ayuda_chat_mensajes").insert({
      sesion_id: sid, rol: "asistente_ia", autor_id: null, contenido: despedida,
    });
    await supabase.from("ayuda_chat_sesiones").update({ estado: "cerrada" }).eq("id", sid);
    setSesion((prev) => prev ? { ...prev, estado: "cerrada" } : prev);
  };

  const resetInactivityTimer = () => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(despedirseYCerrar, INACTIVITY_MS);
  };

  const cerrarSesion = async () => {
    if (!sesion || sesion.estado === "cerrada") return;
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    await supabase.from("ayuda_chat_sesiones").update({ estado: "cerrada" }).eq("id", sesion.id);
    setSesion((prev) => prev ? { ...prev, estado: "cerrada" } : prev);
  };

  const loadMensajes = async (sesionId: string) => {
    const { data } = await supabase
      .from("ayuda_chat_mensajes")
      .select("id, rol, contenido, created_at, autor_id")
      .eq("sesion_id", sesionId)
      .order("created_at", { ascending: true });
    setMensajes((data ?? []) as Mensaje[]);
  };

  const handleOpen = async () => {
    setOpen(true);
    if (sesion) return;
    const s = await ensureSesion();
    if (s) {
      setSesion(s);
      await loadMensajes(s.id);
    }
  };

  const iniciarNuevaConsulta = async () => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    setSesion(null);
    setMensajes([]);
    const s = await ensureSesion();
    if (s) { setSesion(s); await loadMensajes(s.id); }
  };

  // Realtime: escuchar mensajes nuevos (respuesta IA o humano)
  useEffect(() => {
    if (!sesion) return;
    const ch = supabase
      .channel(`ayuda-chat-${sesion.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ayuda_chat_mensajes", filter: `sesion_id=eq.${sesion.id}` },
        (payload) => {
          setMensajes((prev) => {
            const exists = prev.some((m) => m.id === (payload.new as Mensaje).id);
            return exists ? prev : [...prev, payload.new as Mensaje];
          });
          setIaThinking(false);
          resetInactivityTimer();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ayuda_chat_sesiones", filter: `id=eq.${sesion.id}` },
        (payload) => {
          const nuevoEstado = (payload.new as Sesion).estado;
          setSesion((prev) => prev ? { ...prev, estado: nuevoEstado } : prev);
          if (nuevoEstado !== "abierta" && inactivityRef.current) {
            clearTimeout(inactivityRef.current);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sesion]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, iaThinking]);

  const handleSend = async () => {
    if (!texto.trim() || !user) return;
    setSending(true);
    const contenido = texto.trim();
    setTexto("");

    try {
      let activeSesion = sesion;
      if (!activeSesion) {
        activeSesion = await ensureSesion();
        if (!activeSesion) return;
        setSesion(activeSesion);
        await loadMensajes(activeSesion.id);
      }

      // Insertar mensaje del usuario
      const { error } = await supabase.from("ayuda_chat_mensajes").insert({
        sesion_id: activeSesion.id,
        rol: "usuario",
        autor_id: user.id,
        contenido,
      });
      if (error) { toast.error("No se pudo enviar el mensaje"); return; }

      // Agregar optimistamente en UI
      setMensajes((prev) => [...prev, {
        id: crypto.randomUUID(), rol: "usuario", contenido,
        created_at: new Date().toISOString(), autor_id: user.id,
      }]);
      resetInactivityTimer();

      // Si la sesión está escalada, no llamar a la IA
      if (activeSesion.estado === "escalada") return;

      // Llamar a la IA
      setIaThinking(true);
      const slug = slugForRuta(location.pathname);
      const manual_contexto = slug ? await loadManual(slug) : null;

      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/help-chat-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            sesion_id: activeSesion.id,
            mensaje: contenido,
            manual_contexto: manual_contexto ?? undefined,
            ruta_activa: location.pathname,
            clinic_id: activeClinicId ?? undefined,
            user_role: roles[0] ?? undefined,
          }),
        }
      );

      if (!resp.ok) {
        setIaThinking(false);
        // Fallo silencioso — el humano puede responder igualmente
      }
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  const escalada = sesion?.estado === "escalada";
  const cerrada = sesion?.estado === "cerrada";

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="flex h-[500px] w-80 flex-col rounded-xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className={`flex items-center justify-between rounded-t-xl px-4 py-3 text-primary-foreground ${cerrada ? "bg-slate-500" : escalada ? "bg-amber-600" : "bg-primary"}`}>
            <div>
              <p className="text-sm font-semibold">
                {cerrada ? "Consulta cerrada" : escalada ? "Conectando con el equipo…" : "Asistente de ayuda"}
              </p>
              <p className="text-xs opacity-80">
                {cerrada ? "Puedes iniciar una nueva" : escalada ? "Un humano te responde aquí" : "IA + equipo disponible"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!cerrada && (
                <button
                  onClick={cerrarSesion}
                  title="Cerrar consulta"
                  className="text-primary-foreground/70 hover:text-primary-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-primary-foreground/80 hover:text-primary-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {mensajes.length === 0 && (
              <p className="text-center text-xs text-muted-foreground mt-6">
                Escribe tu duda — la IA responde de inmediato. Si no puede ayudarte, el equipo toma el hilo.
              </p>
            )}
            {mensajes.map((m) => (
              <div key={m.id} className={`flex gap-1.5 ${m.rol === "usuario" ? "justify-end" : "justify-start"}`}>
                {m.rol !== "usuario" && (
                  <div className="mt-1 shrink-0">
                    {m.rol === "asistente_ia" ? (
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Users className="h-3.5 w-3.5 text-amber-600" />
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.rol === "usuario"
                      ? "bg-primary text-primary-foreground"
                      : m.rol === "asistente_ia"
                      ? "bg-muted text-foreground border border-border"
                      : "bg-amber-50 text-amber-900 border border-amber-200"
                  }`}
                >
                  {m.contenido}
                  {m.rol !== "usuario" && (
                    <p className="mt-0.5 text-[10px] opacity-50">
                      {m.rol === "asistente_ia" ? "IA" : "Equipo"}
                    </p>
                  )}
                </div>
                {m.rol === "usuario" && <User className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </div>
            ))}
            {iaThinking && (
              <div className="flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
                <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground border border-border">
                  <span className="animate-pulse">Analizando…</span>
                </div>
              </div>
            )}
            {cerrada && (
              <div className="mt-3 text-center">
                <p className="text-xs text-muted-foreground mb-2">Consulta cerrada</p>
                <button
                  onClick={iniciarNuevaConsulta}
                  className="text-xs text-primary underline hover:opacity-80"
                >
                  Iniciar nueva consulta
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {!cerrada && (
            <div className="flex items-end gap-2 border-t border-border p-3">
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={escalada ? "Escribe al equipo…" : "Pregunta algo sobre el sistema…"}
                className="min-h-[40px] resize-none text-sm"
                rows={1}
              />
              <Button size="icon" onClick={handleSend} disabled={sending || !texto.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={handleOpen}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
          title="Asistente de ayuda"
        >
          <LifeBuoy className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
