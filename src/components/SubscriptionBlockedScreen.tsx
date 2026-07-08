interface Props {
  clinic: { subscription_status: string };
}

export function SubscriptionBlockedScreen({ clinic }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold mb-2">Acceso suspendido</h1>
        <p className="text-gray-600">
          {clinic.subscription_status === "canceled"
            ? "La suscripción de este hospital fue cancelada."
            : "El período de gracia por pago pendiente venció."}
          {" "}Contacta a soporte de integrika para reactivar el acceso.
        </p>
      </div>
    </div>
  );
}
