export interface ModuloRow {
  modulo_id: string;
  catalogo_modulos: { id: string; nombre: string; precio_centavos: number; stripe_price_id: string | null } | null;
}

export interface SubscriptionInvoice {
  id: string;
  amount_paid: number;
  status: string;
  created: number;
  hosted_invoice_url: string;
}

export interface SubscriptionSummary {
  clinic: {
    id: string;
    name: string;
    status: string;
    plan: string;
    subscription_status: string;
    grace_period_ends_at: string | null;
  };
  modulos: ModuloRow[];
  subscription: {
    status?: string;
    current_period_end?: number;
    default_payment_method?: { card?: { brand: string; last4: string } } | null;
  } | null;
  invoices: SubscriptionInvoice[];
}

export interface CatalogoModulo {
  id: string;
  nombre: string;
  precio_centavos: number;
}
