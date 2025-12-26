
export function normalizeCode(input: string | null | undefined): string {
  if (!input) return "";
  // Elimină orice caracter care nu este literă sau cifră și transformă în majuscule
  // Ex: "A-123.b" => "A123B"
  return input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}