import type { BranchingProject, Condition, ConditionExpression, ConditionInput, ConditionSet, Consequence, PlayerSimulationState, ProjectDataObject, Transition } from "./domain.js";

export type NarrativeEvaluationState = {
  variables?: Record<string, unknown>;
  canonStates?: Record<string, Record<string, unknown>>;
  visited?: Set<string> | string[];
  dataObjects?: ProjectDataObject[];
  /** Grantable entity ids the player currently holds (mirrors PlayerSimulationState.inventory). */
  inventory?: Set<string> | string[];
};

function compareValues(left: unknown, operator: string, right: unknown): boolean {
  if (operator === "exists") return left !== undefined && left !== null;
  if (operator === "contains") return Array.isArray(left) ? left.includes(right) : String(left ?? "").includes(String(right ?? ""));
  if (operator === "==") return left === right || String(left) === String(right);
  if (operator === "!=") return !(left === right || String(left) === String(right));
  if (operator === ">") return Number(left) > Number(right);
  if (operator === ">=") return Number(left) >= Number(right);
  if (operator === "<") return Number(left) < Number(right);
  if (operator === "<=") return Number(left) <= Number(right);
  return false;
}

export function evaluateCondition(
  condition: Condition,
  project: Pick<BranchingProject, "canonRefs">,
  state: NarrativeEvaluationState,
): boolean {
  const raw = condition as Record<string, unknown>;
  if (condition.type === "canonEntryUnlocked") {
    const ref = String(raw.ref ?? "");
    const unlocked = state.canonStates?.[ref]?.unlocked === true;
    return condition.negate ? !unlocked : unlocked;
  }
  if (condition.type === "canonProperty") {
    const ref = String(raw.ref ?? "");
    const property = String(raw.property ?? "");
    const canonRef = project.canonRefs.find((item) => item.id === ref);
    return compareValues(canonRef?.properties?.[property], String(raw.operator ?? "=="), raw.value);
  }
  if (condition.type === "canonState") {
    const ref = String(raw.ref ?? "");
    const stateName = String(raw.state ?? "");
    return compareValues(state.canonStates?.[ref]?.[stateName], String(raw.operator ?? "=="), raw.value);
  }
  if (condition.type === "variable") {
    return compareValues(state.variables?.[String(raw.name ?? "")], String(raw.operator ?? "=="), raw.value);
  }
  if (condition.type === "dataObjectExists") {
    return Boolean(state.dataObjects?.some((item) => item.id === String(raw.objectId ?? "")));
  }
  if (condition.type === "dataObjectField") {
    const dataObject = state.dataObjects?.find((item) => item.id === String(raw.objectId ?? ""));
    return compareValues(dataObject?.fields[String(raw.field ?? "")], String(raw.operator ?? "=="), raw.value);
  }
  if (condition.type === "runtimeItem") {
    const itemId = String(raw.itemId ?? "");
    const inventory = state.inventory instanceof Set ? state.inventory : new Set(state.inventory ?? []);
    const owned = inventory.has(itemId);
    return condition.operator === "missing" ? !owned : owned;
  }
  if (condition.type === "visited") {
    const visited = state.visited instanceof Set ? state.visited : new Set(state.visited ?? []);
    const targetType = String(raw.targetType ?? "event");
    const targetId = String(raw.targetId ?? "");
    const hasVisited = visited.has(`${targetType}:${targetId}`) || visited.has(targetId);
    return condition.negate ? !hasVisited : hasVisited;
  }
  return false;
}

function evaluateExpression(
  expression: ConditionExpression,
  project: Pick<BranchingProject, "canonRefs">,
  state: NarrativeEvaluationState,
): boolean {
  if (!isConditionSet(expression)) return evaluateCondition(expression, project, state);
  if ("all" in expression) return expression.all.every((item) => evaluateExpression(item, project, state));
  if ("any" in expression) return expression.any.some((item) => evaluateExpression(item, project, state));
  return !evaluateExpression(expression.not, project, state);
}

export function evaluateConditionInput(
  input: ConditionInput | undefined,
  project: Pick<BranchingProject, "canonRefs">,
  state: NarrativeEvaluationState,
): boolean {
  if (!input) return true;
  return (Array.isArray(input) ? input : [input]).every((expression) => evaluateExpression(expression, project, state));
}

