interface Props {
  clinic: { subscription_status: string; grace_period_ends_at: string | null };
}

export function SubscriptionGateBanner({ clinic }: Props) {
  if (clinic.subscription_status !== "past_due" || !clinic.grace_period_ends_at) return null;
  const fecha = new Date(clinic.grace_period_ends_at).toLocaleDateString("es-MX");
  return (
    <div className="bg-amber-100 text-amber-900 text-sm px-4 py-2 text-center">
      Pago pendiente. Resuelve antes de {fecha} para evitar la suspensión del acceso.
    </div>
  );
}
