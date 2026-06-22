import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Tipo = "acceso" | "rectificacion" | "cancelacion" | "oposicion";

const TIPOS: { value: Tipo; label: string; desc: string }[] = [
  { value: "acceso",        label: "Acceso",        desc: "Saber qué datos personales tiene integrika sobre mí." },
  { value: "rectificacion", label: "Rectificación",  desc: "Corregir datos inexactos o incompletos." },
  { value: "cancelacion",   label: "Cancelación",    desc: "Solicitar la eliminación de mis datos." },
  { value: "oposicion",     label: "Oposición",      desc: "Oponerme a cierto tratamiento (ej. finalidades voluntarias o decisiones automatizadas)." },
];

type Status = "idle" | "loading" | "done" | "error";

export default function SolicitudARCO() {
  const [tipo, setTipo] = useState<Tipo | "">("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [folio, setFolio] = useState("");
  const [deadline, setDeadline] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo) return;
    setStatus("loading");
    setErrMsg("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arco-request`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tipo, nombre, email, telefono, descripcion, clinic_name: clinicName }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error desconocido");
      setFolio(json.folio);
      setDeadline(
        new Date(json.deadline_at).toLocaleDateString("es-MX", {
          day: "2-digit", month: "long", year: "numeric",
        })
      );
      setStatus("done");
    } catch (err: unknown) {
      setErrMsg(err instanceof Error ? err.message : "Error al enviar solicitud");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-semibold">Solicitud registrada</h1>
          <div className="rounded-md bg-muted p-4 text-left text-sm space-y-1">
            <p><span className="font-medium">Folio:</span> <code className="text-primary">{folio}</code></p>
            <p><span className="font-medium">Plazo legal de respuesta:</span> {deadline}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Recibirás respuesta en el correo proporcionado antes del plazo indicado.
            Guarda tu folio para dar seguimiento.
          </p>
          <p className="text-xs text-muted-foreground">
            Conforme a <strong>LFPDPPP Arts. 21-29</strong> — plazo de respuesta: 20 días hábiles.
          </p>
        </div>
      </div>
    );
  }

  const tipoInfo = TIPOS.find((t) => t.value === tipo);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Derechos ARCO</h1>
          <p className="text-sm text-muted-foreground">
            Acceso · Rectificación · Cancelación · Oposición
          </p>
          <p className="text-xs text-muted-foreground">
            Conforme a <strong>LFPDPPP Arts. 21-34</strong>. Respuesta en 20 días hábiles.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-6 space-y-5"
        >
          {/* Tipo de derecho */}
          <div className="space-y-2">
            <Label>Derecho que desea ejercer *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tipoInfo && (
              <p className="text-xs text-muted-foreground">{tipoInfo.desc}</p>
            )}
          </div>

          {/* Datos del titular */}
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Juan García López"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono (opcional)</Label>
              <Input
                id="telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="322 123 4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinic">Nombre de la clínica (si aplica)</Label>
            <Input
              id="clinic"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="Clínica donde fue atendido"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción de la solicitud *</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describa qué datos desea acceder, rectificar, cancelar u oponerse a su tratamiento..."
              rows={4}
              required
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-destructive">{errMsg}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!tipo || !nombre.trim() || !email.trim() || !descripcion.trim() || status === "loading"}
          >
            {status === "loading" ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          <a href="/aviso-privacidad" className="underline hover:text-foreground">
            Aviso de Privacidad
          </a>
          {" · "}
          <a href="/terminos" className="underline hover:text-foreground">
            Términos de Servicio
          </a>
          {" · "}
          Responsable de datos: integric.ia@gmail.com
        </p>
      </div>
    </div>
  );
}
