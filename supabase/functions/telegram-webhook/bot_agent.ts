import { listarHorariosDisponibles } from "./bot_horarios.ts";

export async function ejecutarToolClaude(name: string, input: any) {
  switch (name) {
    case "listar_horarios":
      return await listarHorariosDisponibles(input);
    default:
      return { error: "Tool desconocida: " + name };
  }
}

export async function correrAgente() { return ""; }
export async function actualizarMemoria() {}
