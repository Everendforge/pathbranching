import { Download, FileCode2, Package } from "lucide-react";
import { useMemo, type MouseEvent as ReactMouseEvent } from "react";
import { buildExportPreview, type ExportPreviewMode } from "../exportPreview.js";
import type { BranchingProject } from "../domain.js";
import { WorkspaceSidePanel } from "./WorkspaceSidePanel.js";

export function ExportPanel({ project, collapsed, onCollapsedChange, onContextMenu, onExport }: {
  project: BranchingProject; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void; onExport: (mode: ExportPreviewMode) => void;
}) {
  const preview = useMemo(() => buildExportPreview(project, "runtime"), [project]);
  return <WorkspaceSidePanel title="Export" side="right" collapsed={collapsed} onCollapsedChange={onCollapsedChange} onContextMenu={onContextMenu}>
    <div className="export-panel-list">
      <button type="button" className="export-target" onClick={() => onExport("runtime")}><Package size={16} /><span><strong>Runtime Package</strong><small>{preview.runtimePackage.nodes.length} nodes · JSON</small></span><Download size={14} /></button>
      <button type="button" className="export-target" onClick={() => onExport("ink")}><FileCode2 size={16} /><span><strong>Ink</strong><small>{preview.inkExport.files.length} files · preview ready</small></span><Download size={14} /></button>
      <button type="button" className="export-target" onClick={() => onExport("gameData")}><FileCode2 size={16} /><span><strong>SINPO / Game Data</strong><small>JSON · preview ready</small></span><Download size={14} /></button>
      <section className="coming-soon-card"><strong>Harlowe</strong><span>Coming soon · adapter not installed</span></section>
      <section className="coming-soon-card"><strong>More formats</strong><span>Coming soon · configurable adapters</span></section>
    </div>
  </WorkspaceSidePanel>;
}
