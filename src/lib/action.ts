import type { z } from "zod";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Primeira mensagem de erro de validação, em português. */
export function validationError(error: z.ZodError): { ok: false; error: string } {
  return fail(error.issues[0]?.message ?? "Dados inválidos.");
}

/** Traduz erros do Postgres/PostgREST para mensagens amigáveis. */
export function dbError(error: { code?: string; message?: string } | null): {
  ok: false;
  error: string;
} {
  switch (error?.code) {
    case "42501":
      return fail("Você não tem permissão para fazer isso.");
    case "23503":
      return fail("Este item está em uso por outros registros.");
    case "23505":
      return fail("Já existe um registro igual.");
    case "23514":
    case "P0001":
    case "P0002":
      return fail(error.message ?? "Dados inválidos.");
    default:
      console.error(error);
      return fail("Não foi possível salvar. Tente de novo.");
  }
}
