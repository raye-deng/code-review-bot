/**
 * Embedding Engine - 语义相似度分析
 *
 * 使用 Ollama embedding API 将代码文件向量化，
 * 通过余弦相似度检测重复逻辑、相似代码模式、潜在的 copy-paste bug。
 */

export interface EmbeddingResult {
  filePath: string;
  embedding: number[];
  contentHash: string;
}

export interface SimilarityMatch {
  fileA: string;
  fileB: string;
  similarity: number;
  snippetA?: string;
  snippetB?: string;
}

export interface EmbeddingEngineOptions {
  ollamaUrl?: string;
  model?: string;
  similarityThreshold?: number;
}

const DEFAULT_OLLAMA_URL = 'http://192.168.66.141:11434';
const DEFAULT_EMBEDDING_MODEL = 'qwen2.5:7b-instruct';
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * 简单的内容哈希（用于缓存判断）
 */
function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

export class EmbeddingEngine {
  private ollamaUrl: string;
  private model: string;
  private similarityThreshold: number;

  constructor(options: EmbeddingEngineOptions = {}) {
    this.ollamaUrl = options.ollamaUrl || DEFAULT_OLLAMA_URL;
    this.model = options.model || DEFAULT_EMBEDDING_MODEL;
    this.similarityThreshold = options.similarityThreshold || DEFAULT_SIMILARITY_THRESHOLD;
  }

  /**
   * 生成单个文本的 embedding
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama embedding API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as { embeddings?: number[][] };
    if (!data.embeddings || data.embeddings.length === 0) {
      throw new Error('Ollama returned empty embeddings');
    }

    return data.embeddings[0];
  }

  /**
   * 批量生成文件 embedding
   */
  async embedFiles(
    files: { filePath: string; content: string }[]
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`  📐 Embedding [${i + 1}/${files.length}]: ${file.filePath}`);

      try {
        // 截断过长的文件内容（embedding 模型有 token 限制）
        const truncatedContent = file.content.slice(0, 8000);
        const embedding = await this.generateEmbedding(truncatedContent);

        results.push({
          filePath: file.filePath,
          embedding,
          contentHash: simpleHash(file.content),
        });
      } catch (error) {
        console.error(`  ⚠️  Embedding failed for ${file.filePath}: ${(error as Error).message}`);
      }
    }

    return results;
  }

  /**
   * 计算所有文件对之间的相似度，返回高于阈值的匹配
   */
  findSimilarFiles(embeddings: EmbeddingResult[]): SimilarityMatch[] {
    const matches: SimilarityMatch[] = [];

    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const similarity = cosineSimilarity(
          embeddings[i].embedding,
          embeddings[j].embedding
        );

        if (similarity >= this.similarityThreshold) {
          matches.push({
            fileA: embeddings[i].filePath,
            fileB: embeddings[j].filePath,
            similarity,
          });
        }
      }
    }

    // 按相似度降序排列
    matches.sort((a, b) => b.similarity - a.similarity);
    return matches;
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
