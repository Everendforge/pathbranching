import type { Branch, BranchingProject, CanvasScope, Decision, DialogueBeat, EventNode, Outcome, ScriptBlock, Sequence, Transition } from "./domain.js";
import { conditionCount } from "./logic.js";

export type StoryOutlineTab = "sequence" | "branches" | "paths";

export type SequenceConnectionPreview = {
  id: string;
  fromSequenceId: string;
  fromSequenceName: string;
  toSequenceId: string;
  toSequenceName: string;
  fromEventId: string;
  fromEventName: string;
  toEventId: string;
  toEventName: string;
  label: string;
  conditionCount: number;
};

export type EventDependencyLink = {
  transitionId: string;
  eventId: string;
  eventName: string;
  label: string;
  conditionCount: number;
};

export type EventDependencyOutlineItem = {
  event: EventNode;
  branch?: Branch;
  isEntry: boolean;
  isTerminal: boolean;
  incoming: EventDependencyLink[];
  outgoing: EventDependencyLink[];
};

function withValue(values: string[] | undefined, value: string) {
  return values?.includes(value) ? values : [...(values ?? []), value];
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function eventById(project: BranchingProject) {
  return new Map(project.events.map((event) => [event.id, event]));
}

function branchById(project: BranchingProject) {
  return new Map(project.branches.map((branch) => [branch.id, branch]));
}

function sequenceById(project: BranchingProject) {
  return new Map(project.sequences.map((sequence) => [sequence.id, sequence]));
}

function ownerSequenceIdForEvent(project: BranchingProject, eventId: string) {
  return project.sequences.find((sequence) => sequence.eventIds.includes(eventId))?.id;
}

export function branchesForSequence(project: BranchingProject, sequenceId: string | undefined): Branch[] {
  const sequence = sequenceId ? project.sequences.find((item) => item.id === sequenceId) : undefined;
  if (!sequence) return [];

  const sequenceEventIds = new Set(sequence.eventIds);
  const ids = uniqueValues([
    ...(sequence.branchIds ?? []),
    ...project.events
      .filter((event) => sequenceEventIds.has(event.id))
      .map((event) => event.branchRef ?? undefined),
  ]);
  const branches = branchById(project);
  return ids.map((id) => branches.get(id)).filter((branch): branch is Branch => Boolean(branch));
}

export function eventsForBranch(project: BranchingProject, branchId: string, sequenceId?: string): EventNode[] {
  const sequenceEventIds = sequenceId
    ? new Set(project.sequences.find((sequence) => sequence.id === sequenceId)?.eventIds ?? [])
    : undefined;
  return project.events.filter(
    (event) => event.branchRef === branchId && (!sequenceEventIds || sequenceEventIds.has(event.id)),
  );
}

export function normalizeBranchMembership(project: BranchingProject): BranchingProject {
  const events = eventById(project);
  const branches = branchById(project);
  const branchEvents = new Map<string, string[]>();

  project.events.forEach((event) => {
    if (event.branchRef && branches.has(event.branchRef)) {
      branchEvents.set(event.branchRef, withValue(branchEvents.get(event.branchRef), event.id));
    }
  });

  const normalizedBranches = project.branches.map((branch) => ({
    ...branch,
    eventIds: project.events
      .filter((event) => event.branchRef === branch.id)
      .map((event) => event.id),
  }));

  const normalizedSequences = project.sequences.map((sequence) => {
    const eventIds = sequence.eventIds.filter((eventId) => events.has(eventId));
    const eventBranchIds = uniqueValues(eventIds.map((eventId) => events.get(eventId)?.branchRef ?? undefined)).filter((branchId) =>
      branches.has(branchId),
    );
    return {
      ...sequence,
      eventIds,
      branchIds: uniqueValues([...(sequence.branchIds ?? []), ...eventBranchIds]).filter((branchId) => branches.has(branchId)),
    };
  });

  return {
    ...project,
    sequences: normalizedSequences,
    branches: normalizedBranches,
  };
}

export function assignEventToBranch(
  project: BranchingProject,
  eventId: string,
  branchId: string | undefined,
): BranchingProject {
  const targetBranchId = branchId && project.branches.some((branch) => branch.id === branchId) ? branchId : undefined;
  const sequenceId = ownerSequenceIdForEvent(project, eventId);
  const updatedProject: BranchingProject = {
    ...project,
    events: project.events.map((event) =>
      event.id === eventId ? { ...event, branchRef: targetBranchId ?? undefined } : event,
    ),
    sequences: project.sequences.map((sequence) =>
      sequence.id === sequenceId && targetBranchId
        ? { ...sequence, branchIds: withValue(sequence.branchIds, targetBranchId), eventIds: withValue(sequence.eventIds, eventId) }
        : sequence,
    ),
  };
  return normalizeBranchMembership(updatedProject);
}

export function buildSequenceConnectionPreview(project: BranchingProject): SequenceConnectionPreview[] {
  const sequences = sequenceById(project);
  const events = eventById(project);
  const ownerByEvent = new Map<string, string>();
  project.sequences.forEach((sequence) => {
    sequence.eventIds.forEach((eventId) => ownerByEvent.set(eventId, sequence.id));
  });

  return project.events.flatMap((event) => {
    const fromSequenceId = ownerByEvent.get(event.id);
    if (!fromSequenceId) return [];
    const fromSequence = sequences.get(fromSequenceId);
    if (!fromSequence) return [];

    return (event.transitions ?? []).flatMap((transition) => {
      const toSequenceId = ownerByEvent.get(transition.to);
      if (!toSequenceId || toSequenceId === fromSequenceId) return [];
      const toSequence = sequences.get(toSequenceId);
      const toEvent = events.get(transition.to);
      if (!toSequence || !toEvent) return [];
      return [
        {
          id: transition.id,
          fromSequenceId,
          fromSequenceName: fromSequence.name,
          toSequenceId,
          toSequenceName: toSequence.name,
          fromEventId: event.id,
          fromEventName: event.name,
          toEventId: toEvent.id,
          toEventName: toEvent.name,
          label: transition.label ?? "transition",
          conditionCount: conditionCount(transition.conditions),
        },
      ];
    });
  });
}

function linkFromTransition(project: BranchingProject, transition: Transition, eventId: string): EventDependencyLink | undefined {
  const event = project.events.find((candidate) => candidate.id === eventId);
  if (!event) return undefined;
  return {
    transitionId: transition.id,
    eventId,
    eventName: event.name,
    label: transition.label ?? "transition",
    conditionCount: conditionCount(transition.conditions),
  };
}

export function buildEventDependencyOutline(project: BranchingProject, sequenceId: string | undefined): EventDependencyOutlineItem[] {
  const sequence = sequenceId ? project.sequences.find((item) => item.id === sequenceId) : undefined;
  if (!sequence) return [];
  const sequenceEventIds = new Set(sequence.eventIds);
  const branches = branchById(project);
  const categories = new Map((project.eventCategories ?? []).map((category) => [category.id, category]));

  return sequence.eventIds
    .map((eventId) => project.events.find((event) => event.id === eventId))
    .filter((event): event is EventNode => Boolean(event))
    .map((event) => {
      const incoming = project.events.flatMap((sourceEvent) =>
        (sourceEvent.transitions ?? [])
          .filter((transition) => transition.to === event.id)
          .map((transition) => linkFromTransition(project, transition, sourceEvent.id))
          .filter((link): link is EventDependencyLink => Boolean(link)),
      );
      const outgoing = (event.transitions ?? [])
        .filter((transition) => sequenceEventIds.has(transition.to) || project.events.some((target) => target.id === transition.to))
        .map((transition) => linkFromTransition(project, transition, transition.to))
        .filter((link): link is EventDependencyLink => Boolean(link));

      return {
        event,
        branch: event.branchRef ? branches.get(event.branchRef) : undefined,
        isEntry: sequence.entryEventId === event.id,
        isTerminal: event.type === "final" || Boolean(categories.get(event.type)?.terminal),
        incoming,
        outgoing,
      };
    });
}

export type PathTreeNodeKind = "event" | "decision" | "dialogue" | "beat" | "trigger" | "outcome";

export type PathTreeNode = {
  id: string;
  kind: PathTreeNodeKind;
  label: string;
  subtitle?: string;
  badges: string[];
  scope: CanvasScope;
  selectId: string;
  eventId?: string;
  children: PathTreeNode[];
};

function scriptBlockForBeat(project: BranchingProject, beat: DialogueBeat): ScriptBlock | undefined {
  return project.scriptDocuments
    ?.find((script) => script.id === beat.blockRef.scriptId)
    ?.blocks.find((block) => block.id === beat.blockRef.blockId);
}

function beatPathNode(
  project: BranchingProject,
  event: EventNode,
  beat: DialogueBeat,
  scope: CanvasScope,
  index: number,
  dialogueId?: string,
): PathTreeNode {
  const block = scriptBlockForBeat(project, beat);
  const content = block?.content.trim();
  const kindLabel = beat.kind === "speech" ? "Speech Beat" : "Direction";
  return {
    id: `beat:${event.id}:${beat.id}`,
    kind: "beat",
    label: content ? content.slice(0, 80) : `${kindLabel} ${index + 1}`,
    subtitle: `${kindLabel}${dialogueId ? " · Dialogue" : ""}`,
    badges: block?.characterRef || block?.speakerRef ? [block.characterRef ?? block.speakerRef ?? ""] : [],
    scope,
    selectId: `beat:${event.id}:${beat.id}`,
    eventId: event.id,
    children: [],
  };
}

function outcomePathNode(
  event: EventNode,
  decision: Decision,
  outcome: Outcome,
  index: number,
  scope: CanvasScope,
): PathTreeNode {
  return {
    id: `outcome:${event.id}:${decision.id}:${outcome.id}`,
    kind: "outcome",
    label: (outcome.visibleText ?? outcome.name).trim() || `Option ${String.fromCharCode(65 + index)}`,
    subtitle: outcome.name,
    badges: outcome.availability ? ["conditional"] : [],
    scope,
    selectId: `outcome:${event.id}:${decision.id}:${outcome.id}`,
    eventId: event.id,
    children: [],
  };
}

function decisionPathNode(
  event: EventNode,
  decision: Decision,
  scope: CanvasScope,
): PathTreeNode {
  return {
    id: `decision:${event.id}:${decision.id}`,
    kind: "decision",
    label: decision.name,
    subtitle: `${decision.outcomes.length} outcome${decision.outcomes.length === 1 ? "" : "s"}`,
    badges: [decision.type],
    scope,
    selectId: `decision:${event.id}:${decision.id}`,
    eventId: event.id,
    children: decision.outcomes.map((outcome, index) => outcomePathNode(event, decision, outcome, index, scope)),
  };
}

function buildEventPathNode(project: BranchingProject, event: EventNode, scope: CanvasScope, visited: Set<string>): PathTreeNode {
  const nestedScope: CanvasScope = { kind: "event", id: event.id };
  const childEvents = visited.has(event.id)
    ? []
    : (event.childEventIds ?? [])
        .map((childId) => project.events.find((candidate) => candidate.id === childId))
        .filter((candidate): candidate is EventNode => Boolean(candidate));
  const nextVisited = new Set(visited).add(event.id);

  const children: PathTreeNode[] = [
    ...childEvents.map((child) => buildEventPathNode(project, child, nestedScope, nextVisited)),
    ...(event.dialogueStarts ?? []).map((start): PathTreeNode => ({
      id: `dialogue-start:${event.id}:${start.id}`,
      kind: "trigger",
      label: start.source?.kind === "canonRef"
        ? project.canonRefs.find((ref) => ref.id === start.source?.id)?.label ?? start.source.id
        : start.source?.kind === "dataObject"
          ? project.projectDataObjects?.find((item) => item.id === start.source?.id)?.name ?? start.source.id
          : "Choose an interactable source",
      subtitle: "Dialogue Trigger",
      badges: start.availability ? ["conditional"] : [],
      scope: nestedScope,
      selectId: `dialogue-start:${event.id}:${start.id}`,
      eventId: event.id,
      children: [],
    })),
    ...(event.dialogueBeats ?? []).map((beat, index) => beatPathNode(project, event, beat, nestedScope, index)),
    ...(event.decisions ?? []).filter((decision) => !decision.dialogueId).map((decision) => decisionPathNode(event, decision, nestedScope)),
    ...(event.dialogues ?? []).map((dialogue): PathTreeNode => {
      const dialogueScope: CanvasScope = { kind: "dialogue", id: dialogue.id, eventId: event.id };
      const dialogueDecisions = (event.decisions ?? []).filter((decision) => decision.dialogueId === dialogue.id);
      const dialogueBeats = dialogue.beats ?? [];
      return {
        id: `dialogue:${event.id}:${dialogue.id}`,
        kind: "dialogue",
        label: dialogue.title,
        subtitle: `${dialogueBeats.length} beat${dialogueBeats.length === 1 ? "" : "s"}`,
        badges: dialogueDecisions.length ? [`${dialogueDecisions.length} decisions`] : [],
        scope: dialogueScope,
        selectId: `dialogue-boundary:${event.id}:${dialogue.id}:input`,
        eventId: event.id,
        children: [
          ...dialogueBeats.map((beat, index) => beatPathNode(project, event, beat, dialogueScope, index, dialogue.id)),
          ...dialogueDecisions.map((decision) => decisionPathNode(event, decision, dialogueScope)),
        ],
      };
    }),
  ];

  return {
    id: event.id,
    kind: "event",
    label: event.name,
    subtitle: event.type,
    badges: [
      childEvents.length ? `${childEvents.length} nested` : "",
      event.decisions?.length ? `${event.decisions.length} decisions` : "",
      event.dialogues?.length ? `${event.dialogues.length} dialogues` : "",
    ].filter((badge): badge is string => Boolean(badge)),
    scope,
    selectId: event.id,
    eventId: event.id,
    children,
  };
}

export function buildPathTree(project: BranchingProject, sequence: Sequence | undefined): PathTreeNode[] {
  if (!sequence) return [];
  const rootScope: CanvasScope = { kind: "sequence", id: sequence.id };
  return sequence.eventIds
    .map((eventId) => project.events.find((event) => event.id === eventId))
    .filter((event): event is EventNode => Boolean(event))
    .map((event) => buildEventPathNode(project, event, rootScope, new Set()));
}
