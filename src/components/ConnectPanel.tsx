import { Box, Gamepad2, Layers } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { WorkspaceSidePanel } from "./WorkspaceSidePanel.js";

const engines = [
  ["Unity", "Unity adapter v0.1", Gamepad2],
  ["Unreal", "Unreal adapter v0.1", Layers],
  ["Godot", "Godot adapter v0.1", Box],
] as const;

export function ConnectPanel({ collapsed, onCollapsedChange, onContextMenu }: {
  collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void; onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
}) {
  return <WorkspaceSidePanel title="Connect" side="right" collapsed={collapsed} onCollapsedChange={onCollapsedChange} onContextMenu={onContextMenu}>
    <div className="connect-list">{engines.map(([name, requirement, Icon]) => <section className="coming-soon-card" key={name}><Icon size={16} /><div><strong>{name}</strong><span>Coming soon · requires {requirement}</span></div></section>)}</div>
  </WorkspaceSidePanel>;
}
