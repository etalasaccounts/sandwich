// Self-check for the registry layer — identity preservation is the core promise.
// Run: node --experimental-strip-types registry/registry.selfcheck.ts
// Plain asserts, no framework. Exits non-zero on first failure.
import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
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
  markFeatureDone,
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
  readQuestions,
  appendJournal,
  readJournal,
  renderStatus,
  renderFeatureQueue,
  canonicalizeRegistryContent,
  gateRegistryWrite,
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
check("markFeatureDone sets lifecycle done and merges commits without duplicates", () => {
  const before: Feature = { ...speced[0], commits: ["abc111"] };
  const after = markFeatureDone(before, ["abc111", "def222"], "2026-07-03T00:00:00.000Z");
  assert.equal(after.lifecycle, "done");
  assert.deepEqual(after.commits, ["abc111", "def222"]);
  assert.equal(after.updatedAt, "2026-07-03T00:00:00.000Z");
  assert.equal(before.lifecycle, "speced", "input feature must not be mutated");
});
check("markFeatureDone with no commits leaves commits array untouched", () => {
  const before: Feature = { ...speced[0], commits: ["abc111"], lifecycle: "queued" };
  const after = markFeatureDone(before, [], "2026-07-03T00:00:00.000Z");
  assert.deepEqual(after.commits, ["abc111"]);
  assert.equal(after.lifecycle, "done");
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
  assert.ok(txt.includes("F-001"), "should surface the stale spec feature id");
  assert.ok(txt.includes("/prep --approve"), "should prompt to approve the queue");
  assert.ok(txt.includes("open client question"), "should surface open questions");
});

