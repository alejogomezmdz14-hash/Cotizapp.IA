export function isStorageAccessError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("invalid input syntax for type uuid") ||
    message.includes("object not found") ||
    message.includes("not found") ||
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("unauthorized")
  );
}
