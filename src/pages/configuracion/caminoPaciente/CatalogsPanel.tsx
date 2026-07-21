import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

interface CatalogRow {
  id: string;
  catalog_name: string;
  catalog_key: string;
  applies_to_step_type: string | null;
}

interface CatalogItemRow {
  id: string;
  catalog_id: string;
  option_label: string;
  is_active: boolean;
  sort_order: number;
}

/* ---------- Catalogs panel ---------- */
export function CatalogsPanel() {
  const [catalogs, setCatalogs] = useState<CatalogRow[]>([]);
  const [items, setItems] = useState<Record<string, CatalogItemRow[]>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: cats } = await (supabase as any).from("journey_option_catalogs").select("*").order("catalog_name");
    const { data: its } = await (supabase as any).from("journey_option_items").select("*").order("sort_order");
    const map: Record<string, CatalogItemRow[]> = {};
    (its ?? []).forEach((i: CatalogItemRow) => { (map[i.catalog_id] ??= []).push(i); });
    setCatalogs((cats ?? []) as CatalogRow[]);
    setItems(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleItem = async (it: CatalogItemRow) => {
    const { error } = await (supabase as any).from("journey_option_items").update({ is_active: !it.is_active }).eq("id", it.id);
    if (error) toast.error(friendlyError(error)); else load();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-display font-semibold mb-3">Catálogos protegidos</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Los elementos ya usados no se eliminan; solo se desactivan para preservar la trazabilidad.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-4">
          {catalogs.map((c) => (
            <div key={c.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold">{c.catalog_name}</p>
                  <p className="text-xs text-muted-foreground">
                    <code className="font-mono">{c.catalog_key}</code>
                    {c.applies_to_step_type && ` · aplica a etapas de tipo ${c.applies_to_step_type}`}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {(items[c.id] ?? []).map((it) => (
                  <div key={it.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5">
                    <span className={`text-xs ${it.is_active ? "" : "text-muted-foreground line-through"}`}>{it.option_label}</span>
                    <Button size="sm" variant="ghost" onClick={() => toggleItem(it)}>
                      {it.is_active ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
