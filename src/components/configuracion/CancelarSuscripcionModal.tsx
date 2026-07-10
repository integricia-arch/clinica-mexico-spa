import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { TERMINOS_CANCELACION } from "./terminos-cancelacion";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fechaCorte: string;
  loading: boolean;
}

export function CancelarSuscripcionModal({ open, onClose, onConfirm, fechaCorte, loading }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !loading && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TERMINOS_CANCELACION.titulo}</DialogTitle>
          <DialogDescription>{TERMINOS_CANCELACION.cuerpo(fechaCorte)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {TERMINOS_CANCELACION.cancelar}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
            {TERMINOS_CANCELACION.confirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
