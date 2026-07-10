import { Link } from "react-router-dom";

const MODULO_LABELS: Record<string, string> = {
  compras: "Compras",
  almacen: "Almacén",
  pos_farmacia: "Caja / Farmacia",
  facturacion_cfdi: "Facturación CFDI",
};

interface Props {
  moduloSlug: string;
}

export function ModuloNoContratadoScreen({ moduloSlug }: Props) {
  const label = MODULO_LABELS[moduloSlug] ?? moduloSlug;

  return (
    <div className="flex items-center justify-center p-6 py-24">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold mb-2 text-balance">{label} no está contratado</h1>
        <p className="text-gray-600">
          Esta clínica no tiene el módulo de {label.toLowerCase()} activo en su
          suscripción. Contacta a soporte de integrika para agregarlo.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Volver al panel principal
        </Link>
      </div>
    </div>
  );
}
