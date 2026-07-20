-- Fusiona catálogo de cuentas duplicado: la misma cuenta de negocio existía dos veces
-- con codigo distinto — mnemónico legacy de fase 1-4 (ING_CONSULTAS, EGR_HONORARIOS, ...)
-- y numérico con codigo_agrupador_sat de fase 6C (401, 601, ...). Se detectó en auditoría
-- 2026-07-20 (ver memoria/proyectos/modulo-contable-memoria-tecnica.md §12.7).
--
-- Se conserva el codigo LEGACY como sobreviviente por cuenta: tiene más superficie de
-- código dependiente (triggers contab_movimiento_caja/contab_pharmacy_sale/
-- contab_factura_proveedor/contab_devengar_honorarios en fase3/fase6b, reporte de
-- kpis_dashboard en fase4, y CatalogosTab.tsx que restringe la UI de IVA a esos codigos).
-- Antes de fusionar se copia naturaleza + codigo_agrupador_sat de la cuenta numérica
-- (la única que los tenía) hacia la cuenta legacy sobreviviente.

DO $$
DECLARE
  r RECORD;
  v_legacy_id uuid;
  v_numerico_id uuid;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('401', 'ING_CONSULTAS'),
      ('402', 'ING_FARMACIA'),
      ('403', 'ING_OTROS'),
      ('601', 'EGR_HONORARIOS'),
      ('602', 'EGR_RENTA'),
      ('603', 'EGR_NOMINA'),
      ('604', 'EGR_SERVICIOS'),
      ('699', 'EGR_OTROS')
    ) AS m(codigo_numerico, codigo_legacy)
  LOOP
    SELECT id INTO v_legacy_id FROM public.cuentas_contables WHERE codigo = r.codigo_legacy;
    SELECT id INTO v_numerico_id FROM public.cuentas_contables WHERE codigo = r.codigo_numerico;

    IF v_legacy_id IS NULL OR v_numerico_id IS NULL THEN
      CONTINUE; -- ya fusionado o nunca existió en este entorno (idempotente)
    END IF;

    UPDATE public.cuentas_contables legacy
    SET naturaleza = num.naturaleza,
        codigo_agrupador_sat = COALESCE(legacy.codigo_agrupador_sat, num.codigo_agrupador_sat)
    FROM public.cuentas_contables num
    WHERE legacy.id = v_legacy_id AND num.id = v_numerico_id;

    UPDATE public.contab_reglas_asiento SET cuenta_cargo_id = v_legacy_id WHERE cuenta_cargo_id = v_numerico_id;
    UPDATE public.contab_reglas_asiento SET cuenta_abono_id = v_legacy_id WHERE cuenta_abono_id = v_numerico_id;
    UPDATE public.poliza_partidas SET cuenta_id = v_legacy_id WHERE cuenta_id = v_numerico_id;
    UPDATE public.contab_estados_cuenta SET cuenta_id = v_legacy_id WHERE cuenta_id = v_numerico_id;
    UPDATE public.movimientos_contables SET cuenta_id = v_legacy_id WHERE cuenta_id = v_numerico_id;
    UPDATE public.cuentas_contables SET cuenta_padre_id = v_legacy_id WHERE cuenta_padre_id = v_numerico_id;

    DELETE FROM public.cuentas_contables WHERE id = v_numerico_id;
  END LOOP;
END $$;

-- Llave de defensa: nombre normalizado (sin acentos, minúsculas, espacios colapsados)
-- único por tipo de cuenta. No sustituye el UNIQUE ya existente en `codigo` — lo
-- complementa: `codigo` evita duplicar la MISMA clave, esto evita crear una cuenta nueva
-- con nombre equivalente a una ya activa bajo una clave distinta (la causa raíz de esta
-- fusión). Limitación conocida: solo detecta coincidencia de nombre normalizado, no
-- sinónimos (ej. "Otros gastos" vs "Otros egresos" no habría chocado con esta regla) —
-- sigue siendo responsabilidad de quien da de alta revisar el árbol antes de crear.
-- extensions.unaccent() es STABLE (depende del diccionario de config), no IMMUTABLE —
-- Postgres rechaza columnas generadas/índices con funciones no-IMMUTABLE (42P17, mismo
-- error ya documentado para contab_estados_cuenta en fase 8). Wrapper IMMUTABLE fijando
-- el diccionario explícito, patrón estándar para usar unaccent en columnas generadas.
CREATE OR REPLACE FUNCTION public.f_unaccent_immutable(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions
AS $$ SELECT extensions.unaccent('extensions.unaccent', $1) $$;

ALTER TABLE public.cuentas_contables
  ADD COLUMN IF NOT EXISTS nombre_normalizado text
    GENERATED ALWAYS AS (
      lower(regexp_replace(public.f_unaccent_immutable(trim(nombre)), '\s+', ' ', 'g'))
    ) STORED;

DROP INDEX IF EXISTS public.uq_cuentas_contables_nombre_normalizado;
CREATE UNIQUE INDEX uq_cuentas_contables_nombre_normalizado
  ON public.cuentas_contables (tipo, nombre_normalizado)
  WHERE activo;
