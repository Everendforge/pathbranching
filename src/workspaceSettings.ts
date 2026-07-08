import { normalizeThemeId, type ThemeId } from "./themes.js";
import type { AppView, CanvasMode, MarkdownEditorTab, Selection } from "./appTypes.js";
import type { StoryOutlineTab } from "./storyOutlineModel.js";

export const SETTINGS_KEY = "pathbranching.settings.v1";
export const DEFAULT_PANEL_WIDTH = 282;
export const MIN_PANEL_WIDTH = 220;
export const MAX_PANEL_WIDTH = 420;
export const COLLAPSED_RAIL_WIDTH = 36;
export const NEW_SEQUENCE_SELECT_VALUE = "__new_sequence__";

export type CanvasBackgroundSettings = {
  showDots: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  opacity: number;
};

export type CanvasLayoutMode = "branching" | "timeline" | "branches";

export const DEFAULT_CANVAS_BACKGROUND_SETTINGS: CanvasBackgroundSettings = {
  showDots: true,
  showGrid: false,
  snapToGrid: false,
  gridSize: 24,
  opacity: 0.5,
};

export type PathBranchingWorkspaceSession = {
  view?: AppView;
  selection?: Selection;
  canonOpen?: boolean;
  filesOpen?: boolean;
  canonWidth?: number;
  storiesWidth?: number;
  exportOpen?: boolean;
  dataOpen?: boolean;
  eventInspectorOpen?: boolean;
  eventInspectorOpenEventIds?: string[];
  eventInspectorExpandedEventId?: string;
  canvasMode?: CanvasMode;
  focusNodeId?: string;
  markdownTabs?: MarkdownEditorTab[];
  activeMarkdownTabId?: string;
  storyOutlineTab?: StoryOutlineTab;
};

export type AppSettings = {
  theme: ThemeId;
  recentProjects: string[];
  lastOpenedProject?: string;
  lastView?: AppView;
  canvasBackground: CanvasBackgroundSettings;
  canvasLayout: CanvasLayoutMode;
  workspaceSessions?: Record<string, PathBranchingWorkspaceSession>;
};

export function normalizeCanvasBackgroundSettings(value: unknown): CanvasBackgroundSettings {
  const settings = value && typeof value === "object" ? (value as Partial<CanvasBackgroundSettings>) : {};
  const gridSize = typeof settings.gridSize === "number" && Number.isFinite(settings.gridSize)
    ? Math.min(80, Math.max(8, Math.round(settings.gridSize)))
    : DEFAULT_CANVAS_BACKGROUND_SETTINGS.gridSize;
  const opacity = typeof settings.opacity === "number" && Number.isFinite(settings.opacity)
    ? Math.min(1, Math.max(0.05, settings.opacity))
    : DEFAULT_CANVAS_BACKGROUND_SETTINGS.opacity;
  return {
    showDots: typeof settings.showDots === "boolean" ? settings.showDots : DEFAULT_CANVAS_BACKGROUND_SETTINGS.showDots,
    showGrid: typeof settings.showGrid === "boolean" ? settings.showGrid : DEFAULT_CANVAS_BACKGROUND_SETTINGS.showGrid,
    snapToGrid: typeof settings.snapToGrid === "boolean" ? settings.snapToGrid : DEFAULT_CANVAS_BACKGROUND_SETTINGS.snapToGrid,
    gridSize,
    opacity,
  };
}

export function normalizeCanvasLayoutMode(value: unknown): CanvasLayoutMode {
  return value === "timeline" || value === "branches" || value === "branching" ? value : "branching";
}

export function loadSettings(): AppSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<AppSettings>;
    const workspaceSessions =
      parsed.workspaceSessions && typeof parsed.workspaceSessions === "object" ? parsed.workspaceSessions : {};
    return {
      theme: normalizeThemeId(parsed.theme),
      recentProjects: Array.isArray(parsed.recentProjects)
        ? parsed.recentProjects.filter((item): item is string => typeof item === "string")
        : [],
      lastOpenedProject: typeof parsed.lastOpenedProject === "string" ? parsed.lastOpenedProject : undefined,
      lastView: parsed.lastView === "workspace" || parsed.lastView === "home" ? parsed.lastView : "home",
      canvasBackground: normalizeCanvasBackgroundSettings(parsed.canvasBackground),
      canvasLayout: normalizeCanvasLayoutMode(parsed.canvasLayout),
      workspaceSessions,
    };
  } catch {
    return {
      theme: "worldnotion-light",
      recentProjects: [],
      lastView: "home",
      canvasBackground: DEFAULT_CANVAS_BACKGROUND_SETTINGS,
      canvasLayout: "branching",
      workspaceSessions: {},
    };
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function clampPanelWidth(value: unknown) {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_PANEL_WIDTH;
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(numericValue)));
}

