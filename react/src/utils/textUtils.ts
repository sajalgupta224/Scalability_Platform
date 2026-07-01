
export function stripThinkingTags(text: string): string {
  if (!text) return '';

  let out = String(text);

  // Patterns to remove whole blocks
  const patterns: RegExp[] = [
    // Raw HTML-ish tags: <think ...> ... </think ...>
    /<\s*think\b[^>]*>[\s\S]*?<\s*\/\s*think\s*>/gi,

    // HTML-escaped entities: &lt;think&gt; ... &lt;/think&gt;
    /&lt;\s*think\b[^&]*&gt;[\s\S]*?&lt;\s*\/\s*think\s*&gt;/gi,

    // Bracket style: [think] ... [/think]
    /\[\s*think\s*\][\s\S]*?\[\s*\/\s*think\s*\]/gi,
  ];

  for (const re of patterns) {
    out = out.replace(re, '');
  }

  // Also remove stray opening/closing tags if model truncation left them dangling
  const strays: RegExp[] = [
    /<\s*think\b[^>]*>/gi,
    /<\s*\/\s*think\s*>/gi,
    /&lt;\s*think\b[^&]*&gt;/gi,
    /&lt;\s*\/\s*think\s*&gt;/gi,
    /\[\s*\/?\s*think\s*\]/gi,
  ];
  for (const re of strays) {
    out = out.replace(re, '');
  }

  // Collapse excessive blank lines that may be left after removal
  out = out.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n');

  return out.trim();
}

export function normalizeBotText(raw?: string): string {
  if (!raw || raw.trim() === '') {
    return 'No response.';
  }

  let text = String(raw);

  // Normalize line endings and remove BOM
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  // 1) Protect fenced code blocks with optional language tag: ```lang?\n...\n```
  const fences: Array<{ lang: string; content: string }> = [];
  text = text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, lang: string, content: string) => {
    const id = fences.length;
    fences.push({ lang: (lang || '').trim(), content: content.trimEnd() });
    return `@@FENCE_${id}@@`;
  });

  // 2) Remove trailing whitespace on each line
  text = text.replace(/[ \t]+$/gm, '');

  // 3) Collapse 3+ newlines → exactly 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // 4) Normalize bullet spacing: "*  item" or "-  item" → "* item"
  text = text.replace(/^([*-])\s{2,}/gm, '$1 ');

  // 5) Normalize numbered list spacing: "1.  item" → "1. item"
  text = text.replace(/^(\d+\.)\s{2,}/gm, '$1 ');

  // 6) Restore code fences exactly with single leading/trailing newline, preserving language tag
  text = text.replace(/@@FENCE_(\d+)@@/g, (_, id: string) => {
    const entry = fences[Number(id)];
    const lang = entry?.lang ? entry.lang : '';
    const content = entry?.content ?? '';
    return `\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
  });

  // Final trim + trailing newline (common for markdown renderers)
  return text.trim() + '\n';
}

export function formatBotMessage(text: string): string {
  const cleaned = stripThinkingTags(String(text));
  return normalizeBotText(cleaned);
}

/** The rest of your utilities for completeness */
export function toStackedList(text: string): string {
  if (!text) return '';
  return text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function asModelMap(
  text: string,
  models: Array<Record<string, unknown>>
): Record<string, string> {
  return models.reduce<Record<string, string>>((acc, model) => {
    const key =
      (typeof (model as any)?.value === 'string' && (model as any).value) ||
      (typeof (model as any)?.modelId === 'string' && (model as any).modelId) ||
      String((model as any)?.value ?? (model as any)?.modelId ?? 'default');

    acc[key] = text ?? 'No response';
    return acc;
  }, {});
}

export function toTitleCase(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, first) => first.toUpperCase())
    .replace(/\b(of|and|or|the|a|an|to|in|on|for|by|with)\b/gi, (m) => m.toLowerCase());
}