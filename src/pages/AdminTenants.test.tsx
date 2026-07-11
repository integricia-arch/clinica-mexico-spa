import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminTenants from "./AdminTenants";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "staff-1" }, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: true })),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      eq: vi.fn().mockReturnThis(),
    })),
    functions: { invoke: vi.fn() },
  },
}));

describe("AdminTenants — wizard módulos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloquea Crear sin al menos un módulo seleccionado", async () => {
    render(<MemoryRouter><AdminTenants /></MemoryRouter>);
    fireEvent.click(await screen.findByText("Nuevo cliente"));
    fireEvent.change(screen.getByPlaceholderText("Nombre del hospital"), {
      target: { value: "Hospital Test" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email admin del hospital"), {
      target: { value: "admin@test.com" },
    });
    const crearBtn = screen.getByText("Crear");
    expect(crearBtn).toBeDisabled();
  });
});

describe("AdminTenants — tabs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("por default muestra solo clinicas activas (sin archivar, sin cancelar)", async () => {
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn(() =>
        Promise.resolve({
          data: [
            { id: "1", code: "a", name: "Activa", status: "active", plan: "estandar", created_at: "2026-01-01", whatsapp_status: null, whatsapp_phone_number_id: null, subscription_status: "active", grace_period_ends_at: null, archived_at: null },
            { id: "2", code: "b", name: "Cancelada", status: "active", plan: "estandar", created_at: "2026-01-01", whatsapp_status: null, whatsapp_phone_number_id: null, subscription_status: "canceled", grace_period_ends_at: null, archived_at: null },
            { id: "3", code: "c", name: "Archivada", status: "active", plan: "estandar", created_at: "2026-01-01", whatsapp_status: null, whatsapp_phone_number_id: null, subscription_status: "trialing", grace_period_ends_at: null, archived_at: "2026-07-01" },
          ],
          error: null,
        }),
      ),
      eq: vi.fn().mockReturnThis(),
    });
    render(<MemoryRouter><AdminTenants /></MemoryRouter>);
    expect(await screen.findByText("Activa")).toBeInTheDocument();
    expect(screen.queryByText("Cancelada")).not.toBeInTheDocument();
    expect(screen.queryByText("Archivada")).not.toBeInTheDocument();
  });

  it("tab Canceladas muestra solo subscription_status canceling/canceled sin archivar", async () => {
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn(() =>
        Promise.resolve({
          data: [
            { id: "1", code: "a", name: "Activa", status: "active", plan: "estandar", created_at: "2026-01-01", whatsapp_status: null, whatsapp_phone_number_id: null, subscription_status: "active", grace_period_ends_at: null, archived_at: null },
            { id: "2", code: "b", name: "Cancelada", status: "active", plan: "estandar", created_at: "2026-01-01", whatsapp_status: null, whatsapp_phone_number_id: null, subscription_status: "canceled", grace_period_ends_at: null, archived_at: null },
          ],
          error: null,
        }),
      ),
      eq: vi.fn().mockReturnThis(),
    });
    render(<MemoryRouter><AdminTenants /></MemoryRouter>);
    fireEvent.click(await screen.findByText("Canceladas"));
    expect(await screen.findByText("Cancelada")).toBeInTheDocument();
    expect(screen.queryByText("Activa")).not.toBeInTheDocument();
  });
});
