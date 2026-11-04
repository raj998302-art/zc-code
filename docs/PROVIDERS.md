# Providers

ZC CODE supports multiple AI model providers. Each provider can have its own API key,
base URL, default model, and custom headers.

## Supported providers

| Provider | Type | Tool calling | Notes |
|----------|------|--------------|-------|
| OpenAI | OpenAI-compatible | Yes | https://api.openai.com/v1 |
| OpenRouter | OpenAI-compatible | Yes | https://openrouter.ai/api/v1 |
| NVIDIA NIM | OpenAI-compatible | Depends on model | https://integrate.api.nvidia.com/v1 |
| Groq | OpenAI-compatible | Depends on model | https://api.groq.com/openai/v1 |
| DeepSeek | OpenAI-compatible | Depends on model | https://api.deepseek.com |
| Together AI | OpenAI-compatible | Depends on model | https://api.together.xyz/v1 |
| Cerebras | OpenAI-compatible | Depends on model | https://api.cerebras.ai/v1 |
| LM Studio | OpenAI-compatible | No | Local, http://localhost:1234/v1 |
| Ollama | Native | No | Local, http://localhost:11434 |
| Anthropic | Native | Yes | https://api.anthropic.com |
| Google Gemini | Native | Yes | https://generativelanguage.googleapis.com |
| Custom | OpenAI-compatible | Depends on endpoint | User-defined base URL |

## Capability detection

ZC CODE does NOT assume every model supports tool calling or multimodal.
Capabilities are declared per-provider. Check with `zc models list` to see
which capabilities each model reports.

## Configure a provider

```bash
# OpenRouter
zc providers add openrouter --base-url https://openrouter.ai/api/v1 --api-key-env OPENROUTER_API_KEY

# NVIDIA NIM
zc providers add nvidia --base-url https://integrate.api.nvidia.com/v1 --api-key-env NVIDIA_API_KEY

# Ollama (local, no API key)
zc providers add ollama --base-url http://localhost:11434

# LM Studio (local, OpenAI-compatible)
zc providers add lmstudio --base-url http://localhost:1234/v1

# Custom endpoint
zc providers add myendpoint --base-url https://api.example.com/v1 --api-key-env MY_KEY
```

## Store API keys

```bash
# Via environment variable
export OPENROUTER_API_KEY=sk-or-...

# Via ZC CODE auth (stored in ~/.local/share/zc-code/auth/, obfuscated)
zc auth login openrouter
```

## Add models

```bash
zc models add openrouter/gpt-4o-mini --provider openrouter --name "GPT-4o Mini"
zc models add nemotron --provider nvidia --name "NVIDIA Nemotron"
zc models use openrouter/gpt-4o-mini --provider openrouter
```

## Custom models

Users can add newly released models without modifying core:

```bash
zc models add claude-3-5-sonnet-latest --provider anthropic --context 200000
```

## NVIDIA NIM setup

1. Get an API key from https://build.nvidia.com/
2. `zc providers add nvidia --base-url https://integrate.api.nvidia.com/v1 --api-key-env NVIDIA_API_KEY`
3. `export NVIDIA_API_KEY=nvapi-your-key`
4. `zc models add <model-id> --provider nvidia`
5. `zc models use <model-id> --provider nvidia`

## OpenRouter setup

1. Get an API key from https://openrouter.ai/keys
2. `zc providers add openrouter --base-url https://openrouter.ai/api/v1 --api-key-env OPENROUTER_API_KEY`
3. `export OPENROUTER_API_KEY=sk-or-...`
4. `zc models add <model-id> --provider openrouter`
5. `zc models use <model-id> --provider openrouter`
