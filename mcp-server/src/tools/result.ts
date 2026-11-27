/** MCP tool result helpers. */
export function ok(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}

export function err(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}
