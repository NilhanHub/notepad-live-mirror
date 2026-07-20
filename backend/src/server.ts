import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { BridgeExecutionError } from "./bridge.js";
import {
  getDiagnostics,
  getSnapshot,
  saveTab,
  searchLiveSnapshot,
} from "./notepadService.js";
import {
  getRuntimeDiagnostics,
  logEvent,
  setActualPort,
  writeRunArtifact,
} from "./runtime.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const frontendDistPath = resolve(repoRoot, "frontend", "dist");
const preferredPort = Number(process.env.PORT ?? "43117");

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Only localhost origins are allowed."));
    },
  }),
);

app.use(express.json({ limit: "10mb" }));

const saveSchema = z.object({
  windowHandle: z.string().min(1),
  runtimeId: z.string().min(1),
  stateId: z.string().min(1),
  expectedRawText: z.string(),
  text: z.string(),
  force: z.boolean().optional(),
});

const searchSchema = z.object({
  q: z.string().default(""),
  mode: z.enum(["search", "query"]).default("search"),
});

app.get("/api/health", (_req, res) => {
  const runtime = getRuntimeDiagnostics();
  res.json({
    ok: true,
    source: "notepad-live-mirror",
    runId: runtime.runId,
    actualPort: runtime.actualPort,
    bridgeMode: "non_visual_session_state",
  });
});

app.get("/api/notepad/snapshot", async (_req, res, next) => {
  try {
    res.json(await getSnapshot());
  } catch (error) {
    next(error);
  }
});

app.get("/api/notepad/search", async (req, res, next) => {
  try {
    const payload = searchSchema.parse(req.query);
    res.json(await searchLiveSnapshot(payload.q, payload.mode));
  } catch (error) {
    next(error);
  }
});

app.post("/api/notepad/save", async (req, res, next) => {
  try {
    const payload = saveSchema.parse(req.body);
    const result = await saveTab(payload);

    if (result.kind === "conflict") {
      res.status(409).json(result);
      return;
    }

    if (result.kind === "error") {
      res.status(422).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/diag/status", (_req, res) => {
  res.json(getDiagnostics());
});

app.get("/api/diag/oracle", (_req, res) => {
  res.json(getDiagnostics());
});

if (existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(resolve(frontendDistPath, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res
      .status(503)
      .type("text/plain")
      .send("Frontend build is missing. Run `npm run build` before `npm start`.");
  });
}

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        kind: "error",
        code: "invalid_request",
        message: error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }

    if (error instanceof BridgeExecutionError) {
      res.status(500).json({
        kind: "error",
        code: error.code,
        message: error.message,
      });
      return;
    }

    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    logEvent("server.error", { message });
    writeRunArtifact("exception.json", {
      at: new Date().toISOString(),
      message,
    });

    res.status(500).json({
      kind: "error",
      code: "internal_error",
      message,
    });
  },
);

async function listen(startPort: number): Promise<number> {
  return new Promise<number>((resolvePromise, rejectPromise) => {
    const server = createServer(app);

    server.once("error", (error) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "EADDRINUSE"
      ) {
        resolvePromise(listen(startPort + 1));
        return;
      }

      rejectPromise(error);
    });

    server.listen(startPort, "127.0.0.1", () => {
      resolvePromise(startPort);
    });
  });
}

const port = await listen(preferredPort);
setActualPort(port);
logEvent("server.ready", { port, preferredPort });
console.log(`Notepad Live Mirror listening on http://127.0.0.1:${port}`);
