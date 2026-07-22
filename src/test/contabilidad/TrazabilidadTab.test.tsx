import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TrazabilidadTab } from "@/features/contabilidad/TrazabilidadTab";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock("@/hooks/useActiveClinic", () => ({
  useActiveClinic: () => ({ activeClinicId: "clinic-1" }),
}));

describe("TrazabilidadTab", () => {
  it("busca por tipo+id y renderiza el árbol con hijos anidados", async () => {
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        tipo: "solicitud_compra",
        id: "sc-1",
        folio: "SC-004",
        fecha: "2026-07-12",
        monto_centavos: null,
        estado: "aprobada",
        creado_por: { user_id: "u1", nombre: "Ana" },
        autorizado_por: { user_id: "u2", nombre: "Dr. González" },
        hijos: [
          { tipo: "HUECO", mensaje: "Sin cotizaciones registradas aún" },
        ],
      },
      error: null,
    });

    render(<TrazabilidadTab />);

    fireEvent.change(screen.getByLabelText(/tipo de evento/i), { target: { value: "solicitud_compra" } });
    fireEvent.change(screen.getByLabelText(/id o folio/i), { target: { value: "sc-1" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar/i }));

    await waitFor(() => {
      expect(screen.getByText("SC-004")).toBeInTheDocument();
      expect(screen.getByText("Ana")).toBeInTheDocument();
      expect(screen.getByText("Dr. González")).toBeInTheDocument();
      expect(screen.getByText(/Sin cotizaciones registradas aún/i)).toBeInTheDocument();
    });
  });
});
