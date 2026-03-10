import { CodeReviewEngine, Violation } from './lib/lint-engine';
import { batchGenerateSuggestions } from './lib/ai-suggestions';
import { EmbeddingEngine, SimilarityMatch } from './lib/embedding-engine';
import { DeepReviewEngine, DeepReviewResult } from './lib/deep-review';
import * as fs from 'fs';
import path from 'path';

type ReviewLevel = 'L1' | 'L2';

interface CliArgs {
  codePath: string;
  level: ReviewLevel;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let codePath = '.';
  let level: ReviewLevel = 'L1';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--level' && args[i + 1]) {
      const val = args[i + 1].toUpperCase();
      if (val === 'L1' || val === 'L2') {
        level = val;
      } else {
        console.error(`⚠️  Unknown level "${args[i + 1]}", using L1`);
      }
      i++; // skip next arg
    } else if (!args[i].startsWith('--')) {
      codePath = args[i];
    }
  }

  return { codePath, level };
}

/**
 * 收集目录下所有支持的文件内容
 */
function collectFiles(dirPath: string): { filePath: string; content: string }[] {
  const files: { filePath: string; content: string }[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '.next') {
          walk(fullPath);
        }
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        // 跳过 Next.js 前端文件
        if (fullPath.includes(path.join('src', 'app'))) continue;

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          files.push({ filePath: fullPath, content });
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  const stat = fs.statSync(dirPath);
  if (stat.isFile()) {
    const content = fs.readFileSync(dirPath, 'utf-8');
    return [{ filePath: dirPath, content }];
  }

  walk(dirPath);
  return files;
}

/**
 * L1 模式：ESLint + AI 建议
 */
