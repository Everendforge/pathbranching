import type { Branch, BranchingProject, EventNode, Sequence } from "./domain.js";

export function activeSequenceId(project: BranchingProject) {
  const preferred = project.canvas?.activeSequenceId ?? project.entrySequenceId ?? project.sequences[0]?.id;
  return project.sequences.some((sequence) => sequence.id === preferred) ? preferred : project.sequences[0]?.id;
}

export function findSequence(project: BranchingProject, id: string): Sequence | undefined {
  return project.sequences.find((sequence) => sequence.id === id);
}

export function findEvent(project: BranchingProject, id: string): EventNode | undefined {
  return project.events.find((event) => event.id === id);
}

export function findBranch(project: BranchingProject, id: string): Branch | undefined {
  return project.branches.find((branch) => branch.id === id);
}

export function storyEventIds(project: BranchingProject, sequenceId = activeSequenceId(project)) {
  const sequence = sequenceId ? findSequence(project, sequenceId) : undefined;
  return new Set(sequence?.eventIds ?? []);
}
