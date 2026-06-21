// google-calendar.ts — Google Calendar API helpers for telegram-webhook
// Handles token refresh, free/busy queries, and event CRUD.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface DoctorCalendar {
  id: string;
  doctor_id: string;
  clinic_id: string | null;
  calendar_id: string;
  /** Decrypted access token, loaded from Vault after fetching the row. */
  access_token: string;
  /** Decrypted refresh token, loaded from Vault after fetching the row. */
  refresh_token: string;
  token_expiry: string;
  /** Vault secret UUID for the access token (stored in doctor_calendars). */
  vault_access_token_id: string;
  /** Vault secret UUID for the refresh token (stored in doctor_calendars). */
  vault_refresh_token_id: string;
}

export interface BusySlot {
  start: string;
  end: string;
}

export async function getDoctorCalendar(doctorId: string): Promise<DoctorCalendar | null> {
  const { data } = await supabase
    .from("doctor_calendars")
    .select("id, doctor_id, clinic_id, calendar_id, token_expiry, vault_access_token_id, vault_refresh_token_id")
    .eq("doctor_id", doctorId)
    .eq("activo", true)
    .maybeSingle();
  if (!data) return null;

  const cal_row = data as { id: string; doctor_id: string; clinic_id: string | null; calendar_id: string; token_expiry: string; vault_access_token_id: string; vault_refresh_token_id: string };

  // Decrypt both tokens from Vault via service_role RPC
  const [accessResult, refreshResult] = await Promise.all([
    supabase.rpc("doctor_calendar_get_token", { p_doctor_id: doctorId, p_clinic_id: cal_row.clinic_id, p_token_type: "access" }),
    supabase.rpc("doctor_calendar_get_token", { p_doctor_id: doctorId, p_clinic_id: cal_row.clinic_id, p_token_type: "refresh" }),
  ]);

  if (accessResult.error || refreshResult.error || !accessResult.data || !refreshResult.data) {
    console.error("[GCal] Vault token fetch failed", accessResult.error, refreshResult.error);
    return null;
  }

  const cal: DoctorCalendar = {
    ...cal_row,
    access_token: accessResult.data as string,
    refresh_token: refreshResult.data as string,
  };

  const fiveMin = 5 * 60 * 1000;
  if (Date.now() + fiveMin >= new Date(cal.token_expiry).getTime()) {
    const refreshed = await refreshAccessToken(cal);
    if (!refreshed) return null;
    return { ...cal, access_token: refreshed };
  }
  return cal;
}

async function refreshAccessToken(cal: DoctorCalendar): Promise<string | null> {
  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: cal.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!resp.ok) return null;
    const tokens = await resp.json() as { access_token: string; expires_in: number; refresh_token?: string };
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Update the access token in Vault (upsert by name — reuses the existing secret id)
    const { data: newVaultId, error: vaultErr } = await supabase.rpc(
      "doctor_calendar_upsert_token",
      { p_doctor_id: cal.doctor_id, p_clinic_id: cal.clinic_id, p_token_type: "access", p_token_value: tokens.access_token },
    );
    if (vaultErr) {
      console.error("[GCal] refreshAccessToken: Vault upsert failed", vaultErr);
      return null;
    }

    // If Google rotated the refresh token, persist the new one
    if (tokens.refresh_token) {
      const { error: rtError } = await supabase.rpc(
        "doctor_calendar_upsert_token",
        { p_doctor_id: cal.doctor_id, p_clinic_id: cal.clinic_id, p_token_type: "refresh", p_token_value: tokens.refresh_token },
      );
      if (rtError) {
        console.error("[GCal] Error upserting rotated refresh_token:", rtError);
      }
    }

    // Update token_expiry and (in case the vault id changed) vault_access_token_id
    const { error: updateError } = await supabase.from("doctor_calendars").update({
      vault_access_token_id: newVaultId,
      token_expiry: newExpiry,
    }).eq("id", cal.id);
    if (updateError) {
      console.error("[GCal] Failed to update token_expiry after refresh:", updateError);
      // Don't throw — return the new token anyway so this calendar call succeeds
      // but log it so the stale expiry is visible
    }

    return tokens.access_token;
  } catch (e) {
    console.error("[GCal] refreshAccessToken: unexpected error", e);
    return null;
  }
}

export async function getFreeBusy(
  cal: DoctorCalendar,
  timeMin: string,
  timeMax: string,
): Promise<BusySlot[]> {
  try {
    const resp = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cal.access_token}`,
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: "America/Mexico_City",
        items: [{ id: cal.calendar_id }],
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json() as { calendars: Record<string, { busy: BusySlot[] }> };
    return data.calendars?.[cal.calendar_id]?.busy ?? [];
  } catch {
    return [];
  }
}

// Convert a UTC ISO string to a local ISO string in America/Mexico_City (no UTC offset).
// Google Calendar ignores timeZone when the dateTime has an explicit UTC offset (Z),
// so we must pass local time without Z for the timeZone field to take effect.
function toMexicoLocalISO(utcIso: string): string {
  const d = new Date(utcIso);
  // sv-SE locale produces "YYYY-MM-DD HH:MM:SS" in the given timezone
  return d.toLocaleString("sv-SE", { timeZone: "America/Mexico_City" }).replace(" ", "T");
}

export async function createCalendarEvent(
  cal: DoctorCalendar,
  event: { summary: string; description: string; startIso: string; endIso: string },
): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendar_id)}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cal.access_token}`,
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: { dateTime: toMexicoLocalISO(event.startIso), timeZone: "America/Mexico_City" },
          end: { dateTime: toMexicoLocalISO(event.endIso), timeZone: "America/Mexico_City" },
        }),
      },
    );
    if (!resp.ok) {
      const body = await resp.text().catch(() => resp.status.toString());
      throw new Error(`GCal createEvent ${resp.status}: ${body.slice(0, 300)}`);
    }
    const data = await resp.json() as { id?: string };
    return data.id ?? null;
  } catch (e) {
    throw e; // rethrow so crearCitaDesdeSesion outer catch logs to gcal_last_error
  }
}

export async function updateCalendarEvent(
  cal: DoctorCalendar,
  eventId: string,
  event: { summary: string; description: string; startIso: string; endIso: string },
): Promise<boolean> {
  try {
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendar_id)}/events/${eventId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cal.access_token}`,
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: { dateTime: toMexicoLocalISO(event.startIso), timeZone: "America/Mexico_City" },
          end: { dateTime: toMexicoLocalISO(event.endIso), timeZone: "America/Mexico_City" },
        }),
      },
    );
    return resp.ok;
  } catch {
    return false;
  }
}

export async function deleteCalendarEvent(
  cal: DoctorCalendar,
  eventId: string,
): Promise<void> {
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendar_id)}/events/${eventId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${cal.access_token}` },
      },
    );
  } catch {
    // Silent — cita already cancelled in DB
  }
}
