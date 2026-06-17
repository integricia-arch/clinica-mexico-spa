import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { LifeBuoy, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const { activeClinicId } = useActiveClinic();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reusa la sesión abierta/escalada más reciente del usuario, o crea una nueva al primer mensaje
  const ensureSesion = async (): Promise<Sesion | null> => {
    if (!user) return null;
    const { data: existing } = await supabase
      .from("ayuda_chat_sesiones")
      .select("id, estado")
      .eq("user_id", user.id)
      .in("estado", ["abierta", "escalada"])
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

  useEffect(() => {
    if (!sesion) return;
    const ch = supabase
      .channel(`ayuda-chat-${sesion.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ayuda_chat_mensajes", filter: `sesion_id=eq.${sesion.id}` }, (payload) => {
        setMensajes((prev) => [...prev, payload.new as Mensaje]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sesion]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const handleSend = async () => {
    if (!texto.trim() || !user) return;
    setSending(true);
    try {
      let activeSesion = sesion;
      if (!activeSesion) {
        activeSesion = await ensureSesion();
        if (!activeSesion) return;
        setSesion(activeSesion);
      }
      const { error } = await supabase.from("ayuda_chat_mensajes").insert({
        sesion_id: activeSesion.id,
        rol: "usuario",
        autor_id: user.id,
        contenido: texto.trim(),
      });
      if (error) {
        toast.error("No se pudo enviar el mensaje");
        return;
      }
      setMensajes((prev) => [...prev, {
        id: crypto.randomUUID(), rol: "usuario", contenido: texto.trim(),
        created_at: new Date().toISOString(), autor_id: user.id,
      }]);
      setTexto("");
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="flex h-[480px] w-80 flex-col rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between rounded-t-xl bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="text-sm font-semibold">Hablar con un humano</p>
              <p className="text-xs opacity-80">Recepción/admin responde aquí</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-primary-foreground/80 hover:text-primary-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {mensajes.length === 0 && (
              <p className="text-center text-xs text-muted-foreground mt-6">
                Escribe tu duda — alguien del equipo te responde aquí mismo.
              </p>
            )}
            {mensajes.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.rol === "usuario" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                {m.contenido}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="flex items-end gap-2 border-t border-border p-3">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escribe tu duda…"
              className="min-h-[40px] resize-none text-sm"
              rows={1}
            />
            <Button size="icon" onClick={handleSend} disabled={sending || !texto.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleOpen}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
          title="Hablar con un humano"
        >
          <LifeBuoy className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
