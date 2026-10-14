import http from "node:http";
import { spawn } from "node:child_process";

const PORT = parseInt(process.env.CLI_BRIDGE_PORT || "3128", 10);
const HOST = "127.0.0.1";

function detectAvailableClis() {
  const clis = [];
  // Check common CLIs
  const tools = [
    { id: "opencode", cmd: "opencode", name: "OpenCode CLI (Local)" },
    { id: "claude-code", cmd: "claude", name: "Claude Code CLI (Pro Subscription)" },
    { id: "codex-cli", cmd: "codex", name: "OpenAI Codex CLI" },
    { id: "ollama-local", cmd: "ollama", name: "Ollama (Local Models)" },
  ];

  for (const t of tools) {
    clis.push({
      id: t.id,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "cli-bridge",
      name: t.name,
      cmd: t.cmd,
    });
  }
  return clis;
}

function formatMessagesToPrompt(messages) {
  let prompt = "";
  for (const msg of messages) {
    if (msg.role === "system") {
      prompt += `System: ${msg.content}\n\n`;
    } else if (msg.role === "user") {
      prompt += `User: ${msg.content}\n\n`;
    } else if (msg.role === "assistant") {
      prompt += `Assistant: ${msg.content}\n\n`;
    }
  }
  prompt += "Assistant:";
  return prompt;
}

function handleChatCompletions(req, res, body) {
  let payload;
  try {
    payload = JSON.parse(body);
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: { message: "Invalid JSON" } }));
  }

  const { model = "claude-code", messages = [], stream = true } = payload;
  const prompt = formatMessagesToPrompt(messages);
  const completionId = `chatcmpl-${Date.now()}`;

  // Decide command based on requested model or available CLI
  let execCmd = "opencode";
  let execArgs = ["run", prompt];

  if (model.includes("claude")) {
    execCmd = "claude";
    execArgs = ["-p", prompt];
  } else if (model.includes("ollama")) {
    execCmd = "ollama";
    execArgs = ["run", "llama3.2", prompt];
  } else {
    // Default to opencode run
    execCmd = "opencode";
    execArgs = ["run", prompt];
  }

  console.log(`[CLI-Bridge] Routing prompt to CLI: ${execCmd}`);

  if (stream) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const proc = spawn(execCmd, execArgs, { shell: true });

    proc.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      const sseData = {
        id: completionId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            delta: { content: text },
            finish_reason: null,
          },
        ],
      };
      res.write(`data: ${JSON.stringify(sseData)}\n\n`);
    });

    proc.stderr.on("data", (data) => {
      // Log stderr for debugging
      console.error(`[CLI-Bridge stderr]: ${data.toString()}`);
    });

    proc.on("error", (err) => {
      console.warn(`[CLI-Bridge] Failed to spawn ${execCmd}:`, err.message);
      // Fallback message so caller knows what happened
      const fallbackMsg = `[CLI Bridge] Notice: CLI tool '${execCmd}' could not be spawned (${err.message}). Ensure it is installed and authenticated in your terminal.`;
      const sseData = {
        id: completionId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            delta: { content: fallbackMsg },
            finish_reason: null,
          },
        ],
      };
      res.write(`data: ${JSON.stringify(sseData)}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    });

    proc.on("close", (code) => {
      const finishData = {
        id: completionId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
          },
        ],
      };
      res.write(`data: ${JSON.stringify(finishData)}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    });
  } else {
    // Non-streaming response
    const proc = spawn(execCmd, execArgs, { shell: true });
    let fullText = "";

    proc.stdout.on("data", (chunk) => {
      fullText += chunk.toString();
    });

    proc.on("close", (code) => {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(
        JSON.stringify({
          id: completionId,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: fullText },
              finish_reason: "stop",
            },
          ],
        })
      );
    });

    proc.on("error", (err) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            message: `CLI tool ${execCmd} error: ${err.message}`,
          },
        })
      );
    });
  }
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || HOST}`);

  if (req.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
    const models = detectAvailableClis();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ object: "list", data: models }));
  }

  if (
    req.method === "POST" &&
    (url.pathname === "/v1/chat/completions" || url.pathname === "/chat/completions")
  ) {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      handleChatCompletions(req, res, body);
    });
    return;
  }

  // Health check
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", service: "rakazo-cli-reuse-bridge" }));
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { message: `Route not found: ${url.pathname}` } }));
});

server.listen(PORT, HOST, () => {
  console.log(`[Rakazo CLI-Bridge] Running at http://${HOST}:${PORT}`);
  console.log(`[Rakazo CLI-Bridge] OpenAI-Compatible Endpoint: http://${HOST}:${PORT}/v1`);
});
