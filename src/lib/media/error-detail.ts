export function errorDetail(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if (typeof record.code === "string" || typeof record.code === "number") {
      return `code ${record.code}`;
    }
    try {
      const json = JSON.stringify(error);
      if (json && json !== "{}") return json.slice(0, 180);
    } catch {
      // ignore
    }
  }
  return "unknown error";
}
