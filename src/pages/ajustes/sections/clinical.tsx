import { Plus, Trash2, Upload, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { type SectionProps } from "../shared";

/* ---------------- 5. Servicios ---------------- */
export function SectionServicios({ onChange }: SectionProps) {
  const servicios = [
    { n: "Consulta", t: "Consulta", p: 800, d: 30, c: false, k: false },
    { n: "Seguimiento", t: "Seguimiento", p: 500, d: 20, c: false, k: false },
    { n: "Infiltración", t: "Procedimiento", p: 2500, d: 45, c: true, k: true },
    { n: "Análisis clínicos", t: "Laboratorio", p: 650, d: 15, c: false, k: true },
    { n: "Ultrasonido", t: "Imagenología", p: 1200, d: 30, c: false, k: true },
    { n: "Fisioterapia", t: "Tratamiento", p: 700, d: 50, c: true, k: true },
    { n: "Telemedicina", t: "Telemedicina", p: 600, d: 25, c: false, k: false },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Catálogo de servicios</CardTitle>
          <CardDescription>Precios en MXN</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="h-9 w-48 pl-8" placeholder="Buscar servicio" />
          </div>
          <Button size="sm" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Nuevo</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Servicio</TableHead><TableHead>Tipo</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Duración</TableHead>
              <TableHead className="text-center">Consentimiento</TableHead>
              <TableHead className="text-center">Checklist</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servicios.map((s) => (
              <TableRow key={s.n}>
                <TableCell className="font-medium">{s.n}</TableCell>
                <TableCell><Badge variant="secondary">{s.t}</Badge></TableCell>
                <TableCell className="text-right">${s.p.toLocaleString("es-MX")}</TableCell>
                <TableCell className="text-right">{s.d} min</TableCell>
                <TableCell className="text-center"><Switch defaultChecked={s.c} onCheckedChange={onChange} /></TableCell>
                <TableCell className="text-center"><Switch defaultChecked={s.k} onCheckedChange={onChange} /></TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={onChange}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- 6. Doctores ---------------- */
export function SectionDoctores({ onChange }: SectionProps) {
  const docs = [
    { n: "Dra. Ana López", e: "Medicina interna", c: "1234567", co: "Consultorio 1", h: "L-V 09:00–14:00" },
    { n: "Dr. Carlos Ruiz", e: "Traumatología", c: "7654321", co: "Consultorio 2", h: "L-S 15:00–20:00" },
    { n: "Dra. María Gómez", e: "Pediatría", c: "9988776", co: "Consultorio 3", h: "M-J 10:00–18:00" },
  ];
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Personal médico</CardTitle>
          <Button size="sm" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Agregar doctor</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead><TableHead>Especialidad</TableHead>
              <TableHead>Cédula</TableHead><TableHead>Consultorio</TableHead>
              <TableHead>Horario</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.n}>
                  <TableCell className="font-medium">{d.n}</TableCell>
                  <TableCell>{d.e}</TableCell>
                  <TableCell>{d.c}</TableCell>
                  <TableCell>{d.co}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.h}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={onChange}>Editar</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Firma y encabezado de receta</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-40 items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
              Vista previa
            </div>
            <Button variant="outline" size="sm" onClick={onChange}><Upload className="mr-1.5 h-4 w-4" /> Subir firma</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
