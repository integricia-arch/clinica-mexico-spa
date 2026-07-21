// Rate limiting compartido — llama RPC check_rate_limit (Postgres, ventana fija).
// Fail-open: si la RPC falla (BD caída), permite la request y loggea el error.
// Ver memoria/proyectos/S1-rate-limiting-diseno.md

// deno-lint-ignore no-explicit-any
export async function enforceRateLimit(
  admin: any,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc("check_rate_limit", {
    _bucket: bucket,
    _limit: limit,
    _window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rateLimit] check_rate_limit error, fail-open:", error.message);
    return true;
  }
  return data === true;
}

export function rateLimitResponse(corsHeaders: Record<string, string>, retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({ error: "Demasiadas solicitudes, intenta más tarde" }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
