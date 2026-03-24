import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = import.meta.dirname;

const META_SCOPES = [
  "deps",
  "ci",
  "docs",
  "release",
  "claude",
  "agents",
  "stack",
];

function getWorkspaceScopes() {
  const dirs = (dir) => {
    try {
      return readdirSync(resolve(ROOT, dir), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
    } catch {
      return [];
    }
  };

  const appScopes = dirs("apps");
  const appScopeSet = new Set(appScopes);

  const packageScopes = dirs("packages").map((name) =>
    appScopeSet.has(name) ? `${name}-pkg` : name,
  );

  return [...appScopes, ...packageScopes];
}

const scopes = [...getWorkspaceScopes(), ...META_SCOPES];

/** @type {import('cz-git').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  // Parser preset to support emoji prefixes in commit messages
  parserPreset: {
    parserOpts: {
      headerPattern:
        /^(?:(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)|:[a-z_]+:)\s*(\w+)(?:\(([^)]*)\))?:\s*(.+)$/u,
      headerCorrespondence: ["type", "scope", "subject"],
    },
  },
  // cz-git prompt configuration (read directly from commitlint config)
  prompt: {
    alias: {
      fd: "docs: fix typos",
      ur: "docs: update README",
    },
    messages: {
      type: "Select the type of change you're committing:",
      scope: "Denote the scope of this change:",
      customScope: "Denote the scope of this change:",
      subject: "Write a short, imperative description of the change:\n",
      body: 'Provide a longer description of the change (optional). Use "|" to break new line:\n',
      breaking:
        'List any BREAKING CHANGES (optional). Use "|" to break new line:\n',
      footerPrefixSelect: "Select the ISSUES type of change (optional):",
      customFooterPrefix: "Input ISSUES prefix:",
      footer:
        "List any ISSUES affected by this change (optional). E.g.: #31, #34:\n",
      confirmCommit: "Are you sure you want to proceed with the commit above?",
    },
    types: [
      {
        value: "feat",
        name: "feat:     ✨ A new feature",
        emoji: ":sparkles:",
      },
      { value: "fix", name: "fix:      🐛 A bug fix", emoji: ":bug:" },
      {
        value: "docs",
        name: "docs:     📝 Documentation changes",
        emoji: ":memo:",
      },
      {
        value: "style",
        name: "style:    💄 Code style changes",
        emoji: ":lipstick:",
      },
      {
        value: "refactor",
        name: "refactor: ♻️  Code refactoring",
        emoji: ":recycle:",
      },
      {
        value: "perf",
        name: "perf:     ⚡️ Performance improvements",
        emoji: ":zap:",
      },
      {
        value: "test",
        name: "test:     ✅ Adding or updating tests",
        emoji: ":white_check_mark:",
      },
      {
        value: "build",
        name: "build:    📦 Build system changes",
        emoji: ":package:",
      },
      {
        value: "ci",
        name: "ci:       🎡 CI configuration changes",
        emoji: ":ferris_wheel:",
      },
      { value: "chore", name: "chore:    🔧 Other changes", emoji: ":wrench:" },
      {
        value: "revert",
        name: "revert:   ⏪ Reverting changes",
        emoji: ":rewind:",
      },
    ],
    useEmoji: true,
    emojiAlign: "left",
    useAI: false,
    scopes,
    allowCustomScopes: false,
    allowEmptyScopes: false,
    allowBreakingChanges: ["feat", "fix"],
    breaklineNumber: 100,
    allowCustomIssuePrefix: false,
    allowEmptyIssuePrefix: true,
  },
  rules: {
    // Type must be one of the conventional types
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    // Scope must be a known workspace or meta scope
    "scope-enum": [2, "always", scopes],
    // Subject should not be empty
    "subject-empty": [2, "never"],
    // Type should not be empty
    "type-empty": [2, "never"],
    // Scope should not be empty
    "scope-empty": [2, "never"],
    // Subject should be lowercase
    "subject-case": [2, "always", "lower-case"],
    // Header max length
    "header-max-length": [2, "always", 100],
  },
};
