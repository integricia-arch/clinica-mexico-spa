import { listarHorariosDisponibles } from "./bot_horarios.ts";
import { guardarDatosPaciente, confirmarCita } from "./bot_db.ts";

export async function ejecutarToolClaude(name: string, input: any, convId: string) {
  switch (name) {
    case "listar_horarios":
      return await listarHorariosDisponibles(input);
    case "guardar_datos_paciente":
      return await guardarDatosPaciente(convId, input);
    case "confirmar_cita":
      return await confirmarCita(convId, input.slot_key);
    default:
      return { error: "Tool desconocida: " + name };
  }
}

export async function correrAgente() { return ""; }
export async function actualizarMemoria() {}
