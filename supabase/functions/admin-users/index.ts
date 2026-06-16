// =================================================================
// admin-users: gestiona usuarios (listar, crear, editar, contraseñas)
// Solo accesible para usuarios con rol 'admin'.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "no auth" }, 401);

    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "no user" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    let body: any = {};
    try { body = await req.json(); } catch { /* GET o vacío */ }
    const action: string = body?.action ?? "list";

    // Helper para detectar admins permanentes (no se les puede cambiar contraseña masiva)
    const getPermanentAdminEmails = async (): Promise<Set<string>> => {
      const { data } = await admin.from("permanent_admins").select("email");
      return new Set((data ?? []).map((r: any) => (r.email as string).toLowerCase()));
    };

    if (action === "list") {
      const { data: list, error: listErr } = await admin.rpc("admin_list_auth_users");
      if (listErr) throw listErr;

      const { data: roles, error: rolesErr } = await admin.from("user_roles").select("user_id, role");
      if (rolesErr) throw rolesErr;

      const rolesByUser = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      }

      const permanent = await getPermanentAdminEmails();
      const users = (list ?? []).map((u: { id: string; email: string | null; created_at: string; last_sign_in_at: string | null }) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: rolesByUser.get(u.id) ?? [],
        is_permanent_admin: u.email ? permanent.has(u.email.toLowerCase()) : false,
      }));

      return json({ users });
    }

    if (action === "create") {
      const { email, password, roles } = body as { email?: string; password?: string; roles?: string[] };
      if (!email || !password) return json({ error: "email y contraseña son requeridos" }, 400);
      if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) throw createErr;

      const userId = created.user?.id;
      if (userId && Array.isArray(roles) && roles.length > 0) {
        const rows = roles.map((r) => ({ user_id: userId, role: r }));
        await admin.from("user_roles").upsert(rows, { onConflict: "user_id,role" });
      }
      return json({ ok: true, user_id: userId });
    }

    if (action === "update") {
      const { user_id, email } = body as { user_id?: string; email?: string };
      if (!user_id || !email) return json({ error: "user_id y email son requeridos" }, 400);
      const { error: updErr } = await admin.auth.admin.updateUserById(user_id, { email });
      if (updErr) throw updErr;
      return json({ ok: true });
    }

    if (action === "set_password") {
      const { user_id, password } = body as { user_id?: string; password?: string };
      if (!user_id || !password) return json({ error: "user_id y contraseña son requeridos" }, 400);
      if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
      const { error: pErr } = await admin.auth.admin.updateUserById(user_id, { password });
      if (pErr) throw pErr;
      return json({ ok: true });
    }

    if (action === "set_base_password_all") {
      const { password, clinic_id } = body as { password?: string; clinic_id?: string };
      if (!password || password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);

      const permanent = await getPermanentAdminEmails();
      const { data: list, error: listErr } = await admin.rpc("admin_list_auth_users");
      if (listErr) throw listErr;

      let targetIds: Set<string> | null = null;
      if (clinic_id) {
        const { data: members } = await admin
          .from("clinic_memberships")
          .select("user_id")
          .eq("clinic_id", clinic_id)
          .eq("status", "active");
        targetIds = new Set((members ?? []).map((m: any) => m.user_id as string));
      }

      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];
      for (const u of (list ?? []) as { id: string; email: string | null }[]) {
        if (u.email && permanent.has(u.email.toLowerCase())) { skipped++; continue; }
        if (targetIds && !targetIds.has(u.id)) { skipped++; continue; }
        const { error: pErr } = await admin.auth.admin.updateUserById(u.id, { password });
        if (pErr) { errors.push(`${u.email}: ${pErr.message}`); } else { updated++; }
      }
      return json({ ok: true, updated, skipped, errors });
    }

    if (action === "toggle_role") {
      const { user_id, role, has, clinic_id } = body as {
        user_id?: string; role?: string; has?: boolean; clinic_id?: string;
      };
      if (!user_id || !role) return json({ error: "user_id y role requeridos" }, 400);

      if (has) {
        await admin.from("user_roles").delete().eq("user_id", user_id).eq("role", role);
      } else {
        await admin.from("user_roles").upsert({ user_id, role }, { onConflict: "user_id,role" });
      }

      if (clinic_id) {
        const { data: remaining } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", user_id);
        const roles = (remaining ?? []).map((r: any) => r.role as string);
        if (roles.length === 0) {
          await admin.from("clinic_memberships")
            .delete()
            .eq("user_id", user_id)
            .eq("clinic_id", clinic_id);
        } else {
          const PRIORITY: Record<string, number> = {
            admin: 6, manager: 5, doctor: 4, receptionist: 3, nurse: 2, patient: 1,
          };
          const primary = [...roles].sort((a, b) => (PRIORITY[b] ?? 0) - (PRIORITY[a] ?? 0))[0];
          await admin.from("clinic_memberships").upsert(
            { user_id, clinic_id, role: primary, status: "active" },
            { onConflict: "clinic_id,user_id" },
          );
        }
      }

      return json({ ok: true });
    }

    if (action === "link_doctor_user") {
      // Vincula un doctor (doctors.id) con un usuario auth. Si no existe, lo crea.
      const { doctor_id, email, password, existing_user_id } = body as {
        doctor_id?: string; email?: string; password?: string; existing_user_id?: string;
      };
      if (!doctor_id) return json({ error: "doctor_id requerido" }, 400);

      let userId = existing_user_id;
      if (!userId) {
        if (!email || !password) return json({ error: "email y contraseña requeridos para crear cuenta" }, 400);
        if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
        // Si ya existe un usuario con ese email, reutilízalo
        const { data: existing } = await admin.rpc("admin_list_auth_users");
        const found = (existing as { id: string; email: string | null }[] | null)?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase(),
        );
        if (found) {
          userId = found.id;
        } else {
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email, password, email_confirm: true,
          });
          if (createErr) throw createErr;
          userId = created.user?.id;
        }
      }
      if (!userId) return json({ error: "No se pudo obtener user_id" }, 500);

      // Asignar rol doctor
      await admin.from("user_roles").upsert(
        { user_id: userId, role: "doctor" },
        { onConflict: "user_id,role" },
      );
      // Vincular en doctors
      const { error: dErr } = await admin.from("doctors").update({ user_id: userId }).eq("id", doctor_id);
      if (dErr) throw dErr;

      return json({ ok: true, user_id: userId });
    }

    if (action === "unlink_doctor_user") {
      const { doctor_id } = body as { doctor_id?: string };
      if (!doctor_id) return json({ error: "doctor_id requerido" }, 400);
      const { error: dErr } = await admin.from("doctors").update({ user_id: null }).eq("id", doctor_id);
      if (dErr) throw dErr;
      return json({ ok: true });
    }

    if (action === "link_nurse_user") {
      // Vincula una enfermera (nurses.id) con un usuario auth. Si no existe, lo crea.
      const { nurse_id, email, password, existing_user_id } = body as {
        nurse_id?: string; email?: string; password?: string; existing_user_id?: string;
      };
      if (!nurse_id) return json({ error: "nurse_id requerido" }, 400);

      let userId = existing_user_id;
      if (!userId) {
        if (!email || !password) return json({ error: "email y contraseña requeridos para crear cuenta" }, 400);
        if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
        const { data: existing } = await admin.rpc("admin_list_auth_users");
        const found = (existing as { id: string; email: string | null }[] | null)?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase(),
        );
        if (found) {
          userId = found.id;
        } else {
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email, password, email_confirm: true,
          });
          if (createErr) throw createErr;
          userId = created.user?.id;
        }
      }
      if (!userId) return json({ error: "No se pudo obtener user_id" }, 500);

      await admin.from("user_roles").upsert(
        { user_id: userId, role: "nurse" },
        { onConflict: "user_id,role" },
      );
      const { error: nErr } = await admin.from("nurses").update({ user_id: userId }).eq("id", nurse_id);
      if (nErr) throw nErr;

      return json({ ok: true, user_id: userId });
    }

    if (action === "unlink_nurse_user") {
      const { nurse_id } = body as { nurse_id?: string };
      if (!nurse_id) return json({ error: "nurse_id requerido" }, 400);
      const { error: nErr } = await admin.from("nurses").update({ user_id: null }).eq("id", nurse_id);
      if (nErr) throw nErr;
      return json({ ok: true });
    }

    if (action === "delete") {
      const { user_id } = body as { user_id?: string };
      if (!user_id) return json({ error: "user_id requerido" }, 400);
      // Proteger admin temporal / permanente
      const { data: u } = await admin.auth.admin.getUserById(user_id);
      const permanent = await getPermanentAdminEmails();
      if (u?.user?.email && permanent.has(u.user.email.toLowerCase())) {
        return json({ error: "No se puede eliminar a un administrador permanente" }, 403);
      }
      if (user_id === userData.user.id) {
        return json({ error: "No puedes eliminar tu propia cuenta" }, 403);
      }
      const { error: dErr } = await admin.auth.admin.deleteUser(user_id);
      if (dErr) throw dErr;
      return json({ ok: true });
    }

    return json({ error: "Acción no soportada" }, 400);
  } catch (err: any) {
    console.error("admin-users error:", err);
    const raw = err?.message ?? "Error desconocido";
    const isWeak = /weak|easy to guess|pwned|compromised/i.test(raw);
    const msg = isWeak
      ? "La contraseña es muy débil o aparece en bases de datos de contraseñas filtradas. Usa una combinación más fuerte (letras, números y símbolos) y evita palabras comunes."
      : raw;
    return json({ error: msg }, isWeak ? 400 : 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
