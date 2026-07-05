/**
 * Captura de pagos para POS Farmacia.
 *
 * NUNCA solicita ni almacena: número completo de tarjeta, CVV, fecha de
 * vencimiento, NIP, banda magnética ni chip. Solo últimos 4 dígitos y datos
 * operativos (autorización, terminal, adquirente).
 */
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export type CardType = "debito" | "credito";
export type CardBrand = "Visa" | "Mastercard" | "Amex" | "Otro";

export type CardPayment = {
  amount: number;
  card_type: CardType;
  card_brand: CardBrand;
  card_last4: string;
  authorization_code: string;
  terminal_id: string;
  acquirer: string;
};

export type TransferPayment = {
  amount: number;
  transfer_reference: string;
  bank_name: string;
};

export type PaymentBreakdown = {
  efectivo: number;
  monto_recibido: number;
  tarjeta: number;
  transferencia: number;
  card: CardPayment;
  transfer: TransferPayment;
};

const formatMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/**
 * Detecta intentos de capturar número completo o CVV.
 * Devuelve true si la cadena tiene >4 dígitos consecutivos (probable PAN/CVV).
 */
export function looksLikeFullCardNumber(s: string): boolean {
  return /\d{5,}/.test(s);
}

export function emptyBreakdown(total = 0): PaymentBreakdown {
  return {
    efectivo: total,
    monto_recibido: total,
    tarjeta: 0,
    transferencia: 0,
    card: { amount: 0, card_type: "credito", card_brand: "Visa", card_last4: "", authorization_code: "", terminal_id: "", acquirer: "" },
    transfer: { amount: 0, transfer_reference: "", bank_name: "" },
  };
}

export type Method = "efectivo" | "tarjeta" | "transferencia" | "mixto" | "pendiente";

export function validatePayment(
  method: Method,
  total: number,
  bd: PaymentBreakdown,
): { ok: boolean; error?: string } {
  if (method === "pendiente") return { ok: true };

  if (method === "efectivo") {
    if (bd.monto_recibido + 0.01 < total) return { ok: false, error: "Monto recibido no cubre el total" };
    return { ok: true };
  }

  if (method === "tarjeta") {
    if (!/^\d{4}$/.test(bd.card.card_last4)) return { ok: false, error: "Captura los últimos 4 dígitos" };
    if (!bd.card.authorization_code.trim()) return { ok: false, error: "Falta código de autorización" };
    if (looksLikeFullCardNumber(bd.card.authorization_code) || looksLikeFullCardNumber(bd.card.terminal_id)) {
      return { ok: false, error: "No captures el número completo de tarjeta" };
    }
    if (Math.abs(bd.card.amount - total) > 0.01) return { ok: false, error: "Monto de tarjeta debe igualar el total" };
    return { ok: true };
  }

  if (method === "transferencia") {
    if (!bd.transfer.transfer_reference.trim()) return { ok: false, error: "Falta referencia de transferencia" };
    if (Math.abs(bd.transfer.amount - total) > 0.01) return { ok: false, error: "Monto de transferencia debe igualar el total" };
    return { ok: true };
  }

  // mixto
  const sum = bd.efectivo + bd.tarjeta + bd.transferencia;
  if (Math.abs(sum - total) > 0.01) {
    return { ok: false, error: `Los pagos suman ${formatMXN(sum)} y el total es ${formatMXN(total)}` };
  }
  if (bd.tarjeta > 0) {
    if (!/^\d{4}$/.test(bd.card.card_last4)) return { ok: false, error: "Captura los últimos 4 dígitos" };
    if (!bd.card.authorization_code.trim()) return { ok: false, error: "Falta autorización de tarjeta" };
  }
  if (bd.transferencia > 0 && !bd.transfer.transfer_reference.trim()) {
    return { ok: false, error: "Falta referencia de transferencia" };
  }
  return { ok: true };
}

