import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageCircle, Phone, Instagram, Facebook, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Circle, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConversationActionPanel } from "@/features/inbox/ConversationActionPanel";

type CanalTipo = "telegram" | "whatsapp" | "instagram" | "facebook";
type ConvStatus = "activa" | "escalada" | "cerrada";
type MsgRol = "user" | "assistant" | "tool" | "system";

interface IdentidadCanal {
  id: string;
  canal_id: CanalTipo;
  external_id: string;
  display_name: string | null;
  patient_id: string | null;
  patients?: { nombre: string; apellidos: string; telefono: string | null } | null;
}

interface Conversacion {
  id: string;
  identidad_canal_id: string;
  status: ConvStatus;
  intencion_actual: string | null;
  asignada_humano_id: string | null;
  last_message_at: string;
  created_at: string;
  clinic_id: string;
  prioridad?: string | null;
  motivo_resumen?: string | null;
  dolor_intensidad?: number | null;
  identidades_canal?: IdentidadCanal | null;
  ultimo_mensaje?: string;
}

interface Mensaje {
  id: string;
  conversacion_id: string;
  rol: MsgRol;
  contenido: string;
  created_at: string;
}

const CANAL_META: Record<CanalTipo, { label: string; Icon: any; color: string }> = {
  telegram: { label: "Telegram", Icon: Send, color: "text-sky-500 bg-sky-500/10" },
  whatsapp: { label: "WhatsApp", Icon: Phone, color: "text-emerald-500 bg-emerald-500/10" },
  instagram: { label: "Instagram", Icon: Instagram, color: "text-pink-500 bg-pink-500/10" },
  facebook: { label: "Facebook", Icon: Facebook, color: "text-blue-600 bg-blue-600/10" },
};

function formatRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "hace segundos";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

function nombreIdentidad(c: Conversacion) {
  const ic = c.identidades_canal;
  if (ic?.patients) return `${ic.patients.nombre} ${ic.patients.apellidos}`;
  return ic?.display_name || ic?.external_id || "Sin identificar";
}

const STATUS_TABS: { key: "todas" | ConvStatus; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "activa", label: "Activas" },
  { key: "escalada", label: "Escaladas" },
  { key: "cerrada", label: "Cerradas" },
];

