#!/usr/bin/env tsx
/**
 * Vercel Constraint Sync Checker
 *
 * Vercel Functions cannot import from src/, so api/_shared.ts must duplicate
 * types and utilities from src/. This script verifies they stay in sync.
 *
 * Usage:
 *   npx tsx scripts/sync-check.ts
 *   npm run sync:check
 *
 * Exit codes:
 *   0 - All synced
 *   1 - Sync issues found
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// Configuration
// ============================================

interface SyncRule {
  name: string;
  sourceFile: string;
  targetFile: string;
  contentPatterns: Array<{
    description: string;
    sourcePattern: RegExp;
    targetPattern: RegExp;
  }>;
}

const SYNC_RULES: SyncRule[] = [
  {
    name: 'Types Sync',
    sourceFile: 'src/types.ts',
    targetFile: 'api/_shared.ts',
    contentPatterns: [
      {
        description: 'LogEntry interface',
        sourcePattern: /export interface LogEntry \{[\s\S]*?\n\}/,
        targetPattern: /export interface LogEntry \{[\s\S]*?\n\}/,
      },
      {
        description: 'UserActionType',
        sourcePattern: /export type UserActionType\s*=[\s\S]*?;/,
        targetPattern: /export type UserActionType\s*=[\s\S]*?;/,
      },
      {
        description: 'UserAction interface',
        sourcePattern: /export interface UserAction \{[\s\S]*?\n\}/,
        targetPattern: /export interface UserAction \{[\s\S]*?\n\}/,
      },
      {
        description: 'NavigationType',
        sourcePattern: /export type NavigationType\s*=[\s\S]*?;/,
        targetPattern: /export type NavigationType\s*=[\s\S]*?;/,
      },
      {
        description: 'NavigationEntry interface',
        sourcePattern: /export interface NavigationEntry \{[\s\S]*?\n\}/,
        targetPattern: /export interface NavigationEntry \{[\s\S]*?\n\}/,
      },
      {
        description: 'CoreWebVitals interface',
        sourcePattern: /export interface CoreWebVitals \{[\s\S]*?\n\}/,
        targetPattern: /export interface CoreWebVitals \{[\s\S]*?\n\}/,
      },
      {
        description: 'PerformanceSummary interface',
        sourcePattern: /export interface PerformanceSummary \{[\s\S]*?\n\}/,
        targetPattern: /export interface PerformanceSummary \{[\s\S]*?\n\}/,
      },
      {
        description: 'PageContext interface',
        sourcePattern: /export interface PageContext \{[\s\S]*?\n\}/,
        targetPattern: /export interface PageContext \{[\s\S]*?\n\}/,
      },
      {
        description: 'HostedBugReportPayload interface',
        sourcePattern: /export interface HostedBugReportPayload \{[\s\S]*?\n\}/,
        targetPattern: /export interface HostedBugReportPayload \{[\s\S]*?\n\}/,
      },
      {
        description: 'MAX_LOG_ENTRIES constant',
        sourcePattern: /export const MAX_LOG_ENTRIES\s*=\s*\d+;/,
        targetPattern: /export const MAX_LOG_ENTRIES\s*=\s*\d+;/,
      },
    ],
  },
  {
    name: 'Masking Sync',
    sourceFile: 'src/utils/masking.ts',
    targetFile: 'api/_shared.ts',
    contentPatterns: [
      {
        description: 'MASKING_PATTERNS array (pattern count)',
        sourcePattern: /const MASKING_PATTERNS:\s*MaskingPattern\[\]\s*=\s*\[[\s\S]*?\n\];/,
        targetPattern: /const MASKING_PATTERNS:\s*MaskingPattern\[\]\s*=\s*\[[\s\S]*?\n\];/,
      },
    ],
  },
];

// ============================================
// Utilities
// ============================================

function stripCommentsAndNormalize(str: string): string {
  return str
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractWithBraceBalancing(
  content: string,
  startPattern: RegExp
): string | null {
  const match = content.match(startPattern);
  if (!match || match.index === undefined) return null;

  let depth = 0;
  let startIndex = match.index;
  let foundStart = false;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    if (char === '{') {
      if (!foundStart) foundStart = true;
      depth++;
    } else if (char === '}') {
      depth--;
      if (foundStart && depth === 0) {
        return stripCommentsAndNormalize(content.slice(startIndex, i + 1));
      }
    }
  }

  return null;
}

function extractMatch(content: string, pattern: RegExp): string | null {
  if (pattern.source.includes('interface') || pattern.source.includes('type.*=')) {
    const nameMatch = pattern.source.match(/(?:interface|type)\s+(\w+)/);
    if (nameMatch) {
      return extractWithBraceBalancing(content, pattern);
    }
  }
  const match = content.match(pattern);
  return match ? stripCommentsAndNormalize(match[0]) : null;
}

function extractMaskingPatternHashes(content: string): string[] {
  const patternBlockMatch = content.match(
    /const MASKING_PATTERNS[^=]*=\s*\[([\s\S]*?)\n\];/
  );
  if (!patternBlockMatch || !patternBlockMatch[1]) return [];

  const patternObjects: string[] = [];
  let depth = 0;
  let currentObject = '';
  let inObject = false;

  for (const char of patternBlockMatch[1]) {
    if (char === '{') {
      if (depth === 0) inObject = true;
      depth++;
    }
    if (inObject) currentObject += char;
    if (char === '}') {
      depth--;
      if (depth === 0 && inObject) {
        patternObjects.push(stripCommentsAndNormalize(currentObject));
        currentObject = '';
        inObject = false;
      }
    }
  }

  return patternObjects.map((obj) => hashContent(obj));
}

function compareMaskingPatterns(
  sourceContent: string,
  targetContent: string
): { match: boolean; sourceCount: number; targetCount: number; details?: string } {
  const sourceHashes = extractMaskingPatternHashes(sourceContent);
  const targetHashes = extractMaskingPatternHashes(targetContent);

  if (sourceHashes.length !== targetHashes.length) {
    return {
      match: false,
      sourceCount: sourceHashes.length,
      targetCount: targetHashes.length,
      details: `Pattern count mismatch: source has ${sourceHashes.length}, target has ${targetHashes.length}`,
    };
  }

  for (let i = 0; i < sourceHashes.length; i++) {
    if (sourceHashes[i] !== targetHashes[i]) {
      return {
        match: false,
        sourceCount: sourceHashes.length,
        targetCount: targetHashes.length,
        details: `Pattern #${i + 1} content differs`,
      };
    }
  }

  return {
    match: true,
    sourceCount: sourceHashes.length,
    targetCount: targetHashes.length,
  };
}

function hashContent(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

// ============================================
// Main Check Logic
// ============================================

interface CheckResult {
  rule: string;
  pattern: string;
  status: 'ok' | 'mismatch' | 'missing_source' | 'missing_target';
  sourceHash?: string;
  targetHash?: string;
  details?: string;
}

function checkSync(): CheckResult[] {
  const results: CheckResult[] = [];
  const projectRoot = path.resolve(__dirname, '..');

  for (const rule of SYNC_RULES) {
    let sourceContent: string;
    let targetContent: string;

    try {
      sourceContent = fs.readFileSync(
        path.join(projectRoot, rule.sourceFile),
        'utf-8'
      );
    } catch {
      results.push({
        rule: rule.name,
        pattern: 'file-read',
        status: 'missing_source',
        details: `Source file not found: ${rule.sourceFile}`,
      });
      continue;
    }

    try {
      targetContent = fs.readFileSync(
        path.join(projectRoot, rule.targetFile),
        'utf-8'
      );
    } catch {
      results.push({
        rule: rule.name,
        pattern: 'file-read',
        status: 'missing_target',
        details: `Target file not found: ${rule.targetFile}`,
      });
      continue;
    }

    for (const pattern of rule.contentPatterns) {
      if (pattern.description.includes('MASKING_PATTERNS')) {
        const comparison = compareMaskingPatterns(sourceContent, targetContent);

        if (!comparison.match) {
          results.push({
            rule: rule.name,
            pattern: pattern.description,
            status: 'mismatch',
            details: comparison.details,
          });
        } else {
          results.push({
            rule: rule.name,
            pattern: pattern.description,
            status: 'ok',
            details: `${comparison.sourceCount} patterns matched`,
          });
        }
        continue;
      }

      const sourceMatch = extractMatch(sourceContent, pattern.sourcePattern);
      const targetMatch = extractMatch(targetContent, pattern.targetPattern);

      if (!sourceMatch) {
        results.push({
          rule: rule.name,
          pattern: pattern.description,
          status: 'missing_source',
          details: `Not found in ${rule.sourceFile}`,
        });
        continue;
      }

      if (!targetMatch) {
        results.push({
          rule: rule.name,
          pattern: pattern.description,
          status: 'missing_target',
          details: `Not found in ${rule.targetFile}`,
        });
        continue;
      }

      const sourceHash = hashContent(sourceMatch);
      const targetHash = hashContent(targetMatch);

      if (sourceHash === targetHash) {
        results.push({
          rule: rule.name,
          pattern: pattern.description,
          status: 'ok',
          sourceHash,
          targetHash,
        });
      } else {
        results.push({
          rule: rule.name,
          pattern: pattern.description,
          status: 'mismatch',
          sourceHash,
          targetHash,
          details: 'Content differs between source and target',
        });
      }
    }
  }

  return results;
}

// ============================================
// CLI Output
// ============================================

function formatResults(results: CheckResult[]): void {
  console.log('\n🔍 Vercel Constraint Sync Check\n');
  console.log('━'.repeat(60));

  let hasIssues = false;
  let currentRule = '';

  for (const result of results) {
    if (result.rule !== currentRule) {
      currentRule = result.rule;
      console.log(`\n📁 ${currentRule}`);
    }

    const icon =
      result.status === 'ok'
        ? '✅'
        : result.status === 'mismatch'
          ? '❌'
          : '⚠️';
    const status =
      result.status === 'ok'
        ? 'Synced'
        : result.status === 'mismatch'
          ? 'MISMATCH'
          : result.status === 'missing_source'
            ? 'Missing in source'
            : 'Missing in target';

    console.log(`   ${icon} ${result.pattern}: ${status}`);

    if (result.status !== 'ok') {
      hasIssues = true;
      if (result.details) {
        console.log(`      └─ ${result.details}`);
      }
      if (result.sourceHash && result.targetHash) {
        console.log(
          `      └─ Source hash: ${result.sourceHash}, Target hash: ${result.targetHash}`
        );
      }
    }
  }

  console.log('\n' + '━'.repeat(60));

  if (hasIssues) {
    console.log('\n❌ Sync issues found!\n');
    console.log('To fix:');
    console.log(
      '  1. Update api/_shared.ts to match src/types.ts and src/utils/masking.ts'
    );
    console.log('  2. Run this check again: npm run sync:check\n');
    console.log(
      '⚠️  Remember: api/ cannot import from src/ due to Vercel constraints.\n'
    );
    process.exit(1);
  } else {
    console.log('\n✅ All files are in sync!\n');
    process.exit(0);
  }
}

export {
  stripCommentsAndNormalize,
  extractWithBraceBalancing,
  extractMatch,
  extractMaskingPatternHashes,
  compareMaskingPatterns,
  hashContent,
  checkSync,
  SYNC_RULES,
};

export type { SyncRule, CheckResult };

// ============================================
// Entry Point
// ============================================

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('sync-check.ts')) {
  const results = checkSync();
  formatResults(results);
}
