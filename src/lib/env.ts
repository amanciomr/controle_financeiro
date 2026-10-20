function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}. Veja .env.example.`);
  }
  return value;
}

/**
 * Só a origem (https://<ref>.supabase.co). Tolera colar o endereço com
 * caminho, como o da "Data API" (…/rest/v1/), o que quebraria o login.
 */
export const SUPABASE_URL = new URL(
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL).trim(),
).origin;

/** Chave pública (publishable). Aceita o nome antigo ANON_KEY também. */
export const SUPABASE_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
).trim();
