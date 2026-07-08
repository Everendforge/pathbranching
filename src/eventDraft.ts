import type { BranchingProject, EventNode } from "./domain.js";
import type { Selection } from "./appTypes.js";
import { findEvent } from "./storySelection.js";

export type EventDraftMode = "text" | "components";

export type EventDraft = {
  eventId: string;
  baseEvent: EventNode;
  draftEvent: EventNode;
  dirty: boolean;
  saving: boolean;
  mode: EventDraftMode;
};

function cloneEvent(event: EventNode): EventNode {
  return structuredClone(event);
}

export function createEventDraftFromSelection(
  project: BranchingProject | undefined,
  selection: Selection | undefined,
  mode: EventDraftMode = "components",
): EventDraft | undefined {
  if (!project || selection?.type !== "node") return undefined;
  const event = findEvent(project, selection.id);
  if (!event) return undefined;
  return {
    eventId: event.id,
    baseEvent: cloneEvent(event),
    draftEvent: cloneEvent(event),
    dirty: false,
    saving: false,
    mode,
  };
}

export function updateEventDraft(
  draft: EventDraft | undefined,
  updates: Partial<EventNode>,
): EventDraft | undefined {
  if (!draft) return undefined;
  return {
    ...draft,
    draftEvent: {
      ...draft.draftEvent,
      ...updates,
    },
    dirty: true,
  };
}

export function setEventDraftMode(draft: EventDraft | undefined, mode: EventDraftMode): EventDraft | undefined {
  if (!draft) return undefined;
  return { ...draft, mode };
}

export function applyEventDraftToProject(project: BranchingProject, draft: EventDraft): BranchingProject {
  return {
    ...project,
    events: project.events.map((event) => (event.id === draft.eventId ? cloneEvent(draft.draftEvent) : event)),
  };
}

export function eventDraftMatchesSelection(draft: EventDraft | undefined, selection: Selection | undefined) {
  return Boolean(draft && selection?.type === "node" && selection.id === draft.eventId);
}
