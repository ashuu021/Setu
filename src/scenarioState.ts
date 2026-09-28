import type { Action } from './simulation';

export const SCENARIO_STORAGE_KEY = 'setu-scenario-state';
export const DEFAULT_SCENARIO_NAME = 'Summer Resupply 26/27';
export const DEFAULT_ACTION: Exclude<Action, null> = { type: 'airlift', amount: 10000 };

export type ScenarioSnapshot = {
  stationId: 'maitri';
  delayDays: number;
  scenarioName: string;
  action: Action;
};

export type PersistedScenarioState = {
  version: 3;
  executionMode: 'offline-demo' | 'local-online';
  /** Selected panel controls; this may be a hypothetical draft before Apply. */
  selectedAction: Exclude<Action, null>;
  current: ScenarioSnapshot;
  previous: ScenarioSnapshot | null;
};

const BASELINE: PersistedScenarioState = {
  version: 3,
  executionMode: 'local-online',
  selectedAction: DEFAULT_ACTION,
  current: { stationId: 'maitri', delayDays: 0, scenarioName: DEFAULT_SCENARIO_NAME, action: null },
  previous: null,
};

function isAction(value: unknown): value is Action {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.amount !== 'number' || !Number.isFinite(candidate.amount)) return false;
  if (candidate.type === 'demand') return candidate.amount >= 0 && candidate.amount <= 40;
  if (candidate.type === 'airlift') return candidate.amount >= 0 && candidate.amount <= 20000;
  return false;
}

function isSnapshot(value: unknown): value is ScenarioSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.stationId === 'maitri'
    && Number.isInteger(candidate.delayDays) && Number(candidate.delayDays) >= 0 && Number(candidate.delayDays) <= 30
    && typeof candidate.scenarioName === 'string' && candidate.scenarioName.trim().length > 0 && candidate.scenarioName.length <= 100
    && isAction(candidate.action);
}

export function isPersistedScenarioState(value: unknown): value is PersistedScenarioState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 3 &&
    (candidate.executionMode === 'offline-demo' || candidate.executionMode === 'local-online') &&
    isAction(candidate.selectedAction) && candidate.selectedAction !== null && isSnapshot(candidate.current)
    && (candidate.previous === null || isSnapshot(candidate.previous));
}

function safeGet(storage: Storage | undefined, key: string): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}

function browserStorage(): Storage | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; }
  catch { return undefined; }
}

function safeSet(storage: Storage | undefined, key: string, value: string): boolean {
  try { if (!storage) return false; storage.setItem(key, value); return true; }
  catch { return false; /* Keep the in-memory simulator usable if storage is unavailable. */ }
}

export function persistScenarioState(state: PersistedScenarioState, storage: Storage | undefined = browserStorage()): void {
  if (!safeSet(storage, SCENARIO_STORAGE_KEY, JSON.stringify(state))) return;
  // Retire split legacy values after writing the canonical record so they cannot resurrect stale actions.
  try {
    storage?.removeItem('setu-delay');
    storage?.removeItem('setu-applied');
    storage?.removeItem('setu-scenario');
  } catch { /* Storage may be read-only in a restricted browser context. */ }
}

function parseLegacyAction(raw: string | null): Action {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isAction(value) ? value : null;
  } catch { return null; }
}

/** Loads the canonical scenario first; migrates older SETU keys only when no canonical key exists. */
export function restoreScenarioState(storage: Storage | undefined = browserStorage()): PersistedScenarioState {
  const saved = safeGet(storage, SCENARIO_STORAGE_KEY);
  if (saved !== null) {
    try {
      const parsed: unknown = JSON.parse(saved);
      if (isPersistedScenarioState(parsed)) {
        // The active scenario is authoritative after a reload. A draft tab choice
        // from a prior view must not make its controls disagree with the results.
        const restored = parsed.current.action
          ? { ...parsed, selectedAction: parsed.current.action }
          : parsed;
        if (restored !== parsed) persistScenarioState(restored, storage);
        return restored;
      }
      if (parsed && typeof parsed === 'object') {
        const old = parsed as Record<string, unknown>;
        if ((old.version === 1 || old.version === 2) && isSnapshot(old.current)
          && (old.previous === null || isSnapshot(old.previous))) {
          const current = old.current as ScenarioSnapshot;
          const migrated: PersistedScenarioState = {
            version: 3,
            executionMode: old.executionMode === 'offline-demo' ? 'offline-demo' : 'local-online',
            selectedAction: isAction(old.selectedAction) && old.selectedAction !== null
              ? old.selectedAction
              : current.action ?? DEFAULT_ACTION,
            current,
            previous: old.previous as ScenarioSnapshot | null,
          };
          persistScenarioState(migrated, storage);
          return migrated;
        }
      }
      persistScenarioState(BASELINE, storage);
      return BASELINE;
    } catch { persistScenarioState(BASELINE, storage); return BASELINE; }
  }

  const legacyDelay = Number(safeGet(storage, 'setu-delay'));
  const delayDays = Number.isInteger(legacyDelay) && legacyDelay >= 0 && legacyDelay <= 30 ? legacyDelay : 0;
  const legacyScenario = safeGet(storage, 'setu-scenario');
  const scenarioName = legacyScenario?.trim() && legacyScenario.length <= 100 ? legacyScenario : DEFAULT_SCENARIO_NAME;
  let action = parseLegacyAction(safeGet(storage, 'setu-applied'));
  if (!action) {
    try {
      const pending = JSON.parse(safeGet(storage, 'setu-pending-sync') || 'null');
      if (isAction(pending?.applied)) action = pending.applied;
    } catch { /* Ignore a malformed pre-canonical pending record. */ }
  }
  const migrated: PersistedScenarioState = {
    version: 3,
    executionMode: 'local-online',
    selectedAction: action ?? DEFAULT_ACTION,
    current: { stationId: 'maitri', delayDays, scenarioName, action },
    previous: null,
  };
  persistScenarioState(migrated, storage);
  return migrated;
}

export function readActionLog(storage: Storage | undefined = browserStorage()): { time: string; text: string }[] {
  try {
    const parsed: unknown = JSON.parse(safeGet(storage, 'setu-log') || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is { time: string; text: string } => !!entry && typeof entry.time === 'string' && typeof entry.text === 'string');
  } catch { return []; }
}
