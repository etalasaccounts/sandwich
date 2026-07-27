# ADR: Integrate Binder Plugin with Sandwich

**Status:** Proposed  
**Date:** 2026-07-27  
**Authors:** Hermes Agent  
**Related:** [Binder](https://github.com/Deliametap/binder), [Sandwich](https://github.com/etalasaccounts/sandwich)

---

## Context

Binder is a standalone Claude Code plugin that analyzes source code repositories and generates documentation (UAT, User Manual, API Documentation, Installation Guide, Technical Documentation). It shares the same architectural philosophy as Sandwich:

- Validated registry as single source of truth
- Zod validation for all LLM outputs
- Confidence markers with threshold blocking
- Deterministic stable IDs via content fingerprinting
- Journal for audit trail
- Model never computes/decides what must stay consistent — code does

Sandwich currently handles requirements capture and prioritization, then hands off to Superpowers for execution. What's missing is the documentation phase after features are built.

---

## Decision

**Integrate Binder as a complementary, separate plugin with lightweight integration points.**

Binder remains standalone, but Sandwich will:

1. Document the handoff workflow (after `/prep --done`, suggest running Binder)
2. Optionally read Binder's registry for cross-referencing features with generated docs
3. Share common library components (agent-wrapper, confidence types)

---

## Rationale

### Why not merge into one plugin?

Binder has independent value — someone might use it without Sandwich:
- Analyze legacy codebases (no requirements needed)
- Generate docs for open-source projects
- Audit existing systems

Separation of concerns:
- Sandwich = requirements phase (what to build)
- Binder = post-build phase (what was built)

Maintenance:
- Independent test suites
- Independent release cycles
- Specialized development

### Integration Points

1. **Handoff suggestion:** After `sandwich:/prep --done F-001 <sha>`, display message:

   ```
   Feature F-001 marked complete.
   
   To update project documentation, run:
   
     /binder:analyze
     /binder:generate uat user-manual
   
   Docs will be generated in your project root.
   ```

2. **Feature cross-reference (optional enhancement):** Binder can read `.sandwich/registry/features.json` and link detected code features to Sandwich feature IDs in generated documentation.

3. **Shared components:** Extract common utilities:
   - Zod validation wrapper with retry
   - Confidence marker types and thresholds
   - Journal format conventions

---

## Consequences

### Positive

- Complete pipeline from requirements → build → documentation
- Users can adopt incrementally (Sandwich first, add Binder later)
- Binder works on any codebase, Sandwich or not
- Clear separation of concerns
- Both plugins remain independently installable

### Negative

- Two plugins to install for full workflow
- Need to maintain compatibility over time
- Documentation must cover both

### Neutral

- Both require Node.js >= 22.6
- Both use same Claude Code plugin format
- Both support Hermes plugin format

---

## Implementation

### Phase 1: Documentation (this PR)

- Add "Post-build workflow" section to README
- Add handoff message in prep skill
- Add ADR documenting the decision

### Phase 2: Shared utilities

- Extract `agent-wrapper.ts` to shared lib
- Extract confidence types to shared lib
- Add Binder as optional peer dependency

### Phase 3: Feature cross-reference

- Binder: detect and read `.sandwich/registry/features.json`
- Binder: include Sandwich feature IDs in generated docs (when available)

---

## Examples

### Full workflow with both plugins

```
# Requirements phase
/order
[brief content]

/prep
[features scored and queued]

# Hand off to Superpowers for design/build
/brainstorm
[Superpowers handles implementation]

# Mark feature complete
/prep --done F-001 abc123

# Documentation phase (Binder)
/binder:analyze
/binder:generate all id

# Check status
/status                    # Sandwich: what's blocked/next
/binder:status             # Binder: code drift, stale docs
```

### Binder standalone (without Sandwich)

```
# Analyze any codebase
/binder:analyze https://github.com/some/legacy-project
/binder:generate uat api-documentation en
```

---

## Alternatives Considered

### Alternative 1: Merge Binder into Sandwich

One monolithic plugin with `/order`, `/prep`, `/analyze`, `/docs` commands.

**Rejected because:**
- Binder has standalone value
- Concerns are different (requirements vs post-build)
- Harder to maintain
- Users who only need docs would install unnecessary code

### Alternative 2: No integration

Keep completely separate, no cross-referencing.

**Rejected because:**
- Missed opportunity to connect feature specs with generated docs
- User needs to manually discover the workflow
- No handoff guidance after feature completion

---

## References

- [Binder repository](https://github.com/Deliametap/binder)
- [Binder planning doc](./binder-integration-plan.md) (detailed technical planning)
- [Superpowers](https://github.com/obra/Superpowers)
