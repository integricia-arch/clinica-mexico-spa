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
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
}

export interface BusySlot {
  start: string;
  end: string;
}

export async function getDoctorCalendar(doctorId: string): Promise<DoctorCalendar | null> {
  const { data } = await supabase
    .from("doctor_calendars")
    .select("id, doctor_id, calendar_id, access_token, refresh_token, token_expiry")
    .eq("doctor_id", doctorId)
    .eq("activo", true)
    .maybeSingle();
  if (!data) return null;

  const cal = data as DoctorCalendar;
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
    const tokens = await resp.json() as { access_token: string; expires_in: number };
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await supabase.from("doctor_calendars").update({
      access_token: tokens.access_token,
      token_expiry: newExpiry,
    }).eq("id", cal.id);
    return tokens.access_token;
  } catch {
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
    if (!resp.ok) return null;
    const data = await resp.json() as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
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