export default function Inbox() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [filter, setFilter] = useState<"todas" | ConvStatus>("escalada");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [showTechnical, setShowTechnical] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Cargar conversaciones
  const fetchConversaciones = async () => {
    const { data, error } = await supabase
      .from("conversaciones")
      .select("*, identidades_canal(*, patients(nombre, apellidos, telefono))")
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Error cargando conversaciones");
      return;
    }
    // Cargar último mensaje preview
    const ids = (data ?? []).map((c) => c.id);
    const previews: Record<string, string> = {};
    if (ids.length) {
      const { data: msgs } = await supabase
        .from("mensajes")
        .select("conversacion_id, contenido, created_at")
        .in("conversacion_id", ids)
        .order("created_at", { ascending: false });
      (msgs ?? []).forEach((m: any) => {
        if (!previews[m.conversacion_id]) previews[m.conversacion_id] = m.contenido;
      });
    }
    setConversaciones((data ?? []).map((c: any) => ({ ...c, ultimo_mensaje: previews[c.id] ?? "" })));
    setLoading(false);
  };

  useEffect(() => { fetchConversaciones(); }, []);

  // Preselección por ?id= en URL
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) setSelectedId(id);
  }, [searchParams]);


  // Cargar mensajes al seleccionar
  useEffect(() => {
    if (!selectedId) { setMensajes([]); return; }
    (async () => {
      const { data, error } = await supabase
        .from("mensajes")
        .select("*")
        .eq("conversacion_id", selectedId)
        .order("created_at", { ascending: true });
      if (error) { toast.error("Error cargando mensajes"); return; }
      setMensajes((data ?? []) as Mensaje[]);
    })();
  }, [selectedId]);

  // Realtime: nuevos mensajes y updates de conversaciones
  useEffect(() => {
    const ch = supabase
      .channel("inbox-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, (payload) => {
        const m = payload.new as Mensaje;
        if (m.conversacion_id === selectedId) {
          setMensajes((prev) => [...prev, m]);
        }
        setConversaciones((prev) => {
          const idx = prev.findIndex((c) => c.id === m.conversacion_id);
          if (idx === -1) { fetchConversaciones(); return prev; }
          const updated = { ...prev[idx], ultimo_mensaje: m.contenido, last_message_at: m.created_at };
          const rest = prev.filter((_, i) => i !== idx);
          return [updated, ...rest];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversaciones" }, (payload) => {
        const u = payload.new as Conversacion;
        setConversaciones((prev) => prev.map((c) => c.id === u.id ? { ...c, ...u } : c));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversaciones" }, () => {
        fetchConversaciones();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const escaladasCount = useMemo(
    () => conversaciones.filter((c) => c.status === "escalada").length,
    [conversaciones],
  );

  const filteredOrdered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = filter === "todas" ? [...conversaciones] : conversaciones.filter((c) => c.status === filter);
    if (q) {
      list = list.filter((c) => nombreIdentidad(c).toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const pr = (c: Conversacion) => c.prioridad === "urgente" ? 0 : c.prioridad === "alta" ? 1 : 2;
      if (a.status === "escalada" && b.status !== "escalada") return -1;
      if (b.status === "escalada" && a.status !== "escalada") return 1;
      const dp = pr(a) - pr(b);
      if (dp !== 0) return dp;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
    return list;
  }, [conversaciones, filter, search]);

  const selected = conversaciones.find((c) => c.id === selectedId) || null;

  const visibleMensajes = mensajes.filter((m) => showTechnical || (m.rol === "user" || m.rol === "assistant"));
  const hiddenCount = mensajes.length - mensajes.filter((m) => m.rol === "user" || m.rol === "assistant").length;

  const tomarControl = async () => {
    if (!selected || !user) return;
    const { error } = await supabase
      .from("conversaciones")
      .update({ status: "escalada", asignada_humano_id: user.id })
      .eq("id", selected.id);
    if (error) toast.error("No se pudo tomar el control");
    else toast.success("Tomaste el control de la conversación");
  };

  const cerrarConversacion = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("conversaciones")
      .update({ status: "cerrada" })
      .eq("id", selected.id);
    if (error) { toast.error("No se pudo cerrar"); return; }
    await supabase.from("audit_logs").insert({
      tabla: "conversaciones", registro_id: selected.id,
      accion: "conv_cerrada", datos_nuevos: { by: user?.id ?? null },
      clinic_id: selected.clinic_id,
    });
    toast.success("Conversación cerrada");
  };

  const enviarRespuesta = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const mensaje = reply.trim();
    const { error: fnErr } = await supabase.functions.invoke("enviar-mensaje-humano", {
      body: { conversacion_id: selected.id, mensaje },
    });
    setSending(false);
    if (fnErr) {
      toast.error("No se pudo enviar el mensaje");
      return;
    }
    setReply("");
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Columna izquierda */}
      <div className="w-full max-w-sm flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h1 className="text-display text-lg font-bold">Inbox</h1>
          <p className="text-xs text-muted-foreground">Conversaciones de canales externos</p>
        </div>
        <div className="p-3 border-b border-border">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente…"
            className="h-9 text-sm"
          />
        </div>
        <div className="flex gap-1 p-2 border-b border-border bg-muted/30">
          {STATUS_TABS.map((t) => {
            const isActive = filter === t.key;
            const showCount = t.key === "escalada" && escaladasCount > 0;
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={cn(
                  "flex-1 text-xs font-medium px-2 py-1.5 rounded-md transition-colors flex items-center justify-center gap-1",
                  isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {showCount && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full bg-orange-500 text-white px-1">
                    {escaladasCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-4 text-sm text-muted-foreground">Cargando…</div>}
          {!loading && filteredOrdered.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Sin conversaciones</div>
          )}
          {filteredOrdered.map((c) => {
            const ic = c.identidades_canal;
            const meta = ic ? CANAL_META[ic.canal_id] : null;
            const Icon = meta?.Icon ?? MessageCircle;
            const isSel = c.id === selectedId;
            const isEsc = c.status === "escalada";
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "w-full text-left px-3 py-3 border-b border-border flex gap-3 hover:bg-muted/50 transition-colors",
                  isSel && "bg-muted",
                  isEsc && "border-l-4 border-l-orange-500",
                )}
              >
                <div className={cn("h-10 w-10 shrink-0 rounded-full flex items-center justify-center", meta?.color ?? "bg-muted")}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{nombreIdentidad(c)}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatRelative(c.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{c.ultimo_mensaje || "Sin mensajes"}</p>
                  <div className="mt-1.5">
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Columna derecha */}
      <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Selecciona una conversación
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-border flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-display font-bold truncate">{nombreIdentidad(selected)}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{selected.identidades_canal ? CANAL_META[selected.identidades_canal.canal_id].label : "—"}</span>
                  <span>·</span>
                  <span>Inició {new Date(selected.created_at).toLocaleString("es-MX")}</span>
                  <span>·</span>
                  <StatusBadge status={selected.status} />
                </div>
                {selected.status === "escalada" && selected.asignada_humano_id === user?.id && (
                  <p className="mt-2 text-xs font-medium text-orange-600 dark:text-orange-400">
                    Tú estás atendiendo esta conversación
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {selected.status !== "escalada" && selected.status !== "cerrada" && (
                  <Button size="sm" onClick={tomarControl}>
                    <AlertTriangle className="h-4 w-4 mr-1.5" /> Tomar control
                  </Button>
                )}
                {selected.status !== "cerrada" && (
                  <Button size="sm" variant="outline" onClick={cerrarConversacion}>
                    Cerrar conversación
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowTechnical((v) => !v)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1"
                >
                  {showTechnical ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {showTechnical ? "Ocultar" : "Ver"} detalles técnicos ({hiddenCount})
                </button>
              )}
              {visibleMensajes.map((m) => {
                const isUser = m.rol === "user";
                const isAssist = m.rol === "assistant";
                const isTech = m.rol === "tool" || m.rol === "system";
                const isHuman = isAssist && (m as any).raw_payload?.sent_by_human === true;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col",
                      isUser && "items-start",
                      isAssist && "items-end",
                      isTech && "items-center",
                    )}
                  >
                    {isHuman && (
                      <span className="text-[10px] font-semibold text-green-700 dark:text-green-400 mb-0.5 mr-1">
                        Recepción
                      </span>
                    )}
                    <div
                      title={new Date(m.created_at).toLocaleString("es-MX")}
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-sm",
                        isUser && "bg-muted text-foreground rounded-bl-sm",
                        isAssist && !isHuman && "bg-primary/10 text-foreground rounded-br-sm",
                        isHuman && "bg-green-100 text-green-950 dark:bg-green-900/40 dark:text-green-50 rounded-br-sm border border-green-300/60",
                        isTech && "bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs font-mono border border-amber-500/30",
                      )}
                    >
                      {isTech && <div className="text-[10px] uppercase tracking-wide mb-1 opacity-70">{m.rol}</div>}
                      {m.contenido}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {selected.status === "escalada" ? (
              <div className="border-t border-border p-3 bg-card">
                <div className="flex gap-2 items-end">
                  <Textarea
                    rows={2}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Escribe tu respuesta…"
                    className="resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarRespuesta(); }
                    }}
                  />
                  <Button onClick={enviarRespuesta} disabled={sending || !reply.trim()}>
                    <SendHorizonal className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Enter para enviar · Shift+Enter para nueva línea
                </p>
              </div>
            ) : selected.status === "activa" ? (
              <div className="border-t border-border p-3 bg-muted/30 text-xs text-muted-foreground text-center">
                El bot está atendiendo esta conversación. Usa "Tomar control" para responder.
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ConvStatus }) {
  if (status === "activa") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-500/15 rounded-full px-2 py-0.5">
      <Circle className="h-2 w-2 fill-emerald-500 stroke-emerald-500" /> Activa
    </span>
  );
  if (status === "escalada") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-700 bg-orange-500/20 rounded-full px-2 py-0.5">
      <AlertTriangle className="h-2.5 w-2.5" /> Escalada
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
      <CheckCircle2 className="h-2.5 w-2.5" /> Cerrada
    </span>
  );
}
