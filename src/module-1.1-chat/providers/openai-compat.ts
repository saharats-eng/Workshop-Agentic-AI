import type { ChatMessage, McpTool, ToolCaller, ToolTraceEntry } from '../types';

type Message = { role: string; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>; tool_call_id?: string };

export async function runOpenAiCompatConversation(baseUrl: string | undefined, apiKey: string | undefined, model: string, systemPrompt: string, messages: ChatMessage[], tools: McpTool[] = [], callTool?: ToolCaller): Promise<{ reply: string; toolTrace: ToolTraceEntry[] }> {
  if (!baseUrl?.trim()) return { reply: 'ยังไม่ได้ตั้งค่า base URL ของ OpenAI-compatible gateway', toolTrace: [] };
  if (!apiKey?.trim()) return { reply: 'ยังไม่ได้ตั้งค่า API key ของ provider ที่เลือก', toolTrace: [] };
  const requestMessages: Message[] = [{ role: 'system', content: systemPrompt }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
  const trace: ToolTraceEntry[] = [];
  const openAiTools = tools.length ? tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema ?? { type: 'object' } } })) : undefined;
  for (let round = 0; round < 4; round += 1) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: requestMessages, ...(openAiTools ? { tools: openAiTools, tool_choice: 'auto' } : {}) }) });
    if (!response.ok) return { reply: `OpenAI-compatible gateway ตอบกลับไม่สำเร็จ (${response.status}) กรุณาตรวจสอบการตั้งค่า`, toolTrace: trace };
    const data = await response.json() as { choices?: Array<{ message?: Message }> };
    const message = data.choices?.[0]?.message;
    if (!message) return { reply: 'โมเดลไม่ได้ส่งข้อความตอบกลับ', toolTrace: trace };
    if (!message.tool_calls?.length) return { reply: message.content ?? '', toolTrace: trace };
    if (!callTool) return { reply: 'โมเดลขอเรียกใช้เครื่องมือ แต่ยังไม่มีเครื่องมือในโมดูลนี้', toolTrace: trace };
    requestMessages.push(message);
    for (const call of message.tool_calls) {
      let args: unknown = {};
      try { args = JSON.parse(call.function.arguments); } catch { /* keep empty args */ }
      const result = await callTool(call.function.name, args);
      trace.push({ name: call.function.name, arguments: args, result });
      requestMessages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: call.id });
    }
  }
  return { reply: 'การสนทนาใช้รอบเรียกเครื่องมือเกินกำหนด', toolTrace: trace };
}