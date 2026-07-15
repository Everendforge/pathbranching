import { buildEventScriptOutline, buildEventScriptSections } from "../lib/eventScriptModel.js";
import * as mutations from "../lib/projectMutations.js";

const block = (id) => ({ id, kind: "speech", blockRef: { scriptId: "script:demo", blockId: id } });
const project = {
  events: [{
    id: "event:demo",
    name: "Demo event",
    type: "normal",
    dialogueBeats: [block("beat:a"), block("beat:b"), block("beat:entry"), block("beat:orphan")],
    decisions: [{ id: "decision:demo", name: "Choice", type: "dialogue", outcomes: [{ id: "option:yes", name: "Yes" }] }],
    dialogueStarts: [
      { id: "trigger:one", source: { kind: "canonRef", id: "canon:one", propertyId: "talk" } },
      { id: "trigger:two", source: { kind: "canonRef", id: "canon:two", propertyId: "talk" } },
    ],
    transitions: [
      { id: "t1", from: "dialogue-start:event:demo:trigger:one", to: "beat:event:demo:beat:a" },
      { id: "t2", from: "beat:event:demo:beat:a", to: "beat:event:demo:beat:b" },
      { id: "t3", from: "beat:event:demo:beat:b", to: "beat:event:demo:beat:a" },
      { id: "t4", from: "beat:event:demo:beat:a", to: "decision:event:demo:decision:demo" },
      { id: "t5", from: "dialogue-start:event:demo:trigger:two", to: "beat:event:demo:beat:b" },
      { id: "t6", from: "boundary:event:demo:input:entry", to: "beat:event:demo:beat:entry" },
    ],
  }],
  canonRefs: [{ id: "canon:one", label: "One" }, { id: "canon:two", label: "Two" }],
};

const sections = buildEventScriptSections(project, "event:demo");
const outline = buildEventScriptOutline(project, "event:demo");
const start = sections.find((section) => section.id === "event-start");
const firstTrigger = sections.find((section) => section.id === "trigger:trigger:one");
const secondTrigger = sections.find((section) => section.id === "trigger:trigger:two");
const unassigned = sections.find((section) => section.id === "unassigned");

if (!start?.items.some((item) => item.kind === "event")) throw new Error("Event start must include the event content.");
if (start?.trees[0]?.item.kind !== "event") throw new Error("Event start must be the root of its script tree.");
if (!start?.items.some((item) => item.nodeId.endsWith("beat:entry"))) throw new Error("Content connected from an event In port must belong to Event start.");
if (!start?.trees.some((tree) => tree.nodeId.endsWith("beat:entry"))) throw new Error("Content connected from an event In port must appear in the script tree.");
if (!firstTrigger?.items.some((item) => item.nodeId.endsWith("beat:a"))) throw new Error("Trigger must include its reachable beat.");
if (!firstTrigger?.trees[0]?.children.some((node) => node.nodeId.endsWith("beat:b"))) throw new Error("Tree ordering must follow the authored transitions.");
const triggerBeat = firstTrigger?.trees[0];
if (triggerBeat?.item.visualKind !== "speech") throw new Error("Narrative items must expose a visual identity independent of storage kind.");
if (triggerBeat?.ownerSectionId !== "trigger:trigger:one" || triggerBeat.structuralParentId) throw new Error("Outline nodes must retain their editable owner and structural parent.");
if (!triggerBeat.incomingTransitionIds.includes("t1") || !triggerBeat.outgoingTransitionIds.includes("t2")) throw new Error("Outline nodes must expose incoming and outgoing route metadata.");
if (!firstTrigger.items.some((item) => item.kind === "outcome")) throw new Error("Decision outcomes must remain in the owning section.");
if (!secondTrigger?.sharedItemIds.some((id) => id.endsWith("beat:b"))) throw new Error("Shared cyclic content must be referenced, not duplicated.");
if (secondTrigger?.trees[0]?.reference !== "shared") throw new Error("A shared trigger root must render as a tree reference.");
if (!unassigned?.items.some((item) => item.nodeId.endsWith("beat:orphan"))) throw new Error("Unreachable content must remain visible.");
if (unassigned?.items.some((item) => item.nodeId.endsWith("beat:entry"))) throw new Error("Content connected from an event In port must not be unassigned.");
if (!unassigned?.trees.some((tree) => tree.nodeId.endsWith("beat:orphan"))) throw new Error("Unreachable content must form its own tree root.");
if (outline.length !== sections.length) throw new Error("The semantic outline must preserve every script section.");

const dialogueProject = {
  ...project,
  events: [{
    ...project.events[0],
    dialogues: [{ id: "dialogue:hello", title: "Greeting", text: { format: "plain", content: "" }, beats: [block("beat:a")], entryBeatId: "beat:a" }],
    transitions: [{ id: "dialogue-entry", from: "dialogue-start:event:demo:trigger:one", to: "dialogue:event:demo:dialogue:hello" }],
  }],
};
const dialogueOutline = buildEventScriptOutline(dialogueProject, "event:demo");
if (!dialogueOutline.find((section) => section.id === "trigger:trigger:one")?.items.some((item) => item.kind === "dialogue" && item.label === "Greeting")) {
  throw new Error("Dialogue containers must be explicit semantic outline items.");
}

let editable = {
  ...project,
  scriptDocuments: [],
  projectDataObjects: [],
  events: project.events.map((event) => ({ ...event, dialogueStarts: [], transitions: [], dialogueBeats: [] })),
};
editable = mutations.createEventDialogueBeat(editable, "event:demo", "speech").project;
const createdBeat = editable.events[0].dialogueBeats[0];
const createdBlock = editable.scriptDocuments[0].blocks[0];
editable = mutations.updateScriptBlock(editable, createdBeat.blockRef.scriptId, createdBeat.blockRef.blockId, { characterRef: "canon:one" }).project;
if (editable.scriptDocuments[0].blocks[0].characterRef !== "canon:one") throw new Error("Script beats must save their selected speaker.");
editable = mutations.updateScriptBlock(editable, createdBeat.blockRef.scriptId, createdBeat.blockRef.blockId, { characterRef: undefined }).project;
if (editable.scriptDocuments[0].blocks[0].characterRef || editable.scriptDocuments[0].blocks[0].speakerRef) throw new Error("Narrator must clear both current and legacy speaker references.");
editable = mutations.createDialogueStart(editable, "event:demo", { kind: "canonRef", id: "canon:one", propertyId: "talk" }).project;
const createdTrigger = editable.events[0].dialogueStarts[0];
if (createdTrigger.source?.propertyId !== "talk") throw new Error("Property-trigger creation must keep its canonical source atomically.");
editable = mutations.createInternalTransition(editable, "event:demo", `dialogue-start:event:demo:${createdTrigger.id}`, `beat:event:demo:${createdBeat.id}`).project;
const createdTransition = editable.events[0].transitions[0];
editable = mutations.updateTransition(editable, createdTransition.id, { mode: "fallback", conditions: { type: "variable", name: "ignored", operator: "==", value: true } }).project;
if (editable.events[0].transitions[0].mode !== "fallback" || editable.events[0].transitions[0].conditions) throw new Error("Fallback routes must clear their conditions.");
editable = mutations.deleteEventDialogueBeat(editable, "event:demo", createdBeat.id).project;
if (editable.events[0].transitions.length || editable.scriptDocuments[0].blocks.length) throw new Error("Deleting a beat must clean its routes and script block.");

console.log(JSON.stringify({ sections: sections.map((section) => ({ id: section.id, items: section.items.length, shared: section.sharedItemIds.length })) }, null, 2));