check("renderStatus surfaces completeness audit findings", () => {
  const txt = renderStatus(
    speced,
    initProject("X", now),
    [],
    [],
    { missingSpecs: ["F-004", "F-007"], missingDecisionTargets: ["D2"], readyToMarkDone: ["F-009"] }
  );
  assert.ok(txt.includes("F-004, F-007"), "should list features missing specs");
  assert.ok(txt.includes("D2"), "should list unrecorded decisions");
  assert.ok(txt.includes("F-009"), "should list features ready to mark done");
  assert.ok(txt.includes("/prep --done"), "should prompt the command to close it out");
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

// --- Defensive reads: normalization of rogue LLM output ---
const roguedir = mkdtempSync(join(tmpdir(), "sandwich-rogue-"));
const rogueReg = join(roguedir, ".sandwich", "registry");
mkdirSync(rogueReg, { recursive: true });

try {
  check("readFeatures unwraps { features: [...] } wrapper", () => {
    writeFileSync(join(rogueReg, "features.json"), JSON.stringify({
      features: [
        {
          id: "F-001", fingerprint: "abc123", title: "Test Feature", type: "feature",
          module: "Core", confidence: "stated", lifecycle: "proposed",
          provenance: { file: "prd.md", briefHash: "hash1" },
          createdAt: now, updatedAt: now,
        },
      ],
    }));
    const result = readFeatures(roguedir);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "F-001");
  });

  check("readFeatures normalizes LLM-invented field names and fills defaults", () => {
    writeFileSync(join(rogueReg, "features.json"), JSON.stringify([
      {
        id: "F-002", title: "Add Sentry", confidence_marker: "[inferred]",
        lifecycle: { status: "blocked", blocked_by: ["Q2"] },
        source: { file: "technical-notes.md", line_range: [118, 125], context: "no crash reporting" },
        scores: { impact: 8, effort: 3, risk: 3, urgency: 7 },
      },
    ]));
    const result = readFeatures(roguedir);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "F-002");
    assert.equal(result[0].lifecycle, "proposed");
    assert.equal(result[0].confidence, "inferred");
    assert.equal(result[0].module, "General");
    assert.equal(result[0].type, "feature");
    assert.ok(result[0].fingerprint.length > 0);
    assert.equal(result[0].provenance.file, "technical-notes.md");
    assert.equal(result[0].provenance.lines, "118-125");
  });

  check("readFeatures skips items that cannot be salvaged", () => {
    writeFileSync(join(rogueReg, "features.json"), JSON.stringify({
      features: [
        { id: "F-001", title: "Good", type: "feature", module: "X", confidence: "stated",
          lifecycle: "proposed", fingerprint: "fp1", provenance: { file: "a.md", briefHash: "h" },
          createdAt: now, updatedAt: now },
        { garbage: true },
        42,
      ],
    }));
    const result = readFeatures(roguedir);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "F-001");
  });

  check("readProject normalizes snake_case LLM project and fills schema defaults", () => {
    writeFileSync(join(rogueReg, "project.json"), JSON.stringify({
      name: "SwissBelhotel Maintenance",
      slug: "swissbelhotel",
      brief_path: "docs/sandwich",
      brief_hashes: { "prd.md": "v1" },
      mode: "maintenance",
      gates: { brief_complete: true, questions_answered: false },
      created_at: "2026-06-29T00:00:00.000Z",
    }));
    const result = readProject(roguedir);
    assert.ok(result !== null);
    assert.equal(result!.name, "SwissBelhotel Maintenance");
    assert.equal(result!.schemaVersion, 1);
    assert.equal(result!.gates.briefApproved.passed, false);
    assert.equal(result!.gates.queueApproved.passed, false);
    assert.equal(result!.createdAt, "2026-06-29T00:00:00.000Z");
  });

  check("readProject returns null for completely unsalvageable data", () => {
    writeFileSync(join(rogueReg, "project.json"), JSON.stringify({ garbage: true }));
    const result = readProject(roguedir);
    assert.equal(result, null);
  });

  check("readQuestions normalizes question→text, blocks→unblocks, null answers", () => {
    writeFileSync(join(rogueReg, "questions.json"), JSON.stringify({
      questions: [
        { id: "Q1", priority: 1, question: "Warranty end date?", blocks: ["F-001"],
          answer: null, answered_at: null, answered_by: null },
      ],
    }));
    const result = readQuestions(roguedir);
    assert.equal(result.length, 1);
    assert.equal(result[0].text, "Warranty end date?");
    assert.equal(result[0].status, "open");
    assert.deepEqual(result[0].unblocks, ["F-001"]);
    assert.equal(result[0].answer, undefined);
  });

  check("readJournal normalizes timestamp→ts, action→type, agent→actor, details→summary", () => {
    writeFileSync(join(rogueReg, "journal.jsonl"), [
      JSON.stringify({ timestamp: now, action: "feature-added", agent: "prep", details: "Added F-001" }),
      JSON.stringify({ timestamp: now, action: "reconciled", agent: "system", details: "3 matched" }),
    ].join("\n") + "\n");
    const result = readJournal(roguedir);
    assert.equal(result.length, 2);
    assert.equal(result[0].ts, now);
    assert.equal(result[0].actor, "prep");
    assert.equal(result[0].type, "feature-added");
    assert.equal(result[0].summary, "Added F-001");
  });

  check("readJournal skips lines that cannot be normalized", () => {
    writeFileSync(join(rogueReg, "journal.jsonl"), [
      JSON.stringify({ ts: now, actor: "system", type: "feature-added", summary: "good" }),
      JSON.stringify({ garbage: true }),
      "not-json",
    ].join("\n") + "\n");
    const result = readJournal(roguedir);
    assert.equal(result.length, 1);
    assert.equal(result[0].summary, "good");
  });
} finally {
  rmSync(roguedir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Write gate — the deterministic guarantee for runtimes (Pi) that write the
// registry directly without executing the validated workflow. Pure, no disk.
// ---------------------------------------------------------------------------

check("gate recomputes feature priority from dimensions, ignoring the model's number", () => {
  const raw = JSON.stringify([
    {
      id: "F-001",
      title: "User auth flow",
      module: "Auth",
      confidence: "stated",
      status: "ready", // wrong: not a lifecycle value
      scores: { impact: 9, effort: 5, risk: 3, urgency: 1.5 }, // wrong: plural key, flat dims
      priorityScore: 999, // bogus number the model invented
    },
  ]);
  const res = canonicalizeRegistryContent("features.json", raw);
  assert.equal(res.ok, true);
  const parsed = JSON.parse((res as { content: string }).content);
  assert.equal(parsed[0].lifecycle, "proposed");
  assert.equal(parsed[0].score.priority, computePriority({ impact: 9, effort: 5, risk: 3, urgency: 1.5 }));
  assert.notEqual(parsed[0].score.priority, 999);
  assert.equal(parsed[0].score.formulaVersion, 1);
});

check("gate unwraps a { features: [...] } wrapper object", () => {
  const raw = JSON.stringify({
    features: [{ id: "F-002", title: "Export", module: "Reports", confidence: "inferred" }],
  });
  const res = canonicalizeRegistryContent("features.json", raw);
  assert.equal(res.ok, true);
  const parsed = JSON.parse((res as { content: string }).content);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, "F-002");
});

check("gate blocks an out-of-domain urgency factor with a precise error", () => {
  const raw = JSON.stringify([
    {
      id: "F-001",
      title: "User auth",
      module: "Auth",
      confidence: "stated",
      score: { impact: 9, effort: 5, risk: 3, urgency: 10 }, // 10 is not a valid multiplier
    },
  ]);
  const res = canonicalizeRegistryContent("features.json", raw);
  assert.equal(res.ok, false);
  assert.ok((res as { errors: string[] }).errors.some((e) => /urgency|factor/i.test(e)));
});

check("gate blocks a feature with no title and names the file", () => {
  const raw = JSON.stringify([{ id: "F-001", module: "Auth", confidence: "stated" }]);
  const res = canonicalizeRegistryContent("features.json", raw);
  assert.equal(res.ok, false);
  assert.ok((res as { errors: string[] }).errors.some((e) => e.includes("features.json")));
});

check("gate normalizes question id, question→text, blocksFeature→unblocks", () => {
  const raw = JSON.stringify([
    { id: "Q-001", question: "What is the deadline?", priority: 1, blocksFeature: ["F-005"] },
  ]);
  const res = canonicalizeRegistryContent("questions.json", raw);
  assert.equal(res.ok, true);
  const parsed = JSON.parse((res as { content: string }).content);
  assert.equal(parsed[0].id, "Q1");
  assert.equal(parsed[0].text, "What is the deadline?");
  assert.deepEqual(parsed[0].unblocks, ["F-005"]);
  assert.equal(parsed[0].status, "open");
});

check("gate normalizes journal field names, blocks lines it cannot salvage", () => {
  const good = JSON.stringify({ timestamp: "2026-06-29T00:00:00.000Z", action: "feature-added", agent: "system", details: "ok" });
  const okRes = canonicalizeRegistryContent("journal.jsonl", good + "\n");
  assert.equal(okRes.ok, true);
  assert.ok((okRes as { content: string }).content.includes('"ts"'));
  assert.ok((okRes as { content: string }).content.includes('"type":"feature-added"'));

  const bad = canonicalizeRegistryContent("journal.jsonl", good + "\nnot-json\n");
  assert.equal(bad.ok, false);
});

check("gateRegistryWrite passes through non-registry paths untouched", () => {
  const d = gateRegistryWrite("docs/sandwich/prd.md", "# Hello");
  assert.equal(d.action, "allow");
});

check("gateRegistryWrite rewrites a registry path to canonical content", () => {
  const content = JSON.stringify([
    { id: "F-001", title: "Auth", module: "Auth", confidence: "stated", scores: { impact: 8, effort: 2, risk: 2, urgency: 1.0 } },
  ]);
  const d = gateRegistryWrite("/proj/.sandwich/registry/features.json", content);
  assert.equal(d.action, "rewrite");
  const parsed = JSON.parse((d as { content: string }).content);
  assert.equal(parsed[0].score.priority, computePriority({ impact: 8, effort: 2, risk: 2, urgency: 1.0 }));
});

check("gateRegistryWrite blocks an unsalvageable registry write", () => {
  const d = gateRegistryWrite("/proj/.sandwich/registry/features.json", "{ not json");
  assert.equal(d.action, "block");
  assert.ok((d as { reason: string }).reason.includes("features.json"));
});

// --- feature queue projection: spec links, no inline details ---
check("renderFeatureQueue links specs and drops the Details section", () => {
  const dir = mkdtempSync(join(tmpdir(), "sandwich-queue-"));
  renderFeatureQueue(dir, speced, initProject("X", now));
  const md = readFileSync(join(dir, "docs", "sandwich", "feature-queue.md"), "utf8");
  assert.ok(md.includes("| Spec |"), "queue table should have a Spec column");
  assert.ok(md.includes(`[specs/${speced[0].id}.md](specs/${speced[0].id}.md)`), "row should link the spec file");
  assert.ok(!md.includes("## Details"), "inline Details section should be gone");
});

console.log(`\n${n} checks passed.`);
