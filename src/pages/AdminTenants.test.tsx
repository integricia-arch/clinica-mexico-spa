import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    render(<AdminTenants />);
    fireEvent.click(await screen.findByText("Nuevo cliente"));
    fireEvent.change(screen.getByPlaceholderText("Código único (ej. hospital_norte)"), {
      target: { value: "test_hosp" },
    });
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
