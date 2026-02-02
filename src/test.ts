import { CodeReviewEngine } from './lib/lint-engine';
import * as path from 'path';

async function testEngine() {
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

  console.log('🧪 Testing Code Review Engine...\n');

  // Test with sample file
  const samplePath = path.join(__dirname, '..', 'test-sample.ts');
  const violations = await engine.reviewFile(samplePath);

  console.log(`Found ${violations.length} violations:`);
  for (const v of violations) {
    console.log(`  [${v.type}] ${v.ruleId}: ${v.message}`);
    console.log(`    Location: Line ${v.location.line}, Column ${v.location.column}`);
  }

  if (violations.length > 0) {
    console.log('\n✅ Engine test passed!');
  } else {
    console.log('\n⚠️  No violations found (unexpected)');
  }
}

testEngine().catch(console.error);
