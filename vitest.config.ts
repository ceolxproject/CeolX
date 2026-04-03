import { defineConfig } from 'vitest/config';

// Worktree-level vitest config. Prevents vitest from traversing up to the parent
// repo's vitest.config.ts (which references apps/admin/vitest.config.ts that does
// not exist in this worktree). Each package runs its own `vitest run` from its
// own directory — this root config is just a traversal stop.
export default defineConfig({
  test: {
    environment: 'node',
  },
});
