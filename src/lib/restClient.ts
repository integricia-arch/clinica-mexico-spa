/**
 * Cliente REST directo — bypasea el schema cache de Supabase.
 * Lee URL y key del cliente ya inicializado para funcionar en producción.
 */
import { supabase } from "@/integrations/supabase/client";

function getSupabaseConfig() {
  // Acceder a la URL desde el cliente ya inicializado
  const url = (supabase as any).supabaseUrl as string;
  const key = (supabase as any).supabaseKey as string;
  return { url, key };
}

async function getHeaders(): Promise<Record<string, string>> {
  const { key } = getSupabaseConfig();
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "apikey": key,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
    ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
  };
}

function buildUrl(table: string, query = "") {
  const { url } = getSupabaseConfig();
  return `${url}/rest/v1/${table}${query ? `?${query}` : ""}`;
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

export async function restUpdate(table: string, id: string, body: object) {
  const headers = await getHeaders();
  const res = await fetch(buildUrl(table, `id=eq.${id}`), {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}
