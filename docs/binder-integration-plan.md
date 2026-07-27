# Binder Integration Plan

**Status:** Draft  
**Date:** 2026-07-27  
**Author:** Hermes Agent

---

## Overview

Technical planning for integrating [Binder](https://github.com/Deliametap/binder) with [Sandwich](https://github.com/etalasaccounts/sandwich). See [ADR-0001](./decisions/0001-integrate-binder-plugin.md) for the decision rationale.

---

## Current State

### Sandwich Pipeline

```
/order → /prep → docs/sandwich/specs/F-XXX.md → superpowers:brainstorm → build
                 └─ feature-queue.md (priorities + links)
```

Ends at: "what to build and in what order"

### Binder Pipeline

```
/binder:analyze → /binder:generate → UAT.md, User_Manual.md, API_Documentation.md, ...
```

Starts from: existing codebase

### Combined Pipeline

```
/order → /prep → superpowers → build → /binder:analyze → /binder:generate
                                            ↓
                            UAT, User Manual, API Doc, Install Guide, Tech Doc
```

---

## Integration Points

### 1. Handoff Message in `/prep --done`

After marking a feature complete, suggest documentation update.

**File to modify:** `prep/workflow.ts`

**Change:**

```typescript
// After successful --done
console.log(`
Feature ${featureId} marked complete.

To update project documentation, run:

  /binder:analyze
  /binder:generate all id

Docs will be generated in your project root.
`);
```

### 2. Cross-Reference Features in Generated Docs

Binder can optionally read `.sandwich/registry/features.json` and include Sandwich feature IDs in generated documentation.

**File to modify:** `binder/registry/registry-lib.ts`

**Enhancement:**

```typescript
function enrichDetectedFeatures(detected: DetectedFeature[]): EnrichedFeature[] {
  const sandwichFeatures = readSandwichFeatures(); // optional, may not exist
  
  return detected.map(f => {
    const match = sandwichFeatures?.find(sf => 
      fuzzyMatch(sf.title, f.name) || 
      sf.scope?.some(s => f.description.includes(s))
    );
    
    return {
      ...f,
      sandwichFeatureId: match?.id, // e.g., "F-001"
      sandwichFeatureUrl: match ? `docs/sandwich/specs/${match.id}.md` : null
    };
  });
}
```

### 3. Shared Library Components

Extract common utilities that both plugins use.

**Files to create:**

```
lib/shared/
├── agent-wrapper.ts    # Zod validation with retry
├── confidence.ts       # Confidence marker types and thresholds
├── fingerprint.ts      # Content fingerprinting for stable IDs
└── journal.ts          # Journal format utilities
```

**Agent wrapper (shared):**

```typescript
// lib/shared/agent-wrapper.ts

import { z } from 'zod';

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
}

export async function validatedAgentCall<T>(
  agent: () => Promise<unknown>,
  schema: z.ZodSchema<T>,
  options: { maxRetries?: number; context?: string } = {}
): Promise<AgentResult<T>> {
  const maxRetries = options.maxRetries ?? 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const raw = await agent();
      const parsed = schema.safeParse(raw);
      
      if (parsed.success) {
        return { success: true, data: parsed.data, attempts: attempt };
      }
      
      // Retry with error context
      if (attempt < maxRetries) {
        // Agent would need to be told what went wrong
        console.error(`Validation failed (attempt ${attempt}):`, parsed.error.errors);
      } else {
        return { 
          success: false, 
          error: parsed.error.message, 
          attempts: attempt 
        };
      }
    } catch (err) {
      if (attempt === maxRetries) {
        return { 
          success: false, 
          error: String(err), 
          attempts: attempt 
        };
      }
    }
  }
  
  return { success: false, error: 'Max retries exceeded', attempts: maxRetries };
}
```

**Confidence markers (shared):**

```typescript
// lib/shared/confidence.ts

export type ConfidenceMarker = 'stated' | 'discussed' | 'inferred' | 'assumed';

export const CONFIDENCE_WEIGHTS: Record<ConfidenceMarker, number> = {
  stated: 1.0,
  discussed: 0.8,
  inferred: 0.5,
  assumed: 0.2,
};

export interface ValidatedItem {
  confidence: ConfidenceMarker;
}

export function checkConfidence(items: ValidatedItem[]): {
  ok: boolean;
  average: number;
  assumedRatio: number;
} {
  if (items.length === 0) return { ok: true, average: 1, assumedRatio: 0 };
  
  const total = items.reduce((sum, item) => 
    sum + CONFIDENCE_WEIGHTS[item.confidence], 0
  );
  
  const assumedCount = items.filter(i => i.confidence === 'assumed').length;
  
  const average = total / items.length;
  const assumedRatio = assumedCount / items.length;
  
  return {
    ok: average >= 0.4 && assumedRatio <= 0.3,
    average,
    assumedRatio,
  };
}
```

---

## Acceptance Criteria

### Phase 1: Documentation

- [ ] README updated with "Post-build documentation" section
- [ ] Handoff message added to `/prep --done` output
- [ ] ADR documenting integration decision

### Phase 2: Shared Utilities

- [ ] `lib/shared/agent-wrapper.ts` extracted and used by both
- [ ] `lib/shared/confidence.ts` extracted and used by both
- [ ] Both plugins pass all self-checks with shared lib

### Phase 3: Feature Cross-Reference

- [ ] Binder detects and reads `.sandwich/registry/features.json`
- [ ] Generated docs include Sandwich feature IDs when available
- [ ] Graceful fallback when Sandwich not present

---

## Installation

After integration, recommended install flow:

```
# Install both plugins
claude plugin marketplace add etalasaccounts/sandwich
claude plugin marketplace add Deliametap/binder

claude plugin install sandwich
claude plugin install binder
```

Or for Hermes:

```
git clone https://github.com/etalasaccounts/sandwich.git
git clone https://github.com/Deliametap/binder.git

mkdir -p ~/.hermes/plugins
ln -s "$(pwd)/sandwich/hermes-plugin" ~/.hermes/plugins/sandwich
ln -s "$(pwd)/binder/hermes-plugin" ~/.hermes/plugins/binder

hermes plugins enable sandwich
hermes plugins enable binder
```

---

## Timeline

| Phase | Scope | Est. Time | Owner |
|-------|-------|-----------|-------|
| 1 | Documentation + handoff message | 1-2 days | Sandwich team |
| 2 | Shared lib extraction | 2-3 days | Both teams |
| 3 | Feature cross-reference | 2-3 days | Binder team |
| 4 | Testing + docs | 1-2 days | Both teams |

---

## Open Questions

1. **Shared lib location:** Should shared utilities live in Sandwich, Binder, or a separate repo?
   - Option A: In Sandwich, Binder imports from it
   - Option B: Separate `sandwich-lib` repo
   - Option C: Duplicate (simplest, slight drift risk)

2. **Versioning:** If shared lib changes, how to version compatibility?
   - Semantic versioning with peer dependency
   - Or pin to specific commits

3. **Language support:** Binder supports bilingual output (ID/EN). Should Sandwich add this too?

4. **Naming:** Should Binder be renamed to `sandwich-docs` for branding consistency?
   - Pro: Clear that it's part of the Sandwich ecosystem
   - Con: Has standalone value, might confuse non-Sandwich users

---

## References

- [Binder repository](https://github.com/Deliametap/binder)
- [Sandwich repository](https://github.com/etalasaccounts/sandwich)
- [ADR-0001: Integrate Binder Plugin](./decisions/0001-integrate-binder-plugin.md)
