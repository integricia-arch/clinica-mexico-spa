import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Send, LifeBuoy, BookOpen, Plus, Pencil, ToggleLeft, ToggleRight, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useActiveClinic } from "@/hooks/useActiveClinic";

// ── Types ───────────────────────────────────────────────────────────────────
type Estado = "abierta" | "escalada" | "cerrada";

interface Sesion {
  id: string; user_id: string; estado: Estado;
  atendido_por: string | null; ruta_origen: string | null;
  started_at: string; closed_at: string | null;
}
interface Mensaje {
  id: string; sesion_id: string;
  rol: "usuario" | "asistente_ia" | "humano" | "sistema";
  contenido: string; created_at: string; autor_id: string | null;
}
interface UsuarioInfo { email: string | null; full_name: string | null; }

interface FaqItem {
  id: string; pregunta: string; respuesta: string;
  triggers: string[]; ruta_activa: string | null;
  activo: boolean; uso_count: number; origen: string;
}
interface Candidato {
  id: string; pregunta: string; ruta_activa: string | null;
  repeticiones: number; respuesta_ia: string | null; created_at: string;
}

const FILTROS: { key: "todas" | Estado; label: string }[] = [
  { key: "escalada", label: "Escaladas" },
  { key: "abierta",  label: "Abiertas"  },
  { key: "cerrada",  label: "Cerradas"  },
  { key: "todas",    label: "Todas"     },
];

