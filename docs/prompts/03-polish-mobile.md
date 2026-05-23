# Prompt Lovable #3 — Polish para demo estable

> **Última vuelta: pulir la app para que se vea profesional en demo. No tocar lógica, solo presentación.**

---

## Objetivo

Que cualquier persona que abra la app diga "esto se ve serio". Mobile responsive, empty states ilustrados, skeleton loaders, transiciones suaves.

## Lista de pulidos (8 puntos)

### 1. Sidebar colapsable en mobile

En `src/components/AppLayout.tsx`:
- En viewport `<768px` (md breakpoint de Tailwind), sidebar oculto por default
- Botón hamburguesa `<Menu>` en header mobile que abre un `<Sheet>` de shadcn con el sidebar adentro
- Al click en cualquier link del sidebar mobile, cerrarlo automáticamente

### 2. Tablas con scroll horizontal en mobile

Todas las tablas (`Recordatorios.tsx`, `Pacientes.tsx`, `Auditoria.tsx`, etc.) deben envolver el `<Table>` en:

```tsx
<div className="rounded-md border overflow-x-auto">
  <Table>...</Table>
</div>
```

Si ya hay un wrapper similar, solo añadir `overflow-x-auto`.

### 3. Skeleton loaders en lugar de "Cargando..."

Donde sea que veas un estado de loading con texto, reemplazar por `<Skeleton>` de shadcn:

```tsx
// Antes:
{isLoading ? <p>Cargando...</p> : <Lista />}

// Después:
{isLoading ? (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
  </div>
) : <Lista />}
```

Aplicar en mínimo: Inbox, Recordatorios, Pacientes, Agenda, DetalleCita.

### 4. Empty states ilustrados

Cuando no haya datos, en vez de espacio vacío o mensaje crudo:

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <Icono className="w-16 h-16 text-muted-foreground/50 mb-4" />
  <h3 className="text-lg font-medium">Sin {entidad}</h3>
  <p className="text-sm text-muted-foreground mt-1">{descripción de por qué}</p>
  {acción opcional: <Button className="mt-4">Crear primero</Button>}
</div>
```

Aplicar en: Inbox (sin conversaciones), Recordatorios (sin recordatorios), Pacientes (sin pacientes), Agenda (sin citas el día), DetalleCita (sin recordatorios en la cita).

Íconos sugeridos de lucide:
- Inbox vacío → `<MessageSquareOff>` o `<MessageSquare>`
- Recordatorios vacíos → `<BellOff>` o `<Bell>`
- Pacientes vacíos → `<UserX>` o `<Users>`
- Citas vacías → `<CalendarOff>` o `<Calendar>`

### 5. Transiciones de página con framer-motion

`framer-motion` ya está en el stack. En cada `<Route>` page, envolver el contenido raíz:

```tsx
import { motion } from "framer-motion";

return (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2 }}
  >
    {/* contenido de la página */}
  </motion.div>
);
```

Aplicar en todas las páginas top-level. **No** en componentes internos — solo el wrapper raíz por página.

### 6. Toasts consistentes

En `src/main.tsx` o donde tengas `<Toaster />` de sonner, asegurar:

```tsx
<Toaster
  position="top-right"
  richColors
  closeButton
  duration={4000}
/>
```

### 7. Dark mode revisado

Abrir cada página en dark mode y verificar:
- Texto legible (suficiente contraste)
- Badges siguen siendo distinguibles
- Bordes visibles pero sutiles
- Fondos no demasiado oscuros (debe haber jerarquía visual)

Si encuentras problemas, ajusta los tokens semánticos en `src/index.css` (variables `--background`, `--foreground`, `--muted`, etc.). **No** uses colores hardcoded (`bg-gray-900`) — usa los tokens semánticos (`bg-background`).

### 8. Header de página estandarizado

Crear `src/components/PageHeader.tsx`:

```tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
```

Usar en todas las páginas top-level reemplazando los headers actuales.

## Restricciones

- **No tocar lógica de negocio.** Solo presentación, layout, estilo.
- **No agregar librerías.** Todo con lo que ya hay (shadcn/ui, framer-motion, lucide-react, tailwind).
- **Usa tokens semánticos de Tailwind** (`bg-background`, `text-foreground`, `border-border`) — no colores absolutos.
- **`npm run build` debe pasar.**

## Validación

1. Abrir la app en mobile (Chrome DevTools, 375px width):
   - Sidebar colapsa a hamburguesa
   - Tablas hacen scroll lateral
   - Nada se rompe visualmente
2. Cargar páginas con datos vacíos (puedes filtrar para que no haya resultados):
   - Empty states aparecen con ícono y texto
3. Cambiar entre páginas:
   - Transición suave (fade + slight slide up)
4. Toggle dark mode:
   - Todo legible y consistente
5. Build pasa.

## Después de este prompt

La demo está lista para presentar. Pendiente solo cosas de Fase C (mover Edge Functions al repo, CI/CD, tests).
