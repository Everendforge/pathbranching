import type { BranchingProject, DialogueBeat, DialogueStart, EventNode, Outcome } from "./domain.js";

export type EventScriptItemKind = "event" | "dialogue" | "beat" | "decision" | "outcome";
export type EventScriptVisualKind = "event" | "dialogue" | "speech" | "direction" | "decision" | "outcome";

export type EventScriptItem = {
  nodeId: string;
  kind: EventScriptItemKind;
  visualKind: EventScriptVisualKind;
  label: string;
  dialogueId?: string;
  dialogueTitle?: string;
  beat?: DialogueBeat;
  decisionId?: string;
  outcome?: Outcome;
};

export type EventScriptSection = {
  id: string;
  kind: "event-start" | "trigger" | "unassigned";
  label: string;
  trigger?: DialogueStart;
  dialogueId?: string;
  items: EventScriptItem[];
  sharedItemIds: string[];
  trees: EventScriptTreeNode[];
};

export type EventScriptTreeNode = {
  nodeId: string;
  item: EventScriptItem;
  children: EventScriptTreeNode[];
  ownerSectionId: string;
  structuralParentId?: string;
  depth: number;
  incomingTransitionIds: string[];
  outgoingTransitionIds: string[];
  reference?: "shared" | "cycle";
};

type ScriptSectionRoot = Omit<EventScriptSection, "items" | "sharedItemIds" | "dialogueId" | "trees"> & {
  sources: string[];
};

type ScriptGraph = {
  adjacency: Map<string, string[]>;
  content: Map<string, EventScriptItem>;
  dialogueByNode: Map<string, string>;
};

function beatNodeId(eventId: string, beat: DialogueBeat) {
  return `beat:${eventId}:${beat.id}`;
}

function dialogueNodeId(eventId: string, dialogueId: string) {
  return `dialogue:${eventId}:${dialogueId}`;
}

function outcomeNodeId(eventId: string, decisionId: string, outcomeId: string) {
  return `outcome:${eventId}:${decisionId}:${outcomeId}`;
}

function createGraph(event: EventNode): ScriptGraph {
  const adjacency = new Map<string, string[]>();
  const content = new Map<string, EventScriptItem>();
  const dialogueByNode = new Map<string, string>();
  const addEdge = (from: string, to: string) => {
    const next = adjacency.get(from) ?? [];
    if (!next.includes(to)) adjacency.set(from, [...next, to]);
  };

  content.set(event.id, { nodeId: event.id, kind: "event", visualKind: "event", label: event.name || "Event start" });
  (event.dialogueBeats ?? []).forEach((beat) => {
    content.set(beatNodeId(event.id, beat), {
      nodeId: beatNodeId(event.id, beat),
      kind: "beat",
      visualKind: beat.kind === "speech" ? "speech" : "direction",
      label: beat.kind === "speech" ? "Dialogue" : "Direction",
      beat,
    });
  });
  (event.dialogues ?? []).forEach((dialogue) => {
    const nodeId = dialogueNodeId(event.id, dialogue.id);
    dialogueByNode.set(nodeId, dialogue.id);
    content.set(nodeId, {
      nodeId,
      kind: "dialogue",
      visualKind: "dialogue",
      label: dialogue.title || "Dialogue",
      dialogueId: dialogue.id,
      dialogueTitle: dialogue.title || "Dialogue",
    });
    const entry = dialogue.entryBeatId
      ? dialogue.beats?.find((beat) => beat.id === dialogue.entryBeatId)
      : dialogue.beats?.[0];
    if (entry) addEdge(nodeId, beatNodeId(event.id, entry));
    (dialogue.beats ?? []).forEach((beat) => {
      const nodeId = beatNodeId(event.id, beat);
      content.set(nodeId, {
        nodeId,
        kind: "beat",
        visualKind: beat.kind === "speech" ? "speech" : "direction",
        label: beat.kind === "speech" ? "Dialogue" : "Direction",
        dialogueId: dialogue.id,
        dialogueTitle: dialogue.title || "Dialogue",
        beat,
      });
      dialogueByNode.set(nodeId, dialogue.id);
    });
  });
  (event.decisions ?? []).forEach((decision) => {
    const nodeId = `decision:${event.id}:${decision.id}`;
    content.set(nodeId, {
      nodeId,
      kind: "decision",
      visualKind: "decision",
      label: decision.name || "Decision",
      dialogueId: decision.dialogueId,
      dialogueTitle: event.dialogues?.find((dialogue) => dialogue.id === decision.dialogueId)?.title,
      decisionId: decision.id,
    });
    if (decision.dialogueId) dialogueByNode.set(nodeId, decision.dialogueId);
    decision.outcomes.forEach((outcome) => {
      const outcomeId = outcomeNodeId(event.id, decision.id, outcome.id);
      addEdge(nodeId, outcomeId);
      content.set(outcomeId, {
        nodeId: outcomeId,
        kind: "outcome",
        visualKind: "outcome",
        label: outcome.name || "Option",
        dialogueId: decision.dialogueId,
        dialogueTitle: event.dialogues?.find((dialogue) => dialogue.id === decision.dialogueId)?.title,
        decisionId: decision.id,
        outcome,
      });
      if (decision.dialogueId) dialogueByNode.set(outcomeId, decision.dialogueId);
    });
  });
  (event.transitions ?? []).forEach((transition) => addEdge(transition.from, transition.to));
  return { adjacency, content, dialogueByNode };
}

