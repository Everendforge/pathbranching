import { CircleAlert, GitBranch, Plus, Trash2, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  BranchingProject,
  ConditionExpression,
  ConditionInput,
  Consequence,
  LogicEffect,
  LogicEffectOperation,
  LogicPredicate,
  LogicSubject,
} from "../domain.js";
import { asConditionExpressions, isConditionSet, migrateConditionInput, migrateConsequence } from "../logic.js";
import { grantableEntities } from "../explorerSchema.js";
import {
  LOGIC_COMPARISON_OPERATORS as comparisonOperators,
  logicEffectFor as effectFor,
  logicEffectOperations as effectOperations,
  logicFieldOptions as fieldOptions,
  logicOperatorsFor as operatorsFor,
  logicPredicateFor as predicateFor,
  resolveLogicField,
  logicSubjectKey as subjectKey,
  logicSubjectOptions as subjectOptions,
  type LogicSubjectOption as SubjectOption,
  type LogicFieldOption,
  type LogicPresentation,
} from "../logicCapabilities.js";

type LogicComposerProps = {
  project: BranchingProject;
  contextEntityIds?: string[];
  compact?: boolean;
};

function valueEditor(value: unknown, valueType: string | undefined, onChange: (value: unknown) => void) {
  if (valueType === "boolean") {
    return <select value={String(value ?? true)} onChange={(event) => onChange(event.target.value === "true")}><option value="true">true</option><option value="false">false</option></select>;
  }
  if (valueType === "list" || valueType === "multiselect" || valueType === "entity-ref-list") {
    return <input type="text" value={Array.isArray(value) ? value.join(", ") : String(value ?? "")} onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />;
  }
  return <input type={valueType === "number" ? "number" : valueType === "date" ? "date" : "text"} value={String(value ?? "")} onChange={(event) => onChange(valueType === "number" ? Number(event.target.value) : event.target.value)} />;
}

function variableValueEditor(value: unknown, type: string | undefined, operation: string, onChange: (value: unknown) => void) {
  const scalarListOperation = type === "list" && ["contains", "notContains", "append", "remove"].includes(operation);
  if (scalarListOperation) {
    const scalarValue = Array.isArray(value) ? value[0] : value;
    return <input type="text" value={String(scalarValue ?? "")} placeholder="Item" onChange={(event) => onChange(event.target.value)} />;
  }
  return valueEditor(value, type, onChange);
}

