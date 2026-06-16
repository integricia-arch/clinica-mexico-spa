import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

// Vite-only static import of every manual; key = '/docs/manual-usuario/<slug>.md'
const MANUAL_MODULES = import.meta.glob("/docs/manual-usuario/*.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

interface ManualPagina {
  id: string;
  slug: string;
  titulo: string;
}

export default function ManualButton() {
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pagina, setPagina] = useState<ManualPagina | null>(null);
  const [contenido, setContenido] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Resolve the manual_paginas row for the current route (longest prefix match)
  useEffect(() => {
    let active = true;
    const resolve = async () => {
      const { data, error } = await supabase
        .from("manual_paginas")
        .select("id, slug, titulo, ruta")
        .eq("activo", true);
      if (error || !data || !active) return;
      const candidates = data
        .filter((p) => location.pathname === p.ruta || location.pathname.startsWith(p.ruta))
        .sort((a, b) => b.ruta.length - a.ruta.length);
      setPagina(candidates[0] ?? null);
    };
    resolve();
    return () => { active = false; };
  }, [location.pathname]);

  const handleOpen = async () => {
    if (!pagina) return;
    setOpen(true);
    setLoading(true);
    try {
      const path = `/docs/manual-usuario/${pagina.slug}.md`;
      const loader = MANUAL_MODULES[path];
      const md = loader ? await loader() : null;
      setContenido(md ?? "_Manual pendiente de redactar para esta pantalla._");
      if (user) {
        await supabase.from("manual_consultas").insert({ manual_id: pagina.id, user_id: user.id });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!pagina) return null;

  return (
    <>
      <button
        onClick={handleOpen}
        title={`Manual: ${pagina.titulo}`}
        className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <HelpCircle className="h-[18px] w-[18px]" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{pagina.titulo}</DialogTitle>
            <DialogDescription>Manual de usuario</DialogDescription>
          </DialogHeader>
          <div
            className="text-sm leading-relaxed space-y-3
              [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4
              [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3
              [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
              [&_table]:w-full [&_table]:text-xs [&_th]:text-left [&_th]:border-b [&_td]:border-b [&_th]:py-1 [&_td]:py-1
              [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_blockquote]:text-muted-foreground [&_blockquote]:border-l-2 [&_blockquote]:pl-3"
          >
            {loading ? (
              <p className="text-muted-foreground">Cargando manual…</p>
            ) : (
              <ReactMarkdown>{contenido ?? ""}</ReactMarkdown>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
