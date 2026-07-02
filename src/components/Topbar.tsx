import {
  ArrowLeft,
  Crown,
  Database,
  Download,
  FilePlus2,
  FolderOpen,
  Home,
  Moon,
  RotateCcw,
  Save,
  SearchCheck,
  Settings,
  Sun,
} from "lucide-react";
import type { BranchingProject, ValidationFinding } from "../domain.js";
import { projectFileName, type ProjectFileState } from "../projectPersistence.js";
import { isDarkTheme, themeById, type ThemeId } from "../themes.js";
import { UniverseIconFrame } from "./UniverseIconFrame.js";

function universeDisplayName(project?: BranchingProject, fileState?: ProjectFileState) {
  return fileState?.universeProfile?.name ?? project?.name ?? project?.projectId ?? "No universe";
}

function universeDisplayPath(fileState?: ProjectFileState) {
  const universePath = projectFileName(fileState?.universePath ?? fileState?.path);
  const storyPath = projectFileName(fileState?.storyPath ?? fileState?.path);
  return [universePath, storyPath].filter(Boolean).join(" / ");
}

export function Topbar({
  project,
  fileState,
  findings,
  exportOpen,
  dataOpen,
  theme,
  onOpenSettings,
  onToggleTheme,
  onOpenProject,
  onSaveProject,
  onExportRuntime,
  onHome,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onCreateSequence,
  onValidate,
  onToggleExport,
  onToggleData,
  onCreateDataObject,
  onResetLayout,
}: {
  project?: BranchingProject;
  fileState?: ProjectFileState;
  findings: ValidationFinding[];
  exportOpen: boolean;
  dataOpen: boolean;
  theme: ThemeId;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
  onExportRuntime: () => void;
  onHome: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCreateSequence: () => void;
  onValidate: () => void;
  onToggleExport: () => void;
  onToggleData: () => void;
  onCreateDataObject: () => void;
  onResetLayout: () => void;
}) {
  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  const status = findings.length === 0 ? "Clean" : `${findings.length} findings`;
  const universeName = universeDisplayName(project, fileState);
  const universePath = universeDisplayPath(fileState);

  return (
    <header className="topbar dock-top-bar pathbranching-topbar" aria-label="Workspace controls">
      <div className="dock-top-left">
        <div className="forge-corner-menu">
          <button type="button" className="forge-corner-button" title="Everend Forge">
            <Crown size={16} />
          </button>
        </div>

        <button type="button" className="dock-icon-button" title="Home" onClick={onHome}>
          <Home size={15} />
        </button>

        <div className="dock-top-divider" />

        <button type="button" className="dock-universe-button" onClick={onOpenSettings} title="Universe settings">
          <UniverseIconFrame profile={fileState?.universeProfile} />
          <span className="dock-universe-copy">
            <strong>{universeName}</strong>
            <span>
              {universePath || "Open a universe"}
              {fileState?.dirty ? " *" : ""}
            </span>
          </span>
        </button>
        <button type="button" className="dock-icon-button dock-settings-button" onClick={onOpenSettings} title="Application settings">
          <Settings size={14} />
        </button>
      </div>

      <div className="dock-top-right">
        <div className="dock-command-group" aria-label="Universe">
          <button type="button" title="Open universe" onClick={onOpenProject}>
            <FolderOpen size={14} />
            <span>Open</span>
          </button>
          <button type="button" title="Save branching story" onClick={onSaveProject}>
            <Save size={14} />
            <span>Save</span>
          </button>
          <button type="button" title="Export current preview" onClick={onExportRuntime}>
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>

        <div className="dock-command-group" aria-label="History">
          <button type="button" title="Undo" onClick={onUndo} disabled={!canUndo}>
            <ArrowLeft size={14} />
            <span>Undo</span>
          </button>
          <button type="button" title="Redo" onClick={onRedo} disabled={!canRedo}>
            <ArrowLeft size={14} style={{ transform: "scaleX(-1)" }} />
            <span>Redo</span>
          </button>
        </div>

        <div className="dock-command-group" aria-label="Authoring">
          <button type="button" title="New sequence" onClick={onCreateSequence}>
            <FilePlus2 size={14} />
            <span>Sequence</span>
          </button>
          <button type="button" title="Validate project" onClick={onValidate}>
            <SearchCheck size={14} />
            <span>Validate</span>
          </button>
        </div>

        <div className="dock-command-group" aria-label="Panels">
          <button type="button" title="Toggle runtime export preview" className={exportOpen ? "active" : ""} onClick={onToggleExport}>
            <Download size={14} />
            <span>Export View</span>
          </button>
          <button type="button" title="Toggle project data drawer" className={dataOpen ? "active" : ""} onClick={onToggleData}>
            <Database size={14} />
            <span>Data</span>
          </button>
          <button type="button" title="Create knowledge data object" onClick={onCreateDataObject}>
            <FilePlus2 size={14} />
            <span>Knowledge</span>
          </button>
          <button type="button" title="Reset canvas layout" onClick={onResetLayout}>
            <RotateCcw size={14} />
            <span>Layout</span>
          </button>
        </div>

        <span className={`pathbranching-status ${errorCount > 0 ? "has-errors" : ""}`} title={status}>
          {status}
          {errorCount > 0 ? ` (${errorCount})` : ""}
        </span>

        <button type="button" className="dock-icon-button" onClick={onToggleTheme} title={`Toggle theme (${themeById(theme).label})`}>
          {isDarkTheme(theme) ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}
