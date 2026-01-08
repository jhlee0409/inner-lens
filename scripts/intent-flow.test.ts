import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('analyze-issue.ts Intent Flow Static Analysis', () => {
  const analyzeIssuePath = path.join(__dirname, 'analyze-issue.ts');
  const analyzeIssueCode = fs.readFileSync(analyzeIssuePath, 'utf-8');

  describe('Import Verification', () => {
    it('should import extractIntentWithLLM from finder', () => {
      expect(analyzeIssueCode).toMatch(/import\s*{[^}]*extractIntentWithLLM[^}]*}\s*from\s*['"]\.\/agents\/finder/);
    });

    it('should import inferFilesWithLLM from finder', () => {
      expect(analyzeIssueCode).toMatch(/import\s*{[^}]*inferFilesWithLLM[^}]*}\s*from\s*['"]\.\/agents\/finder/);
    });

    it('should import getProjectFileTree from finder', () => {
      expect(analyzeIssueCode).toMatch(/import\s*{[^}]*getProjectFileTree[^}]*}\s*from\s*['"]\.\/agents\/finder/);
    });

    it('should import mergeInferredWithDiscovered from finder', () => {
      expect(analyzeIssueCode).toMatch(/import\s*{[^}]*mergeInferredWithDiscovered[^}]*}\s*from\s*['"]\.\/agents\/finder/);
    });

    it('should import ExtractedIntent type', () => {
      expect(analyzeIssueCode).toMatch(/import\s*.*ExtractedIntent.*from\s*['"]\.\/agents\/types/);
    });
  });



  describe('USER_PROMPT_TEMPLATE Verification', () => {
    it('should accept extractedIntent parameter', () => {
      expect(analyzeIssueCode).toMatch(/USER_PROMPT_TEMPLATE\s*=\s*\([^)]*extractedIntent/);
    });

    it('should build intentSection from extractedIntent', () => {
      expect(analyzeIssueCode).toMatch(/intentSection\s*=\s*extractedIntent\s*\?/);
    });

    it('should include userAction in intentSection', () => {
      expect(analyzeIssueCode).toMatch(/extractedIntent\.userAction/);
    });

    it('should include expectedBehavior in intentSection', () => {
      expect(analyzeIssueCode).toMatch(/extractedIntent\.expectedBehavior/);
    });

    it('should include actualBehavior in intentSection', () => {
      expect(analyzeIssueCode).toMatch(/extractedIntent\.actualBehavior/);
    });

    it('should include inferredFeatures in intentSection', () => {
      expect(analyzeIssueCode).toMatch(/extractedIntent\.inferredFeatures\.join/);
    });
  });

  describe('SYSTEM_PROMPT Intent Rules Verification', () => {
    it('should have Rule 6 for Intent usage', () => {
      expect(analyzeIssueCode).toMatch(/Rule 6.*Intent|Intent.*Rule 6/i);
    });

    it('should mention Extracted User Intent in system prompt', () => {
      expect(analyzeIssueCode).toMatch(/Extracted User Intent/);
    });

    it('should mention inferredFeatures in system prompt guidance', () => {
      expect(analyzeIssueCode).toMatch(/[Ii]nferred\s*[Ff]eatures/);
    });
  });


});

describe('finder.ts Export Verification', () => {
  const finderPath = path.join(__dirname, 'agents/finder.ts');
  const finderCode = fs.readFileSync(finderPath, 'utf-8');

  it('should export extractIntentWithLLM', () => {
    expect(finderCode).toMatch(/export\s*{[^}]*extractIntentWithLLM/);
  });

  it('should export inferFilesWithLLM', () => {
    expect(finderCode).toMatch(/export\s*{[^}]*inferFilesWithLLM/);
  });

  it('should export getProjectFileTree', () => {
    expect(finderCode).toMatch(/export\s*{[^}]*getProjectFileTree/);
  });

  it('should export mergeInferredWithDiscovered', () => {
    expect(finderCode).toMatch(/export\s*{[^}]*mergeInferredWithDiscovered/);
  });
});

describe('types.ts ExtractedIntent Verification', () => {
  const typesPath = path.join(__dirname, 'agents/types.ts');
  const typesCode = fs.readFileSync(typesPath, 'utf-8');

  it('should define ExtractedIntent interface', () => {
    expect(typesCode).toMatch(/export\s+interface\s+ExtractedIntent/);
  });

  it('should have userAction field', () => {
    expect(typesCode).toMatch(/userAction\s*:\s*string/);
  });

  it('should have inferredFeatures field', () => {
    expect(typesCode).toMatch(/inferredFeatures\s*:\s*string\[\]/);
  });

  it('should have uiElements field', () => {
    expect(typesCode).toMatch(/uiElements\s*:\s*string\[\]/);
  });
});
