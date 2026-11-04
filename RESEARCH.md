# ZC CODE — Deep Research Summary

## Sources reviewed
- OpenCode CLI: https://github.com/anomalyco/opencode, https://opencode.ai/docs/
- Anthropic: https://docs.anthropic.com/
- Google Gemini: https://ai.google.dev/
- OpenAI: https://platform.openai.com/docs/
- Model Context Protocol: https://modelcontextprotocol.io/
- NVIDIA NIM: https://docs.nvidia.com/
- Gemini CLI: https://github.com/google-gemini/gemini-cli

## Key architectural takeaways (independently re-implemented, not copied)

### OpenCode CLI
- Client/server architecture with a terminal UI (React Ink).
- Agent-based: assistant plans, calls tools, observes results, iterates.
- Provider abstraction with model selection and API-key auth.
- MCP client for local STDIO and remote servers.
- Permission system with allow/ask/deny for tool execution.
- Session persistence and context management.
- Plugins and skills for extensibility.
- Configuration under `~/.opencode/`.

### Claude Code
- Agentic coding: file editing (read/write/edit), terminal execution, grep/glob.
- Subagent delegation: main agent spawns research/coding/testing subagents.
- Permission handling per tool with user approval.
- Context window management and summarization.
- Git-aware (diff, status, commit).

### Gemini CLI
- Provider integration (Google Gemini) with tool use and extensions.
- MCP support (STDIO + HTTP).
- Terminal-first experience with streaming.

### Model providers
- OpenAI: Chat Completions / Responses API, tool calling, streaming SSE.
- Anthropic: Messages API, tool use, system prompts, streaming.
- Google Gemini: generateContent / streamGenerateContent, function calling, safety settings.
- OpenRouter / NVIDIA NIM / Groq / DeepSeek / Together / Cerebras: OpenAI-compatible chat completions base URLs.
- Mistral: chat API with tool calling.
- Ollama / LM Studio: local OpenAI-compatible endpoints (`/api/chat`, `/v1/chat/completions`).
- Custom OpenAI-compatible endpoints: user-defined base URL + API key.

### Model Context Protocol (MCP)
- JSON-RPC 2.0 over STDIO or Streamable HTTP.
- Client sends `initialize`, server returns capabilities.
- Tool discovery: `tools/list`; execution: `tools/call`.
- Resource discovery: `resources/list`, `resources/read`.
- Prompts: `prompts/list`, `prompts/get`.
- OAuth and API-key auth for remote servers.
- Connection lifecycle: initialize → capability negotiation → requests → shutdown.
- Error handling via JSON-RPC error codes.

## Design decisions derived from research
1. Unified provider interface (normalize OpenAI/Anthropic/Gemini/Ollama to common message + tool-call format).
2. Capability metadata per model (do NOT claim tool calling or multimodal unless supported).
3. Permission engine with ALLOW/ASK/DENY and interactive approval.
4. MCP client with STDIO + Streamable HTTP; treat MCP content as untrusted.
5. File-system + terminal + git built-in tools, actually executed (not faked).
6. SQLite session storage via sql.js (no native deps for Termux).
7. Ink TUI for streaming chat + approval prompts.
8. One-command installer for Termux/Linux ARM64.
