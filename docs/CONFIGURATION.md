# Configuration

Create `~/.config/opencode/antigravity.json` (or `.opencode/antigravity.json` in project root):

```json
{
  "$schema": "https://raw.githubusercontent.com/insign/opencode-antigravity-auth-updated/main/assets/antigravity.schema.json"
}
```

Most settings have sensible defaults — only configure what you need.

---

## Quick Start

**Minimal config (recommended for most users):**

```json
{
  "$schema": "https://raw.githubusercontent.com/insign/opencode-antigravity-auth-updated/main/assets/antigravity.schema.json"
}
```

**With web search enabled:**

The plugin provides a `google_search` tool that the model can call to search the web. No configuration is needed - the tool is always available.

---

## Model Behavior

Settings that affect how the model thinks and responds.

| Option | Default | Description |
|--------|---------|-------------|
| `keep_thinking` | `false` | Preserve Claude's thinking blocks across turns. **Warning:** enabling may degrade model stability. |
| `session_recovery` | `true` | Auto-recover from tool_result_missing errors |
| `auto_resume` | `false` | Auto-send resume prompt after recovery |
| `resume_text` | `"continue"` | Text to send when auto-resuming |

> **Note:** The `web_search` config options are deprecated. Google Search is now implemented as a dedicated `google_search` tool that the model can call explicitly.

---

## Antigravity SDK And Model Discovery

PR #576 added the Antigravity SDK / Gemini API-key path and runtime model discovery. Most users can keep the defaults: OAuth accounts still route Antigravity and Claude models, while configured API keys can serve Gemini models such as `gemini-3.5-flash` or act as fallback capacity when OAuth quotas are exhausted.

| Option | Default | Description |
|--------|---------|-------------|
| `agy_sdk.enabled` | `true` | Enable the Gemini API-key request path used by the Antigravity SDK style. |
| `agy_sdk.prefer_for_gemini` | `false` | Prefer API-key projects for Gemini requests even when OAuth accounts are available. |
| `agy_sdk.api_key_fallback` | `true` | Use API-key projects when OAuth-backed Antigravity/Gemini CLI quota is unavailable. |
| `agy_sdk.cloud_projects` | `[]` | Optional pool of API keys and project IDs for Gemini API routing. |
| `model_discovery.enabled` | `true` | Add runtime-discovered models to OpenCode's provider list. |
| `model_discovery.gemini_api` | `true` | Include public Gemini API models discovered from API keys. |
| `model_discovery.antigravity` | `true` | Include OAuth-backed Antigravity models from the available-models API. |

Example API-key fallback pool:

```json
{
  "$schema": "https://raw.githubusercontent.com/insign/opencode-antigravity-auth-updated/main/assets/antigravity.schema.json",
  "agy_sdk": {
    "enabled": true,
    "api_key_fallback": true,
    "cloud_projects": [
      {
        "label": "gemini-api-primary",
        "api_key": "YOUR_GEMINI_API_KEY",
        "project_id": "your-google-cloud-project"
      }
    ]
  },
  "model_discovery": {
    "enabled": true,
    "gemini_api": true,
    "antigravity": true
  }
}
```

### About `keep_thinking`

When `true`, Claude's thinking blocks are preserved in conversation history:
- **Pros:** Model remembers its reasoning, more coherent across turns
- **Cons:** May degrade model stability, slightly larger context

When `false` (default), thinking is stripped:
- **Pros:** More stable model behavior, smaller context
- **Cons:** Model may be less coherent, forgets previous reasoning

---

### Google Search grounding models

The `google_search` tool resolves its model as an ordered chain instead of a
single hardcoded id: an explicit `search.model` override first, then the
newest live-discovered Gemini Flash model from the Antigravity model list,
then `search.fallback_models`, then the built-in last resort. Each model is
tried in order until one returns a grounded answer, so search survives
capacity-exhausted (`429`/`503`), removed (`404`), or retired (answered with a
"no longer available" message) models.

| Option | Default | Description |
|--------|---------|-------------|
| `search.enabled` | `true` | Master switch. When `false`, only `search.model` (or the built-in default) is used. |
| `search.model` | `null` | Pin a model id and try it before discovery. Example: `"gemini-3.6-flash-high"`. |
| `search.auto_discover` | `true` | Fetch the live model list and try the newest grounding-capable Flash model. |
| `search.preferred_tier` | `"high"` | Thinking tier (`minimal`, `low`, `medium`, `high`) preferred among discovered variants. |
| `search.fallback_models` | `["gemini-2.5-flash", "gemini-3-flash"]` | Static chain tried after the explicit and discovered models. |
| `search.discover_cache_seconds` | `300` | How long to cache the fetched model list. `0` disables caching. |

Example:

```json
{
  "search": {
    "preferred_tier": "medium",
    "fallback_models": ["gemini-2.5-flash", "gemini-3-flash"]
  }
}
```

Only bare Flash grounding ids are eligible (`gemini-3.6-flash-high`,
`gemini-3-flash`); non-grounding variants such as `-image`, `-lite`,
`-agent`, and `-tiered` are skipped automatically.

---

## Account Rotation

Settings for managing multiple Google accounts.

| Option | Default | Description |
|--------|---------|-------------|
| `account_selection_strategy` | `"hybrid"` | How to select accounts |
| `switch_on_first_rate_limit` | `true` | Switch account immediately on first 429 |
| `pid_offset_enabled` | `false` | Distribute sessions across accounts (for parallel agents) |
| `quota_fallback` | `false` | Deprecated (ignored). Kept for backward compatibility; Gemini fallback is automatic |

### Strategy Guide

