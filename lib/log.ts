// Logging de errores que no filtra material sensible.
//
// Importa especialmente en los caminos de ARCA: la librería `soap` adjunta al
// error propiedades enumerables `body` (el XML crudo de la respuesta) y
// `response` (la respuesta HTTP completa). Un `console.error(err)` sobre un
// error de WSAA/WSFE volcaría todo eso a los logs de Vercel.
//
// Regla: nunca `console.error(error)` con el objeto entero. Siempre este helper.

export type DescribedError = {
  name: string;
  message: string;
};

export function describeError(error: unknown): DescribedError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  if (typeof error === "string") {
    return { name: "UnknownError", message: error };
  }

  // Cualquier otra cosa (objetos, null, undefined) se colapsa a "unknown": no
  // serializamos objetos arbitrarios porque podrían contener credenciales.
  return { name: "UnknownError", message: "unknown" };
}

export function logError(
  scope: string,
  error: unknown,
  extra: Record<string, string | number | boolean | null> = {},
): void {
  console.error(`[${scope}]`, { ...describeError(error), ...extra });
}
