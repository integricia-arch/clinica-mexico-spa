import { useCallback, useEffect, useState } from "react";
import {
  getSection,
  saveSection,
  type SettingsSection,
} from "@/lib/repositories/clinicSettingsRepository";
import { friendlyError } from "@/lib/errors";

/**
 * Hook genérico para secciones de /ajustes que se almacenan como un blob JSONB
 * en `clinic_settings` (una fila por (clinic_id, section)). Mantiene un form
 * controlado fusionado con `defaults`, de modo que campos nuevos añadidos al
 * default aparecen aunque la fila guardada sea más antigua.
 *
 * Mismo contrato que `useClinicGeneral` para que el shell de /ajustes pueda
 * registrar `save`/`reset` sin ramas especiales.
 */
interface UseClinicSettingsFormResult<T> {
  form: T;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;
  save: () => Promise<void>;
  reset: () => void;
}

export function useClinicSettingsForm<T extends object>(
  clinicId: string | null,
  section: SettingsSection,
  defaults: T,
): UseClinicSettingsFormResult<T> {
  const [form, setForm] = useState<T>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) {
      setForm(defaults);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const saved = await getSection<Partial<T>>(clinicId, section);
      // Fusión inmutable: defaults primero, luego lo guardado encima.
      setForm({ ...defaults, ...(saved ?? {}) });
      setDirty(false);
    } catch (e) {
      setError(
        friendlyError(e as never, `No se pudo cargar la sección "${section}".`),
      );
    } finally {
      setLoading(false);
    }
    // `defaults` se asume estable (literal en el componente); se omite a propósito
    // para no recargar en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, section]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!clinicId) {
      const msg = "No hay clínica activa seleccionada.";
      setError(msg);
      throw new Error(msg);
    }
    setSaving(true);
    setError(null);
    try {
      await saveSection(clinicId, section, form);
      setDirty(false);
    } catch (e) {
      const msg = friendlyError(e as never, "No se pudieron guardar los cambios.");
      setError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  }, [clinicId, section, form]);

  const reset = useCallback(() => {
    void load();
  }, [load]);

  return { form, setField, loading, saving, dirty, error, save, reset };
}
