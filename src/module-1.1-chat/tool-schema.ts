const TYPES: Record<string, string> = { object: 'OBJECT', string: 'STRING', number: 'NUMBER', integer: 'INTEGER', boolean: 'BOOLEAN', array: 'ARRAY', null: 'NULL' };

export function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...schema };
  if (typeof schema.type === 'string') result.type = TYPES[schema.type.toLowerCase()] ?? schema.type.toUpperCase();
  if (schema.properties && typeof schema.properties === 'object') {
    result.properties = Object.fromEntries(Object.entries(schema.properties as Record<string, unknown>).map(([key, value]) => [key, value && typeof value === 'object' ? toGeminiSchema(value as Record<string, unknown>) : value]));
  }
  if (schema.items && typeof schema.items === 'object') result.items = toGeminiSchema(schema.items as Record<string, unknown>);
  return result;
}