import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NotaConsultaModal from "./NotaConsultaModal";
import { restInsert } from "@/lib/restClient";

vi.mock("@/lib/restClient", () => ({
  restInsert: vi.fn().mockResolvedValue({ id: "nota-1" }),
  restUpdate: vi.fn().mockResolvedValue({ id: "nota-1" }),
}));

describe("NotaConsultaModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("incluye clinic_id en el payload de insert (regresion post NOT NULL)", async () => {
    render(
      <NotaConsultaModal
        open={true}
        onClose={() => {}}
        expedienteId="exp-1"
        doctorId="doc-1"
        clinicId="clinic-1"
        nota={null}
        onSaved={() => {}}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/lo que refiere el paciente/i), {
      target: { value: "Motivo de prueba" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar nota/i }));

    await waitFor(() => expect(restInsert).toHaveBeenCalled());
    const [table, payload] = (restInsert as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(table).toBe("notas_consulta");
    expect(payload).toMatchObject({ clinic_id: "clinic-1", expediente_id: "exp-1", doctor_id: "doc-1" });
  });

  it("no envia insert si no hay clinic_id activo", async () => {
    render(
      <NotaConsultaModal
        open={true}
        onClose={() => {}}
        expedienteId="exp-1"
        doctorId="doc-1"
        clinicId={null}
        nota={null}
        onSaved={() => {}}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/lo que refiere el paciente/i), {
      target: { value: "Motivo de prueba" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar nota/i }));

    await waitFor(() => {
      expect(restInsert).not.toHaveBeenCalled();
    });
  });
});
