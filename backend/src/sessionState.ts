import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const NOTEPAD_PACKAGE_ID = "Microsoft.WindowsNotepad_8wekyb3d8bbwe";

export interface SessionBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ParsedWindowState {
  stateId: string;
  sequence: number;
  filePath: string;
  refreshedAt: string;
  numberTabs: number;
  activeTab: number;
  tabIds: string[];
  bounds: SessionBounds;
}

export interface ParsedUnsavedChunk {
  cursorPosition: number;
  deletionCount: number;
  additionCount: number;
  addedText: string;
}

export interface ParsedTabState {
  stateId: string;
  sequence: number;
  typeFlag: number;
  filePath: string;
  rawText: string;
  selectionStart: number;
  selectionEnd: number;
  wordWrap: boolean;
  rightToLeft: boolean;
  showUnicode: boolean;
  unsaved: boolean;
  sourceFilePath: string | null;
  sourceFileExists: boolean;
  sourceKind:
    | "unsaved-buffer"
    | "disk-file"
    | "inline-fallback"
    | "missing-file"
    | "state-file";
  carriageReturnType: number | null;
  encodingType: number | null;
  usedUnsavedChunks: boolean;
  unsavedChunkCount: number;
  warnings: string[];
}

export interface ParsedSessionState {
  stateRoot: string;
  tabStateDir: string;
  windowStateDir: string;
  windows: ParsedWindowState[];
  tabsById: Map<string, ParsedTabState>;
  warnings: string[];
}

class BinaryCursor {
  private offset = 0;

  constructor(private readonly bytes: Buffer) {}

  remaining(): number {
    return this.bytes.length - this.offset;
  }

  readByte(): number {
    if (this.remaining() < 1) {
      throw new Error("Unexpected end of buffer.");
    }

    const value = this.bytes[this.offset]!;
    this.offset += 1;
    return value;
  }

