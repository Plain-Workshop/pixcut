// Checks a pull request diff against the rules in AGENTS.md that tools can enforce.
// Usage: node scripts/pr-guards.mjs [base-ref]   (default: origin/main)
// Add `guard:allow` in a comment on a line to exempt it.
import { execFileSync } from "node:child_process";

const base = process.argv[2] ?? "origin/main";
const diff = execFileSync("git", ["diff", "--unified=0", "--no-color", `${base}...HEAD`], {
  encoding: "utf8",
  maxBuffer: 256 * 1024 * 1024,
});

const isTestFile = (f) => /(^|\/)(tests?|__tests__)(\/|\.rs$)|\.test\.[tj]sx?$/.test(f);
const allowedNetwork = [
  "desktop/src-tauri/src/online_music.rs",
  "desktop/src/stores/online-music.ts",
  "desktop/src/app/bridge.ts",
];

/** Added lines as { file, line, text }. */
function addedLines(text) {
  const out = [];
  let file = "";
  let line = 0;
  for (const raw of text.split("\n")) {
    if (raw.startsWith("+++ ")) file = raw.slice(4).replace(/^b\//, "");
    else if (raw.startsWith("@@")) line = Number(/\+(\d+)/.exec(raw)?.[1] ?? 0) - 1;
    else if (raw.startsWith("+")) out.push({ file, line: ++line, text: raw.slice(1) });
  }
  return out.filter((l) => !l.text.includes("guard:allow"));
}

const added = addedLines(diff);
const changed = new Set(added.map((l) => l.file));
const failures = [];
const warnings = [];

for (const l of added) {
  const rust = l.file.endsWith(".rs") && /^desktop\/(src-tauri|crates)\//.test(l.file);
  if (rust && !isTestFile(l.file) && /\.unwrap\(\)|\.expect\(|\bpanic!\(/.test(l.text)) {
    failures.push([l, "unwrap/expect/panic in non-test Rust. Return an error instead (AGENTS.md rule 1)."]);
  }
  const code = /^desktop\/(src|src-tauri\/src)\//.test(l.file) && /\.(rs|tsx?)$/.test(l.file);
  if (
    code &&
    !isTestFile(l.file) &&
    !allowedNetwork.includes(l.file) &&
    /\breqwest::|\bureq::|XMLHttpRequest|fetch\(\s*[`'"]https?:/.test(l.text)
  ) {
    failures.push([l, "network call outside the user-triggered update and music code (AGENTS.md rule 2)."]);
  }
}

const touches = (re) => [...changed].some((f) => re.test(f) && !isTestFile(f));
const ts = touches(/^desktop\/src\/stores\/model\.ts$/);
const rs = touches(/^desktop\/crates\/project\/src\//);
if (ts !== rs) {
  warnings.push(
    `${ts ? "model.ts" : "crates/project"} changed without ${ts ? "crates/project" : "model.ts"}. ` +
      "If the schema changed, update both with a migration (AGENTS.md rule 4).",
  );
}

for (const w of warnings) console.log(`::warning::${w}`);
for (const [l, why] of failures) console.log(`::error file=${l.file},line=${l.line}::${why}`);
if (failures.length) {
  console.error(`\n${failures.length} guard failure(s). Add "guard:allow" to a line only with a reason.`);
  process.exit(1);
}
console.log("PR guards passed.");