async function runL1(codePath: string): Promise<{
  violations: Violation[];
  suggestions: Map<string, string>;
}> {
  const engine = new CodeReviewEngine({
    config: {
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['eslint:recommended'],
      rules: {
        'no-console': 'warn',
        'no-unused-vars': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  });

  const allViolations: Violation[] = [];

  const stat = fs.statSync(codePath);
  let results: Map<string, Violation[]>;

  if (stat.isFile()) {
    const violations = await engine.reviewFile(codePath);
    results = new Map();
    if (violations.length > 0) {
      results.set(codePath, violations);
    }
  } else {
    results = await engine.reviewDirectory(codePath);
  }

  for (const [filePath, violations] of results.entries()) {
    allViolations.push(...violations);
    console.log(`  📄 ${path.relative(process.cwd(), filePath)}: ${violations.length} issues`);
  }

  let suggestions = new Map<string, string>();
  if (allViolations.length > 0) {
    console.log(`\n🤖 Generating AI suggestions for ${allViolations.length} issues...`);
    suggestions = await batchGenerateSuggestions(allViolations);
  }

  return { violations: allViolations, suggestions };
}

/**
 * L2 模式：Embedding 相似度 + 深度 LLM 分析
 */
async function runL2(codePath: string): Promise<{
  similarityMatches: SimilarityMatch[];
  deepReviews: DeepReviewResult[];
}> {
  const embeddingEngine = new EmbeddingEngine();
  const deepReviewEngine = new DeepReviewEngine();

  // 检查 Ollama 可用性
  console.log('\n🔗 Checking Ollama availability...');
  const available = await embeddingEngine.isAvailable();
  if (!available) {
    console.error('❌ Ollama is not available at http://192.168.66.141:11434');
    console.error('   L2 analysis requires Ollama. Skipping L2 phase.');
    return { similarityMatches: [], deepReviews: [] };
  }
  console.log('  ✅ Ollama is available');

  // 收集文件
  const files = collectFiles(codePath);
  console.log(`\n📂 Collected ${files.length} files for L2 analysis`);

  if (files.length === 0) {
    console.log('  No files to analyze.');
    return { similarityMatches: [], deepReviews: [] };
  }

  // Phase 1: Embedding 相似度分析
  console.log('\n📐 Phase 1: Embedding similarity analysis...');
  let similarityMatches: SimilarityMatch[] = [];
  try {
    const embeddings = await embeddingEngine.embedFiles(files);
    similarityMatches = embeddingEngine.findSimilarFiles(embeddings);
    console.log(`  → Found ${similarityMatches.length} similar file pairs (threshold > 0.85)`);
  } catch (error) {
    console.error(`  ⚠️  Embedding phase failed: ${(error as Error).message}`);
  }

  // Phase 2: 深度 LLM 分析
  console.log('\n🔬 Phase 2: Deep LLM analysis...');
  let deepReviews: DeepReviewResult[] = [];
  try {
    deepReviews = await deepReviewEngine.reviewFiles(files);
  } catch (error) {
    console.error(`  ⚠️  Deep review phase failed: ${(error as Error).message}`);
  }

  return { similarityMatches, deepReviews };
}

/**
 * 输出 L1 报告
 */
function printL1Report(violations: Violation[], suggestions: Map<string, string>): void {
  if (violations.length === 0) {
    console.log('\n✅ No ESLint issues found!');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📋 SECTION 1: ESLINT RESULTS');
  console.log('═'.repeat(60));

  for (const violation of violations) {
    const key = `${violation.filePath}:${violation.location.line}:${violation.location.column}`;
    const suggestion = suggestions.get(key) || 'No AI suggestion available';

    console.log(`\n${violation.type.toUpperCase()}: ${violation.ruleId}`);
    console.log(`📍 ${path.basename(violation.filePath)}:${violation.location.line}:${violation.location.column}`);
    console.log(`💬 ${violation.message}`);

    if (violation.source) {
      console.log(`\nCode:`);
      console.log(`  ${violation.source.trim()}`);
    }

    console.log(`\n💡 Suggestion:`);
    console.log(`  ${suggestion}`);
    console.log('─'.repeat(40));
  }
}

/**
 * 输出 L2 报告
 */
function printL2Report(
  similarityMatches: SimilarityMatch[],
  deepReviews: DeepReviewResult[]
): void {
  // Embedding 相似度报告
  console.log('\n' + '═'.repeat(60));
  console.log('📐 SECTION 2: CODE SIMILARITY (EMBEDDING)');
  console.log('═'.repeat(60));

  if (similarityMatches.length === 0) {
    console.log('\n✅ No highly similar file pairs detected.');
  } else {
    for (const match of similarityMatches) {
      const pct = (match.similarity * 100).toFixed(1);
      console.log(`\n⚠️  Similarity: ${pct}%`);
      console.log(`  File A: ${path.relative(process.cwd(), match.fileA)}`);
      console.log(`  File B: ${path.relative(process.cwd(), match.fileB)}`);
      console.log('  → Consider extracting shared logic into a common module.');
      console.log('─'.repeat(40));
    }
  }

  // 深度 LLM 分析报告
  console.log('\n' + '═'.repeat(60));
  console.log('🔬 SECTION 3: DEEP LLM ANALYSIS');
  console.log('═'.repeat(60));

  const totalIssues = deepReviews.reduce((sum, r) => sum + r.issues.length, 0);
  const totalCritical = deepReviews.reduce(
    (sum, r) => sum + r.issues.filter(i => i.severity === 'critical').length, 0
  );
  const totalWarning = deepReviews.reduce(
    (sum, r) => sum + r.issues.filter(i => i.severity === 'warning').length, 0
  );
  const totalInfo = deepReviews.reduce(
    (sum, r) => sum + r.issues.filter(i => i.severity === 'info').length, 0
  );

  console.log(`\n📊 Total: ${totalIssues} issues (${totalCritical} critical, ${totalWarning} warning, ${totalInfo} info)`);

  for (const review of deepReviews) {
    if (review.issues.length === 0) continue;

    console.log(`\n${'─'.repeat(40)}`);
    console.log(`📄 ${path.relative(process.cwd(), review.filePath)}`);
    console.log(`   Summary: ${review.summary}`);
    console.log(`   Review time: ${(review.reviewDurationMs / 1000).toFixed(1)}s`);

    for (const issue of review.issues) {
      const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
      console.log(`\n  ${icon} [${issue.severity.toUpperCase()}] [${issue.category}] ${issue.title}`);
      console.log(`     ${issue.description}`);
      if (issue.location) {
        console.log(`     📍 ${issue.location}`);
      }
      if (issue.suggestion) {
        console.log(`     💡 ${issue.suggestion}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const { codePath, level } = parseArgs();

  console.log('╔════════════════════════════════════════╗');
  console.log(`║  🤖 Code Review Bot — Level ${level}        ║`);
  console.log('╚════════════════════════════════════════╝');
  console.log(`\n🔍 Reviewing code in: ${codePath}`);
  console.log(`📊 Analysis level: ${level}`);

  // L1 always runs
  console.log('\n━━━ L1: ESLint + AI Suggestions ━━━');
  const { violations, suggestions } = await runL1(codePath);

  // L2 if requested
  let similarityMatches: SimilarityMatch[] = [];
  let deepReviews: DeepReviewResult[] = [];

  if (level === 'L2') {
    console.log('\n━━━ L2: Embedding + Deep LLM Analysis ━━━');
    const l2Result = await runL2(codePath);
    similarityMatches = l2Result.similarityMatches;
    deepReviews = l2Result.deepReviews;
  }

  // Print report
  console.log('\n' + '═'.repeat(60));
  console.log(`📋 CODE REVIEW REPORT (Level ${level})`);
  console.log('═'.repeat(60));

  printL1Report(violations, suggestions);

  if (level === 'L2') {
    printL2Report(similarityMatches, deepReviews);
  }

  // Save to JSON
  const reportPath = path.join(process.cwd(), 'review-report.json');
  const report = {
    level,
    timestamp: new Date().toISOString(),
    eslint: violations.map((v: Violation) => ({
      ...v,
      suggestion: suggestions.get(`${v.filePath}:${v.location.line}:${v.location.column}`),
    })),
    ...(level === 'L2' && {
      similarity: similarityMatches.map(m => ({
        fileA: m.fileA,
        fileB: m.fileB,
        similarity: m.similarity,
      })),
      deepReview: deepReviews.map(r => ({
        filePath: r.filePath,
        issues: r.issues,
        summary: r.summary,
        reviewDurationMs: r.reviewDurationMs,
      })),
    }),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved to: ${reportPath}`);

  // Summary
  const totalDeepIssues = deepReviews.reduce((sum, r) => sum + r.issues.length, 0);
  console.log('\n📊 Summary:');
  console.log(`  ESLint issues: ${violations.length}`);
  if (level === 'L2') {
    console.log(`  Similar file pairs: ${similarityMatches.length}`);
    console.log(`  Deep review issues: ${totalDeepIssues}`);
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
