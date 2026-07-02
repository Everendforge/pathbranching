import type { BranchingProject, RuntimeChoice, RuntimeNode, RuntimePackage, EventNode } from "./domain.js";

function eventChoices(event: EventNode): RuntimeChoice[] | undefined {
  const directChoices: RuntimeChoice[] = (event.transitions ?? [])
    .filter((transition) => transition.from === event.id)
    .map((transition) => ({
      id: transition.id,
      textKey: transition.label ? `transition.${transition.id}.label` : `transition.${transition.id}`,
      targetNodeId: transition.to,
      conditions: transition.conditions,
      consequences: transition.consequences,
    }));

  const outcomeChoices: RuntimeChoice[] = (event.decisions ?? []).flatMap((decision) =>
    decision.outcomes.map((outcome) => {
      const outcomeNodeId = `outcome:${event.id}:${decision.id}:${outcome.id}`;
      const transition = event.transitions?.find((candidate) => candidate.from === outcomeNodeId);
      return {
        id: outcome.id,
        textKey: `outcome.${outcome.id}.name`,
        targetNodeId: transition?.to ?? event.id,
        conditions: outcome.conditions,
        consequences: outcome.consequences,
      };
    }),
  );

  const choices = [...directChoices, ...outcomeChoices];
  return choices.length ? choices : undefined;
}

export function exportRuntimePackage(project: BranchingProject): RuntimePackage {
  const entrySequence = project.entrySequenceId
    ? project.sequences.find((sequence) => sequence.id === project.entrySequenceId)
    : project.sequences[0];
  const entryNodeId = entrySequence?.entryEventId ?? project.events[0]?.id ?? "missing-entry";

  const canonRefDetails = (ids: string[] | undefined) =>
    (ids ?? [])
      .map((id) => project.canonRefs.find((ref) => ref.id === id))
      .filter(Boolean)
      .map((ref) => ({
        id: ref!.id,
        kind: ref!.kind,
        label: ref!.label,
        canonSourcePath: ref!.canonSourcePath,
        missingIdentity: ref!.missingIdentity,
        identityWarning: ref!.identityWarning,
      }));

  const nodes: RuntimeNode[] = project.events.map((event) => ({
    id: event.id,
    type: "event",
    textKey: `event.${event.id}.name`,
    choices: eventChoices(event),
    conditions: event.availability,
    canonRefs: event.canonRefs,
    canonRefDetails: canonRefDetails(event.canonRefs),
    storyText: event.text,
    script: event.script,
    legacyId: event.legacyId,
    decisions: event.decisions,
    transitions: event.transitions,
    consequences: event.unlocks,
    ruleSets: event.ruleSets,
  }));

  return {
    specVersion: "0.1",
    packageId: project.projectId,
    entryNodeId,
    canonRefs: project.canonRefs,
    variables: project.variables,
    localization: Object.fromEntries(
      project.events.flatMap((event) => [
        [`event.${event.id}.name`, event.name],
        ...(event.text?.content ? [[`event.${event.id}.text`, event.text.content] as const] : []),
        ...(event.decisions ?? []).flatMap((decision) =>
          decision.outcomes.map((outcome) => [`outcome.${outcome.id}.name`, outcome.name] as const),
        ),
      ]),
    ),
    nodes,
    pathBranching: {
      projectId: project.projectId,
      sourceVault: project.sourceVault,
      dataClasses: project.dataClasses,
      projectDataObjects: project.projectDataObjects,
      canonEditSuggestions: project.canonEditSuggestions,
      projectionRules: project.projectionRules,
      graphModules: project.graphModules,
      eventCategories: project.eventCategories,
      entrySequenceId: project.entrySequenceId,
      sequences: project.sequences,
      branches: project.branches,
      events: project.events,
      scripts: project.scripts,
      externalFunctions: project.externalFunctions,
    },
    engineTargets: project.engineTargets,
  };
}
