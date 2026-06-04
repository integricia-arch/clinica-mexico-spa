import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { type SectionProps } from "../shared";

/* ---------------- 7. Consultorios y Recursos ---------------- */
export function SectionRecursos({ onChange }: SectionProps) {
  return (
    <Tabs defaultValue="consultorios">
      <TabsList>
        <TabsTrigger value="consultorios">Consultorios</TabsTrigger>
        <TabsTrigger value="salas">Salas de procedimiento</TabsTrigger>
        <TabsTrigger value="equipos">Equipos</TabsTrigger>
      </TabsList>

      <TabsContent value="consultorios" className="mt-4">
        <ResourceTable
          headers={["Nombre", "Piso", "Capacidad", "Estado"]}
          rows={[
            ["Consultorio 1", "PB", "2", "Disponible"],
            ["Consultorio 2", "PB", "2", "Ocupado"],
            ["Consultorio 3", "1°", "3", "Disponible"],
          ]}
          onChange={onChange}
        />
      </TabsContent>
      <TabsContent value="salas" className="mt-4">
        <ResourceTable
          headers={["Sala", "Tipo", "Capacidad", "Estado"]}
          rows={[
            ["Sala A", "Curaciones", "1", "Disponible"],
            ["Sala B", "Cirugía menor", "1", "Mantenimiento"],
          ]}
          onChange={onChange}
        />
      </TabsContent>
      <TabsContent value="equipos" className="mt-4">
        <ResourceTable
          headers={["Equipo", "Ubicación", "Próx. mantenimiento", "Estado"]}
          rows={[
            ["Ultrasonido GE", "Sala A", "15/08/2026", "Disponible"],
            ["Electrocardiógrafo", "Consultorio 2", "30/07/2026", "Disponible"],
            ["Autoclave", "Sala B", "10/07/2026", "Mantenimiento"],
          ]}
          onChange={onChange}
        />
      </TabsContent>
    </Tabs>
  );
}

function ResourceTable({ headers, rows, onChange }: { headers: string[]; rows: string[][]; onChange: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardDescription>{rows.length} registros</CardDescription>
        <Button size="sm" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Agregar</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}<TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((c, j) => (
                  <TableCell key={j} className={j === 0 ? "font-medium" : ""}>
                    {j === r.length - 1 ? (
                      <Badge variant={c === "Disponible" ? "default" : c === "Mantenimiento" ? "destructive" : "secondary"}>{c}</Badge>
                    ) : c}
                  </TableCell>
                ))}
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={onChange}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- 8. Formularios del Paciente ---------------- */
export function SectionFormularios({ onChange }: SectionProps) {
  const bloques = [
    { t: "Datos generales", d: "Nombre, fecha de nacimiento, sexo, CURP, contacto", on: true },
    { t: "Antecedentes médicos", d: "Personales, familiares, quirúrgicos", on: true },
    { t: "Alergias", d: "Medicamentos, alimentos, ambientales", on: true },
    { t: "Medicamentos actuales", d: "Lista activa con posología", on: true },
    { t: "Contacto de emergencia", d: "Nombre, parentesco, teléfono", on: true },
    { t: "Consentimientos informados", d: "Vinculados al servicio", on: true },
    { t: "Preguntas por especialidad", d: "Cuestionarios condicionales", on: false },
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Bloques del expediente</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {bloques.map((b) => (
          <div key={b.t} className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">{b.t}</p>
              <p className="text-xs text-muted-foreground">{b.d}</p>
            </div>
            <Switch defaultChecked={b.on} onCheckedChange={onChange} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- 9. Checklists Clínicos ---------------- */
export function SectionChecklists({ onChange }: SectionProps) {
  const checks = [
    { servicio: "Infiltración", pasos: 5, responsable: "Doctor", bloqueo: true },
    { servicio: "Ultrasonido", pasos: 3, responsable: "Enfermería", bloqueo: false },
    { servicio: "Cirugía menor", pasos: 8, responsable: "Doctor", bloqueo: true },
    { servicio: "Toma de muestra", pasos: 4, responsable: "Enfermería", bloqueo: true },
  ];
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Checklists por servicio</CardTitle>
          <Button size="sm" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Nuevo checklist</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Servicio</TableHead><TableHead>Pasos</TableHead>
              <TableHead>Responsable</TableHead><TableHead>Bloquear avance</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {checks.map((c) => (
                <TableRow key={c.servicio}>
                  <TableCell className="font-medium">{c.servicio}</TableCell>
                  <TableCell>{c.pasos}</TableCell>
                  <TableCell><Badge variant="secondary">{c.responsable}</Badge></TableCell>
                  <TableCell><Switch defaultChecked={c.bloqueo} onCheckedChange={onChange} /></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={onChange}>Configurar</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">Permitir justificación al omitir un paso</p>
            <p className="text-xs text-muted-foreground">Requiere capturar motivo y queda en auditoría</p>
          </div>
          <Switch defaultChecked onCheckedChange={onChange} />
        </CardContent>
      </Card>
    </div>
  );
}