/** Construye las filas a insertar en pharmacy_sale_payments según el método. */
export function paymentsToRows(method: Method, bd: PaymentBreakdown) {
  if (method === "pendiente") return [];
  const rows: Array<Record<string, unknown>> = [];
  const pushCash = (amount: number) => {
    if (amount > 0) rows.push({
      payment_method: "efectivo",
      amount,
      monto_recibido: bd.monto_recibido > 0 ? bd.monto_recibido : amount,
      cambio_entregado: bd.monto_recibido > amount ? bd.monto_recibido - amount : 0,
    });
  };
  const pushCard = (amount: number) => {
    if (amount > 0) {
      rows.push({
        payment_method: "tarjeta",
        amount,
        card_type: bd.card.card_type,
        card_brand: bd.card.card_brand,
        card_last4: bd.card.card_last4,
        authorization_code: bd.card.authorization_code || null,
        terminal_id: bd.card.terminal_id || null,
        acquirer: bd.card.acquirer || null,
      });
    }
  };
  const pushTransfer = (amount: number) => {
    if (amount > 0) {
      rows.push({
        payment_method: "transferencia",
        amount,
        transfer_reference: bd.transfer.transfer_reference,
        bank_name: bd.transfer.bank_name || null,
      });
    }
  };
  if (method === "efectivo") pushCash(bd.efectivo > 0 ? bd.efectivo : 0);
  else if (method === "tarjeta") pushCard(bd.card.amount);
  else if (method === "transferencia") pushTransfer(bd.transfer.amount);
  else if (method === "mixto") {
    // En mixto el efectivo es exacto (sin cambio); monto_recibido = bd.efectivo
    if (bd.efectivo > 0) rows.push({
      payment_method: "efectivo",
      amount: bd.efectivo,
      monto_recibido: bd.efectivo,
      cambio_entregado: 0,
    });
    pushCard(bd.tarjeta);
    pushTransfer(bd.transferencia);
  }
  return rows;
}

