/** Safe message for API / SSE clients; full detail stays in server logs. */
export function clientFacingErrorMessage(error: unknown): string {
  if (process.env["NODE_ENV"] === "production") {
    return "Something went wrong";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong";
}