// ── Componente principal ────────────────────────────────────────────────────
export default function AyudaInterna() {
  const { user } = useAuth();
  const { activeClinicId } = useActiveClinic();
  const [tab, setTab] = useState("sesiones");

  return (
    <div className="flex flex-col gap-4 h-full">
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col h-full">
        <TabsList className="w-fit">
          <TabsTrigger value="sesiones" className="gap-1.5">
            <LifeBuoy className="h-3.5 w-3.5" /> Sesiones
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Base de conocimiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sesiones" className="flex-1 min-h-0 mt-0">
          <SesionesPanel user={user} />
        </TabsContent>

        <TabsContent value="faq" className="flex-1 min-h-0 mt-0">
          <FaqPanel clinicId={activeClinicId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Panel Sesiones (código original refactorizado) ──────────────────────────
function SesionesPanel({ user }: { user: { id: string } | null }) {
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [usuarios, setUsuarios] = useState<Record<string, UsuarioInfo>>({});
  const [filtro, setFiltro] = useState<"todas" | Estado>("escalada");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchSesiones = async () => {
    const { data, error } = await (supabase as any)
      .from("ayuda_chat_sesiones").select("*")
      .order("started_at", { ascending: false }).limit(200);
    if (error) { toast.error("Error cargando sesiones"); return; }
    setSesiones((data ?? []) as Sesion[]);
    const ids = Array.from(new Set((data ?? []).map((s) => s.user_id)));
    if (ids.length) {
      const { data: resolved } = await (supabase as any).rpc("ayuda_chat_resolver_usuarios", { p_user_ids: ids });
      const map: Record<string, UsuarioInfo> = {};
      (resolved ?? []).forEach((r: { user_id: string; email: string | null; full_name: string | null }) => {
        map[r.user_id] = { email: r.email, full_name: r.full_name };
      });
      setUsuarios(map);
    }
  };

  useEffect(() => {
    fetchSesiones();
    const ch = supabase.channel("ayuda-sesiones-staff")
      .on("postgres_changes", { event: "*", schema: "public", table: "ayuda_chat_sesiones" }, fetchSesiones)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const load = async () => {
      const { data } = await (supabase as any).from("ayuda_chat_mensajes").select("*")
        .eq("sesion_id", selectedId).order("created_at", { ascending: true });
      setMensajes((data ?? []) as Mensaje[]);
    };
    load();
    const ch = supabase.channel(`ayuda-staff-${selectedId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ayuda_chat_mensajes", filter: `sesion_id=eq.${selectedId}` },
        (payload) => setMensajes((prev) => [...prev, payload.new as Mensaje]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);

  const tomarSesion  = async (s: Sesion) => {
    await (supabase as any).from("ayuda_chat_sesiones").update({ atendido_por: user!.id, estado: "abierta" }).eq("id", s.id);
  };
  const cerrarSesion = async (s: Sesion) => {
    await (supabase as any).from("ayuda_chat_sesiones").update({ estado: "cerrada", closed_at: new Date().toISOString() }).eq("id", s.id);
    if (selectedId === s.id) setSelectedId(null);
  };
  const handleReply  = async () => {
    if (!reply.trim() || !selectedId || !user) return;
    setSending(true);
    try {
      const { error } = await (supabase as any).from("ayuda_chat_mensajes").insert({
        sesion_id: selectedId, rol: "humano", autor_id: user.id, contenido: reply.trim(),
      });
      if (error) { toast.error("Error al enviar"); return; }
      setReply("");
    } finally { setSending(false); }
  };

  const visibles = sesiones.filter((s) => filtro === "todas" || s.estado === filtro);
  const selected  = sesiones.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex gap-1 border-b border-border p-2">
          {FILTROS.map((f) => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium",
                filtro === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {visibles.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Sin sesiones.</p>}
          {visibles.map((s) => {
            const info = usuarios[s.user_id];
            return (
              <button key={s.id} onClick={() => setSelectedId(s.id)}
                className={cn("flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left hover:bg-muted/60",
                  selectedId === s.id && "bg-muted")}>
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
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Selecciona una sesión.</div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border p-3">
              <div>
                <p className="text-sm font-semibold">{usuarios[selected.user_id]?.full_name || usuarios[selected.user_id]?.email || "Usuario"}</p>
                <p className="text-xs text-muted-foreground">Origen: {selected.ruta_origen || "—"}</p>
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
                <div key={m.id} className={cn("max-w-[75%] rounded-lg px-3 py-2 text-sm",
                  m.rol === "humano" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                  {m.contenido}
                  <p className="mt-0.5 text-[10px] opacity-50">{m.rol}</p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            {selected.estado !== "cerrada" && (
              <div className="flex items-end gap-2 border-t border-border p-3">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                  placeholder="Responder…" className="min-h-[40px] resize-none text-sm" rows={1} />
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

// ── Panel Base de conocimiento ──────────────────────────────────────────────
function FaqPanel({ clinicId }: { clinicId: string | null }) {
  const [subtab, setSubtab] = useState<"faqs" | "pendientes">("faqs");
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(false);
  const [editItem, setEditItem] = useState<FaqItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchFaqs = async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any).from("faq_items").select("*")
        .or(`clinic_id.is.null,clinic_id.eq.${clinicId ?? "00000000-0000-0000-0000-000000000000"}`)
        .order("uso_count", { ascending: false });
      setFaqs((data ?? []) as FaqItem[]);
    } finally { setLoading(false); }
  };

  const fetchCandidatos = async () => {
    const { data } = await (supabase as any).from("chat_preguntas_pendientes").select("*")
      .eq("aprobado", false)
      .order("repeticiones", { ascending: false }).limit(50);
    setCandidatos((data ?? []) as Candidato[]);
  };

  useEffect(() => { fetchFaqs(); fetchCandidatos(); }, [clinicId]);

  const toggleActivo = async (item: FaqItem) => {
    await (supabase as any).from("faq_items").update({ activo: !item.activo }).eq("id", item.id);
    setFaqs((prev) => prev.map((f) => f.id === item.id ? { ...f, activo: !f.activo } : f));
  };

  const openNew = () => {
    setEditItem({ id: "", pregunta: "", respuesta: "", triggers: [], ruta_activa: null, activo: true, uso_count: 0, origen: "manual" });
    setDialogOpen(true);
  };

  const openEdit = (item: FaqItem) => { setEditItem(item); setDialogOpen(true); };

  const openFromCandidato = (c: Candidato) => {
    setEditItem({
      id: "", pregunta: c.pregunta, respuesta: c.respuesta_ia ?? "",
      triggers: [c.pregunta.toLowerCase().replace(/[¿?¡!]/g, "").trim()],
      ruta_activa: c.ruta_activa, activo: true, uso_count: 0, origen: "aprendido",
    });
    setDialogOpen(true);
  };

  const saveFaq = async (item: FaqItem, triggersRaw: string) => {
    const triggers = triggersRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const payload = { pregunta: item.pregunta, respuesta: item.respuesta, triggers, ruta_activa: item.ruta_activa || null, activo: item.activo, origen: item.origen, clinic_id: clinicId };
    if (item.id) {
      await (supabase as any).from("faq_items").update(payload).eq("id", item.id);
    } else {
      await (supabase as any).from("faq_items").insert(payload);
    }
    toast.success(item.id ? "FAQ actualizado" : "FAQ creado");
    setDialogOpen(false);
    fetchFaqs();
  };

  const ignorarCandidato = async (id: string) => {
    await (supabase as any).from("chat_preguntas_pendientes").update({ aprobado: true }).eq("id", id);
    setCandidatos((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["faqs", "pendientes"] as const).map((k) => (
            <button key={k} onClick={() => setSubtab(k)}
              className={cn("rounded-md px-3 py-1 text-xs font-medium",
                subtab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              {k === "faqs" ? `FAQ activos (${faqs.filter(f => f.activo).length})` : `Para revisar (${candidatos.length})`}
            </button>
          ))}
        </div>
        {subtab === "faqs" && (
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nuevo FAQ
          </Button>
        )}
      </div>

      {subtab === "faqs" && (
        <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card">
          {loading && <p className="p-4 text-center text-xs text-muted-foreground">Cargando…</p>}
          {!loading && faqs.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Sin FAQs. Crea uno.</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left">Pregunta</th>
                <th className="px-3 py-2 text-left hidden md:table-cell">Triggers</th>
                <th className="px-3 py-2 text-center">Usos</th>
                <th className="px-3 py-2 text-center">Estado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {faqs.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <p className="font-medium text-xs">{f.pregunta}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{f.respuesta}</p>
                    {f.origen === "aprendido" && <Badge variant="outline" className="text-[9px] mt-0.5">aprendido</Badge>}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {f.triggers.slice(0, 3).map((t) => (
                        <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{t}</span>
                      ))}
                      {f.triggers.length > 3 && <span className="text-[10px] text-muted-foreground">+{f.triggers.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-mono">{f.uso_count}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => toggleActivo(f)} title={f.activo ? "Desactivar" : "Activar"}>
                      {f.activo
                        ? <ToggleRight className="h-5 w-5 text-green-600" />
                        : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => openEdit(f)} className="text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subtab === "pendientes" && (
        <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card">
          {candidatos.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Sin preguntas pendientes de revisión.</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left">Pregunta del usuario</th>
                <th className="px-3 py-2 text-center">Veces</th>
                <th className="px-3 py-2 text-left hidden md:table-cell">Respuesta IA</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {candidatos.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <p className="text-xs font-medium">{c.pregunta}</p>
                    {c.ruta_activa && <p className="text-[10px] text-muted-foreground">{c.ruta_activa}</p>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant={c.repeticiones >= 3 ? "destructive" : "secondary"} className="text-[10px]">
                      {c.repeticiones >= 3 ? <ChevronUp className="h-2.5 w-2.5 inline" /> : <ChevronDown className="h-2.5 w-2.5 inline" />}
                      {c.repeticiones}x
                    </Badge>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.respuesta_ia ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                        onClick={() => openFromCandidato(c)}>
                        + FAQ
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-muted-foreground"
                        onClick={() => ignorarCandidato(c.id)}>
                        Ignorar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FaqDialog open={dialogOpen} item={editItem} onClose={() => setDialogOpen(false)} onSave={saveFaq} />
    </div>
  );
}

// ── Dialog editar / crear FAQ ───────────────────────────────────────────────
function FaqDialog({
  open, item, onClose, onSave,
}: {
  open: boolean;
  item: FaqItem | null;
  onClose: () => void;
  onSave: (item: FaqItem, triggersRaw: string) => Promise<void>;
}) {
  const [form, setForm] = useState<FaqItem | null>(null);
  const [triggersRaw, setTriggersRaw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({ ...item });
      setTriggersRaw(item.triggers.join(", "));
    }
  }, [item]);

  if (!form) return null;

  const handle = async () => {
    if (!form.pregunta.trim() || !form.respuesta.trim() || !triggersRaw.trim()) {
      toast.error("Pregunta, respuesta y al menos un trigger son requeridos");
      return;
    }
    setSaving(true);
    try { await onSave(form, triggersRaw); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar FAQ" : "Nuevo FAQ"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Pregunta canónica (para admin)</Label>
            <Input value={form.pregunta} onChange={(e) => setForm({ ...form, pregunta: e.target.value })}
              placeholder="¿Cómo abro mi turno?" />
          </div>
          <div>
            <Label className="text-xs">Respuesta (máx. 3 oraciones)</Label>
            <Textarea value={form.respuesta} onChange={(e) => setForm({ ...form, respuesta: e.target.value })}
              rows={3} placeholder="Ve a Farmacia → botón Abrir turno…" />
          </div>
          <div>
            <Label className="text-xs">Triggers (separados por coma)</Label>
            <Input value={triggersRaw} onChange={(e) => setTriggersRaw(e.target.value)}
              placeholder="abrir turno, abro turno, iniciar turno" />
            <p className="text-[10px] text-muted-foreground mt-1">Frases cortas sin signos. El sistema busca si alguna aparece en el mensaje del usuario.</p>
          </div>
          <div>
            <Label className="text-xs">Ruta activa (opcional)</Label>
            <Input value={form.ruta_activa ?? ""} onChange={(e) => setForm({ ...form, ruta_activa: e.target.value || null })}
              placeholder="/farmacia (vacío = toda la app)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handle} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
