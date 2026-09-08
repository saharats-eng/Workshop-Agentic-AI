import type { ChatMessage, McpTool, ToolCaller, ToolTraceEntry } from '../types';
import { toGeminiSchema } from '../tool-schema';

export async function runGeminiConversation(apiKey: string | undefined, model: string, systemPrompt: string, messages: ChatMessage[], tools: McpTool[] = [], callTool?: ToolCaller): Promise<{ reply: string; toolTrace: ToolTraceEntry[] }> {
  if (!apiKey?.trim()) return { reply: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY จึงไม่สามารถเรียก Gemini ได้', toolTrace: [] };
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const trace: ToolTraceEntry[] = [];
  const geminiTools = tools.length ? [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: toGeminiSchema(t.inputSchema ?? { type: 'object' }) })) }] : undefined;
  for (let round = 0; round < 4; round += 1) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents, ...(geminiTools ? { tools: geminiTools } : {}) }) });
    if (!response.ok) return { reply: `Gemini ตอบกลับไม่สำเร็จ (${response.status}) กรุณาตรวจสอบ key และ model`, toolTrace: trace };
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<Record<string, any>> } }> };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall) as Array<{ functionCall: { name: string; args?: unknown } }>;
    if (!calls.length) return { reply: parts.map((p) => typeof p.text === 'string' ? p.text : '').join('') || 'โมเดลไม่ได้ส่งข้อความตอบกลับ', toolTrace: trace };
    if (!callTool) return { reply: 'โมเดลขอเรียกใช้เครื่องมือ แต่ยังไม่มีเครื่องมือในโมดูลนี้', toolTrace: trace };
    contents.push({ role: 'model', parts });
    for (const call of calls) {
      const result = await callTool(call.functionCall.name, call.functionCall.args ?? {});
      trace.push({ name: call.functionCall.name, arguments: call.functionCall.args, result });
      contents.push({ role: 'user', parts: [{ functionResponse: { name: call.functionCall.name, response: { result } } }] });
    }
  }
  return { reply: 'การสนทนาใช้รอบเรียกเครื่องมือเกินกำหนด', toolTrace: trace };
}