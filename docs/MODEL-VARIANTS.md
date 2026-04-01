# Model Variants

OpenCode's variant system allows you to configure thinking budget dynamically instead of defining separate models for each thinking level.

---

## How Variants Work

When you define a model with `variants`, OpenCode shows variant options in the model picker. Selecting a variant passes the `providerOptions` to the plugin, which extracts the thinking configuration.

```bash
opencode run "Hello" --model=google/antigravity-claude-opus-4-6-thinking --variant=max
```

---

## Variant Configuration

Define variants in your model configuration:

```json
{
  "antigravity-claude-opus-4-6-thinking": {
    "name": "Claude Opus 4.6 Thinking",
    "limit": { "context": 200000, "output": 64000 },
    "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
    "variants": {
      "low": { "thinkingConfig": { "thinkingBudget": 8192 } },
      "max": { "thinkingConfig": { "thinkingBudget": 32768 } }
    }
  }
}
```

---

## Supported Variant Formats

The plugin accepts different variant formats depending on the model family:

| Model Family | Variant Format | Example |
|--------------|----------------|---------|
| **Claude** | `thinkingConfig.thinkingBudget` | `{ "thinkingConfig": { "thinkingBudget": 8192 } }` |
| **Gemini 3** | `thinkingLevel` | `{ "thinkingLevel": "high" }` |
| **Gemini 2.5** | `thinkingConfig.thinkingBudget` | `{ "thinkingConfig": { "thinkingBudget": 8192 } }` |

---

## Gemini 3 Thinking Levels

Gemini 3 models use string-based thinking levels. Available levels differ by model:

| Level | Flash | Pro (3.1) | Description |
|-------|-------|-------------|-------------|
| `minimal` | ✅ | ❌ | Minimal thinking, lowest latency |
| `low` | ✅ | ✅ | Light thinking |
| `medium` | ✅ | ❌ | Balanced thinking |
| `high` | ✅ | ✅ | Maximum thinking (default) |

> **Note:** The API rejects invalid levels (e.g., `"minimal"` on Pro). Configure variants accordingly.

### Gemini 3 Flash Example

```json
{
  "antigravity-gemini-3-flash": {
    "name": "Gemini 3 Flash (Antigravity)",
    "limit": { "context": 1048576, "output": 65536 },
    "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
    "variants": {
      "minimal": { "thinkingLevel": "minimal" },
      "low": { "thinkingLevel": "low" },
      "medium": { "thinkingLevel": "medium" },
      "high": { "thinkingLevel": "high" }
    }
  }
}
```

---

## Claude Thinking Budget

Claude models use token-based thinking budgets:

| Model | Variants | Budgets |
|-------|----------|---------|
| `antigravity-claude-opus-4-6-thinking` | `low`, `medium`, `high`, `max` | 8192, 16384, 32768, 65536 |
| `antigravity-claude-sonnet-4-6-thinking` | `low`, `medium`, `high` | 8192, 16384, 32768 |

### Claude Example

```json
{
  "antigravity-claude-sonnet-4-6-thinking": {
    "name": "Claude Sonnet 4.6 Thinking (Antigravity)",
    "limit": { "context": 200000, "output": 64000 },
    "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
    "variants": {
      "low": { "thinkingConfig": { "thinkingBudget": 8192 } },
      "medium": { "thinkingConfig": { "thinkingBudget": 16384 } },
      "high": { "thinkingConfig": { "thinkingBudget": 32768 } }
    }
  },
  "antigravity-claude-opus-4-6-thinking": {
    "name": "Claude Opus 4.6 Thinking (Antigravity)",
    "limit": { "context": 200000, "output": 64000 },
    "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
    "variants": {
      "low": { "thinkingConfig": { "thinkingBudget": 8192 } },
      "medium": { "thinkingConfig": { "thinkingBudget": 16384 } },
      "high": { "thinkingConfig": { "thinkingBudget": 32768 } },
      "max": { "thinkingConfig": { "thinkingBudget": 65536 } }
    }
  }
}
```

You can define custom budgets:

```json
{
  "variants": {
    "minimal": { "thinkingConfig": { "thinkingBudget": 4096 } },
    "low": { "thinkingConfig": { "thinkingBudget": 8192 } },
    "medium": { "thinkingConfig": { "thinkingBudget": 16384 } },
    "high": { "thinkingConfig": { "thinkingBudget": 24576 } },
    "max": { "thinkingConfig": { "thinkingBudget": 32768 } }
  }
}
```

---

## Legacy Budget Format (Deprecated)

For Gemini 3 models, the old `thinkingBudget` format is still supported but deprecated:

| Budget Range | Maps to Level |
|--------------|---------------|
| ≤ 8192 | low |
| ≤ 16384 | medium |
| > 16384 | high |

**Recommended:** Use `thinkingLevel` directly for Gemini 3 models.

---

## Tier-Suffixed Names

Tier-suffixed model names are still accepted:

- `antigravity-claude-opus-4-6-thinking-low`
- `antigravity-claude-opus-4-6-thinking-medium`
- `antigravity-claude-opus-4-6-thinking-high`
- `antigravity-claude-opus-4-6-thinking-max`
- `antigravity-claude-sonnet-4-6-thinking-low`
- `antigravity-claude-sonnet-4-6-thinking-medium`
- `antigravity-claude-sonnet-4-6-thinking-high`
- `gemini-3-flash-medium`

However, **we recommend using simplified model names with variants** for:

- **Cleaner model picker** — 7 models instead of 12+
- **Simpler config** — No need to configure both `antigravity-` and `-preview` versions
- **Automatic quota routing** — Plugin handles model name transformation
- **Flexible budgets** — Define any budget, not just preset tiers
- **Future-proof** — Works with OpenCode's native variant system

---

## Benefits of Variants

| Before (tier-suffixed) | After (variants) |
|------------------------|------------------|
| 12+ separate models | 4 models with variants |
| Fixed thinking budgets | Customizable budgets |
| Cluttered model picker | Clean model picker |
| Hard to add new tiers | Easy to add new variants |
