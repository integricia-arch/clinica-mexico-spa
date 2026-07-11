import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConfiguracionPagos from "./ConfiguracionPagos";

const mockSummary = {
  clinic: { id: "clinic-1", name: "Clínica Test", status: "active", plan: "estandar", subscription_status: "active", grace_period_ends_at: null },
  modulos: [{ modulo_id: "mod-1", catalogo_modulos: { id: "mod-1", nombre: "Agenda", precio_centavos: 50000, stripe_price_id: "price_1" } }],
  subscription: { status: "active", current_period_end: 1735689600 },
  invoices: [],
};

vi.mock("@/hooks/useActiveClinic", () => ({ useActiveClinic: () => ({ activeClinicId: "clinic-1" }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: "tok" } } })) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
      // el query builder real de supabase-js es "thenable" (se puede await sin .maybeSingle()),
      // acá simulamos eso para la consulta a catalogo_modulos que hace .eq(...).then(...)
      then: (resolve: (v: { data: { id: string; nombre: string; precio_centavos: number }[] }) => void) =>
        resolve({ data: [{ id: "mod-1", nombre: "Agenda", precio_centavos: 50000 }] }),
    })),
  },
  supabaseUrl: "https://example.supabase.co",
}));

global.fetch = vi.fn((url: string) => {
  if (url.includes("clinic_id=clinic-1") && !url.includes("action")) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary) } as Response);
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary) } as Response);
}) as unknown as typeof fetch;

describe("ConfiguracionPagos — panel self-service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra los módulos contratados con precio desde el summary", async () => {
    render(<MemoryRouter><ConfiguracionPagos /></MemoryRouter>);
    expect(await screen.findByText(/Agenda/)).toBeInTheDocument();
    expect(screen.getByText(/\$500\.00/)).toBeInTheDocument();
  });

  it("deshabilita Guardar cambios si quitar el último módulo dejaría 0", async () => {
    render(<MemoryRouter><ConfiguracionPagos /></MemoryRouter>);
    const checkbox = await screen.findByLabelText(/Agenda/);
    fireEvent.click(checkbox);
    await waitFor(() => expect(screen.getByText("Guardar cambios")).toBeDisabled());
  });
});
