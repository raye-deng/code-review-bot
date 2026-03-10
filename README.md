# 🤖 Code Review Bot

Local AI-powered code review for JavaScript/TypeScript projects. Your code stays on your machine - no cloud LLMs.

## ✨ Features

- **Local-first** — All analysis runs on your machine with Ollama (qwen3-coder)
- **Privacy-focused** — Your code never leaves your local environment
- **Multi-level analysis** — L1 (lint + AI suggestions) and L2 (embedding + deep LLM review)
- **Smart suggestions** — AI explains why issues occur and how to fix them
- **Code similarity detection** — Embedding-based duplicate/copy-paste detection
- **Batch processing** — Review entire codebases in minutes
- **Configurable rules** — Use your favorite ESLint configs

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/raye-deng/code-review-bot.git
cd code-review-bot
npm install

# L1: Basic lint + AI suggestions (default)
npx tsx src/index.ts path/to/code

# L2: Lint + embedding similarity + deep LLM analysis
npx tsx src/index.ts path/to/code --level L2
```

## 📊 Analysis Levels

### L1 — Basic Analysis (Default)

- **ESLint static check** — Rule-based linting with TypeScript support
- **AI suggestions** — qwen3-coder generates fix suggestions for each issue

```bash
npx tsx src/index.ts ./src
```

### L2 — Deep Analysis

Everything in L1, plus:

- **Embedding similarity** — Uses `qwen2.5:7b-instruct` to vectorize code files and detect similar/duplicate logic (cosine similarity > 0.85)
- **Deep LLM review** — Uses `qwen3-coder` for comprehensive analysis:
  - 🏗️ Architecture issues (module coupling, unclear responsibilities)
  - 🔒 Security vulnerabilities (injection, hardcoded credentials)
  - ⚡ Performance issues (N+1, memory leaks, unnecessary re-renders)
  - ✅ Best practices (TypeScript type safety, error handling, logging)
  - 🔄 Code similarity (embedding-based duplicate detection)

```bash
npx tsx src/index.ts ./src --level L2
```

## 📋 Example Output

### L1 Output

```
╔════════════════════════════════════════╗
║  🤖 Code Review Bot — Level L1        ║
╚════════════════════════════════════════╝

🔍 Reviewing code in: ./src
📊 Analysis level: L1

━━━ L1: ESLint + AI Suggestions ━━━
  📄 src/index.ts: 5 issues

═══════════════════════════════════════════════════════
📋 SECTION 1: ESLINT RESULTS
═══════════════════════════════════════════════════════

WARNING: no-console
📍 index.ts:10:3
💬 Unexpected console statement.
💡 Use a proper logging utility...
```

### L2 Output (additional sections)

```
═══════════════════════════════════════════════════════
📐 SECTION 2: CODE SIMILARITY (EMBEDDING)
═══════════════════════════════════════════════════════

⚠️  Similarity: 92.3%
  File A: src/lib/lint-engine.ts
  File B: src/lib/ai-suggestions.ts
  → Consider extracting shared logic into a common module.

═══════════════════════════════════════════════════════
🔬 SECTION 3: DEEP LLM ANALYSIS
═══════════════════════════════════════════════════════

📄 src/lib/ai-suggestions.ts
   Summary: Generally well-structured with room for improvement

  🟡 [WARNING] [type-safety] Use of `any` type in batch function
     The violations parameter uses `any[]` which bypasses TypeScript safety.
     💡 Define a proper Violation interface and use it consistently.

  🔵 [INFO] [error-handling] Generic error catch
     The catch block logs but doesn't provide structured error info.
     💡 Use a custom error class with error codes.
```

## 🔧 Prerequisites

- **Node.js** >= 18
- **Ollama** running at `http://192.168.66.141:11434` (configurable)
- **Models**:
  - `qwen3-coder` — for AI suggestions and deep review
  - `qwen2.5:7b-instruct` — for embedding (L2 only)

```bash
# Pull required models
ollama pull qwen3-coder
ollama pull qwen2.5:7b-instruct
```

## 🏗️ Architecture

```
src/
  index.ts                 # CLI entry point (--level L1|L2)
  lib/
    lint-engine.ts         # ESLint wrapper (L1)
    ai-suggestions.ts      # AI fix suggestions via Ollama (L1)
    embedding-engine.ts    # Embedding + cosine similarity (L2)
    deep-review.ts         # Deep LLM code review (L2)
```

| Component | Level | Purpose |
|-----------|-------|---------|
| ESLint Engine | L1 | Static analysis, rule checking |
| AI Suggestions | L1 | Natural language fix suggestions |
| Embedding Engine | L2 | Code vectorization + similarity detection |
| Deep Review | L2 | Comprehensive LLM-based code audit |

## 🔧 Configuration

### ESLint Rules

Customize in `src/index.ts`:

```typescript
const engine = new CodeReviewEngine({
  config: {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
});
```

### Ollama Settings

Default Ollama URL: `http://192.168.66.141:11434`

To use a different Ollama instance, modify the constants in:
- `src/lib/ai-suggestions.ts`
- `src/lib/embedding-engine.ts`
- `src/lib/deep-review.ts`

### Similarity Threshold

Default: `0.85` (85%). Files with cosine similarity above this threshold are flagged.

Adjust in `EmbeddingEngine` constructor options.

## 🛡️ Error Handling

- If Ollama is unavailable, L1 AI suggestions gracefully fall back to a default message
- L2 checks Ollama availability before starting and skips if unreachable
- Individual file failures don't stop the batch process
- All errors are logged with context

## 📄 License

MIT

---

Built with ❤️ for developers who care about code quality and privacy.
