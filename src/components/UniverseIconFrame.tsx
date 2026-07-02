import { GitBranch } from "lucide-react";
import type { UniverseProfile } from "../pathBranchingWorkspace.js";

export function UniverseIconFrame({ profile, size = 28 }: { profile?: UniverseProfile; size?: number }) {
  const icon = profile?.icon;
  if (icon?.type === "image" && icon.value) {
    return (
      <span className="pathbranching-universe-icon" style={{ width: size, height: size }}>
        <img src={icon.value} alt="" />
      </span>
    );
  }

  return (
    <span className="pathbranching-universe-icon" style={{ width: size, height: size }}>
      {icon?.type === "preset" && icon.value ? <span className="universe-preset-icon">{icon.value.slice(0, 2).toUpperCase()}</span> : <GitBranch size={16} />}
    </span>
  );
}
