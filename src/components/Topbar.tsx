import {
  ArrowLeft,
  Crown,
  Download,
  FolderOpen,
  Home,
  Moon,
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
  theme,
  onOpenSettings,
  onRevealUniverse,
  onToggleTheme,
  onExportRuntime,
  onHome,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  project?: BranchingProject;
  fileState?: ProjectFileState;
  findings: ValidationFinding[];
  exportOpen: boolean;
  theme: ThemeId;
  onOpenSettings: () => void;
  onRevealUniverse: () => void;
  onToggleTheme: () => void;
  onExportRuntime: () => void;
  onHome: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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
        <button
          type="button"
          className="dock-icon-button"
          onClick={onRevealUniverse}
          disabled={!fileState?.universePath}
          title={fileState?.universePath ? "Reveal universe folder" : "Open a universe first"}
        >
          <FolderOpen size={14} />
        </button>
      </div>

      <div className="dock-top-right">
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

        <div className="dock-command-group" aria-label="Panels">
          <button type="button" title="Export current story" className={exportOpen ? "active" : ""} onClick={onExportRuntime}>
            <Download size={14} />
            <span>Export</span>
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
