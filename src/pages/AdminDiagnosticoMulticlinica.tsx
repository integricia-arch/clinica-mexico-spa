import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw } from "lucide-react";

interface TableRow_ {
  table: string;
  total: number;
  null_clinic_id: number;
  non_default_clinic_id: number;
}

interface Diagnostics {
  generated_at: string;
  default_clinic_id: string;
  tables: TableRow_[];
  cross_checks: Record<string, number>;
  tables_without_rls: string[];
  memberships_by_role: Record<string, number>;
  helpers_present: Record<string, boolean>;
}

export default function AdminDiagnosticoMulticlinica() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: result, error: err } = await (supabase as any).rpc("multiclinic_diagnostics");
    if (err) {
      setError(err.message);
      setData(null);
    } else {
      setData(result as unknown as Diagnostics);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const statusBadge = (ok: boolean) =>
    ok ? (
      <Badge variant="default" className="bg-emerald-600">OK</Badge>
    ) : (
      <Badge variant="destructive">Atención</Badge>
    );

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Diagnóstico multi-clínica</h1>
          <p className="text-muted-foreground">
            Validación de consistencia clinic_id, RLS e integridad cruzada.
          </p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Actualizar</span>
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Clínica default</p>
                <p className="font-mono break-all">{data.default_clinic_id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Generado</p>
                <p>{new Date(data.generated_at).toLocaleString("es-MX")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tablas sin RLS</p>
                <p>{statusBadge(data.tables_without_rls.length === 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Helpers SQL</p>
                <p>{statusBadge(Object.values(data.helpers_present).every(Boolean))}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Memberships por rol</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Object.entries(data.memberships_by_role).map(([role, count]) => (
                <Badge key={role} variant="secondary">
                  {role}: {count}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cruces de clínica</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Verificación</TableHead>
                    <TableHead className="text-right">Inconsistencias</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(data.cross_checks).map(([key, count]) => (
                    <TableRow key={key}>
                      <TableCell className="font-mono text-xs">{key}</TableCell>
                      <TableCell className="text-right">{count}</TableCell>
                      <TableCell className="text-right">{statusBadge(count === 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tablas con clinic_id</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabla</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">clinic_id NULL</TableHead>
                    <TableHead className="text-right">No-default</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tables.map((t) => {
                    const ok =
                      (t.null_clinic_id === 0 || t.table === "audit_logs") &&
                      t.non_default_clinic_id === 0;
                    return (
                      <TableRow key={t.table}>
                        <TableCell className="font-mono text-xs">{t.table}</TableCell>
                        <TableCell className="text-right">{t.total}</TableCell>
                        <TableCell className="text-right">{t.null_clinic_id}</TableCell>
                        <TableCell className="text-right">{t.non_default_clinic_id}</TableCell>
                        <TableCell className="text-right">{statusBadge(ok)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.tables_without_rls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tablas sin RLS</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.tables_without_rls.map((t) => (
                  <Badge key={t} variant="destructive">{t}</Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