export function PaymentCapture({
  method, total, value, onChange,
}: {
  method: Method;
  total: number;
  value: PaymentBreakdown;
  onChange: (v: PaymentBreakdown) => void;
}) {
  if (method === "pendiente") {
    return <p className="text-xs text-muted-foreground">Pago pendiente — no se captura desglose.</p>;
  }

  const showCash = method === "efectivo" || method === "mixto";
  const showCard = method === "tarjeta" || method === "mixto";
  const showTransfer = method === "transferencia" || method === "mixto";

  // Auto-calc helpers for mixto
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const setMixtoEfectivo = (ef: number) => {
    const restante = Math.max(0, round2(total - ef - value.transferencia));
    onChange({ ...value, efectivo: ef, monto_recibido: ef, tarjeta: restante, card: { ...value.card, amount: restante } });
  };
  const setMixtoTarjeta = (card: number) => {
    const restante = Math.max(0, round2(total - card - value.transferencia));
    onChange({ ...value, tarjeta: card, card: { ...value.card, amount: card }, efectivo: restante, monto_recibido: restante });
  };
  const setMixtoTransferencia = (transf: number) => {
    const restante = Math.max(0, round2(total - value.efectivo - transf));
    onChange({ ...value, transferencia: transf, transfer: { ...value.transfer, amount: transf }, tarjeta: restante, card: { ...value.card, amount: restante }, monto_recibido: value.efectivo });
  };

  const setCardAmount = (n: number) => onChange({ ...value, tarjeta: n, card: { ...value.card, amount: n } });
  const setTransferAmount = (n: number) => onChange({ ...value, transferencia: n, transfer: { ...value.transfer, amount: n } });

  const mixtoSum = round2(value.efectivo + value.tarjeta + value.transferencia);
  const mixtoDiff = round2(mixtoSum - total);

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-2.5">
      {/* Indicador de diferencia en mixto */}
      {method === "mixto" && (
        <>
          <div className={`flex items-center justify-between rounded px-2 py-1 text-xs font-medium ${
            Math.abs(mixtoDiff) < 0.01
              ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
          }`}>
            <span>Total: {formatMXN(total)}</span>
            <span>{Math.abs(mixtoDiff) < 0.01 ? "✓ Cuadrado" : `Pendiente: ${formatMXN(Math.abs(mixtoDiff))}`}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Ingresa efectivo → tarjeta se calcula sola, o viceversa.</p>
        </>
      )}

      {showCash && (
        <div className="space-y-1">
          <Label className="text-xs">{method === "mixto" ? "Efectivo" : "Monto recibido (efectivo)"}</Label>
          {method === "mixto" ? (
            <MoneyInput
              value={String(value.efectivo)}
              onValueChange={(raw) => setMixtoEfectivo(Number(raw) || 0)}
              className="h-11"
            />
          ) : (
            <>
              <MoneyInput
                value={String(value.monto_recibido)}
                onValueChange={(raw) => onChange({ ...value, monto_recibido: Number(raw) || 0, efectivo: Number(raw) || 0 })}
                className="h-11"
              />
              {value.monto_recibido >= total && (
                <p className="text-[11px] font-semibold text-green-700 dark:text-green-400">
                  Cambio a entregar: {formatMXN(value.monto_recibido - total)}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {showCard && (
        <div className="space-y-2 border-t pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Tarjeta</Label>
            <Badge variant="outline" className="text-[10px]">Solo últimos 4</Badge>
          </div>
          {method === "mixto" && (
            <div className="space-y-1">
              <Label className="text-[11px]">Monto tarjeta</Label>
              <MoneyInput
                value={String(value.tarjeta)}
                onValueChange={(raw) => setMixtoTarjeta(Number(raw) || 0)}
                className="h-11"
              />
            </div>
          )}
          {method === "tarjeta" && (
            <div className="space-y-1">
              <Label className="text-[11px]">Monto tarjeta</Label>
              <MoneyInput
                value={String(value.card.amount)}
                onValueChange={(raw) => setCardAmount(Number(raw) || 0)}
                className="h-11"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Tipo</Label>
              <Select value={value.card.card_type} onValueChange={(v) => onChange({ ...value, card: { ...value.card, card_type: v as CardType } })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Marca</Label>
              <Select value={value.card.card_brand} onValueChange={(v) => onChange({ ...value, card: { ...value.card, card_brand: v as CardBrand } })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Visa">Visa</SelectItem>
                  <SelectItem value="Mastercard">Mastercard</SelectItem>
                  <SelectItem value="Amex">Amex</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Últimos 4 dígitos</Label>
              <Input
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                value={value.card.card_last4}
                onChange={(e) => onChange({ ...value, card: { ...value.card, card_last4: onlyDigits(e.target.value).slice(0, 4) } })}
                className="h-11 font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Autorización</Label>
              <Input
                placeholder="123456"
                value={value.card.authorization_code}
                onChange={(e) => onChange({ ...value, card: { ...value.card, authorization_code: e.target.value.slice(0, 24) } })}
                className="h-11 font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Terminal</Label>
              <Input
                placeholder="TPV-01"
                value={value.card.terminal_id}
                onChange={(e) => onChange({ ...value, card: { ...value.card, terminal_id: e.target.value.slice(0, 40) } })}
                className="h-11"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Adquirente / Banco</Label>
              <Input
                placeholder="Banorte"
                value={value.card.acquirer}
                onChange={(e) => onChange({ ...value, card: { ...value.card, acquirer: e.target.value.slice(0, 40) } })}
                className="h-11"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            No captures número completo, CVV, NIP ni fecha de vencimiento.
          </p>
        </div>
      )}

      {showTransfer && (
        <div className="space-y-2 border-t pt-2">
          <Label className="text-xs font-semibold">Transferencia</Label>
          {method === "mixto" && (
            <div className="space-y-1">
              <Label className="text-[11px]">Monto transferencia</Label>
              <MoneyInput
                value={String(value.transferencia)}
                onValueChange={(raw) => setMixtoTransferencia(Number(raw) || 0)}
                className="h-11"
              />
            </div>
          )}
          {method === "transferencia" && (
            <div className="space-y-1">
              <Label className="text-[11px]">Monto transferencia</Label>
              <MoneyInput
                value={String(value.transfer.amount)}
                onValueChange={(raw) => setTransferAmount(Number(raw) || 0)}
                className="h-11"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Referencia</Label>
              <Input
                value={value.transfer.transfer_reference}
                onChange={(e) => onChange({ ...value, transfer: { ...value.transfer, transfer_reference: e.target.value.slice(0, 60) } })}
                className="h-11 font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Banco origen</Label>
              <Input
                value={value.transfer.bank_name}
                onChange={(e) => onChange({ ...value, transfer: { ...value.transfer, bank_name: e.target.value.slice(0, 40) } })}
                className="h-11"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
