/**
 * Deep Review Engine - L2 深度 LLM 分析
 *
 * 使用 Ollama qwen3-coder 模型对代码文件进行深度审查，
 * 分析架构问题、安全漏洞、性能问题、最佳实践等。
 */

export type Severity = 'critical' | 'warning' | 'info';
export type Category =
  | 'architecture'
  | 'security'
  | 'performance'
  | 'best-practice'
  | 'code-similarity'
  | 'error-handling'
  | 'type-safety'
  | 'logging';

export interface DeepReviewIssue {
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
}

export interface DeepReviewResult {
  filePath: string;
  issues: DeepReviewIssue[];
  summary: string;
  reviewDurationMs: number;
}

export interface DeepReviewOptions {
  ollamaUrl?: string;
  model?: string;
}

const DEFAULT_OLLAMA_URL = 'http://192.168.66.141:11434';
const DEFAULT_MODEL = 'qwen3-coder';

const DEEP_REVIEW_SYSTEM_PROMPT = `You are an expert code reviewer. Analyze the given code file thoroughly and return your findings in a strict JSON format.

Review the code for:
1. **Architecture issues** (module coupling, unclear responsibilities, separation of concerns)
2. **Security vulnerabilities** (injection, hardcoded credentials, insecure dependencies, data leaks)
3. **Performance issues** (N+1 queries, memory leaks, unnecessary re-renders, inefficient algorithms)
4. **Best practices** (TypeScript type safety, error handling, logging standards, naming conventions)
5. **Error handling** (missing try-catch, unhandled promises, generic error messages)
6. **Type safety** (use of \`any\`, missing type annotations, unsafe type assertions)

For each issue found, provide:
- severity: "critical" | "warning" | "info"
- category: "architecture" | "security" | "performance" | "best-practice" | "error-handling" | "type-safety" | "logging"
- title: short description of the issue
- description: detailed explanation
- location: approximate line reference or code snippet identifier
- suggestion: how to fix it

Respond ONLY with valid JSON in this format (no markdown, no code fences):
{
  "issues": [
    {
      "severity": "warning",
      "category": "type-safety",
      "title": "Use of any type",
      "description": "...",
      "location": "line 42",
      "suggestion": "..."
    }
  ],
  "summary": "Brief overall assessment of the code quality"
}

If the code is excellent and has no issues, return an empty issues array with a positive summary.
Do NOT output anything outside the JSON.`;

export class DeepReviewEngine {
  private ollamaUrl: string;
  private model: string;

  constructor(options: DeepReviewOptions = {}) {
    this.ollamaUrl = options.ollamaUrl || DEFAULT_OLLAMA_URL;
    this.model = options.model || DEFAULT_MODEL;
  }

  /**
   * 对单个文件进行深度 LLM 分析
   */
  async reviewFile(filePath: string, content: string): Promise<DeepReviewResult> {
    const startTime = Date.now();

    const userPrompt = `Review this TypeScript/JavaScript file:

**File:** ${filePath}

\`\`\`typescript
${content.slice(0, 12000)}
\`\`\`

Analyze thoroughly and return JSON as specified.`;

    try {
      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: DEEP_REVIEW_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 4096,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama chat API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as {
        message?: { content?: string };
      };

      const rawContent = data.message?.content || '';
      const parsed = this.parseResponse(rawContent);

      return {
        filePath,
        issues: parsed.issues,
        summary: parsed.summary,
        reviewDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`  ⚠️  Deep review failed for ${filePath}: ${(error as Error).message}`);

      return {
        filePath,
        issues: [],
        summary: `Review failed: ${(error as Error).message}`,
        reviewDurationMs: elapsed,
      };
    }
  }

  /**
   * 批量审查多个文件
   */
  async reviewFiles(
    files: { filePath: string; content: string }[]
  ): Promise<DeepReviewResult[]> {
    const results: DeepReviewResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`  🔬 Deep review [${i + 1}/${files.length}]: ${file.filePath}`);

      const result = await this.reviewFile(file.filePath, file.content);
      results.push(result);

      const issueCount = result.issues.length;
      const critical = result.issues.filter(i => i.severity === 'critical').length;
      const warning = result.issues.filter(i => i.severity === 'warning').length;
      const info = result.issues.filter(i => i.severity === 'info').length;

      console.log(
        `    → ${issueCount} issues (${critical} critical, ${warning} warning, ${info} info) [${(result.reviewDurationMs / 1000).toFixed(1)}s]`
      );
    }

    return results;
  }

  /**
   * 解析 LLM 响应为结构化数据
   */
  private parseResponse(raw: string): { issues: DeepReviewIssue[]; summary: string } {
    try {
      // 尝试直接解析 JSON
      let jsonStr = raw.trim();

      // 去除可能存在的 think 标签内容
      jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      // 如果被 markdown code fence 包裹，提取其中的 JSON
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }

      // 尝试找到 JSON 对象
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
      }

      const parsed = JSON.parse(jsonStr);

      const issues: DeepReviewIssue[] = (parsed.issues || []).map((issue: any) => ({
        severity: this.validateSeverity(issue.severity),
        category: this.validateCategory(issue.category),
        title: String(issue.title || 'Unknown issue'),
        description: String(issue.description || ''),
        location: issue.location ? String(issue.location) : undefined,
        suggestion: issue.suggestion ? String(issue.suggestion) : undefined,
      }));

      return {
        issues,
        summary: String(parsed.summary || 'No summary provided'),
      };
    } catch {
      // 如果解析失败，返回原始文本作为 summary
      return {
        issues: [],
        summary: `LLM response could not be parsed. Raw: ${raw.slice(0, 500)}`,
      };
    }
  }

  private validateSeverity(s: unknown): Severity {
    if (s === 'critical' || s === 'warning' || s === 'info') return s;
    return 'info';
  }

  private validateCategory(c: unknown): Category {
    const valid: Category[] = [
      'architecture', 'security', 'performance', 'best-practice',
      'code-similarity', 'error-handling', 'type-safety', 'logging',
    ];
    if (typeof c === 'string' && valid.includes(c as Category)) return c as Category;
    return 'best-practice';
  }

  /**
   * 检查 Ollama 服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
