import { Heart, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function SinAcceso() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
          <Heart className="h-7 w-7 text-primary-foreground" />
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-card space-y-4">
          <h1 className="text-xl font-semibold text-card-foreground">Cuenta pendiente de activación</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta <span className="font-medium text-foreground">{user?.email}</span> fue creada
            correctamente pero aún no tiene permisos asignados.
          </p>
          <p className="text-sm text-muted-foreground">
            Contacta al administrador de tu clínica para que te asigne un rol de acceso.
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" asChild>
              <a href="mailto:soporte@integrika.mx" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contactar soporte
              </a>
            </Button>
            <Button variant="ghost" onClick={signOut} className="text-muted-foreground">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
