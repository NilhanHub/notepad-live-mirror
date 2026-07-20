import type {
  ApiDiagnosticsResponse,
  ApiMutationResult,
  ApiSearchResponse,
  ApiSnapshot,
  SaveTabPayload,
} from "./types.js";

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export function extractApiErrorMessage(
  statusText: string,
  text: string,
  fallback: string,
): string {
  if (text) {
    try {
      const parsed = JSON.parse(text) as { message?: unknown };

      if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
        return parsed.message;
      }
    } catch {
      // Ignore malformed error bodies and fall back to the HTTP metadata below.
    }
  }

  return statusText || fallback;
}

function parseJson<T>(response: Response, text: string): T {
  if (!text) {
    throw new ApiRequestError(response.status, "The server returned an empty response.");
  }

  return JSON.parse(text) as T;
}

async function readJson<T>(response: Response): Promise<T> {
  return parseJson<T>(response, await response.text());
}

export async function fetchSnapshot(): Promise<ApiSnapshot> {
  const response = await fetch("/api/notepad/snapshot");
  const text = await response.text();

  if (!response.ok) {
    const message = extractApiErrorMessage(
      response.statusText,
      text,
      "Failed to refresh the live Notepad session.",
    );
    throw new ApiRequestError(response.status, message);
  }

  return parseJson<ApiSnapshot>(response, text);
}

export async function saveTab(
  payload: SaveTabPayload,
): Promise<{ status: number; data: ApiMutationResult }> {
  const response = await fetch("/api/notepad/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await readJson<ApiMutationResult>(response);
  return {
    status: response.status,
    data,
  };
}

export async function searchSnapshot(
  query: string,
  mode: "search" | "query",
): Promise<ApiSearchResponse> {
  const response = await fetch(
    `/api/notepad/search?${new URLSearchParams({ q: query, mode }).toString()}`,
  );
  const text = await response.text();

  if (!response.ok) {
    const message = extractApiErrorMessage(
      response.statusText,
      text,
      "Failed to search the current live snapshot.",
    );
    throw new ApiRequestError(response.status, message);
  }

  return parseJson<ApiSearchResponse>(response, text);
}

export async function fetchDiagnostics(): Promise<ApiDiagnosticsResponse> {
  const response = await fetch("/api/diag/status");
  const text = await response.text();

  if (!response.ok) {
    const message = extractApiErrorMessage(
      response.statusText,
      text,
      "Failed to read diagnostics.",
    );
    throw new ApiRequestError(response.status, message);
  }

  return parseJson<ApiDiagnosticsResponse>(response, text);
}
