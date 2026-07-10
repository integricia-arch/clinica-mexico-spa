export const TERMINOS_CANCELACION = {
  titulo: "Cancelar suscripción",
  cuerpo: (fechaCorte: string) =>
    `Tu suscripción se cancelará, pero seguirás teniendo acceso completo a todos tus módulos hasta el ${fechaCorte}. No se hace ningún reembolso por el tiempo ya pagado. Puedes reactivar tu suscripción en cualquier momento antes de esa fecha desde esta misma pantalla.`,
  confirmar: "Sí, cancelar suscripción",
  cancelar: "No, mantener mi suscripción",
} as const;
