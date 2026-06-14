import { format } from "prettier/standalone";
import * as prettierPluginYaml from "prettier/plugins/yaml";

/**
 * Lightweight synchronous heuristic for whether a string looks like valid YAML.
 * Used to gate expensive diff computation — avoids sending obviously broken
 * YAML to the backend while the user is still typing.
 *
 * Empty/whitespace is considered valid (means "use chart defaults, no overrides").
 *
 * This is intentionally permissive — the backend (helm template) is the
 * source of truth for actual YAML validity.
 */
export function isLikelyValidYaml(value: string): boolean {
  // Empty values are valid — "use chart defaults, no overrides"
  if (!value.trim()) {
    return true;
  }

  // YAML forbids tab characters for indentation — the most common typo
  if (/\t/.test(value)) {
    return false;
  }

  return true;
}

/**
 * Format a YAML string using Prettier (runs entirely client-side).
 *
 * Returns the original value untouched when it is empty.
 */
export async function formatYaml(value: string): Promise<string> {
  if (!value.trim()) {
    return value;
  }

  return format(value, {
    parser: "yaml",
    plugins: [prettierPluginYaml],
  });
}