export function rememberRecentProject(settings: AppSettings, path: string): AppSettings {
  return {
    ...settings,
    lastOpenedProject: path,
    recentProjects: [path, ...settings.recentProjects.filter((candidate) => candidate !== path)].slice(0, 8),
    workspaceSessions: settings.workspaceSessions ?? {},
  };
}

export function storableMarkdownTabs(tabs: MarkdownEditorTab[]): MarkdownEditorTab[] {
  return tabs.map((tab) => ({ ...tab, saving: false })).slice(-5);
}

export function isSelection(value: unknown): value is Selection {
  if (!value || typeof value !== "object" || !("type" in value) || !("id" in value)) return false;
  const selection = value as { type?: unknown; id?: unknown };
  return (
    typeof selection.id === "string" &&
    (selection.type === "node" ||
      selection.type === "edge" ||
      selection.type === "canon" ||
      selection.type === "file" ||
      selection.type === "dataObject" ||
      selection.type === "canonSuggestion")
  );
}

export function sessionMarkdownTabs(value: unknown): MarkdownEditorTab[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tab): tab is MarkdownEditorTab => {
      return (
        tab &&
        typeof tab === "object" &&
        typeof tab.id === "string" &&
        typeof tab.canonRefId === "string" &&
        typeof tab.title === "string" &&
        typeof tab.content === "string" &&
        (tab.format === "markdown" || tab.format === "ink" || tab.format === "gameData" || tab.format === "frontmatter")
      );
    })
    .map((tab) => ({ ...tab, saving: false }))
    .slice(-5);
}

export function sessionStringIds(value: unknown, limit = 5): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0).slice(-limit);
}

export function normalizeWorkspaceSession(session: PathBranchingWorkspaceSession | undefined): PathBranchingWorkspaceSession {
  if (!session) return {};
  return {
    view: session.view === "home" || session.view === "workspace" ? session.view : undefined,
    selection: isSelection(session.selection) ? session.selection : undefined,
    canonOpen: typeof session.canonOpen === "boolean" ? session.canonOpen : undefined,
    filesOpen: typeof session.filesOpen === "boolean" ? session.filesOpen : undefined,
    canonWidth: session.canonWidth === undefined ? undefined : clampPanelWidth(session.canonWidth),
    storiesWidth: session.storiesWidth === undefined ? undefined : clampPanelWidth(session.storiesWidth),
    exportOpen: typeof session.exportOpen === "boolean" ? session.exportOpen : undefined,
    dataOpen: typeof session.dataOpen === "boolean" ? session.dataOpen : undefined,
    eventInspectorOpen: typeof session.eventInspectorOpen === "boolean" ? session.eventInspectorOpen : undefined,
    eventInspectorOpenEventIds: sessionStringIds(session.eventInspectorOpenEventIds),
    eventInspectorExpandedEventId:
      typeof session.eventInspectorExpandedEventId === "string" ? session.eventInspectorExpandedEventId : undefined,
    canvasMode: session.canvasMode === "branching" || session.canvasMode === "focus" ? session.canvasMode : undefined,
    focusNodeId: typeof session.focusNodeId === "string" ? session.focusNodeId : undefined,
    markdownTabs: sessionMarkdownTabs(session.markdownTabs),
    activeMarkdownTabId: typeof session.activeMarkdownTabId === "string" ? session.activeMarkdownTabId : undefined,
    storyOutlineTab:
      session.storyOutlineTab === "sequence" || session.storyOutlineTab === "branches" || session.storyOutlineTab === "events"
        ? session.storyOutlineTab
        : undefined,
  };
}
