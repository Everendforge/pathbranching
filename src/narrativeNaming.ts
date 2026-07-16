import type { BranchingProject, EventNode, EventType } from "./domain.js";

function eventLabel(type: EventType) {
  if (type === "final") return "Final Event";
  if (type === "exploration") return "Exploration Event";
  return "Event";
}

function eventLineage(project: BranchingProject, eventId: string | undefined) {
  const lineage: EventNode[] = [];
  const seen = new Set<string>();
  let current = eventId ? project.events.find((event) => event.id === eventId) : undefined;
  while (current && !seen.has(current.id)) {
    lineage.unshift(current);
    seen.add(current.id);
    current = current.parentEventId
      ? project.events.find((event) => event.id === current!.parentEventId)
      : undefined;
  }
  return lineage;
}

function sequenceForEvent(project: BranchingProject, eventId: string | undefined) {
  const lineage = eventLineage(project, eventId);
  const rootId = lineage[0]?.id;
  return project.sequences.find((sequence) =>
    rootId && (sequence.eventIds.includes(rootId) || sequence.entryEventId === rootId),
  ) ?? project.sequences.find((sequence) =>
    sequence.id === (project.canvas?.activeSequenceId ?? project.entrySequenceId),
  ) ?? project.sequences[0];
}

function branchForEvent(project: BranchingProject, eventId: string | undefined, branchId?: string) {
  const lineage = eventLineage(project, eventId);
  const inheritedBranchId = branchId ?? [...lineage].reverse().find((event) => event.branchRef)?.branchRef;
  return inheritedBranchId
    ? project.branches.find((branch) => branch.id === inheritedBranchId)
    : undefined;
}

export function automaticNarrativeName(
  project: BranchingProject,
  parentEventId: string | undefined,
  label: string,
  ordinal: number,
  branchId?: string,
) {
  const sequence = sequenceForEvent(project, parentEventId);
  const branch = branchForEvent(project, parentEventId, branchId);
  const context = [
    sequence?.name || sequence?.id || "Sequence",
    branch?.title || "No division",
    parentEventId ? project.events.find((event) => event.id === parentEventId)?.name : undefined,
    `${label} ${ordinal}`,
  ].filter((value): value is string => Boolean(value?.trim()));
  return context.join(" · ");
}

export function automaticEventName(
  project: BranchingProject,
  type: EventType,
  parentEventId?: string,
  branchId?: string,
) {
  const siblingEvents = parentEventId
    ? project.events.filter((event) => event.parentEventId === parentEventId)
    : project.events.filter((event) => {
        const sequence = sequenceForEvent(project, undefined);
        return Boolean(sequence?.eventIds.includes(event.id)) && (!branchId || event.branchRef === branchId);
      });
  return automaticNarrativeName(
    project,
    parentEventId,
    eventLabel(type),
    siblingEvents.length + 1,
    branchId,
  );
}

