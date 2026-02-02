import { ESLint, Linter } from 'eslint';
import * as fs from 'fs';
import path from 'path';

export interface Violation {
  type: 'error' | 'warning';
  location: { line: number; column: number };
  ruleId: string;
  message: string;
  source?: string;
  filePath: string;
}

export interface LintOptions {
  config?: any;
  parserOptions?: any;
}

export class CodeReviewEngine {
  private eslint: ESLint;

  constructor(options: LintOptions = {}) {
    this.eslint = new ESLint({
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      overrideConfig: options.config,
      useEslintrc: false,
    });
  }

  async reviewFile(filePath: string): Promise<Violation[]> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const results = await this.eslint.lintFiles([filePath]);
    const violations: Violation[] = [];

    for (const result of results) {
      for (const msg of result.messages) {
        violations.push({
          type: msg.severity === 2 ? 'error' : 'warning',
          location: { line: msg.line, column: msg.column },
          ruleId: msg.ruleId || 'unknown',
          message: msg.message,
          source: msg.source,
          filePath,
        });
      }
    }

    return violations;
  }

  async reviewDirectory(dirPath: string): Promise<Map<string, Violation[]>> {
    const files = this.getSupportedFiles(dirPath);
    const results = new Map<string, Violation[]>();

    for (const file of files) {
      const violations = await this.reviewFile(file);
      if (violations.length > 0) {
        results.set(file, violations);
      }
    }

    return results;
  }

  private getSupportedFiles(dirPath: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...this.getSupportedFiles(fullPath));
      } else if (entry.isFile() && this.isSupportedFile(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private isSupportedFile(filename: string): boolean {
    return /\.(ts|tsx|js|jsx)$/.test(filename);
  }
}
