import type {
  BranchingProject,
  DataClassDefinition,
  EventCategoryDefinition,
  LogicVariable,
  LogicVariableGroup,
} from "./domain.js";
import { normalizeBranchMembership } from "./storyOutlineModel.js";

export function projectFileName(path: string | undefined) {
  if (!path) {
    return "Untitled.pathbranching.json";
  }
  return path.split(/[\\/]/).pop() ?? path;
}

export const DEFAULT_EVENT_CATEGORIES: EventCategoryDefinition[] = [
  { id: "normal", label: "Event" },
  { id: "final", label: "Final", terminal: true },
];

export const DEFAULT_DATA_CLASSES: DataClassDefinition[] = [
  {
    id: "class:KnowledgeEntry",
    label: "Knowledge Entry",
    category: "canonProjection",
    roles: ["knowledge", "unlockable", "runtime"],
    fields: [
      { name: "title", type: "text", label: "Title", required: true },
      { name: "body", type: "text", label: "Body" },
      { name: "sourceRef", type: "canonRef", label: "Canon Source" },
      {
        name: "unlockedByDefault",
        type: "boolean",
        label: "Unlocked By Default",
        defaultValue: false,
      },
    ],
  },
  {
    id: "class:Speaker",
    label: "Speaker",
    category: "narrative",
    roles: ["speaker", "presentation"],
    fields: [
      {
        name: "displayName",
        type: "text",
        label: "Display Name",
        required: true,
      },
      { name: "canonRef", type: "canonRef", label: "Canon Source" },
      { name: "voice", type: "text", label: "Voice" },
    ],
  },
  {
    id: "class:RuntimeItem",
    label: "Runtime Item",
    category: "runtime",
    roles: ["condition", "inventory", "runtime"],
    fields: [
      {
        name: "displayName",
        type: "text",
        label: "Display Name",
        required: true,
      },
      {
        name: "itemId",
        type: "text",
        label: "Runtime Item ID",
        required: true,
      },
      {
        name: "startsOwned",
        type: "boolean",
        label: "Starts Owned",
        defaultValue: false,
      },
    ],
  },
  {
    id: "class:SceneSetting",
    label: "Scene Setting",
    category: "narrative",
    roles: ["scene", "presentation"],
    fields: [
      { name: "title", type: "text", label: "Title", required: true },
      { name: "canonRef", type: "canonRef", label: "Canon Source" },
      { name: "description", type: "text", label: "Description" },
    ],
  },
  {
    id: "class:QuestFlag",
    label: "Quest Flag",
    category: "runtime",
    roles: ["condition", "state", "runtime"],
    fields: [
      { name: "flag", type: "text", label: "Flag", required: true },
      {
        name: "initialValue",
        type: "boolean",
        label: "Initial Value",
        defaultValue: false,
      },
    ],
  },
];

function labelFromCategoryId(id: string) {
  return (
    id
      .split(/[-_:]/g)
      .filter(Boolean)
      .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
      .join(" ") || id
  );
}

function normalizeEventCategories(
  project: BranchingProject,
): EventCategoryDefinition[] {
  const categories = new Map<string, EventCategoryDefinition>();
  DEFAULT_EVENT_CATEGORIES.forEach((category) =>
    categories.set(category.id, category),
  );
  (project.eventCategories ?? []).forEach((category) => {
    if (!category.id) return;
    const migratedLabel =
      category.id === "normal" && category.label === "Normal"
        ? "Event"
        : category.label;
    categories.set(category.id, {
      ...category,
      label: migratedLabel || labelFromCategoryId(category.id),
      terminal:
        category.id === "final"
          ? true
          : category.id === "normal"
            ? false
            : category.terminal,
    });
  });
  (project.events ?? []).forEach((event) => {
    if (!event.type || categories.has(event.type)) return;
    categories.set(event.type, {
      id: event.type,
      label: labelFromCategoryId(event.type),
    });
  });
  return Array.from(categories.values());
}

function normalizeDataClasses(
  project: BranchingProject,
): DataClassDefinition[] {
  const classes = new Map<string, DataClassDefinition>();
  DEFAULT_DATA_CLASSES.forEach((dataClass) =>
    classes.set(dataClass.id, dataClass),
  );
  (project.dataClasses ?? []).forEach((dataClass) => {
    if (!dataClass.id) return;
    classes.set(dataClass.id, {
      ...dataClass,
      fields: dataClass.fields ?? [],
    });
  });
  return Array.from(classes.values());
}