function reachable(source: string, adjacency: Map<string, string[]>) {
  const seen = new Set<string>();
  const queue = [source];
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    (adjacency.get(current) ?? []).forEach((next) => {
      if (!seen.has(next)) queue.push(next);
    });
  }
  return seen;
}

function triggerLabel(project: BranchingProject, trigger: DialogueStart) {
  if (trigger.source?.kind !== "canonRef") return "Dialogue trigger · configure source";
  const entity = project.canonRefs.find((ref) => ref.id === trigger.source?.id);
  const property = trigger.source.propertyId ? ` · ${trigger.source.propertyId}` : "";
  return `${entity?.label ?? trigger.source.id}${property}`;
}

/**
 * Pure narrative outline used by the Script workspace. It preserves authored
 * route order while making Dialogue nodes explicit structural rows, so a beat
 * never has to guess which dialogue column it belongs to.
 */
export function buildEventScriptOutline(project: BranchingProject, eventId: string): EventScriptSection[] {
  const event = project.events.find((candidate) => candidate.id === eventId);
  if (!event) return [];
  const graph = createGraph(event);
  const inputPortPrefix = `boundary:${event.id}:input:`;
  const inputSources = Array.from(
    new Set(
      (event.transitions ?? [])
        .filter((transition) => transition.from.startsWith(inputPortPrefix))
        .map((transition) => transition.from),
    ),
  );
  const roots: ScriptSectionRoot[] = [
    // An event canvas can enter its script through any visible In port. Those
    // ports are not content nodes themselves, so they must be explicit graph
    // roots rather than relying on the event ID to reach them.
    {
      id: "event-start",
      kind: "event-start",
      label: "Event start",
      sources: [event.id, ...inputSources],
    },
    ...(event.dialogueStarts ?? []).map((trigger) => ({
      id: `trigger:${trigger.id}`,
      kind: "trigger" as const,
      label: triggerLabel(project, trigger),
      trigger,
      sources: [`dialogue-start:${event.id}:${trigger.id}`],
    })),
  ];
  const ownerByNode = new Map<string, string>();
  const sharedBySection = new Map<string, Set<string>>();
  const nodesBySection = new Map<string, Set<string>>();

  roots.forEach((root) => {
    const reached = new Set(
      root.sources.flatMap((source) => Array.from(reachable(source, graph.adjacency))),
    );
    nodesBySection.set(root.id, reached);
    reached.forEach((nodeId) => {
      if (!graph.content.has(nodeId)) return;
      const owner = ownerByNode.get(nodeId);
      if (!owner) {
        ownerByNode.set(nodeId, root.id);
      } else if (owner !== root.id) {
        const shared = sharedBySection.get(root.id) ?? new Set<string>();
        shared.add(nodeId);
        sharedBySection.set(root.id, shared);
      }
    });
  });

  const buildTree = (sectionId: string, nodeId: string, ancestry: Set<string>, structuralParentId?: string, depth = 0): EventScriptTreeNode | undefined => {
    const item = graph.content.get(nodeId);
    if (!item) return undefined;
    const owner = ownerByNode.get(nodeId);
    const transitionIds = (event.transitions ?? []).filter((transition) => transition.from === nodeId || transition.to === nodeId);
    const metadata = {
      ownerSectionId: owner ?? sectionId,
      structuralParentId,
      depth,
      incomingTransitionIds: transitionIds.filter((transition) => transition.to === nodeId).map((transition) => transition.id),
      outgoingTransitionIds: transitionIds.filter((transition) => transition.from === nodeId).map((transition) => transition.id),
    };
    if (owner && owner !== sectionId) return { nodeId, item, children: [], reference: "shared", ...metadata };
    if (ancestry.has(nodeId)) return { nodeId, item, children: [], reference: "cycle", ...metadata };
    const nextAncestry = new Set(ancestry);
    nextAncestry.add(nodeId);
    return {
      nodeId,
      item,
      ...metadata,
      children: (graph.adjacency.get(nodeId) ?? []).flatMap((next) => {
        const child = buildTree(sectionId, next, nextAncestry, nodeId, depth + 1);
        return child ? [child] : [];
      }),
    };
  };
  const sections: EventScriptSection[] = roots.map((root) => {
    const reached = nodesBySection.get(root.id) ?? new Set<string>();
    const itemIds = Array.from(reached).filter((nodeId) => ownerByNode.get(nodeId) === root.id && graph.content.has(nodeId));
    const dialogueId = itemIds.map((nodeId) => graph.dialogueByNode.get(nodeId)).find(Boolean);
    return {
      id: root.id,
      kind: root.kind,
      label: root.label,
      trigger: root.trigger,
      dialogueId,
      items: itemIds.map((nodeId) => graph.content.get(nodeId)!),
      sharedItemIds: Array.from(sharedBySection.get(root.id) ?? []),
      trees: root.sources.flatMap((source) =>
        graph.content.has(source)
          ? (() => {
            const tree = buildTree(root.id, source, new Set<string>());
            return tree ? [tree] : [];
          })()
          : (graph.adjacency.get(source) ?? []).flatMap((nodeId) => {
            const tree = buildTree(root.id, nodeId, new Set<string>());
            return tree ? [tree] : [];
          }),
      ),
    } satisfies EventScriptSection;
  });
  const unassigned = Array.from(graph.content.values()).filter((item) => !ownerByNode.has(item.nodeId));
  if (unassigned.length) {
    const unassignedIds = new Set(unassigned.map((item) => item.nodeId));
    const targets = new Set(Array.from(graph.adjacency.values()).flat().filter((nodeId) => unassignedIds.has(nodeId)));
    const roots = unassigned.filter((item) => !targets.has(item.nodeId));
    const treeRoots = roots.length ? roots : unassigned;
    sections.push({
      id: "unassigned",
      kind: "unassigned",
      label: "Unassigned content",
      trigger: undefined,
      dialogueId: undefined,
      items: unassigned,
      sharedItemIds: [],
      trees: treeRoots.flatMap((item) => {
        const tree = buildTree("unassigned", item.nodeId, new Set<string>());
        return tree ? [tree] : [];
      }),
    });
  }
  return sections;
}

/** @deprecated Use buildEventScriptOutline for new UI. */
export const buildEventScriptSections = buildEventScriptOutline;
