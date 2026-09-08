import type { Env } from '../env';
import { errorJson, json } from '../lib/http';
import { runGeminiConversation } from './providers/gemini';
import { runOpenAiCompatConversation } from './providers/openai-compat';
import type { ChatMessage, ChatProvider, ChatTurnResult } from './types';

const PROVIDERS: ChatProvider[] = ['gemini', 'openai', 'openai-compat'];
export function resolveProvider(value: unknown, env: Env): ChatProvider {
  const candidate = value ?? env.DEFAULT_CHAT_PROVIDER;
  return PROVIDERS.includes(candidate as ChatProvider) ? candidate as ChatProvider : 'gemini';
}
export function defaultModelFor(provider: ChatProvider, env: Env): string {
  return provider === 'gemini' ? env.GEMINI_MODEL || 'gemini-flash-latest' : provider === 'openai' ? env.OPENAI_MODEL || 'gpt-4o-mini' : env.OPENAI_COMPAT_MODEL || 'gpt-4o-mini';
}
export function buildSystemPrompt(): string { return 'คุณคือผู้ช่วย AI ภาษาไทย ตอบอย่างสุภาพ กระชับ และช่วยผู้ใช้แก้ปัญหาอย่างชัดเจน'; }
function resolveApiKey(provider: ChatProvider, env: Env): string | undefined { return provider === 'gemini' ? env.GEMINI_API_KEY : provider === 'openai' ? env.OPENAI_API_KEY : env.OPENAI_COMPAT_API_KEY; }
function resolveBaseUrl(provider: ChatProvider): string | undefined { return provider === 'openai' ? 'https://api.openai.com/v1' : undefined; }
function resolveTools() { return []; }

export async function runChatTurn(input: { message: string; history?: ChatMessage[]; provider?: ChatProvider; model?: string }, env: Env): Promise<ChatTurnResult> {
  const provider = resolveProvider(input.provider, env);
  const model = input.model?.trim() || defaultModelFor(provider, env);
  const messages: ChatMessage[] = [...(input.history ?? []), { role: 'user', content: input.message }];
  const tools = resolveTools();
  const result = provider === 'gemini'
    ? await runGeminiConversation(resolveApiKey(provider, env), model, buildSystemPrompt(), messages, tools)
    : await runOpenAiCompatConversation(resolveBaseUrl(provider) ?? env.OPENAI_COMPAT_BASE_URL, resolveApiKey(provider, env), model, buildSystemPrompt(), messages, tools);
  return { ...result, provider, model };
}

export async function handleChatRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return errorJson('รองรับเฉพาะ POST /api/chat', 405);
  try {
    const body = await request.json() as { message?: unknown; history?: unknown; provider?: unknown; model?: unknown };
    if (typeof body.message !== 'string' || !body.message.trim()) return errorJson('กรุณาระบุ message เป็นข้อความ', 400);
    const history = Array.isArray(body.history) ? body.history.filter((m): m is ChatMessage => !!m && typeof m === 'object' && ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant') && typeof (m as ChatMessage).content === 'string') : [];
    const result = await runChatTurn({ message: body.message, history, provider: body.provider as ChatProvider | undefined, model: typeof body.model === 'string' ? body.model : undefined }, env);
    return json(result);
  } catch { return errorJson('รูปแบบ request ไม่ถูกต้อง', 400); }
}