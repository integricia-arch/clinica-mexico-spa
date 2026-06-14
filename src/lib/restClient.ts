/**
 * Cliente REST directo — bypasea el schema cache de Supabase.
 * Lee URL y key del cliente ya inicializado para funcionar en producción.
 */
import { supabase } from "@/integrations/supabase/client";

async function getHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
    ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
  };
}

function buildUrl(table: string, query = "") {
  return `${import.meta.env.VITE_SUPABASE_URL as string}/rest/v1/${table}${query ? `?${query}` : ""}`;
}

export async function restSelect(table: string, query = "") {
  const headers = await getHeaders();
  const res = await fetch(buildUrl(table, query), { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function restInsert(table: string, body: object) {
  const headers = await getHeaders();
  const res = await fetch(buildUrl(table), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function restUpdate(table: string, id: string, body: object) {
  if (!UUID_RE.test(id)) throw new Error("Invalid id");
  const headers = await getHeaders();
  const res = await fetch(buildUrl(table, `id=eq.${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}