| Your Setup | Recommended Strategy | Why |
|------------|---------------------|-----|
| **1 account** | `"sticky"` | No rotation needed, preserve prompt cache |
| **2-3 accounts** | `"hybrid"` (default) | Smart rotation with health scoring |
| **4+ accounts** | `"round-robin"` | Maximum throughput |
| **Parallel agents** | `"round-robin"` + `pid_offset_enabled: true` | Distribute across accounts |

### Available Strategies

| Strategy | Behavior | Best For |
|----------|----------|----------|
| `sticky` | Same account until rate-limited | Single account, prompt cache |
| `round-robin` | Rotate on every request | Maximum throughput |
| `hybrid` | Health score + token bucket + LRU | Smart distribution (default) |

---

## App Behavior

Settings that control plugin behavior.

| Option | Default | Description |
|--------|---------|-------------|
| `quiet_mode` | `false` | Hide toast notifications (except recovery) |
| `debug` | `false` | Enable debug logging |
| `log_dir` | OS default | Custom directory for debug logs |
| `auto_update` | `true` | Enable automatic plugin updates |

### Debug Logging

```json
{
  "debug": true,
  "debug_tui": true
}
```

Logs are written to `~/.config/opencode/antigravity-logs/` (or `log_dir` if set).

---

## Recommended Configs

Copy-paste ready configs with recommended settings pre-applied.

### 1 Account

```json
{
  "$schema": "https://raw.githubusercontent.com/insign/opencode-antigravity-auth-updated/main/assets/antigravity.schema.json",
  "account_selection_strategy": "sticky"
}
```

**Why these settings:**
- `sticky` — No rotation needed, preserves Anthropic prompt cache

### 2-3 Accounts

```json
{
  "$schema": "https://raw.githubusercontent.com/insign/opencode-antigravity-auth-updated/main/assets/antigravity.schema.json",
  "account_selection_strategy": "hybrid"
}
```

**Why these settings:**
- `hybrid` — Smart rotation using health scores, avoids bad accounts

### 3+ Accounts (Power Users / Parallel Agents)

```json
{
  "$schema": "https://raw.githubusercontent.com/insign/opencode-antigravity-auth-updated/main/assets/antigravity.schema.json",
  "account_selection_strategy": "round-robin",
  "switch_on_first_rate_limit": true,
  "pid_offset_enabled": true
}
```

**Why these settings:**
- `round-robin` — Maximum throughput, rotates every request
- `switch_on_first_rate_limit` — Immediately switch on 429 (default: true)
- `pid_offset_enabled` — Different sessions use different starting accounts

---

## What's Enabled by Default

These settings are already `true` by default — you don't need to set them:

| Setting | Default | What it does |
|---------|---------|--------------|
| `session_recovery` | `true` | Auto-recover from errors |
| `auto_update` | `true` | Keep plugin updated |
| `switch_on_first_rate_limit` | `true` | Fast account switching |

These settings are `false` by default:

| Setting | Default | What it does |
|---------|---------|--------------|
| `keep_thinking` | `false` | Preserve Claude thinking (may degrade stability) |
| `auto_resume` | `false` | Auto-continue after recovery |

---

## Advanced Settings

> These settings are for edge cases. Most users don't need to change them.

<details>
<summary><b>Error Recovery (internal)</b></summary>

| Option | Default | Description |
|--------|---------|-------------|
| `empty_response_max_attempts` | `4` | Retries for empty API responses |
| `empty_response_retry_delay_ms` | `2000` | Delay between retries |
| `tool_id_recovery` | `true` | Fix mismatched tool IDs from context compaction |
| `claude_tool_hardening` | `true` | Prevent tool parameter hallucination |
| `max_rate_limit_wait_seconds` | `300` | Max wait time when rate limited (0=unlimited) |

</details>

<details>
<summary><b>Token Management (internal)</b></summary>

| Option | Default | Description |
|--------|---------|-------------|
| `proactive_token_refresh` | `true` | Refresh tokens before expiry |
| `proactive_refresh_buffer_seconds` | `1800` | Refresh 30 min before expiry |
| `proactive_refresh_check_interval_seconds` | `300` | Check interval |

</details>

<details>
<summary><b>Signature Cache (internal)</b></summary>

Used when `keep_thinking: true`. Most users don't need to configure this.

| Option | Default | Description |
|--------|---------|-------------|
| `signature_cache.enabled` | `true` | Enable disk caching |
| `signature_cache.memory_ttl_seconds` | `3600` | In-memory cache TTL (1 hour) |
| `signature_cache.disk_ttl_seconds` | `172800` | Disk cache TTL (48 hours) |
| `signature_cache.write_interval_seconds` | `60` | Background write interval |

</details>

<details>
<summary><b>Health Score Tuning (internal)</b></summary>

Used by `hybrid` strategy. Most users don't need to configure this.

| Option | Default | Description |
|--------|---------|-------------|
| `health_score.initial` | `70` | Starting health score |
| `health_score.success_reward` | `1` | Points added on success |
| `health_score.rate_limit_penalty` | `-10` | Points removed on rate limit |
| `health_score.failure_penalty` | `-20` | Points removed on failure |
| `health_score.recovery_rate_per_hour` | `2` | Points recovered per hour |
| `health_score.min_usable` | `50` | Minimum score to use account |
| `health_score.max_score` | `100` | Maximum health score |

</details>

<details>
<summary><b>Token Bucket Tuning (internal)</b></summary>

Used by `hybrid` strategy. Most users don't need to configure this.

| Option | Default | Description |
|--------|---------|-------------|
| `token_bucket.max_tokens` | `50` | Maximum tokens in bucket |
| `token_bucket.regeneration_rate_per_minute` | `6` | Tokens regenerated per minute |
| `token_bucket.initial_tokens` | `50` | Starting tokens |

</details>
