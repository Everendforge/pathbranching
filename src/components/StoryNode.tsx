import { Handle, Position, type NodeProps, type NodeTypes } from "@xyflow/react";
import type { StoryCanvasNode, StoryCanvasNodeData } from "../canvas/storyCanvasModel.js";

function badgeText(value: string) {
  return value.length > 22 ? `${value.slice(0, 19)}...` : value;
}

function StoryNode({ data, selected }: NodeProps<StoryCanvasNode>) {
  const nodeData = data as StoryCanvasNodeData;
  const isFinalEvent = nodeData.kind === "event" && nodeData.badges.includes("terminal");
  const focusClass = typeof nodeData.focusState === "string" ? ` focus-${nodeData.focusState}` : "";
  const canReceive = nodeData.kind !== "start" && nodeData.kind !== "sequence";
  const canSource = nodeData.kind === "start" || (nodeData.kind !== "sequence" && !isFinalEvent);

  if (nodeData.isContainer) {
    return (
      <div className={`story-node branch-container${focusClass} ${selected ? "selected" : ""}`}>
        {canReceive ? <Handle type="target" position={Position.Left} /> : null}
        <div className="node-kind">{nodeData.kind}</div>
        <div className="node-title">{nodeData.title}</div>
        {nodeData.subtitle ? <div className="node-subtitle">{nodeData.subtitle}</div> : null}
        {nodeData.badges.length > 0 ? (
          <div className="node-badges">
            {nodeData.badges.slice(0, 5).map((badge) => (
              <span key={badge}>{badgeText(badge)}</span>
            ))}
          </div>
        ) : null}
        {canSource ? <Handle type="source" position={Position.Right} /> : null}
      </div>
    );
  }

  return (
    <div className={`story-node ${nodeData.kind}${focusClass}${isFinalEvent ? " terminal" : ""}${selected ? " selected" : ""}`}>
      {canReceive ? <Handle type="target" position={Position.Left} /> : null}
      <div className="node-kind">{nodeData.kind}</div>
      <div className="node-title">{nodeData.title}</div>
      {nodeData.subtitle ? <div className="node-subtitle">{nodeData.subtitle}</div> : null}
      {nodeData.badges.length > 0 ? (
        <div className="node-badges">
          {nodeData.badges.slice(0, 4).map((badge) => (
            <span key={badge}>{badgeText(badge)}</span>
          ))}
        </div>
      ) : null}
      {canSource ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}

export const nodeTypes = {
  story: StoryNode,
} satisfies NodeTypes;