export function orderedTransitions(transitions: Transition[]): Transition[] {
  return [...transitions].sort((a, b) => {
    if (a.mode === "fallback" && b.mode !== "fallback") return 1;
    if (b.mode === "fallback" && a.mode !== "fallback") return -1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

export function resolveFirstValidTransition(
  transitions: Transition[],
  project: Pick<BranchingProject, "canonRefs">,
  state: NarrativeEvaluationState,
): Transition | undefined {
  return orderedTransitions(transitions).find(
    (transition) => transition.mode === "fallback" || evaluateConditionInput(transition.conditions, project, state),
  );
}

/** Filters a list of consequences down to the ones whose own (optional) `conditions` gate currently passes. */
export function resolveConsequences(
  consequences: Consequence[] | undefined,
  project: Pick<BranchingProject, "canonRefs">,
  state: NarrativeEvaluationState,
): Consequence[] {
  return (consequences ?? []).filter((consequence) => evaluateConditionInput(consequence.conditions, project, state));
}

/** Pure reducer applying a single consequence onto player simulation state. */
export function applyConsequence(consequence: Consequence, state: PlayerSimulationState): PlayerSimulationState {
  if (consequence.type === "addGrantable") {
    const inventory = state.inventory ?? [];
    return inventory.includes(consequence.entityId)
      ? state
      : { ...state, inventory: [...inventory, consequence.entityId] };
  }
  if (consequence.type === "removeGrantable") {
    return { ...state, inventory: (state.inventory ?? []).filter((id) => id !== consequence.entityId) };
  }
  if (consequence.type === "editGrantable") {
    return {
      ...state,
      grantableProperties: {
        ...state.grantableProperties,
        [consequence.entityId]: {
          ...state.grantableProperties?.[consequence.entityId],
          [consequence.propertyId]: consequence.value,
        },
      },
    };
  }
  return { ...state, variables: { ...state.variables, [consequence.name]: consequence.value } };
}

export function isConditionSet(expression: ConditionExpression): expression is ConditionSet {
  return "all" in expression || "any" in expression || "not" in expression;
}

export function asConditionExpressions(input: ConditionInput | undefined): ConditionExpression[] {
  if (!input) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
}

export function walkConditions(
  input: ConditionInput | undefined,
  visit: (condition: Condition, path: string) => void,
  path = "conditions",
) {
  asConditionExpressions(input).forEach((expression, index) => {
    walkConditionExpression(expression, visit, `${path}[${index}]`);
  });
}

function walkConditionExpression(
  expression: ConditionExpression,
  visit: (condition: Condition, path: string) => void,
  path: string,
) {
  if (!isConditionSet(expression)) {
    visit(expression, path);
    return;
  }

  if ("all" in expression) {
    expression.all.forEach((child, index) => walkConditionExpression(child, visit, `${path}.all[${index}]`));
    return;
  }

  if ("any" in expression) {
    expression.any.forEach((child, index) => walkConditionExpression(child, visit, `${path}.any[${index}]`));
    return;
  }

  walkConditionExpression(expression.not, visit, `${path}.not`);
}

export function conditionCount(input: ConditionInput | undefined): number {
  let count = 0;
  walkConditions(input, () => {
    count += 1;
  });
  return count;
}

export function conditionLabel(condition: Condition): string {
  if (condition.type === "canonEntryUnlocked") {
    return condition.negate ? "unless canon" : "requires canon";
  }
  if (condition.type === "canonProperty") {
    return `${condition.property} ${condition.operator}`;
  }
  if (condition.type === "canonState") {
    return `${condition.state} ${condition.operator}`;
  }
  if (condition.type === "variable") {
    return `${condition.name} ${condition.operator}`;
  }
  if (condition.type === "dataObjectExists") {
    return "requires data";
  }
  if (condition.type === "dataObjectField") {
    return `${condition.field} ${condition.operator}`;
  }
  if (condition.type === "runtimeItem") {
    return condition.operator === "missing" ? "missing item" : "has item";
  }
  if (condition.type === "visited") {
    return condition.negate ? `not visited ${condition.targetType}` : `visited ${condition.targetType}`;
  }
  return condition.type;
}

export function conditionLabels(input: ConditionInput | undefined): string[] {
  const labels: string[] = [];
  walkConditions(input, (condition) => {
    labels.push(conditionLabel(condition));
  });
  return labels;
}

export function consequenceLabel(consequence: Consequence): string {
  if (consequence.type === "addGrantable") {
    return "grant item";
  }
  if (consequence.type === "removeGrantable") {
    return "remove item";
  }
  if (consequence.type === "editGrantable") {
    return `edit ${consequence.propertyId}`;
  }
  return "set variable";
}

export function conditionInputsFromConsequences(consequences: Consequence[] | undefined): ConditionInput[] {
  return (consequences ?? []).flatMap((consequence) => {
    if (!("conditions" in consequence)) {
      return [];
    }
    return isConditionInput(consequence.conditions) ? [consequence.conditions] : [];
  });
}

function isConditionInput(value: unknown): value is ConditionInput {
  if (!value || typeof value !== "object") {
    return false;
  }
  return true;
}
