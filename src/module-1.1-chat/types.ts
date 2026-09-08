export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ChatProvider = 'gemini' | 'openai' | 'openai-compat';
export type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown>; serverId?: string };
export type ToolTraceEntry = { name: string; arguments?: unknown; result?: unknown };
export type ChatTurnResult = { reply: string; provider: ChatProvider; model: string; toolTrace: ToolTraceEntry[] };
export type ToolCaller = (name: string, args: unknown) => Promise<unknown>;
export function toolFunctionName(serverId: string, toolName: string): string { return `${serverId}__${toolName}`; }