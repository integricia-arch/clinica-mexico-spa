# Facturación y CFDI

> Aquí configuras los datos fiscales del emisor, el Certificado de Sello Digital (CSD) y la conexión con el Proveedor Autorizado de Certificación (PAC) para poder timbrar facturas (CFDI) válidas ante el SAT. Solo la usa el administrador.

## Operación — cómo se usa

### Cómo capturar los datos del emisor

1. Entra a "Configuración" → "Facturación y CFDI".
2. Completa **RFC** y **CP del domicilio fiscal** (obligatorios), y la **razón social/nombre completo** exactamente como está registrada en el SAT.
3. Elige el **régimen fiscal** de la lista (los 17 regímenes vigentes del SAT).
4. Define la **serie por defecto** (ej. "A") que llevarán tus facturas.
5. Elige la **tasa de IVA por defecto** (16% general, 8% zona fronteriza, o 0%) y marca la casilla si la clínica está en zona fronteriza.

### Cómo subir el Certificado de Sello Digital (CSD)

1. En la sección "Certificado de Sello Digital (CSD)", da clic en **"Seleccionar .cer"** y elige el archivo `.cer` que te dio el SAT.
2. Da clic en **"Seleccionar .key"** y elige el archivo `.key` correspondiente.
3. Escribe la **contraseña del CSD** (déjala en blanco si no quieres cambiarla).
4. Da clic en **"Guardar configuración CFDI"** — los archivos se suben a un almacenamiento privado cifrado.

### Cómo configurar el PAC (proveedor que timbra las facturas)

1. En la sección "Proveedor Autorizado de Certificación (PAC)", elige el PAC (Facturama, FiscalAPI o Finkok).
2. Elige el ambiente: **Sandbox (pruebas)** o **Producción**. Si eliges Producción, el sistema te avisa que los CFDI timbrados tendrán validez fiscal real.
3. Captura usuario y contraseña del PAC.
4. Da clic en **"Probar conexión PAC"** para verificar que las credenciales funcionan antes de guardar.
5. Da clic en **"Guardar configuración CFDI"**.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** RFC, razón social y CP del domicilio fiscal son obligatorios para guardar.
  **Por qué:** son datos mínimos exigidos por el SAT para timbrar cualquier factura válida.
- **Lo que pasa:** las contraseñas del CSD y del PAC nunca se muestran de vuelta — el campo siempre aparece vacío y solo se actualiza si escribes algo nuevo.
  **Por qué:** son credenciales sensibles; se guardan de forma protegida (fuera del alcance de este formulario) y no se exponen ni siquiera al propio administrador que las capturó.
- **Lo que pasa:** si eliges ambiente "Producción", el sistema muestra una advertencia visible.
  **Por qué:** en ese modo, cada factura que se timbre tendrá validez fiscal real — un error ahí no se puede "deshacer" como en modo de pruebas.
- **Lo que pasa:** puedes probar la conexión con el PAC antes de guardar.
  **Por qué:** así detectas credenciales incorrectas antes de que el sistema intente timbrar una factura real y falle en el momento de cobrarle a un paciente.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No puedo guardar, dice que faltan datos | Falta RFC, razón social o CP del domicilio fiscal | Completa los tres campos marcados con asterisco |
| "Probar conexión PAC" me dice error | Usuario o contraseña del PAC incorrectos, o el PAC no respondió | Verifica las credenciales con tu proveedor de PAC; confirma también el ambiente (sandbox vs producción) |
| Subí el CSD pero no veo la contraseña que puse antes | Es el comportamiento esperado — las contraseñas nunca se muestran de vuelta por seguridad | Si necesitas cambiarla, simplemente escribe la nueva; si no, déjala en blanco y no se modifica |
| Timbré una factura de prueba y salió con validez real | El ambiente estaba en "Producción" en vez de "Sandbox" | Cambia el ambiente a "Sandbox (pruebas)" antes de hacer pruebas |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/configuracion/ConfiguracionCFDI.tsx` (ruta `/configuracion/facturacion`).
- **Tabla Supabase:** `cfdi_config` (`clinic_id`, `rfc`, `razon_social`, `regimen_fiscal`, `domicilio_fiscal_cp`, `serie_defecto`, `pac_proveedor`, `pac_ambiente`, `pac_usuario`, `csd_cer_nombre`, `csd_key_nombre`, `csd_cer_path`, `csd_key_path`, `iva_default`, `zona_fronteriza`). Las columnas `pac_contrasena`/`csd_contrasena` **nunca** se escriben en esta tabla desde el frontend.
- **Storage:** bucket privado `csd-files`, ruta `{clinic_id}/emisor.cer` y `{clinic_id}/emisor.key`.
- **Edge function:** `cfdi-set-credentials` — recibe `pac_contrasena`/`csd_contrasena` y las guarda en Vault (nunca pasan por la tabla `cfdi_config`).
- **Prueba de conexión PAC:** `handleTestPAC()` hace un `fetch` directo desde el navegador a la API de Facturama (sandbox o producción) con Basic Auth — solo implementado para Facturama; si se agrega soporte a otro PAC, extender esta función.
- **Cómo agregar un régimen fiscal nuevo:** agregar la entrada a la constante `REGIMENES` (clave + nombre) al inicio del archivo.
- **Cómo agregar un PAC nuevo:** agregar a la constante `PACS`, e implementar su lógica de prueba de conexión y de timbrado real (esta última vive en el backend/edge function de facturación, no en este archivo).

_/aprende 2026-07-06_
