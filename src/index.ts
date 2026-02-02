import { CodeReviewEngine } from './lib/lint-engine';
import { batchGenerateSuggestions } from './lib/ai-suggestions';
import * as fs from 'fs';
import path from 'path';

async function main() {
  const codePath = process.argv[2] || '.';
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

  console.log(`🔍 Reviewing code in: ${codePath}`);

  // Collect all violations
  const allViolations: any[] = [];
  const results = await engine.reviewDirectory(codePath);

  for (const [filePath, violations] of results.entries()) {
    allViolations.push(...violations);
    console.log(`\n📄 ${filePath}: ${violations.length} issues found`);
  }

  if (allViolations.length === 0) {
    console.log('\n✅ No issues found!');
    return;
  }

  // Generate AI suggestions in batches
  console.log(`\n🤖 Generating AI suggestions for ${allViolations.length} issues...`);
  const suggestions = await batchGenerateSuggestions(allViolations);

  // Output final report
  console.log('\n' + '='.repeat(60));
  console.log('📋 CODE REVIEW REPORT');
  console.log('='.repeat(60));

  for (const violation of allViolations) {
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
    console.log('-'.repeat(40));
  }

  // Save to JSON
  const reportPath = path.join(process.cwd(), 'review-report.json');
  const report = allViolations.map((v: any) => ({
    ...v,
    suggestion: suggestions.get(`${v.filePath}:${v.location.line}:${v.location.column}`),
  }));

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved to: ${reportPath}`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
