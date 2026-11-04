/**
 * ZC CODE Terminal UI (Ink + React).
 * Dark theme with cyan/electric blue accents and purple highlights.
 * Gracefully degrades on non-TTY and small screens (Termux).
 *
 * Ink v5 does not export <Input> or <Spinner>, so we build a small custom
 * input using the useInput hook and a manual spinner.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import chalk from "chalk";

const ACCENT = "#00d9ff"; // cyan
const BLUE = "#4f8cff";   // electric blue
const PURPLE = "#b36bff"; // purple
const GREEN = "#5af78e";
const RED = "#ff5f77";
const DIM = "#888888";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: Array<{ name: string; args: unknown; ok: boolean; output?: any; error?: string }>;
  loading?: boolean;
  error?: boolean;
}

export interface TUIProps {
  provider: string;
  model: string;
  agent: string;
  project: string;
  onSubmit: (message: string, onChunk?: (chunk: string) => void) => Promise<void>;
  onApproval?: (tool: string, args: unknown) => Promise<"allow-once" | "always" | "deny">;
}

export function ZCApp(props: TUIProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [approval, setApproval] = useState<{ tool: string; args: unknown; resolve: (v: "allow-once" | "always" | "deny") => void } | null>(null);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // Spinner animation
  useEffect(() => {
    if (!streaming) return;
    const iv = setInterval(() => setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(iv);
  }, [streaming]);

  const handleKey = useCallback((inputChar: string, key: { backspace?: boolean; return?: boolean; ctrlC?: boolean; isUpperCase?: boolean }) => {
    if (approval) return; // let approval handle its own input
    if (key.ctrlC) { exit(); return; }
    if (key.return) {
      const trimmed = input.trim();
      if (!trimmed || streaming) return;
      if (trimmed.startsWith(":")) {
        const cmd = trimmed.slice(1).toLowerCase();
        if (cmd === "quit" || cmd === "q") { exit(); return; }
        if (cmd === "help") {
          addMessage({ id: String(Date.now()), role: "system", content: "Commands: :quit, :help, :agents, :models, :mcp, :permissions" });
          setInput("");
          return;
        }
        setInput("");
        return;
      }
      setInput("");
      setStatus("Thinking...");
      setStreaming(true);
      const userMsg: ChatMessage = { id: String(Date.now()), role: "user", content: trimmed };
      addMessage(userMsg);
      const assistantId = String(Date.now() + 1);
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", loading: true }]);
      props.onSubmit(trimmed, (chunk: string) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk, loading: false } : m))
        );
      }).then(() => {
        setStreaming(false);
        setStatus("Ready");
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, loading: false } : m)));
      }).catch((err) => {
        setStreaming(false);
        setStatus("Ready");
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + `\n[error: ${(err as Error).message}]`, loading: false } : m))
        );
      });
      return;
    }
    if (key.backspace) { setInput((s) => s.slice(0, -1)); return; }
    setInput((s) => s + inputChar);
  }, [input, streaming, approval, props.onSubmit, exit, addMessage]);

  useInput(handleKey);

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box padding={1} borderStyle="single" borderColor={BLUE} marginBottom={1}>
        <Text color={PURPLE} bold>ZC CODE</Text>
        <Text color={DIM}>Personal AI Coding Agent</Text>
        <Text color={DIM}>Provider: {props.provider}  |  Model: {props.model}  |  Agent: {props.agent}</Text>
        <Text color={DIM}>Project: {props.project}</Text>
        <Text color={DIM}>Status: {status}</Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} padding={1}>
        {messages.map((m) => (
          <Box key={m.id} marginBottom={1}>
            {m.role === "user" && (
              <>
                <Text color={ACCENT} bold>{"> You: "}</Text>
                <Text>{m.content}</Text>
              </>
            )}
            {m.role === "assistant" && (
              <>
                <Text color={BLUE} bold>{"< ZC: "}</Text>
                {streaming && <Text color={GREEN}>{SPINNER_FRAMES[spinnerFrame]} </Text>}
                <Text>{m.content}</Text>
              </>
            )}
            {m.role === "tool" && (
              <Text color={DIM}>[tool: {m.content}]</Text>
            )}
          </Box>
        ))}
        {streaming && <Text color={GREEN}>Streaming…</Text>}
      </Box>

      {/* Approval prompt overlay */}
      {approval && (
        <Box padding={1} borderStyle="single" borderColor={RED} alignItems="center">
          <Text color={RED} bold>ZC CODE wants to execute:</Text>
          <Text color={PURPLE}>{approval.tool}</Text>
          <Text color={DIM}>{JSON.stringify(approval.args).slice(0, 200)}</Text>
          <Text color={DIM}>Permission required.</Text>
          <Text color={DIM}>(a)llow-once / (l)ways / (d)ny</Text>
        </Box>
      )}

      {/* Input line */}
      <Box padding={1} borderStyle="single" borderColor={ACCENT}>
        <Text color={DIM}>{streaming ? "Streaming…" : "> "}</Text>
        <Text>{input}</Text>
        {streaming ? <Text color={GREEN}> {SPINNER_FRAMES[spinnerFrame]}</Text> : null}
      </Box>

      {/* Footer hints */}
      <Box paddingLeft={1}>
        <Text color={DIM}><Text bold>⌨ </Text>Enter: send  |  Ctrl+C: quit  |  :help  |  :agents  |  :models  |  :mcp  |  :permissions</Text>
      </Box>
    </Box>
  );
}

export function StartupScreen() {
  return (
    <Box alignItems="center" padding={3}>
      <Text color={PURPLE} bold>ZC CODE</Text>
      <Text color={BLUE}>Personal AI Coding Agent</Text>
      <Box marginTop={1} borderStyle="single" borderColor={ACCENT} padding={1}>
        <Text color={DIM}>No provider configured.</Text>
        <Text color={DIM}>Run:  zc providers add</Text>
        <Text color={DIM}>Then:  zc chat</Text>
      </Box>
    </Box>
  );
}
