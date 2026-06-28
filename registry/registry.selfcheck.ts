// Self-check for the registry layer — identity preservation is the core promise.
// Run: node --experimental-strip-types registry/registry.selfcheck.ts
// Plain asserts, no framework. Exits non-zero on first failure.
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  fingerprint,
  nextFeatureId,
  matchByFingerprint,
  mergeExtraction,
  applyRipple,
  attachScores,
  effectivePriority,
  computePriority,
  passGate,
  resetGate,
  parseClientQuestions,
  type Feature,
  type ExtractedFeature,
} from "./registry-lib.ts";
import {
  initProject,
  readProject,
  writeProject,
  readFeatures,
  writeFeatures,
  appendJournal,
  readJournal,
  renderStatus,
} from "./registry-io.ts";

let n = 0;
const check = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ✓ ${name}`);
};

const now = "2026-06-28T00:00:00.000Z";
const hashFor = () => "deadbeef0000";

const mkExtracted = (title: string, module: string): ExtractedFeature => ({
  title,
  module,
  type: "feature",
  confidence: "stated",
  source: { file: "prd.md", line: 10 },
});

// --- fingerprint ---
check("fingerprint is case- and punctuation-insensitive", () => {
  assert.equal(
    fingerprint("Fix Reported Bugs!", "Main WebView"),
    fingerprint("fix  reported bugs", "main webview")
  );
});
check("fingerprint distinguishes genuinely different features", () => {
  assert.notEqual(
    fingerprint("Apply Security Patches", "Build"),
    fingerprint("Fix Reported Bugs", "Build")
  );
});

// --- nextFeatureId ---
check("nextFeatureId is monotonic over all known ids", () => {
  assert.equal(nextFeatureId([{ id: "F-001" }, { id: "F-007" }, { id: "F-003" }]), "F-008");
  assert.equal(nextFeatureId([]), "F-001");
});

// --- merge: identity preservation, the whole point ---
const existing: Feature[] = mergeExtraction(
  matchByFingerprint([mkExtracted("Fix Reported Bugs", "Main WebView")], []),
  hashFor,
  now
);

check("a brand-new extraction mints F-001 as proposed", () => {
  assert.equal(existing.length, 1);
  assert.equal(existing[0].id, "F-001");
  assert.equal(existing[0].lifecycle, "proposed");
});

check("a reworded title keeps its stable ID (no renumber)", () => {
  // Same feature, different wording + punctuation → same fingerprint → same ID.
  const match = matchByFingerprint([mkExtracted("fix reported bugs!!", "main webview")], existing);
  assert.equal(match.matched.length, 1);
  assert.equal(match.added.length, 0);
  const merged = mergeExtraction(match, hashFor, now);
  assert.equal(merged[0].id, "F-001");
});

check("a pinned priority survives re-extraction", () => {
  const pinned: Feature[] = [
    {
      ...existing[0],
      lifecycle: "queued",
      overrides: { priority: { value: 90, by: "ria", reason: "client escalated", at: now } },
    },
  ];
  const match = matchByFingerprint([mkExtracted("Fix Reported Bugs", "Main WebView")], pinned);
  const merged = mergeExtraction(match, hashFor, now);
  assert.equal(merged[0].lifecycle, "queued"); // preserved
  assert.equal(merged[0].overrides.priority?.value, 90); // override untouched
  assert.equal(effectivePriority(merged[0]), 90); // pin wins over any computed score
});

check("a new feature alongside existing gets the next free ID", () => {
  const match = matchByFingerprint(
    [mkExtracted("Fix Reported Bugs", "Main WebView"), mkExtracted("Apply Security Patches", "Build")],
    existing
  );
  const merged = mergeExtraction(match, hashFor, now);
  const security = merged.find((f) => f.title === "Apply Security Patches");
  assert.equal(security?.id, "F-002");
  assert.equal(merged.find((f) => f.title === "Fix Reported Bugs")?.id, "F-001");
});

check("a feature dropped from the brief is preserved as missing, not deleted", () => {
  const match = matchByFingerprint([mkExtracted("Apply Security Patches", "Build")], existing);
  assert.equal(match.missing.length, 1);
  assert.equal(match.missing[0].id, "F-001");
  const merged = mergeExtraction(match, hashFor, now);
  // F-001 still present (preserved) plus the new security feature.
  assert.ok(merged.some((f) => f.id === "F-001"));
});

// --- ripple: a brief change cascades into flags ---
const speced: Feature[] = mergeExtraction(
  matchByFingerprint([mkExtracted("Apply Security Patches", "Build")], []),
  () => "oldhash",
  now
).map((f) => ({ ...f, lifecycle: "speced" as const, specRef: "specs/F-001.json" }));

check("ripple: a moved source flags re-review and a stale spec", () => {
  const match = matchByFingerprint([mkExtracted("Apply Security Patches", "Build")], speced);
  const merged = mergeExtraction(match, () => "newhash", now);
  const { features, report } = applyRipple(merged, match, () => "newhash");
  assert.equal(features[0].flags.needsReanalysis, true);
  assert.equal(features[0].flags.stale, true);
  assert.deepEqual(report.changed, ["F-001"]);
  assert.deepEqual(report.staleSpecs, ["F-001"]);
});

check("ripple: an unchanged feature gets no flags", () => {
  const match = matchByFingerprint([mkExtracted("Apply Security Patches", "Build")], speced);
  const merged = mergeExtraction(match, () => "oldhash", now);
  const { features, report } = applyRipple(merged, match, () => "oldhash");
  assert.equal(features[0].flags.needsReanalysis, false);
  assert.equal(features[0].flags.stale, false);
  assert.equal(report.changed.length, 0);
});

check("ripple: a dropped feature is flagged orphaned but kept with its state", () => {
  const match = matchByFingerprint([mkExtracted("Some Other Feature", "X")], speced);
  const merged = mergeExtraction(match, () => "oldhash", now);
  const { features, report } = applyRipple(merged, match, () => "oldhash");
  const sec = features.find((f) => f.title === "Apply Security Patches");
  assert.ok(sec);
  assert.equal(sec!.flags.orphaned, true);
  assert.equal(sec!.lifecycle, "speced"); // execution state preserved, not deleted
  assert.deepEqual(report.orphaned, ["F-001"]);
});

check("ripple: a returning feature clears the orphaned flag", () => {
  const orphaned: Feature[] = speced.map((f) => ({ ...f, flags: { ...f.flags, orphaned: true } }));
  const match = matchByFingerprint([mkExtracted("Apply Security Patches", "Build")], orphaned);
  const merged = mergeExtraction(match, () => "oldhash", now);
  const { features } = applyRipple(merged, match, () => "oldhash");
  assert.equal(features[0].flags.orphaned, false);
});

// --- scores ---
check("attachScores stamps deterministic priority and formula version", () => {
  const scored = [
    {
      id: "F-001",
      impact: { score: 8, factors: ["core"] },
      effort: { score: 3, factors: ["small"] },
      risk: { score: 2, factors: ["low"] },
      urgency: { factor: 1.5 as const, reason: "sla" },
      priority: computePriority({ impact: 8, effort: 3, risk: 2, urgency: 1.5 }),
    },
  ];
  const withScores = attachScores(existing, scored, now);
  assert.equal(withScores[0].score?.priority, 24);
  assert.equal(withScores[0].score?.formulaVersion, 1);
});

// --- gates ---
check("passGate marks a gate passed with attribution", () => {
  const p = passGate(initProject("X", now), "queueApproved", "ria", now);
  assert.equal(p.gates.queueApproved.passed, true);
  assert.equal(p.gates.queueApproved.by, "ria");
});
check("resetGate clears a passed gate and is a no-op when already open", () => {
  const passed = passGate(initProject("X", now), "queueApproved", "ria", now);
  assert.equal(resetGate(passed, "queueApproved", now).gates.queueApproved.passed, false);
  const open = initProject("X", now);
  assert.equal(resetGate(open, "queueApproved", now), open); // unchanged reference
});

// --- status projection ---
check("renderStatus surfaces the actions awaiting a human", () => {
  const stale: Feature = { ...speced[0], flags: { ...speced[0].flags, stale: true } };
  const txt = renderStatus(
    [stale],
    initProject("SwissBelhotel", now),
    [{ ts: now, actor: "system", type: "drift-detected", target: "F-001", summary: "spec stale" }],
    [{ id: "Q1", text: "API docs?", priority: 1, status: "open", unblocks: ["F-008"] }]
  );
  assert.ok(txt.includes("Awaiting you"));
  assert.ok(txt.includes("/recipe F-001"), "should tell the human to regenerate the stale spec");
  assert.ok(txt.includes("/prep --approve"), "should prompt to approve the queue");
  assert.ok(txt.includes("open client question"), "should surface open questions");
});

// --- client-questions parsing ---
const QMD = `# Client Questions