  readBytes(length: number): Buffer {
    if (length < 0 || this.remaining() < length) {
      throw new Error("Unexpected end of buffer.");
    }

    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  readAscii(length: number): string {
    return this.readBytes(length).toString("ascii");
  }

  readLeb128Unsigned(): number {
    let value = 0;
    let shift = 0;

    while (true) {
      const next = this.readByte();
      value |= (next & 0x7f) << shift;

      if ((next & 0x80) === 0) {
        return value >>> 0;
      }

      shift += 7;
    }
  }

  readUInt32LE(): number {
    return this.readBytes(4).readUInt32LE(0);
  }
}

function getLocalStateRoot(): string {
  const localAppData = process.env.LOCALAPPDATA;

  if (!localAppData) {
    throw new Error("LOCALAPPDATA is not available.");
  }

  return resolve(localAppData, "Packages", NOTEPAD_PACKAGE_ID, "LocalState");
}

function stripTrailingNuls(value: string): string {
  return value.replace(/\0+$/g, "");
}

function decodeUtf16Le(bytes: Buffer): string {
  return bytes.toString("utf16le");
}

function decodeAnsi(bytes: Buffer): string {
  return new TextDecoder("windows-1252").decode(bytes);
}

function decodeDiskBytes(bytes: Buffer, encodingType: number | null): string {
  switch (encodingType) {
    case 1:
      return decodeAnsi(bytes);
    case 2:
      return decodeUtf16Le(bytes);
    case 3:
      return new TextDecoder("utf-16be").decode(bytes);
    case 4: {
      const text = bytes.toString("utf8");
      return text.startsWith("\uFEFF") ? text.slice(1) : text;
    }
    case 5:
    case null:
      return bytes.toString("utf8");
    default:
      return bytes.toString("utf8");
  }
}

function toBounds(
  left: number,
  top: number,
  right: number,
  bottom: number,
): SessionBounds {
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function parseWindowStateFile(filePath: string): ParsedWindowState {
  const bytes = readFileSync(filePath);
  const cursor = new BinaryCursor(bytes);

  if (cursor.readAscii(2) !== "NP") {
    throw new Error(`Invalid WindowState header in ${filePath}.`);
  }

  const sequence = cursor.readLeb128Unsigned();
  cursor.readLeb128Unsigned();
  cursor.readByte();

  const numberTabs = cursor.readLeb128Unsigned();
  const tabIds: string[] = [];

  for (let index = 0; index < numberTabs; index += 1) {
    tabIds.push(cursor.readBytes(16).toString("hex"));
  }

  const activeTab = cursor.readLeb128Unsigned();
  const left = cursor.readUInt32LE();
  const top = cursor.readUInt32LE();
  const right = cursor.readUInt32LE();
  const bottom = cursor.readUInt32LE();

  const stateIdMatch = /([0-9a-f-]{36})\.\d+\.bin$/i.exec(filePath);

  if (!stateIdMatch) {
    throw new Error(`Unexpected WindowState file name: ${filePath}`);
  }

  return {
    stateId: stateIdMatch[1] ?? "",
    sequence,
    filePath,
    refreshedAt: statSync(filePath).mtime.toISOString(),
    numberTabs,
    activeTab,
    tabIds: tabIds.map((tabBytes) => {
      const bytesForGuid = Buffer.from(tabBytes, "hex");
      return bufferToGuid(bytesForGuid);
    }),
    bounds: toBounds(left, top, right, bottom),
  };
}

function bufferToGuid(bytes: Buffer): string {
  const hex = bytes.toString("hex");

  return [
    hex.slice(6, 8) + hex.slice(4, 6) + hex.slice(2, 4) + hex.slice(0, 2),
    hex.slice(10, 12) + hex.slice(8, 10),
    hex.slice(14, 16) + hex.slice(12, 14),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function parseUnsavedChunks(cursor: BinaryCursor): ParsedUnsavedChunk[] {
  const chunks: ParsedUnsavedChunk[] = [];

  while (cursor.remaining() > 0) {
    const cursorPosition = cursor.readLeb128Unsigned();
    const deletionCount = cursor.readLeb128Unsigned();
    const additionCount = cursor.readLeb128Unsigned();
    const addedBytes =
      additionCount > 0 ? cursor.readBytes(additionCount * 2) : Buffer.alloc(0);
    cursor.readBytes(4);

    chunks.push({
      cursorPosition,
      deletionCount,
      additionCount,
      addedText: decodeUtf16Le(addedBytes),
    });
  }

  return chunks;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function applyUnsavedChunks(
  baseText: string,
  chunks: ParsedUnsavedChunk[],
): string {
  let next = baseText;

  for (const chunk of chunks) {
    const start = clamp(chunk.cursorPosition, 0, next.length);
    const end = clamp(start + chunk.deletionCount, start, next.length);
    next = `${next.slice(0, start)}${chunk.addedText}${next.slice(end)}`;
  }

  return next;
}

function resolveSavedBaseText(
  sourceFilePath: string | null,
  inlineContent: Buffer,
  encodingType: number | null,
  warnings: string[],
): {
  rawText: string;
  sourceKind: ParsedTabState["sourceKind"];
  sourceFileExists: boolean;
} {
  if (sourceFilePath && existsSync(sourceFilePath)) {
    try {
      return {
        rawText: decodeDiskBytes(readFileSync(sourceFilePath), encodingType),
        sourceKind: "disk-file",
        sourceFileExists: true,
      };
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? error.message
          : "Saved file content could not be read.",
      );
    }
  }

  if (inlineContent.length > 0) {
    return {
      rawText: decodeUtf16Le(inlineContent),
      sourceKind: "inline-fallback",
      sourceFileExists: Boolean(sourceFilePath && existsSync(sourceFilePath)),
    };
  }

  return {
    rawText: "",
    sourceKind: sourceFilePath ? "missing-file" : "inline-fallback",
    sourceFileExists: Boolean(sourceFilePath && existsSync(sourceFilePath)),
  };
}

function parseTabStateFile(filePath: string): ParsedTabState {
  const bytes = readFileSync(filePath);
  const cursor = new BinaryCursor(bytes);

  if (cursor.readAscii(2) !== "NP") {
    throw new Error(`Invalid TabState header in ${filePath}.`);
  }

  const stateIdMatch = /([0-9a-f-]{36})\.bin$/i.exec(filePath);

  if (!stateIdMatch) {
    throw new Error(`Unexpected TabState file name: ${filePath}`);
  }

  const stateId = stateIdMatch[1] ?? "";
  const sequence = cursor.readLeb128Unsigned();
  const typeFlag = cursor.readLeb128Unsigned();
  const warnings: string[] = [];

  let selectionStart = 0;
  let selectionEnd = 0;
  let wordWrap = false;
  let rightToLeft = false;
  let showUnicode = false;
  let unsaved = false;
  let sourceFilePath: string | null = null;
  let sourceFileExists = false;
  let sourceKind: ParsedTabState["sourceKind"] = "state-file";
  let carriageReturnType: number | null = null;
  let encodingType: number | null = null;
  let rawText = "";
  let usedUnsavedChunks = false;

  switch (typeFlag) {
    case 0: {
      unsaved = cursor.readByte() === 1;
      selectionStart = cursor.readLeb128Unsigned();
      selectionEnd = cursor.readLeb128Unsigned();
      wordWrap = cursor.readByte() === 1;
      rightToLeft = cursor.readByte() === 1;
      showUnicode = cursor.readByte() === 1;
      const optionCount = cursor.readLeb128Unsigned();
      cursor.readBytes(optionCount);
      const contentLength = cursor.readLeb128Unsigned();
      const content = cursor.readBytes(contentLength * 2);
      cursor.readByte();
      cursor.readBytes(4);

      rawText = decodeUtf16Le(content);
      sourceKind = "unsaved-buffer";
      break;
    }
    case 1: {
      const filePathLength = cursor.readLeb128Unsigned();
      sourceFilePath = stripTrailingNuls(
        decodeUtf16Le(cursor.readBytes(filePathLength * 2)),
      );
      cursor.readLeb128Unsigned();
      encodingType = cursor.readByte();
      carriageReturnType = cursor.readByte();
      cursor.readLeb128Unsigned();
      cursor.readBytes(32);
      cursor.readBytes(2);
      selectionStart = cursor.readLeb128Unsigned();
      selectionEnd = cursor.readLeb128Unsigned();
      wordWrap = cursor.readByte() === 1;
      rightToLeft = cursor.readByte() === 1;
      showUnicode = cursor.readByte() === 1;
      const optionCount = cursor.readLeb128Unsigned();
      cursor.readBytes(optionCount);
      const contentLength = cursor.readLeb128Unsigned();
      const inlineContent = cursor.readBytes(contentLength * 2);
      unsaved = cursor.readByte() === 1;
      cursor.readBytes(4);

      const base = resolveSavedBaseText(
        sourceFilePath,
        inlineContent,
        encodingType,
        warnings,
      );

      rawText = base.rawText;
      sourceKind = base.sourceKind;
      sourceFileExists = base.sourceFileExists;
      break;
    }
    default: {
      cursor.readByte();
      cursor.readLeb128Unsigned();
      selectionStart = cursor.readLeb128Unsigned();
      selectionEnd = cursor.readLeb128Unsigned();
      wordWrap = cursor.readByte() === 1;
      rightToLeft = cursor.readByte() === 1;
      showUnicode = cursor.readByte() === 1;
      const optionCount = cursor.readLeb128Unsigned();
      cursor.readBytes(optionCount);
      cursor.readBytes(4);
      sourceKind = "state-file";
      break;
    }
  }

  const chunks = parseUnsavedChunks(cursor);

  if (chunks.length > 0) {
    rawText = applyUnsavedChunks(rawText, chunks);
    usedUnsavedChunks = true;
  }

  return {
    stateId,
    sequence,
    typeFlag,
    filePath,
    rawText,
    selectionStart,
    selectionEnd,
    wordWrap,
    rightToLeft,
    showUnicode,
    unsaved,
    sourceFilePath,
    sourceFileExists,
    sourceKind,
    carriageReturnType,
    encodingType,
    usedUnsavedChunks,
    unsavedChunkCount: chunks.length,
    warnings,
  };
}

function getWindowStateCandidates(
  windowStateDir: string,
): Map<string, Array<{ sequence: number; filePath: string }>> {
  const groups = new Map<string, Array<{ sequence: number; filePath: string }>>();

  for (const entry of readdirSync(windowStateDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const match = /^([0-9a-f-]{36})\.(\d+)\.bin$/i.exec(entry.name);

    if (!match) {
      continue;
    }

    const stateId = match[1] ?? "";
    const sequence = Number(match[2] ?? "0");
    const filePath = resolve(windowStateDir, entry.name);
    const current = groups.get(stateId) ?? [];
    current.push({ sequence, filePath });
    groups.set(stateId, current);
  }

  for (const entries of groups.values()) {
    entries.sort((left, right) => right.sequence - left.sequence);
  }

  return groups;
}

export function parseNotepadSessionState(): ParsedSessionState {
  const stateRoot = getLocalStateRoot();
  const tabStateDir = resolve(stateRoot, "TabState");
  const windowStateDir = resolve(stateRoot, "WindowState");
  const warnings: string[] = [];

  if (!existsSync(tabStateDir) || !existsSync(windowStateDir)) {
    return {
      stateRoot,
      tabStateDir,
      windowStateDir,
      windows: [],
      tabsById: new Map(),
      warnings,
    };
  }

  const windows: ParsedWindowState[] = [];
  for (const [stateId, candidates] of getWindowStateCandidates(windowStateDir)) {
    let parsedWindow: ParsedWindowState | null = null;

    for (const candidate of candidates) {
      try {
        parsedWindow = parseWindowStateFile(candidate.filePath);
        break;
      } catch (error) {
        warnings.push(
          `WindowState ${stateId} candidate ${candidate.filePath} was skipped: ${
            error instanceof Error ? error.message : "Unknown parse failure."
          }`,
        );
      }
    }

    if (parsedWindow) {
      windows.push(parsedWindow);
    }
  }

  windows.sort((left, right) => left.sequence - right.sequence);

  const uniqueTabIds = new Set(windows.flatMap((window) => window.tabIds));
  const tabsById = new Map<string, ParsedTabState>();

  for (const tabId of uniqueTabIds) {
    const filePath = resolve(tabStateDir, `${tabId}.bin`);

    if (!existsSync(filePath)) {
      continue;
    }

    try {
      tabsById.set(tabId, parseTabStateFile(filePath));
    } catch (error) {
      warnings.push(
        `TabState ${tabId} was skipped: ${
          error instanceof Error ? error.message : "Unknown parse failure."
        }`,
      );
    }
  }

  return {
    stateRoot,
    tabStateDir,
    windowStateDir,
    windows,
    tabsById,
    warnings,
  };
}
