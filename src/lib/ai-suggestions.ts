export interface Suggestion {
  suggestion: string;
  confidence?: number;
}

export async function generateSuggestion(
  violation: {
    type: string;
    location: { line: number; column: number };
    ruleId: string;
    message: string;
    source?: string;
  },
  modelUrl: string = 'http://192.168.66.141:12004/v1'
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

Keep your response under 200 words.`;

  try {
    const response = await fetch(`${modelUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-oss-20b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    return {
      suggestion: text.trim(),
      confidence: 0.8,
    };
  } catch (error) {
    console.error('AI suggestion failed:', error);
    return {
      suggestion: 'Review the code against best practices.',
      confidence: 0.5,
    };
  }
}

export async function batchGenerateSuggestions(
  violations: any[],
  modelUrl?: string
): Promise<Map<string, string>> {
  const suggestions = new Map<string, string>();

  // Process in batches to avoid overwhelming the local model
  const batchSize = 3;
  for (let i = 0; i < violations.length; i += batchSize) {
    const batch = violations.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (v) => {
        const key = `${v.filePath}:${v.location.line}:${v.location.column}`;
        const result = await generateSuggestion(v, modelUrl);
        suggestions.set(key, result.suggestion);
      })
    );
  }

  return suggestions;
}