## Priority 1 ( Blocks Task Breakdown )

### Q1: Bookingwizz Loyalty API Access
**Question:** Do you have API docs for the Loyalty API?
**Blocks:** F-008 POC Bookingwizz

### Q2: Current Issue Backlog
**Question:** Any known bugs to prioritize?
**Blocks:** F-001

## Priority 2 ( Affects Planning )

### Q4: Report Format
**Question:** Preferred monthly report format?
**Impact:** F-006, F-013

## Answered

### Q3: Slack Channel ✓
**Question:** Which channel for support?
**Answer:** #swissbel-support
`;

check("parseClientQuestions extracts ids, priority, and unblocks", () => {
  const qs = parseClientQuestions(QMD);
  const q1 = qs.find((q) => q.id === "Q1");
  assert.equal(q1?.priority, 1);
  assert.equal(q1?.status, "open");
  assert.deepEqual(q1?.unblocks, ["F-008"]);
  const q4 = qs.find((q) => q.id === "Q4");
  assert.equal(q4?.priority, 2);
  assert.deepEqual(q4?.unblocks, ["F-006", "F-013"]);
});

check("parseClientQuestions detects answered questions and captures the answer", () => {
  const qs = parseClientQuestions(QMD);
  const q3 = qs.find((q) => q.id === "Q3");
  assert.equal(q3?.status, "answered");
  assert.equal(q3?.answer, "#swissbel-support");
});

// --- I/O round-trips on a temp dir ---
const dir = mkdtempSync(join(tmpdir(), "sandwich-reg-"));
try {
  check("project round-trips through disk with validation", () => {
    const p = initProject("SwissBelhotel", now);
    writeProject(dir, p);
    const back = readProject(dir);
    assert.equal(back?.name, "SwissBelhotel");
    assert.equal(back?.schemaVersion, 1);
    assert.equal(back?.gates.queueApproved.passed, false);
  });

  check("features round-trip and defaults are applied on read", () => {
    writeFeatures(dir, existing);
    const back = readFeatures(dir);
    assert.equal(back.length, 1);
    assert.equal(back[0].id, "F-001");
    assert.deepEqual(back[0].flags, { needsReanalysis: false, stale: false, orphaned: false });
  });

  check("journal is append-only and replays in order", () => {
    appendJournal(dir, { ts: now, actor: "system", type: "feature-added", target: "F-001", summary: "added" });
    appendJournal(dir, { ts: now, actor: "ria", type: "override-set", target: "F-001", summary: "pinned" });
    const events = readJournal(dir);
    assert.equal(events.length, 2);
    assert.equal(events[0].type, "feature-added");
    assert.equal(events[1].actor, "ria");
  });

  check("writing an invalid feature is rejected by schema", () => {
    assert.throws(() => writeFeatures(dir, [{ id: "BAD" } as unknown as Feature]));
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${n} checks passed.`);
