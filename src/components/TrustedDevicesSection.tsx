import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Laptop, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

interface TrustedDevice {
  id: string;
  device_label: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

export default function TrustedDevicesSection() {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("mfa_list_trusted_devices");
    if (!error) setDevices((data as TrustedDevice[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id: string) => {
    setRevokingId(id);
    const { error } = await supabase.rpc("mfa_revoke_trusted_device", { _device_id: id });
    setRevokingId(null);
    if (error) { toast.error("No se pudo revocar: " + friendlyError(error)); return; }
    toast.success("Dispositivo revocado — pedirá código en su próximo ingreso");
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  if (loading || devices.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-display font-semibold text-card-foreground">Dispositivos de confianza (verificación en dos pasos)</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Estos dispositivos no piden código de verificación en cada ingreso. Revoca cualquiera que no reconozcas.
      </p>
      <div className="space-y-2">
        {devices.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <Laptop className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{d.device_label ?? "Dispositivo sin nombre"}</p>
                <p className="text-xs text-muted-foreground">
                  Último uso {fmt(d.last_seen_at)} · confiable hasta {fmt(d.expires_at)}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => revoke(d.id)} disabled={revokingId === d.id}>
              {revokingId === d.id ? "Revocando…" : "Revocar"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
