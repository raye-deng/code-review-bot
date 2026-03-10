/**
 * AI Suggestions - L1 基础 AI 建议
 *
 * 使用 Ollama qwen3-coder 模型生成代码修复建议。
 * 更新：从 gpt-oss-20b (OpenAI 兼容) 迁移到 Ollama 原生 API。
 */

export interface Suggestion {
  suggestion: string;
  confidence?: number;
}

const DEFAULT_OLLAMA_URL = 'http://192.168.66.141:11434';
const DEFAULT_MODEL = 'qwen3-coder';

export async function generateSuggestion(
  violation: {
    type: string;
    location: { line: number; column: number };
    ruleId: string;
    message: string;
    source?: string;
  },
  ollamaUrl: string = DEFAULT_OLLAMA_URL,
  model: string = DEFAULT_MODEL
): Promise<Suggestion> {
  const prompt = `Review this code issue and provide a specific fix:

**Rule:** ${violation.ruleId}
**Message:** ${violation.message}
**Location:** Line ${violation.location.line}, Column ${violation.location.column}

${violation.source ? `**Code:**\n\`\`\`typescript\n${violation.source}\n\`\`\`` : ''}

Provide:
1. The specific fix needed
2. Why this is a problem
3. Example corrected code

Keep your response under 200 words. Do NOT wrap your response in any XML-like tags.`;

  try {
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 512,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json() as {
      message?: { content?: string };
    };

    let text = data.message?.content || '';

    // Strip <think> tags if present
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    return {
      suggestion: text || 'Review the code against best practices.',
      confidence: 0.8,
    };
  } catch (error) {
    console.error('AI suggestion failed:', (error as Error).message);
    return {
      suggestion: 'AI suggestion unavailable. Review the code against best practices.',
      confidence: 0.3,
    };
  }
}

export async function batchGenerateSuggestions(
  violations: any[],
  ollamaUrl?: string,
  model?: string
): Promise<Map<string, string>> {
  const suggestions = new Map<string, string>();

  // Process in batches to avoid overwhelming the local model
  const batchSize = 3;
  for (let i = 0; i < violations.length; i += batchSize) {
    const batch = violations.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (v: any) => {
        const key = `${v.filePath}:${v.location.line}:${v.location.column}`;
        const result = await generateSuggestion(v, ollamaUrl, model);
        suggestions.set(key, result.suggestion);
      })
    );
  }

  return suggestions;
}