export function normalizeProject(project: BranchingProject): BranchingProject {
  const entrySequenceId = project.entrySequenceId ?? project.sequences[0]?.id;
  const activeSequenceId =
    project.canvas?.activeSequenceId ??
    entrySequenceId ??
    project.sequences[0]?.id;
  const activeScope =
    project.canvas?.activeScope?.kind === "event" &&
    project.events?.some(
      (event) => event.id === project.canvas?.activeScope?.id,
    )
      ? project.canvas.activeScope
      : project.canvas?.activeScope?.kind === "sequence" &&
          project.sequences?.some(
            (sequence) => sequence.id === project.canvas?.activeScope?.id,
          )
        ? project.canvas.activeScope
        : activeSequenceId
          ? { kind: "sequence" as const, id: activeSequenceId }
          : undefined;

  const logicVariableGroups = normalizeLogicGroups(project.logicVariableGroups);
  const logicVariables = normalizeLogicVariables(project, logicVariableGroups);

  return normalizeBranchMembership({
    ...project,
    specVersion: project.specVersion ?? "0.1",
    dataClasses: normalizeDataClasses(project),
    projectDataObjects: project.projectDataObjects ?? [],
    canonEditSuggestions: project.canonEditSuggestions ?? [],
    canonWorkingCopies: project.canonWorkingCopies ?? [],
    canonChangeSets: project.canonChangeSets ?? [],
    localExplorerEntities: project.localExplorerEntities ?? [],
    localExplorerTypes: project.localExplorerTypes ?? [],
    localExplorerProperties: project.localExplorerProperties ?? [],
    assets: project.assets ?? [],
    logicVariableGroups,
    logicVariables,
    projectionRules: project.projectionRules ?? [],
    graphModules: project.graphModules ?? [],
    panels: {
      canonOpen: project.panels?.canonOpen ?? true,
      filesOpen: project.panels?.filesOpen ?? true,
    },
    canvas: {
      ...project.canvas,
      activeSequenceId,
      activeScope,
      scopes: project.canvas?.scopes ?? {},
    },
    entrySequenceId,
    eventCategories: normalizeEventCategories(project),
    canonRefs: project.canonRefs ?? [],
    sequences: project.sequences ?? [],
    branches: project.branches ?? [],
    events: (project.events ?? []).map((event) => ({
      ...event,
      childEventIds: event.childEventIds ?? [],
      dialogues: event.dialogues ?? [],
      boundaryBindings: event.boundaryBindings ?? [],
    })),
    scripts: project.scripts ?? [],
    externalFunctions: project.externalFunctions ?? [],
    variables: Object.fromEntries(logicVariables.map((variable) => [variable.name, variable.value])),
  });
}

function normalizeLogicGroups(groups: LogicVariableGroup[] | undefined): LogicVariableGroup[] {
  const source = groups?.length ? groups : [{ id: "ungrouped", name: "Unassigned", order: 0 }];
  const byId = new Map(source.filter((group) => group.id).map((group) => [group.id, group]));
  if (!byId.has("ungrouped")) byId.set("ungrouped", { id: "ungrouped", name: "Unassigned", order: -1 });
  return Array.from(byId.values()).sort((a, b) => a.order - b.order).map((group, order) => ({ ...group, name: group.name.trim() || "Untitled group", order }));
}

function normalizeLogicVariables(project: BranchingProject, groups: LogicVariableGroup[]): LogicVariable[] {
  const legacy = Object.entries(project.variables ?? {}).map(([name, value]) => ({
    id: `variable:${name}`, name,
    type: Array.isArray(value) ? "list" as const : typeof value === "number" ? "number" as const : typeof value === "boolean" ? "boolean" as const : "text" as const,
    value: Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : String(value),
    groupId: "ungrouped",
  }));
  const seen = new Set<string>();
  return (project.logicVariables ?? legacy).map((variable, index) => {
    const baseName = variable.name.trim() || `variable_${index + 1}`;
    let name = baseName;
    let suffix = 2;
    while (seen.has(name)) name = `${baseName}_${suffix++}`;
    seen.add(name);
    const type = ["text", "number", "boolean", "list", "canonRef"].includes(variable.type) ? variable.type : "text";
    const value = type === "list" ? (Array.isArray(variable.value) ? variable.value.map(String) : []) : type === "number" ? (typeof variable.value === "number" && Number.isFinite(variable.value) ? variable.value : Number(variable.value) || 0) : type === "boolean" ? (typeof variable.value === "boolean" ? variable.value : variable.value === "true") : String(variable.value ?? "");
    return { ...variable, id: variable.id || `variable:${name}`, name, type, value, groupId: groups.some((group) => group.id === variable.groupId) ? variable.groupId : "ungrouped" } as LogicVariable;
  });
}

export function serializeProject(project: BranchingProject) {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function parseProject(content: string): BranchingProject {
  return normalizeProject(JSON.parse(content) as BranchingProject);
}