function GenericPredicateRow({ project, options, predicate, onChange, onRemove }: {
  project: BranchingProject;
  options: SubjectOption[];
  predicate: LogicPredicate;
  onChange: (predicate: LogicPredicate) => void;
  onRemove: () => void;
}) {
  const enabledFields = fieldOptions(project, predicate.subject, "condition");
  const selectedKey = predicate.type === "state" ? predicate.stateId : predicate.type === "property" ? predicate.propertyId : predicate.type;
  const selectedKind = predicate.type === "state" ? "state" : predicate.type === "property" ? "property" : predicate.type === "visited" ? "visited" : predicate.type === "external" ? "external" : "value";
  const resolvedField = resolveLogicField(project, predicate.subject, "condition", selectedKind, selectedKey);
  const fields = resolvedField.status === "enabled" || enabledFields.some((field) => field.key === resolvedField.key)
    ? enabledFields
    : [resolvedField, ...enabledFields];
  const selectedField = fields.find((field) => field.key === selectedKey) ?? fields[0];
  const operators = selectedField ? operatorsFor(selectedField) : comparisonOperators;
  const operator = predicate.operator;
  const selectedSubjectKey = subjectKey(predicate.subject);
  const selectedSubjectOption = subjectOptions(project).find((option) => option.key === selectedSubjectKey);
  const rowOptions = options.some((option) => option.key === selectedSubjectKey) || !selectedSubjectOption
    ? options
    : [selectedSubjectOption, ...options];
  return <div className="logic-composer-row">
    <select aria-label="Logic subject" value={selectedSubjectKey} onChange={(event) => {
      const subject = rowOptions.find((option) => option.key === event.target.value)?.subject;
      if (!subject) return;
      const field = fieldOptions(project, subject, "condition")[0];
      if (field) onChange(predicateFor(subject, field));
    }}>{rowOptions.map((option) => <option key={option.key} value={option.key}>{option.contextual ? "● " : ""}{option.label} · {option.detail}</option>)}</select>
    <select aria-label="Logic field" value={selectedField?.key ?? ""} onChange={(event) => {
      const field = fields.find((item) => item.key === event.target.value);
      if (field) onChange(predicateFor(predicate.subject, field));
    }}>{fields.map((field) => <option key={`${field.kind}:${field.key}`} value={field.key}>{field.status === "enabled" ? field.label : `${field.label} · capability ${field.status}`}</option>)}</select>
    <select aria-label="Logic operator" value={operator} onChange={(event) => onChange({ ...predicate, operator: event.target.value as LogicPredicate["operator"] } as LogicPredicate)}>{operators.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    {!['has', 'missing', 'exists'].includes(operator) ? valueEditor("value" in predicate ? predicate.value : undefined, selectedField?.valueType, (value) => onChange({ ...predicate, value } as LogicPredicate)) : null}
    {resolvedField.status !== "enabled" ? <span className="logic-row-capability-warning" title="Enable this capability in the Explorer type or property configuration"><CircleAlert size={12} /> Configure capability</span> : null}
    <button type="button" className="icon-only danger" aria-label="Remove condition" onClick={onRemove}><Trash2 size={13} /></button>
  </div>;
}

function GenericEffectRow({ project, options, effect, onChange, onRemove }: {
  project: BranchingProject;
  options: SubjectOption[];
  effect: LogicEffect;
  onChange: (effect: LogicEffect) => void;
  onRemove: () => void;
}) {
  if (effect.type === "external") {
    return <div className="logic-composer-row effect"><code>{effect.subject.functionId}</code><span>call</span><button type="button" className="icon-only danger" aria-label="Remove effect" onClick={onRemove}><Trash2 size={13} /></button></div>;
  }
  const enabledFields = fieldOptions(project, effect.subject, "effect");
  const selectedKey = effect.type === "state" ? effect.stateId : effect.type === "property" ? effect.propertyId : effect.type;
  const selectedKind = effect.type === "state" ? "state" : effect.type === "property" ? "property" : "value";
  const resolvedField = resolveLogicField(project, effect.subject, "effect", selectedKind, selectedKey);
  const fields = resolvedField.status === "enabled" || enabledFields.some((field) => field.key === resolvedField.key)
    ? enabledFields
    : [resolvedField, ...enabledFields];
  const selectedField = fields.find((field) => field.key === selectedKey) ?? fields[0];
  const operations = selectedField ? effectOperations(selectedField) : ["set" as const];
  const selectedSubjectKey = subjectKey(effect.subject);
  const selectedSubjectOption = subjectOptions(project).find((option) => option.key === selectedSubjectKey);
  const rowOptions = options.some((option) => option.key === selectedSubjectKey) || !selectedSubjectOption
    ? options
    : [selectedSubjectOption, ...options];
  return <div className="logic-composer-row effect">
    <select aria-label="Effect subject" value={selectedSubjectKey} onChange={(event) => {
      const subject = rowOptions.find((option) => option.key === event.target.value)?.subject;
      if (!subject) return;
      const field = fieldOptions(project, subject, "effect")[0];
      if (field) onChange(effectFor(subject, field));
    }}>{rowOptions.filter((option) => option.subject.kind !== "progress").map((option) => <option key={option.key} value={option.key}>{option.contextual ? "● " : ""}{option.label} · {option.detail}</option>)}</select>
    <select aria-label="Effect field" value={selectedField?.key ?? ""} onChange={(event) => {
      const field = fields.find((item) => item.key === event.target.value);
      if (field) onChange(effectFor(effect.subject, field));
    }}>{fields.map((field) => <option key={`${field.kind}:${field.key}`} value={field.key}>{field.status === "enabled" ? field.label : `${field.label} · capability ${field.status}`}</option>)}</select>
    <select aria-label="Effect operation" value={effect.operation} onChange={(event) => onChange({ ...effect, operation: event.target.value as LogicEffectOperation })}>{operations.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    {!['toggle', 'clear', 'grant', 'ungrant', 'unlock', 'lock', 'discover', 'hide', 'enter', 'leave'].includes(effect.operation) ? valueEditor("value" in effect ? effect.value : undefined, selectedField?.valueType, (value) => onChange({ ...effect, value })) : null}
    {resolvedField.status !== "enabled" ? <span className="logic-row-capability-warning" title="Enable this capability in the Explorer type or property configuration"><CircleAlert size={12} /> Configure capability</span> : null}
    <button type="button" className="icon-only danger" aria-label="Remove effect" onClick={onRemove}><Trash2 size={13} /></button>
  </div>;
}

function grantablePredicate(entityId: string): LogicPredicate {
  return {
    type: "state",
    subject: { kind: "entity", entityId },
    stateId: "owned",
    operator: "has",
  };
}

function defaultVariableValue(type: string | undefined): unknown {
  if (type === "number") return 0;
  if (type === "boolean") return true;
  if (type === "list") return [];
  return "";
}

function variablePredicate(variableId: string, type?: string): LogicPredicate {
  return {
    type: "value",
    subject: { kind: "variable", variableId },
    operator: "==",
    value: defaultVariableValue(type),
  };
}

function grantableEffect(entityId: string): LogicEffect {
  return {
    type: "state",
    subject: { kind: "entity", entityId },
    stateId: "owned",
    operation: "grant",
  };
}

function variableEffect(variableId: string, type?: string): LogicEffect {
  return {
    type: "value",
    subject: { kind: "variable", variableId },
    operation: "set",
    value: defaultVariableValue(type),
  };
}

function isGrantablePredicate(predicate: LogicPredicate): predicate is Extract<LogicPredicate, { type: "state" }> & { subject: Extract<LogicSubject, { kind: "entity" }> } {
  return predicate.type === "state" && predicate.stateId === "owned" && predicate.subject.kind === "entity";
}

function isVariablePredicate(predicate: LogicPredicate): predicate is Extract<LogicPredicate, { type: "value" }> & { subject: Extract<LogicSubject, { kind: "variable" }> } {
  return predicate.type === "value" && predicate.subject.kind === "variable";
}

function isGrantableEffect(effect: LogicEffect): effect is Extract<LogicEffect, { type: "state" }> & { subject: Extract<LogicSubject, { kind: "entity" }> } {
  return effect.type === "state" && effect.stateId === "owned" && effect.subject.kind === "entity";
}

function isVariableEffect(effect: LogicEffect): effect is Extract<LogicEffect, { type: "value" }> & { subject: Extract<LogicSubject, { kind: "variable" }> } {
  return effect.type === "value" && effect.subject.kind === "variable";
}

function variableConditionOperators(type: string | undefined) {
  if (type === "number" || type === "date") return [
    ["==", "Equal"],
    ["!=", "Not equal"],
    [">", "Greater than"],
    [">=", "At least"],
    ["<", "Less than"],
    ["<=", "At most"],
  ] as const;
  if (type === "list") return [["contains", "Contains"], ["notContains", "Does not contain"], ["exists", "Has a value"], ["missing", "Is empty"]] as const;
  if (type === "text") return [["==", "Is"], ["!=", "Is not"], ["contains", "Contains"], ["notContains", "Does not contain"], ["exists", "Has a value"], ["missing", "Is empty"]] as const;
  return [["==", "Is"], ["!=", "Is not"], ["exists", "Has a value"], ["missing", "Is empty"]] as const;
}

function variableEffectOperations(type: string | undefined): LogicEffectOperation[] {
  if (type === "number" || type === "date") return ["set", "add", "subtract", "clear"];
  if (type === "list") return ["set", "append", "remove", "clear"];
  if (type === "boolean") return ["set", "toggle", "clear"];
  return ["set", "clear"];
}

function actionTypeOptions(includeVisited = false) {
  return <>
    <option value="grantable">Grantable</option>
    <option value="variable">Variable</option>
    {includeVisited ? <option value="visited">Visited</option> : null}
  </>;
}

function visitedPredicate(eventId: string): LogicPredicate {
  return {
    type: "visited",
    subject: { kind: "progress", targetType: "event", targetId: eventId },
    operator: "has",
  };
}

function availableEventOptions(project: BranchingProject) {
  return project.events.map((event) => ({ id: event.id, label: event.name }));
}

function PredicateRow({ project, options, predicate, onChange, onChangeMany, onRemove }: {
  project: BranchingProject;
  options: SubjectOption[];
  predicate: LogicPredicate;
  onChange: (predicate: LogicPredicate) => void;
  onChangeMany?: (predicates: LogicPredicate[]) => void;
  onRemove: () => void;
}) {
  const grantables = grantableEntities(project);
  const variables = project.logicVariables ?? [];
  const events = availableEventOptions(project);
  if (isGrantablePredicate(predicate)) {
    const selectedGrantable = grantables.some((entity) => entity.id === predicate.subject.entityId);
    return <div className="logic-composer-row simple">
      <select aria-label="Condition action type" value="grantable" onChange={(event) => {
        if (event.target.value === "grantable") return;
        const variable = variables[0];
        if (event.target.value === "variable") onChange(variablePredicate(variable?.id ?? "", variable?.type));
        if (event.target.value === "visited") onChange(visitedPredicate(events[0]?.id ?? ""));
      }}>
        {actionTypeOptions(true)}
      </select>
      <select aria-label="Grantable condition action" value={predicate.operator} onChange={(event) => onChange({ ...predicate, operator: event.target.value as "has" | "missing" })}>
        <option value="has">Have</option>
        <option value="missing">Not have</option>
      </select>
      <select
        aria-label="Grantable entities"
        multiple={grantables.length > 1}
        size={grantables.length > 1 ? Math.min(4, grantables.length) : undefined}
        value={selectedGrantable ? [predicate.subject.entityId] : [""]}
        onChange={(event) => {
          const selectedIds = Array.from(event.target.selectedOptions, (option) => option.value);
          if (selectedIds.length > 1 && onChangeMany) {
            onChangeMany(selectedIds.map((entityId) => grantablePredicate(entityId)));
            return;
          }
          onChange(grantablePredicate(selectedIds[0] ?? ""));
        }}
      >
        {!selectedGrantable ? <option value="" disabled>Not available</option> : null}
        {grantables.map((entity) => <option key={`${entity.source}:${entity.id}`} value={entity.id}>{entity.label}</option>)}
      </select>
      <button type="button" className="icon-only danger" aria-label="Remove condition" onClick={onRemove}><Trash2 size={13} /></button>
    </div>;
  }

  if (predicate.type === "visited") {
    const selectedEvent = events.some((event) => event.id === predicate.subject.targetId) ? predicate.subject.targetId : "";
    return <div className="logic-composer-row simple">
      <select aria-label="Condition action type" value="visited" onChange={(event) => {
        if (event.target.value === "grantable") onChange(grantablePredicate(grantables[0]?.id ?? ""));
        if (event.target.value === "variable") onChange(variablePredicate(variables[0]?.id ?? "", variables[0]?.type));
        if (event.target.value === "visited") return;
      }}>
        {actionTypeOptions(true)}
      </select>
      <select aria-label="Visited condition action" value={predicate.operator} onChange={(event) => onChange({ ...predicate, operator: event.target.value as "has" | "missing" })}>
        <option value="has">Has</option>
        <option value="missing">Has not</option>
      </select>
      <select aria-label="Visited event" value={selectedEvent} onChange={(event) => onChange(visitedPredicate(event.target.value))}>
        {!selectedEvent ? <option value="" disabled>Not available</option> : null}
        {events.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}
      </select>
      <button type="button" className="icon-only danger" aria-label="Remove condition" onClick={onRemove}><Trash2 size={13} /></button>
    </div>;
  }

  if (isVariablePredicate(predicate)) {
    const variable = variables.find((item) => item.id === predicate.subject.variableId);
    const variableOperators = variableConditionOperators(variable?.type);
    return <div className="logic-composer-row simple variable">
      <select aria-label="Condition action type" value="variable" onChange={(event) => {
        if (event.target.value === "grantable") {
          onChange(grantablePredicate(grantables[0]?.id ?? ""));
        }
        if (event.target.value === "visited") {
          onChange(visitedPredicate(events[0]?.id ?? ""));
        }
      }}>
        {actionTypeOptions(true)}
      </select>
      <select aria-label="Variable condition action" value={predicate.operator} onChange={(event) => onChange({ ...predicate, operator: event.target.value as LogicPredicate["operator"] } as LogicPredicate)}>
        {variableOperators.map(([operator, label]) => <option key={operator} value={operator}>{label}</option>)}
      </select>
      <select aria-label="Condition variable" value={predicate.subject.variableId} onChange={(event) => {
        const nextVariable = variables.find((item) => item.id === event.target.value);
        if (nextVariable) onChange(variablePredicate(nextVariable.id, nextVariable.type));
      }}>
        {!variable ? <option value="" disabled>Not available</option> : null}
        {variables.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {variableValueEditor(predicate.value, variable?.type, predicate.operator, (value) => onChange({ ...predicate, value }))}
      <button type="button" className="icon-only danger" aria-label="Remove condition" onClick={onRemove}><Trash2 size={13} /></button>
    </div>;
  }

  {
    return <GenericPredicateRow project={project} options={options} predicate={predicate} onChange={onChange} onRemove={onRemove} />;
  }
}

function EffectRow({ project, options, effect, onChange, onChangeMany, onRemove }: {
  project: BranchingProject;
  options: SubjectOption[];
  effect: LogicEffect;
  onChange: (effect: LogicEffect) => void;
  onChangeMany?: (effects: LogicEffect[]) => void;
  onRemove: () => void;
}) {
  const grantables = grantableEntities(project);
  const variables = project.logicVariables ?? [];
  if (isGrantableEffect(effect)) {
    const selectedGrantable = grantables.some((entity) => entity.id === effect.subject.entityId);
    return <div className="logic-composer-row effect simple">
      <select aria-label="Consequence action type" value="grantable" onChange={(event) => {
        if (event.target.value === "grantable") return;
        const variable = variables[0];
        if (event.target.value === "variable") onChange(variableEffect(variable?.id ?? "", variable?.type));
      }}>
        {actionTypeOptions()}
      </select>
      <select aria-label="Grantable consequence action" value={effect.operation} onChange={(event) => onChange({ ...effect, operation: event.target.value as "grant" | "ungrant" })}>
        <option value="grant">Add</option>
        <option value="ungrant">Remove</option>
      </select>
      <select
        aria-label="Grantable entities"
        multiple={grantables.length > 1}
        size={grantables.length > 1 ? Math.min(4, grantables.length) : undefined}
        value={selectedGrantable ? [effect.subject.entityId] : [""]}
        onChange={(event) => {
          const selectedIds = Array.from(event.target.selectedOptions, (option) => option.value);
          if (selectedIds.length > 1 && onChangeMany) {
            onChangeMany(selectedIds.map((entityId) => grantableEffect(entityId)));
            return;
          }
          onChange(grantableEffect(selectedIds[0] ?? ""));
        }}
      >
        {!selectedGrantable ? <option value="" disabled>Not available</option> : null}
        {grantables.map((entity) => <option key={`${entity.source}:${entity.id}`} value={entity.id}>{entity.label}</option>)}
      </select>
      <button type="button" className="icon-only danger" aria-label="Remove effect" onClick={onRemove}><Trash2 size={13} /></button>
    </div>;
  }

  if (isVariableEffect(effect)) {
    const variable = variables.find((item) => item.id === effect.subject.variableId);
    const operations = variableEffectOperations(variable?.type);
    return <div className="logic-composer-row effect simple variable">
      <select aria-label="Consequence action type" value="variable" onChange={(event) => {
        if (event.target.value === "grantable") {
          onChange(grantableEffect(grantables[0]?.id ?? ""));
        }
      }}>
        {actionTypeOptions()}
      </select>
      <select aria-label="Variable consequence action" value={effect.operation} onChange={(event) => onChange({ ...effect, operation: event.target.value as LogicEffectOperation } as LogicEffect)}>
        {operations.map((operation) => <option key={operation} value={operation}>{operation === "set" ? "Set" : operation === "add" || operation === "append" ? "Add" : operation === "subtract" || operation === "remove" ? "Remove" : operation === "toggle" ? "Toggle" : "Clear"}</option>)}
      </select>
      <select aria-label="Consequence variable" value={effect.subject.variableId} onChange={(event) => {
        const nextVariable = variables.find((item) => item.id === event.target.value);
        if (nextVariable) onChange(variableEffect(nextVariable.id, nextVariable.type));
      }}>
        {!variable ? <option value="" disabled>Not available</option> : null}
        {variables.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {effect.operation !== "clear" ? variableValueEditor(effect.value, variable?.type, effect.operation, (value) => onChange({ ...effect, value })) : <span className="logic-composer-empty-value">—</span>}
      <button type="button" className="icon-only danger" aria-label="Remove effect" onClick={onRemove}><Trash2 size={13} /></button>
    </div>;
  }

  {
    return <GenericEffectRow project={project} options={options} effect={effect} onChange={onChange} onRemove={onRemove} />;
  }
}

function firstPredicate(project: BranchingProject, options: SubjectOption[]): LogicPredicate | undefined {
  const firstGrantable = grantableEntities(project)[0];
  if (firstGrantable) return grantablePredicate(firstGrantable.id);
  const firstVariable = project.logicVariables?.[0];
  if (firstVariable) return variablePredicate(firstVariable.id, firstVariable.type);
  for (const option of options) {
    const field = fieldOptions(project, option.subject, "condition")[0];
    if (field) return predicateFor(option.subject, field);
  }
  return grantablePredicate("");
}

function firstEffect(project: BranchingProject, options: SubjectOption[]): LogicEffect | undefined {
  const firstGrantable = grantableEntities(project)[0];
  if (firstGrantable) return grantableEffect(firstGrantable.id);
  const firstVariable = project.logicVariables?.[0];
  if (firstVariable) return variableEffect(firstVariable.id, firstVariable.type);
  for (const option of options) {
    const field = fieldOptions(project, option.subject, "effect")[0];
    if (field) return effectFor(option.subject, field);
  }
  return grantableEffect("");
}

function isFlatExpression(expression: ConditionExpression): boolean {
  if (!isConditionSet(expression)) return true;
  if ("not" in expression) return false;
  return ("all" in expression ? expression.all : expression.any).every((child) => !isConditionSet(child));
}

export function LogicConditionEditor({ project, contextEntityIds, value, onChange, label = "WHEN", compact }: LogicComposerProps & {
  value?: ConditionInput;
  onChange: (value: ConditionInput | undefined) => void;
  label?: string;
}) {
  const [dropMessage, setDropMessage] = useState<string>();
  const [dropChoice, setDropChoice] = useState<{ option: SubjectOption; fields: LogicFieldOption[] }>();
  const options = useMemo(
    () => {
      const grantableIds = new Set(grantableEntities(project).map((entity) => entity.id));
      return subjectOptions(project, contextEntityIds).filter((option) => {
      if (option.subject.kind === "entity" && !grantableIds.has(option.subject.entityId)) return false;
      if (!["entity", "variable", "progress"].includes(option.subject.kind)) return false;
      if (option.subject.kind === "external") {
        const functionId = option.subject.functionId;
        const kind = project.externalFunctions.find((item) => item.name === functionId)?.kind;
        if (kind !== "condition" && kind !== "transition") return false;
      }
      return fieldOptions(project, option.subject, "condition").length > 0;
      });
    },
    [project, contextEntityIds],
  );
  const migrated = migrateConditionInput(value, project.logicVariables ?? []);
  const expressions = asConditionExpressions(migrated);
  const top = expressions.length === 1 ? expressions[0] : { all: expressions };
  const flat = expressions.length === 0 || isFlatExpression(top);
  const group = flat && isConditionSet(top) && "any" in top ? "any" : "all";
  const rows = expressions.length === 1 && isConditionSet(top) && !('not' in top) ? ("all" in top ? top.all : top.any) : expressions;
  const replaceRows = (next: ConditionExpression[], nextGroup = group) => onChange(next.length ? (next.length === 1 ? next[0] : nextGroup === "any" ? { any: next } : { all: next }) : undefined);
  const canAddCondition = Boolean(firstPredicate(project, options));
  return <section
    className={`logic-composer ${compact ? "compact" : ""}`}
    onDragOver={(event) => {
      if (event.dataTransfer.types.includes("application/x-pathbranching-canon-ref") || event.dataTransfer.types.includes("application/x-pathbranching-entity")) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    }}
    onDrop={(event) => {
      const entityId = event.dataTransfer.getData("application/x-pathbranching-entity") || event.dataTransfer.getData("application/x-pathbranching-canon-ref");
      if (!entityId) return;
      event.preventDefault();
      const option = options.find((candidate) => candidate.subject.kind === "entity" && candidate.subject.entityId === entityId);
      const fields = option ? fieldOptions(project, option.subject, "condition") : [];
      if (!option || !fields.length) {
        setDropMessage("This entity has no condition-readable property or runtime state. Enable one in its type/property capabilities.");
        setDropChoice(undefined);
        return;
      }
      if (fields.length > 1) {
        setDropChoice({ option, fields });
        setDropMessage(undefined);
        return;
      }
      replaceRows([...rows, predicateFor(option.subject, fields[0])]);
      setDropChoice(undefined);
      setDropMessage(undefined);
    }}
  >
    <header><strong>{label}</strong><span>{rows.length ? `${rows.length} condition${rows.length === 1 ? "" : "s"}` : "Always"}</span></header>
    {flat ? <>
      {rows.length > 1 ? <label className="logic-composer-group">Match<select value={group} onChange={(event) => replaceRows(rows, event.target.value as "all" | "any")}><option value="all">All (AND)</option><option value="any">Any (OR)</option></select></label> : null}
      <div className="logic-composer-rows">{rows.map((expression, index) => !isConditionSet(expression) ? <PredicateRow key={`${expression.type}:${index}`} project={project} options={options} predicate={expression as LogicPredicate} onChange={(predicate) => replaceRows(rows.map((item, itemIndex) => itemIndex === index ? predicate : item))} onChangeMany={(predicates) => replaceRows(rows.flatMap((item, itemIndex) => itemIndex === index ? predicates : [item]))} onRemove={() => replaceRows(rows.filter((_, itemIndex) => itemIndex !== index))} /> : null)}</div>
    </> : <p className="logic-composer-summary">Nested conditions are not available in this editor yet.</p>}
    <div className="logic-composer-actions"><button type="button" disabled={!canAddCondition} title={canAddCondition ? "Add condition" : "Create a Grantable type or Variable first"} onClick={() => { const predicate = firstPredicate(project, options); if (predicate) replaceRows([...rows, predicate]); }}><Plus size={13} /> Condition</button></div>
    {!canAddCondition ? <p className="logic-composer-empty-state">Create a Grantable type or Variable in Logic to configure this gate.</p> : null}
    {dropChoice ? <div className="logic-composer-drop-choice" role="dialog" aria-label={`Choose condition field for ${dropChoice.option.label}`}>
      <strong>{dropChoice.option.label}</strong><span>Choose a readable property or state</span>
      <div>{dropChoice.fields.map((field) => <button type="button" key={`${field.kind}:${field.key}`} onClick={() => {
        replaceRows([...rows, predicateFor(dropChoice.option.subject, field)]);
        setDropChoice(undefined);
      }}>{field.label}</button>)}</div>
    </div> : null}
    {dropMessage ? <p className="logic-composer-drop-message" role="status">{dropMessage}</p> : null}
  </section>;
}

export function LogicEffectEditor({ project, contextEntityIds, value, onChange, label = "THEN", compact }: LogicComposerProps & {
  value?: Consequence[];
  onChange: (value: Consequence[] | undefined) => void;
  label?: string;
}) {
  const [dropMessage, setDropMessage] = useState<string>();
  const [dropChoice, setDropChoice] = useState<{ option: SubjectOption; fields: LogicFieldOption[] }>();
  const options = useMemo(
    () => {
      const grantableIds = new Set(grantableEntities(project).map((entity) => entity.id));
      return subjectOptions(project, contextEntityIds).filter((option) => {
      if (option.subject.kind === "entity" && !grantableIds.has(option.subject.entityId)) return false;
      if (!["entity", "variable"].includes(option.subject.kind)) return false;
      if (option.subject.kind === "external") {
        const functionId = option.subject.functionId;
        const kind = project.externalFunctions.find((item) => item.name === functionId)?.kind;
        if (kind !== "consequence" && kind !== "runtimeAction" && kind !== "engineSignal") return false;
      }
      return fieldOptions(project, option.subject, "effect").length > 0;
      });
    },
    [project, contextEntityIds],
  );
  const effects = (value ?? []).map((effect) => migrateConsequence(effect, project.logicVariables ?? []));
  const canAddEffect = Boolean(firstEffect(project, options));
  return <section
    className={`logic-composer effect ${compact ? "compact" : ""}`}
    onDragOver={(event) => {
      if (event.dataTransfer.types.includes("application/x-pathbranching-canon-ref") || event.dataTransfer.types.includes("application/x-pathbranching-entity")) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    }}
    onDrop={(event) => {
      const entityId = event.dataTransfer.getData("application/x-pathbranching-entity") || event.dataTransfer.getData("application/x-pathbranching-canon-ref");
      if (!entityId) return;
      event.preventDefault();
      const option = options.find((candidate) => candidate.subject.kind === "entity" && candidate.subject.entityId === entityId);
      const fields = option ? fieldOptions(project, option.subject, "effect") : [];
      if (!option || !fields.length) {
        setDropMessage("This entity has no action-writable property or runtime state. Enable one in its type/property capabilities.");
        setDropChoice(undefined);
        return;
      }
      if (fields.length > 1) {
        setDropChoice({ option, fields });
        setDropMessage(undefined);
        return;
      }
      onChange([...effects, effectFor(option.subject, fields[0])]);
      setDropChoice(undefined);
      setDropMessage(undefined);
    }}
  >
    <header><strong>{label}</strong><span>{effects.length ? `${effects.length} effect${effects.length === 1 ? "" : "s"}` : "No effects"}</span></header>
    <div className="logic-composer-rows">{effects.map((effect, index) => <EffectRow key={`${effect.type}:${index}`} project={project} options={options} effect={effect} onChange={(next) => onChange(effects.map((item, itemIndex) => itemIndex === index ? next : item))} onChangeMany={(nextEffects) => onChange(effects.flatMap((item, itemIndex) => itemIndex === index ? nextEffects : [item]))} onRemove={() => onChange(effects.filter((_, itemIndex) => itemIndex !== index))} />)}</div>
    <div className="logic-composer-actions"><button type="button" disabled={!canAddEffect} title={canAddEffect ? "Add consequence" : "Create a Grantable type or Variable first"} onClick={() => { const effect = firstEffect(project, options); if (effect) onChange([...effects, effect]); }}><Plus size={13} /> Consequence</button></div>
    {!canAddEffect ? <p className="logic-composer-empty-state">Create a Grantable type or Variable in Logic to add consequences.</p> : null}
    {dropChoice ? <div className="logic-composer-drop-choice" role="dialog" aria-label={`Choose effect field for ${dropChoice.option.label}`}>
      <strong>{dropChoice.option.label}</strong><span>Choose a writable property or state</span>
      <div>{dropChoice.fields.map((field) => <button type="button" key={`${field.kind}:${field.key}`} onClick={() => {
        onChange([...effects, effectFor(dropChoice.option.subject, field)]);
        setDropChoice(undefined);
      }}>{field.label}</button>)}</div>
    </div> : null}
    {dropMessage ? <p className="logic-composer-drop-message" role="status">{dropMessage}</p> : null}
  </section>;
}

function LogicPresentationToken({ item }: { item: LogicPresentation }) {
  return <span
    className={`logic-presentation-token${item.status === "enabled" ? "" : " warning"}`}
    title={item.status === "enabled" ? item.text : `${item.text} · capability ${item.status}`}
    style={item.color ? { "--logic-subject-color": item.color } as CSSProperties : undefined}
  >
    <i aria-hidden="true" />
    <span>{item.subjectLabel}</span>
    <b>{item.fieldLabel}</b>
    <em>{item.operatorLabel}{item.valueLabel ? ` ${item.valueLabel}` : ""}</em>
    {item.status !== "enabled" ? <CircleAlert size={10} aria-label={`Capability ${item.status}`} /> : null}
  </span>;
}

export function LogicBands({
  when,
  then,
  whenItems = [],
  thenItems = [],
  expanded,
  warningCount = 0,
  onOpenWhen,
  onOpenThen,
}: {
  when?: string;
  then?: string;
  whenItems?: LogicPresentation[];
  thenItems?: LogicPresentation[];
  expanded?: boolean;
  warningCount?: number;
  onOpenWhen?: () => void;
  onOpenThen?: () => void;
}) {
  return <div className={`node-logic-bands${expanded ? " expanded" : ""}`}>
    {when ? <button type="button" className="node-logic-band when" onClick={onOpenWhen}>
      <GitBranch size={10} /><b>WHEN</b>
      <span className="logic-band-summary">{whenItems.length ? whenItems.map((item) => <LogicPresentationToken key={item.id} item={item} />) : when}</span>
    </button> : null}
    {then ? <button type="button" className="node-logic-band then" onClick={onOpenThen}>
      <Zap size={10} /><b>THEN</b>
      <span className="logic-band-summary">{thenItems.length ? thenItems.map((item) => <LogicPresentationToken key={item.id} item={item} />) : then}</span>
    </button> : null}
    {warningCount > 0 ? <span className="node-logic-warning" title={`${warningCount} capability warning${warningCount === 1 ? "" : "s"}`}><CircleAlert size={11} />{warningCount}</span> : null}
  </div>;
}
