import type { SubscriptionInvoice } from "@/types/subscription";

export function InvoicesTable({ invoices }: { invoices: SubscriptionInvoice[] }) {
  if (invoices.length === 0) {
    return <p className="text-sm text-gray-500">Sin facturas todavía.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-1">Fecha</th>
          <th>Monto</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr key={inv.id} className="border-b">
            <td className="py-1">{new Date(inv.created * 1000).toLocaleDateString("es-MX")}</td>
            <td>${(inv.amount_paid / 100).toFixed(2)}</td>
            <td>{inv.status}</td>
            <td>
              <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                Ver
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
