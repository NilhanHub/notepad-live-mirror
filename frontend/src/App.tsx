import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiRequestError,
  fetchDiagnostics,
  fetchSnapshot,
  saveTab,
  searchSnapshot,
} from "./api.js";
import { chooseSelectedTabId, findTabById, mergeTabIntoSnapshot } from "./model.js";
import type {
  ApiDiagnosticsResponse,
  ApiMutationConflict,
  ApiSnapshot,
  ApiTab,
  ApiTabBase,
  SearchResult,
} from "./types.js";

type DiscardIntent =
  | { kind: "refresh" }
  | { kind: "switch-tab"; targetTabId: string; jump: { start: number; end: number } | null };

interface ConflictState {
  requestedText: string;
  liveTab: ApiTabBase;
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0 2.2 5.5" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v6h8V4" />
      <path d="M8 20v-6h8v6" />
    </svg>
  );
}

function DiagnosticsDrawer({
  diagnostics,
  snapshot,
  open,
  onClose,
}: {
  diagnostics: ApiDiagnosticsResponse | null;
  snapshot: ApiSnapshot | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  return (
    <div className="drawer-scrim" role="presentation" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diagnostics-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Diagnostics</p>
            <h3 id="diagnostics-title">Bridge truth and Oracle handoff</h3>
          </div>
          <button className="text-button subtle" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="drawer-grid">
          <section className="drawer-section">
            <h4>Runtime</h4>
            <dl className="kv-list">
              <div>
                <dt>Version</dt>
                <dd>{diagnostics?.appVersion ?? "Loading..."}</dd>
              </div>
              <div>
                <dt>Port</dt>
                <dd>{diagnostics?.actualPort || "Loading..."}</dd>
              </div>
              <div>
                <dt>Run ID</dt>
                <dd>{diagnostics?.runId ?? "Loading..."}</dd>
              </div>
              <div>
                <dt>Bridge mode</dt>
                <dd>{diagnostics?.bridgeMode ?? snapshot?.diagnostics.bridgeMode ?? "Loading..."}</dd>
              </div>
              <div>
                <dt>Last snapshot</dt>
                <dd>{diagnostics?.lastSnapshotRequestId ?? snapshot?.diagnostics.requestId ?? "None"}</dd>
              </div>
              <div>
                <dt>Last save</dt>
                <dd>{diagnostics?.lastSaveRequestId ?? "None"}</dd>
              </div>
              <div>
                <dt>Last bridge action</dt>
                <dd>{diagnostics?.lastBridgeActionId ?? snapshot?.diagnostics.bridgeActionId ?? "None"}</dd>
              </div>
            </dl>
          </section>

          <section className="drawer-section">
            <h4>Artifacts</h4>
            <dl className="kv-list">
              <div>
                <dt>Latest artifacts</dt>
                <dd>{diagnostics?.latestArtifactsDir ?? "Loading..."}</dd>
              </div>
              <div>
                <dt>Verification run</dt>
                <dd>{diagnostics?.latestVerificationRunDir ?? "Not yet recorded"}</dd>
              </div>
              <div>
                <dt>Known-good run</dt>
                <dd>{diagnostics?.latestKnownGoodRunDir ?? "Not yet recorded"}</dd>
              </div>
              <div>
                <dt>Real-user audit</dt>
                <dd>{diagnostics?.latestRealAuditDir ?? "Not yet recorded"}</dd>
              </div>
              <div>
                <dt>Oracle doc</dt>
                <dd>{diagnostics?.oracleDocPath ?? "Loading..."}</dd>
              </div>
              <div>
                <dt>Oracle YAML</dt>
                <dd>{diagnostics?.oracleYamlPath ?? "Loading..."}</dd>
              </div>
              <div>
                <dt>Oracle source</dt>
                <dd>{diagnostics?.oracleSourcePath ?? "Loading..."}</dd>
              </div>
              <div>
                <dt>Oracle command file</dt>
                <dd>{diagnostics?.oracleCommandPath ?? "Loading..."}</dd>
              </div>
            </dl>
          </section>

          <section className="drawer-section">
            <h4>Objective</h4>
            <p className="drawer-copy">{diagnostics?.currentObjective ?? "Loading..."}</p>
          </section>

          <section className="drawer-section">
            <h4>Current uncertainty</h4>
            <p className="drawer-copy">
              {diagnostics?.currentFailureOrUncertainty ?? "Loading..."}
            </p>
          </section>

          <section className="drawer-section">
            <h4>Oracle command</h4>
            <p className="drawer-copy">{diagnostics?.oracleCommand ?? "Loading..."}</p>
            <div className="inline-actions">
              <button
                className="text-button subtle"
                onClick={() => diagnostics && void copy(diagnostics.oracleCommand)}
                type="button"
              >
                Copy command
              </button>
            </div>
          </section>

          <section className="drawer-section">
            <h4>Include globs</h4>
            <ul className="plain-list">
              {diagnostics?.includeGlobs.map((item) => <li key={item}>{item}</li>) ?? <li>Loading...</li>}
            </ul>
          </section>

          <section className="drawer-section">
            <h4>Exclude globs</h4>
            <ul className="plain-list">
              {diagnostics?.excludeGlobs.map((item) => <li key={item}>{item}</li>) ?? <li>Loading...</li>}
            </ul>
          </section>

          <section className="drawer-section">
            <h4>Sanitization rules</h4>
            <ul className="plain-list">
              {diagnostics?.sanitizationRules.map((item) => <li key={item}>{item}</li>) ?? <li>Loading...</li>}
            </ul>
          </section>

          <section className="drawer-section">
            <h4>Reproduction</h4>
            <ol className="plain-list numbered-list">
              {diagnostics?.reproductionSteps.map((item) => <li key={item}>{item}</li>) ?? <li>Loading...</li>}
            </ol>
          </section>

          <section className="drawer-section">
            <h4>Evidence sufficient</h4>
            <ul className="plain-list">
              {diagnostics?.evidenceSufficient.map((item) => <li key={item}>{item}</li>) ?? <li>Loading...</li>}
            </ul>
          </section>

          <section className="drawer-section">
            <h4>Current snapshot</h4>
            <dl className="kv-list">
              <div>
                <dt>Session read kind</dt>
                <dd>{snapshot?.diagnostics.sessionReadKind ?? "Not yet read"}</dd>
              </div>
              <div>
                <dt>Selection actions</dt>
                <dd>{snapshot?.diagnostics.selectionActionsDuringSnapshot ?? 0}</dd>
              </div>
              <div>
                <dt>Focus changed</dt>
                <dd>{snapshot?.diagnostics.focusChangedDuringSnapshot ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>Window activated</dt>
                <dd>{snapshot?.diagnostics.windowActivatedDuringSnapshot ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>Process delta</dt>
                <dd>{snapshot?.diagnostics.newNotepadProcessCountDelta ?? 0}</dd>
              </div>
              <div>
                <dt>Window delta</dt>
                <dd>{snapshot?.diagnostics.newNotepadWindowCountDelta ?? 0}</dd>
              </div>
              <div>
                <dt>Matched windows</dt>
                <dd>{snapshot?.diagnostics.matchedWindowStateCount ?? 0}</dd>
              </div>
              <div>
                <dt>Agreement checks</dt>
                <dd>{snapshot?.diagnostics.selectedDocumentAgreementCount ?? 0}</dd>
              </div>
            </dl>
            <ul className="plain-list">
              {snapshot?.diagnostics.warnings.length ? (
                snapshot.diagnostics.warnings.map((warning) => <li key={warning}>{warning}</li>)
              ) : (
                <li>No current snapshot warnings.</li>
              )}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const [snapshot, setSnapshot] = useState<ApiSnapshot | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [editorText, setEditorText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardIntent, setDiscardIntent] = useState<DiscardIntent | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"search" | "query">("search");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchSummary, setSearchSummary] = useState<string>("");
  const [showDiagnostics, setShowDiagnostics] = useState(
    searchParams.get("diag") === "1",
  );
  const [diagnostics, setDiagnostics] = useState<ApiDiagnosticsResponse | null>(null);
  const [wrapText, setWrapText] = useState(true);
  const [pendingJump, setPendingJump] = useState<{ start: number; end: number } | null>(
    null,
  );

  const selectedTab = useMemo(
    () => findTabById(snapshot, selectedTabId),
    [snapshot, selectedTabId],
  );

  const isDirty = Boolean(selectedTab && editorText !== selectedTab.text);
  const hasTabs = Boolean(snapshot?.windows.some((window) => window.tabs.length > 0));

  const replaceSelection = useCallback(
    (nextSnapshot: ApiSnapshot, preferredTabId: string | null) => {
      const nextSelectedId = chooseSelectedTabId(nextSnapshot, preferredTabId);
      const nextSelectedTab = findTabById(nextSnapshot, nextSelectedId);

      setSnapshot(nextSnapshot);
      setSelectedTabId(nextSelectedId);
      setEditorText(nextSelectedTab?.text ?? "");
    },
    [],
  );

  const loadDiagnostics = useCallback(async () => {
    try {
      setDiagnostics(await fetchDiagnostics());
    } catch {
      // Diagnostics remain optional in the UI.
    }
  }, []);

  const refreshLiveSnapshot = useCallback(
    async (preferredTabId: string | null) => {
      setError(null);
      setRefreshing(true);

      try {
        const nextSnapshot = await fetchSnapshot();
        replaceSelection(nextSnapshot, preferredTabId);
        void loadDiagnostics();
      } catch (requestError) {
        const message =
          requestError instanceof ApiRequestError
            ? requestError.message
            : "Notepad could not be refreshed right now.";
        setError(message);
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [loadDiagnostics, replaceSelection],
  );

  useEffect(() => {
    void refreshLiveSnapshot(null);
  }, [refreshLiveSnapshot]);

  useEffect(() => {
    if (!showDiagnostics) {
      return;
    }

    void loadDiagnostics();
  }, [loadDiagnostics, showDiagnostics]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchSummary("");
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSearching(true);

      try {
        const response = await searchSnapshot(searchQuery, searchMode);
        setSearchResults(response.results);
        setSearchSummary(response.summary);
      } catch (requestError) {
        const message =
          requestError instanceof ApiRequestError
            ? requestError.message
            : "Search could not be completed right now.";
        setError(message);
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [searchMode, searchQuery]);

  useEffect(() => {
    if (!pendingJump || !selectedTab || selectedTab.id !== selectedTabId || !editorRef.current) {
      return;
    }

    editorRef.current.focus();
    editorRef.current.setSelectionRange(pendingJump.start, pendingJump.end);
    setPendingJump(null);
  }, [pendingJump, selectedTab, selectedTabId]);

  const handleSelectTab = useCallback(
    (tab: ApiTab, jump: { start: number; end: number } | null = null) => {
      if (tab.id === selectedTabId) {
        if (jump) {
          setPendingJump(jump);
        }
        return;
      }

      if (isDirty) {
        setDiscardIntent({
          kind: "switch-tab",
          targetTabId: tab.id,
          jump,
        });
        return;
      }

      setSelectedTabId(tab.id);
      setEditorText(tab.text);
      setPendingJump(jump);
      setError(null);
    },
    [isDirty, selectedTabId],
  );

  const handleRefreshRequest = useCallback(() => {
    if (isDirty) {
      setDiscardIntent({ kind: "refresh" });
      return;
    }

    void refreshLiveSnapshot(selectedTabId);
  }, [isDirty, refreshLiveSnapshot, selectedTabId]);

  const handleSave = useCallback(
    async (force = false, requestedText = editorText) => {
      if (!selectedTab) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const response = await saveTab({
          windowHandle: selectedTab.windowHandle,
          runtimeId: selectedTab.runtimeId,
          stateId: selectedTab.stateId,
          expectedRawText: selectedTab.rawText,
          text: requestedText,
          force,
        });

        if (response.status === 409 && response.data.kind === "conflict" && response.data.tab) {
          const conflictData = response.data as ApiMutationConflict;
          setConflict({
            requestedText,
            liveTab: conflictData.tab,
          });
          return;
        }

        if (response.data.kind !== "success" || !response.data.tab) {
          setError(response.data.message ?? "The save could not be completed.");
          return;
        }

        setSnapshot((current) => mergeTabIntoSnapshot(current, response.data.tab));
        setEditorText(response.data.tab.text);
        void loadDiagnostics();
      } catch (requestError) {
        const message =
          requestError instanceof ApiRequestError
            ? requestError.message
            : "The save could not be completed.";
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [editorText, loadDiagnostics, selectedTab],
  );

  const confirmDiscard = useCallback(() => {
    if (!discardIntent) {
      return;
    }

    if (discardIntent.kind === "refresh") {
      setDiscardIntent(null);
      void refreshLiveSnapshot(selectedTabId);
      return;
    }

    const nextTab = findTabById(snapshot, discardIntent.targetTabId);
    setDiscardIntent(null);

    if (nextTab) {
      setSelectedTabId(nextTab.id);
      setEditorText(nextTab.text);
      setPendingJump(discardIntent.jump);
      setError(null);
    }
  }, [discardIntent, refreshLiveSnapshot, selectedTabId, snapshot]);

  const reloadFromConflict = useCallback(() => {
    if (!conflict) {
      return;
    }

    setSnapshot((current) => mergeTabIntoSnapshot(current, conflict.liveTab));
    setEditorText(conflict.liveTab.text);
    setConflict(null);
  }, [conflict]);

  const selectedWindowLabel = useMemo(() => {
    if (!selectedTab || !snapshot) {
      return "";
    }

    const selectedWindow = snapshot.windows.find(
      (window) => window.handle === selectedTab.windowHandle,
    );

    if (!selectedWindow) {
      return "";
    }

    const duplicateMeta =
      selectedTab.duplicateCount > 1
        ? `Tab ${selectedTab.duplicateIndex} of ${selectedTab.duplicateCount}`
        : null;

    return [selectedWindow.label, duplicateMeta].filter(Boolean).join(" • ");
  }, [selectedTab, snapshot]);

  const snapshotStatus = useMemo(() => {
    if (!snapshot) {
      return "Waiting for first sync";
    }

    if (snapshot.diagnostics.warnings.length > 0) {
      return `${snapshot.diagnostics.warnings.length} diagnostic warning${
        snapshot.diagnostics.warnings.length === 1 ? "" : "s"
      }`;
    }

    return `${snapshot.diagnostics.bridgeMode.replaceAll("_", " ")}`;
  }, [snapshot]);

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="rail-header">
          <p className="eyebrow">Local-first</p>
          <h1>Live Notepad</h1>
          <p className="muted">
            {snapshot ? `Last read ${formatTimestamp(snapshot.refreshedAt)}` : "Waiting for first sync"}
          </p>
          <button
            className="text-button subtle compact"
            onClick={() => setShowDiagnostics(true)}
            type="button"
          >
            Diagnostics
          </button>
        </div>

        <div className="rail-scroll">
          {snapshot?.windows.map((window) => (
            <section className="window-group" key={window.id}>
              {snapshot.windows.length > 1 ? (
                <header className="window-group-header">
                  <span>{window.label}</span>
                  <small>{window.windowTitle.replace(/^-?\*?/, "")}</small>
                </header>
              ) : null}

              <div className="tab-list">
                {window.tabs.map((tab) => {
                  const active = tab.id === selectedTabId;
                  const duplicateMeta =
                    tab.duplicateCount > 1
                      ? `${tab.duplicateIndex} of ${tab.duplicateCount}`
                      : null;

                  return (
                    <button
                      key={tab.id}
                      className={`tab-row ${active ? "is-active" : ""}`}
                      onClick={() => handleSelectTab(tab)}
                      type="button"
                    >
                      <span className="tab-row-title">{tab.title}</span>
                      <span className="tab-row-meta">
                        {duplicateMeta ? <span>{duplicateMeta}</span> : null}
                        {tab.modified ? <span>modified</span> : <span>saved</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </aside>

      <main className="workspace">
        <section className="search-shell">
          <div className="search-row">
            <input
              aria-label="Search the current live snapshot"
              className="search-input"
              placeholder="Search titles and text, or ask a grounded question over the current snapshot"
              spellCheck={false}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            <div className="mode-toggle" role="tablist" aria-label="Search mode">
              <button
                className={`mode-button ${searchMode === "search" ? "is-active" : ""}`}
                onClick={() => setSearchMode("search")}
                type="button"
              >
                Search
              </button>
              <button
                className={`mode-button ${searchMode === "query" ? "is-active" : ""}`}
                onClick={() => setSearchMode("query")}
                type="button"
              >
                Query
              </button>
            </div>
          </div>

          <p className="search-summary">
            {searchQuery.trim()
              ? searchSummary || (searching ? "Searching the live snapshot..." : "")
              : "Search stays local to the current live snapshot. Results cite the source tab they came from."}
          </p>

          {searchResults.length > 0 ? (
            <div className="search-results">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  className="search-result"
                  onClick={() => {
                    const tab = findTabById(snapshot, result.tabId);
                    if (tab) {
                      handleSelectTab(tab, {
                        start: result.matchStart,
                        end: Math.max(result.matchEnd, result.matchStart + 1),
                      });
                    }
                  }}
                  type="button"
                >
                  <span className="search-result-title">
                    {result.tabTitle}
                    {result.duplicateLabel ? (
                      <small>{result.duplicateLabel}</small>
                    ) : null}
                  </span>
                  <span className="search-result-meta">
                    State {result.stateId.slice(0, 8)} • Window {result.windowHandle}
                  </span>
                  <span className="search-result-snippet">{result.snippet}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <div className="workspace-header">
          <div>
            <p className="eyebrow">Selected tab</p>
            <h2>{selectedTab?.title ?? "Nothing open"}</h2>
            <p className="muted">{selectedWindowLabel || "Open Notepad and refresh when ready."}</p>
          </div>

          <div className="header-actions">
            <button
              className="text-button subtle compact"
              onClick={() => setWrapText((current) => !current)}
              type="button"
            >
              {wrapText ? "Wrap on" : "Wrap off"}
            </button>
            <div className={`dirty-pill ${isDirty ? "is-dirty" : ""}`}>
              {isDirty ? "Edited locally" : "In sync"}
            </div>
          </div>
        </div>

        <p className="status-band">{snapshotStatus}</p>
        {error ? <div className="inline-message">{error}</div> : null}

        {!loading && !hasTabs ? (
          <section className="empty-state">
            <p className="eyebrow">No live session</p>
            <h3>Notepad is not open right now.</h3>
            <p className="muted">
              Open the stock Windows Notepad app, then read the live session again.
            </p>
            <button className="text-button" onClick={handleRefreshRequest} type="button">
              Try again
            </button>
          </section>
        ) : (
          <section className="editor-shell">
            {selectedTab ? (
              <textarea
                ref={editorRef}
                aria-label="Selected Notepad tab text"
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className={`editor ${wrapText ? "is-wrapped" : "is-unwrapped"}`}
                data-gramm="false"
                placeholder="Select a live Notepad tab to begin."
                spellCheck={false}
                value={editorText}
                wrap={wrapText ? "soft" : "off"}
                onChange={(event) => setEditorText(event.target.value)}
              />
            ) : (
              <div className="editor-placeholder">
                {loading ? "Reading the live Notepad session..." : "No tab is selected."}
              </div>
            )}
          </section>
        )}

        {refreshing && !loading ? (
          <p className="status-line">Refreshing the live Notepad session...</p>
        ) : null}
        {saving ? (
          <p className="status-line">Saving back into the live Notepad tab...</p>
        ) : null}
      </main>

      <div className="floating-actions" aria-label="Actions">
        <button
          aria-label="Refresh from live Notepad"
          className="icon-button"
          disabled={refreshing}
          onClick={handleRefreshRequest}
          title="Refresh"
          type="button"
        >
          <RefreshIcon />
        </button>
        <button
          aria-label="Save into live Notepad"
          className="icon-button accent"
          disabled={!selectedTab || !isDirty || saving}
          onClick={() => void handleSave()}
          title="Save"
          type="button"
        >
          <SaveIcon />
        </button>
      </div>

      {discardIntent ? (
        <div className="modal-scrim" role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="discard-title">
            <p className="eyebrow">Unsaved changes</p>
            <h3 id="discard-title">Discard the website edits?</h3>
            <p className="muted">
              {discardIntent.kind === "refresh"
                ? "Refreshing will replace the current website draft with a fresh live Notepad read."
                : "Switching tabs will replace the current website draft with the other live Notepad tab."}
            </p>
            <div className="dialog-actions">
              <button className="text-button" onClick={() => setDiscardIntent(null)} type="button">
                Cancel
              </button>
              <button className="filled-button" onClick={confirmDiscard} type="button">
                Discard and continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {conflict ? (
        <div className="modal-scrim" role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
            <p className="eyebrow">Live change detected</p>
            <h3 id="conflict-title">That Notepad tab changed after the last refresh.</h3>
            <p className="muted">
              Choose whether to keep the website draft, reload the live Notepad text, or cancel.
            </p>
            <div className="dialog-actions">
              <button className="text-button" onClick={() => setConflict(null)} type="button">
                Cancel
              </button>
              <button className="text-button" onClick={reloadFromConflict} type="button">
                Reload from Notepad
              </button>
              <button
                className="filled-button"
                onClick={() => {
                  const nextText = conflict.requestedText;
                  setConflict(null);
                  void handleSave(true, nextText);
                }}
                type="button"
              >
                Overwrite from website
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DiagnosticsDrawer
        diagnostics={diagnostics}
        snapshot={snapshot}
        open={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
      />
    </div>
  );
}
