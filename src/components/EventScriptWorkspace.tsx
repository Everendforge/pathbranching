import { AlertTriangle, ChevronDown, CircleDot, FileText, Filter, Flag, GitBranch, Home, Link2, MapPin, MessageCircle, MousePointer2, Package, Plus, RotateCcw, Route, Sparkles, Trash2, UserRound } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { BranchingProject, ConditionInput, DialogueBeat, DialogueStart, EventNode, Outcome, ProjectDataObject, ScriptBlock, Transition } from "../domain.js";
import { buildEventScriptOutline, type EventScriptItem, type EventScriptTreeNode } from "../eventScriptModel.js";
import { canonExplorerProperties, flattenCanonExplorerProperties, propertySupportsDialogueTrigger } from "../explorerSchema.js";
import { blockValues, localeDisplayName, normalizeLocaleList, scriptBlockTextKey, type LocaleNames } from "../localization.js";

type RouteTarget = { id: string; label: string };

function itemKindLabel(item: EventScriptItem) {
  if (item.visualKind === "speech") return "Speech";
  if (item.visualKind === "direction") return "Direction";
  return item.visualKind[0].toUpperCase() + item.visualKind.slice(1);
}

function ItemKindIcon({ item, size = 15 }: { item: EventScriptItem; size?: number }) {
  if (item.visualKind === "event") return <Flag size={size} />;
  if (item.visualKind === "dialogue") return <MessageCircle size={size} />;
  if (item.visualKind === "speech") return <UserRound size={size} />;
  if (item.visualKind === "direction") return <Sparkles size={size} />;
  if (item.visualKind === "decision") return <GitBranch size={size} />;
  return <MousePointer2 size={size} />;
}

function conditionType(value: ConditionInput | undefined) {
  if (!value) return "none";
  const expression = Array.isArray(value) ? value[0] : value;
  if ("all" in expression) return "all";
  if ("any" in expression) return "any";
  if ("not" in expression) return "not";
  return expression.type;
}

function InlineConditionEditor({
  value,
  canonRefs,
  dataObjects,
  onChange,
}: {
  value?: ConditionInput;
  canonRefs: string[];
  dataObjects: ProjectDataObject[];
  onChange: (value: ConditionInput | undefined) => void;
}) {
  const type = conditionType(value);
  const condition = value && !Array.isArray(value) && !("all" in value) && !("any" in value) && !("not" in value)
    ? value as Record<string, unknown>
    : undefined;
  return <div className="script-condition-editor">
    <label className="field-label">If
      <select value={type} onChange={(event) => {
        const next = event.target.value;
        if (next === "none") onChange(undefined);
        if (next === "canonEntryUnlocked") onChange({ type: "canonEntryUnlocked", ref: canonRefs[0] ?? "" });
        if (next === "variable") onChange({ type: "variable", name: "flag", operator: "==", value: true });
        if (next === "visited") onChange({ type: "visited", targetType: "event", targetId: "" });
        if (next === "all") onChange({ all: [{ type: "canonEntryUnlocked", ref: canonRefs[0] ?? "" }] });
        if (next === "any") onChange({ any: [{ type: "canonEntryUnlocked", ref: canonRefs[0] ?? "" }] });
        if (next === "not") onChange({ not: { type: "canonEntryUnlocked", ref: canonRefs[0] ?? "" } });
      }}>
        <option value="none">Always available</option>
        <option value="canonEntryUnlocked">Canon unlocked</option>
        <option value="variable">Variable</option>
        <option value="visited">Visited</option>
        <option value="all">All conditions</option>
        <option value="any">Any condition</option>
        <option value="not">Not condition</option>
      </select>
    </label>
    {type === "canonEntryUnlocked" ? <label className="field-label">Canon
      <select value={String(condition?.ref ?? "")} onChange={(event) => onChange({ type: "canonEntryUnlocked", ref: event.target.value })}>
        <option value="">Select canon…</option>{canonRefs.map((ref) => <option key={ref} value={ref}>{ref}</option>)}
      </select>
    </label> : null}
    {type === "variable" ? <div className="logic-grid">
      <label className="field-label">Variable<input value={String(condition?.name ?? "")} onChange={(event) => onChange({ type: "variable", name: event.target.value, operator: "==", value: condition?.value ?? true })} /></label>
      <label className="field-label">Value<input value={String(condition?.value ?? "")} onChange={(event) => onChange({ type: "variable", name: String(condition?.name ?? "flag"), operator: "==", value: event.target.value })} /></label>
    </div> : null}
    {type === "visited" ? <div className="logic-grid">
      <label className="field-label">Target type<select value={String(condition?.targetType ?? "event")} onChange={(event) => onChange({ type: "visited", targetType: event.target.value as "sequence" | "branch" | "event" | "decision" | "outcome", targetId: String(condition?.targetId ?? "") })}><option value="event">Event</option><option value="decision">Decision</option><option value="outcome">Option</option><option value="branch">Branch</option><option value="sequence">Sequence</option></select></label>
      <label className="field-label">Target ID<input value={String(condition?.targetId ?? "")} onChange={(event) => onChange({ type: "visited", targetType: (condition?.targetType as "sequence" | "branch" | "event" | "decision" | "outcome") ?? "event", targetId: event.target.value })} /></label>
    </div> : null}
    {type === "all" || type === "any" || type === "not" ? <p className="script-condition-help">Compound condition: refine its child conditions below.</p> : null}
    <ConditionJsonEditor value={value} onChange={onChange} />
    {dataObjects.length ? <small>{dataObjects.length} data object{dataObjects.length === 1 ? "" : "s"} available for conditions in the canvas inspector.</small> : null}
  </div>;
}

function ConditionJsonEditor({ value, onChange }: { value?: ConditionInput; onChange: (value: ConditionInput | undefined) => void }) {
  const serialized = JSON.stringify(value ?? null, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState<string>();
  useEffect(() => { setDraft(serialized); setError(undefined); }, [serialized]);
  return <details className="script-condition-advanced">
    <summary>Advanced condition</summary>
    <textarea rows={5} value={draft} aria-label="Advanced condition JSON" onChange={(event) => {
      const next = event.target.value;
      setDraft(next);
      try {
        const parsed = JSON.parse(next) as ConditionInput | null;
        onChange(parsed ?? undefined);
        setError(undefined);
      } catch {
        setError("Enter valid condition JSON to save changes.");
      }
    }} />
    {error ? <small className="warning-text">{error}</small> : null}
  </details>;
}

function RouteConnectorRow({ transitions, targets, colSpan, depth }: {
  transitions: Transition[]; targets: RouteTarget[]; colSpan: number; depth: number;
}) {
  const ordered = [...transitions].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  if (!ordered.length) return null;
  return <tr className="script-route-connector"><td className="script-outline-track" style={{ "--script-tree-depth": depth } as CSSProperties}><span /></td><td colSpan={colSpan - 1}><div className="script-route-connector-body">
    {ordered.map((route) => <div className="script-route-connector-item" key={route.id}>
      <span className="script-route-connector-line" aria-hidden="true" />
      <Route size={13} /><span>Continues to</span><strong>{targets.find((item) => item.id === route.to)?.label ?? route.to}</strong>
    </div>)}
  </div></td></tr>;
}

function localizedKey(item: EventScriptItem, eventId: string, block?: ScriptBlock) {
  if (item.kind === "event") return `event.${eventId}.text`;
  if (item.kind === "beat" && item.beat) return block?.textKey ?? scriptBlockTextKey(item.beat.blockRef.scriptId, item.beat.blockRef.blockId);
  if (item.kind === "decision") return `decision.${item.decisionId}.prompt`;
  return `outcome.${item.outcome?.id}.text`;
}

type ScriptTreeContext = {
  project: BranchingProject;
  event: NonNullable<BranchingProject["events"][number]>;
  primaryLocale: string;
  languages: string[];
  localeNames?: LocaleNames;
  focusedTextKey?: string;
  blocks: Map<string, ScriptBlock>;
  targets: RouteTarget[];
  onUpdateText: (key: string, locale: string, value: string) => void;
  onDeleteBeat: (dialogueId: string | undefined, beatId: string) => void;
  onUpdateDecision: (eventId: string, decisionId: string, updates: { name?: string }) => void;
  onUpdateOutcome: (eventId: string, decisionId: string, outcomeId: string, updates: Partial<Outcome>) => void;
  selectedNodeId?: string;
  expandedNodeIds: Set<string>;
  onSelectNode: (nodeId: string) => void;
  onToggleExpanded: (nodeId: string) => void;
};

function filterTreeNodes(nodes: EventScriptTreeNode[], visibleIds: Set<string>): EventScriptTreeNode[] {
  return nodes.flatMap((node) => {
    const children = filterTreeNodes(node.children, visibleIds);
    if (visibleIds.has(node.nodeId)) return [{ ...node, children }];
    return children.length ? [{ ...node, children }] : [];
  });
}

function ScriptItemEditor({ node, context }: { node: EventScriptTreeNode; context: ScriptTreeContext }) {
  const { item } = node;
  const { project, event, primaryLocale, languages, focusedTextKey, blocks, targets, onUpdateText, onDeleteBeat, onUpdateDecision, onUpdateOutcome, selectedNodeId, expandedNodeIds, onSelectNode, onToggleExpanded } = context;
  const block = item.beat ? blocks.get(`${item.beat.blockRef.scriptId}:${item.beat.blockRef.blockId}`) : undefined;
  const key = localizedKey(item, event.id, block);
  const values = project.localizationCatalog?.entries[key]?.values ?? (block && item.beat ? blockValues(project, item.beat.blockRef.scriptId, block, primaryLocale) : {});
  const routes = (event.transitions ?? []).filter((route) => route.from === item.nodeId);
  const isSelected = selectedNodeId === item.nodeId;
  const isExpanded = isSelected || expandedNodeIds.has(item.nodeId);
  const dialogue = item.dialogueId ? event.dialogues?.find((candidate) => candidate.id === item.dialogueId) : undefined;
  const style = { "--script-tree-depth": node.depth } as CSSProperties;
  const textValue = (locale: string) => values[locale] ?? (locale === primaryLocale ? block?.content ?? item.label : "");
  const updateText = (locale: string, value: string) => {
    onUpdateText(key, locale, value);
    if (locale !== primaryLocale) return;
    if (item.kind === "decision" && item.decisionId) onUpdateDecision(event.id, item.decisionId, { name: value });
    if (item.kind === "outcome" && item.decisionId && item.outcome) onUpdateOutcome(event.id, item.decisionId, item.outcome.id, { name: value });
  };
  return <><tr className={`script-sheet-row script-outline-row ${item.visualKind}${node.depth ? " nested" : ""}${key === focusedTextKey ? " focused" : ""}${isSelected ? " selected" : ""}`} onClick={() => onSelectNode(item.nodeId)}>
    <td className="script-outline-track" style={style}><span /></td>
    <td className="script-sheet-flow" style={style}><button type="button" className="script-outline-identity" aria-expanded={isExpanded} onClick={(click) => { click.stopPropagation(); onToggleExpanded(item.nodeId); }}><ItemKindIcon item={item} /><span><small>{itemKindLabel(item)}</small><strong>{item.label}</strong></span>{item.kind === "dialogue" ? <ChevronDown size={14} /> : null}</button>{item.kind === "beat" && item.beat ? <button type="button" className="script-row-delete danger" aria-label={`Delete ${itemKindLabel(item)}`} title="Delete beat" onClick={(click) => { click.stopPropagation(); if (window.confirm("Delete this beat and its linked routes?")) onDeleteBeat(item.dialogueId, item.beat!.id); }}><Trash2 size={12} /></button> : null}</td>
    <td className="script-sheet-dialogue">{item.kind === "dialogue" ? <span className="script-context-pill">{(dialogue?.beats?.length ?? 0) + (dialogue?.members?.filter((member) => member.kind === "decision").length ?? 0)} items</span> : dialogue ? <span>{dialogue.title}</span> : <span className="script-sheet-empty">Event scope</span>}</td>
    {languages.map((locale) => <td key={locale} className="script-sheet-translation"><span>{locale}</span>{item.kind === "dialogue" ? <em>Dialogue container</em> : <textarea rows={3} aria-label={`${locale} ${itemKindLabel(item)} text`} value={textValue(locale)} placeholder={locale === primaryLocale ? item.label : "Translation…"} onClick={(click) => click.stopPropagation()} onDoubleClick={(doubleClick) => doubleClick.stopPropagation()} onChange={(input) => updateText(locale, input.target.value)} />}</td>)}
  </tr><RouteConnectorRow transitions={routes} targets={targets} colSpan={languages.length + 3} depth={node.depth + 1} /></>;
}

function ScriptTree({ nodes, visibleIds, context, depth = 0 }: { nodes: EventScriptTreeNode[]; visibleIds: Set<string>; context: ScriptTreeContext; depth?: number }): ReactNode {
  const visibleNodes = filterTreeNodes(nodes, visibleIds);
  if (!visibleNodes.length) return null;
  return <>{visibleNodes.map((node) => <Fragment key={`${node.nodeId}:${node.reference ?? "item"}`}>
    {node.reference ? <tr className={`script-sheet-reference ${node.reference}`}><td colSpan={context.languages.length + 3} style={{ "--script-tree-depth": node.depth } as CSSProperties}>{node.reference === "cycle" ? <RotateCcw size={13} /> : <Link2 size={13} />}<span>{node.reference === "cycle" ? "Cycle reference" : "Shared reference"} · {node.item.label}</span></td></tr> : <ScriptItemEditor node={node} context={context} />}
    {node.children.length ? <ScriptTree nodes={node.children} visibleIds={visibleIds} context={context} depth={depth + 1} /> : null}
  </Fragment>)}</>;
}

type EventConfigContext = {
  project: BranchingProject;
  event: EventNode;
  propertiesConfig?: Record<string, unknown>;
  onUpdateEvent: (eventId: string, updates: Partial<EventNode>) => void;
  onCreateTrigger: (source?: DialogueStart["source"]) => void;
  onUpdateTrigger: (triggerId: string, updates: Partial<DialogueStart>) => void;
};

function entityGroup(kind: string | undefined) {
  const normalized = (kind ?? "").toLowerCase();
  if (normalized.includes("character") || normalized.includes("speaker")) return "Characters";
  if (normalized.includes("item") || normalized.includes("inventory")) return "Items";
  return "Other entities";
}

function EventConfiguration({ context }: { context: EventConfigContext }) {
  const { project, event, propertiesConfig, onUpdateEvent, onCreateTrigger, onUpdateTrigger } = context;
  const [entityToAdd, setEntityToAdd] = useState("");
  const presentEntityRefs = event.presentEntityRefs ?? event.canonRefs ?? [];
  const presentSet = new Set(presentEntityRefs);
  const refsById = useMemo(() => new Map(project.canonRefs.map((ref) => [ref.id, ref])), [project.canonRefs]);
  const propertiesById = useMemo(() => new Map(flattenCanonExplorerProperties(canonExplorerProperties(propertiesConfig)).map((property) => [property.id, property])), [propertiesConfig]);
  const grouped = useMemo(() => ["Characters", "Items", "Other entities"].map((group) => ({ group, refs: presentEntityRefs.map((id) => refsById.get(id)).filter((ref): ref is NonNullable<typeof ref> => Boolean(ref)).filter((ref) => entityGroup(ref.kind) === group) })), [presentEntityRefs, refsById]);
  const locationCandidates = project.canonRefs.filter((ref) => /location|scene/i.test(ref.kind ?? ""));
  const selectableLocations = locationCandidates.length ? locationCandidates : project.canonRefs;
  const removeEntity = (entityId: string) => {
    const dependent = (event.dialogueStarts ?? []).filter((start) => start.source?.kind === "canonRef" && start.source.id === entityId);
    if (dependent.length && !window.confirm(`Removing this entity also removes ${dependent.length} dialogue trigger${dependent.length === 1 ? "" : "s"} and their routes. Continue?`)) return;
    const triggerNodeIds = new Set(dependent.map((start) => `dialogue-start:${event.id}:${start.id}`));
    onUpdateEvent(event.id, {
      presentEntityRefs: presentEntityRefs.filter((id) => id !== entityId),
      dialogueStarts: (event.dialogueStarts ?? []).filter((start) => !dependent.includes(start)),
      transitions: (event.transitions ?? []).filter((route) => !triggerNodeIds.has(route.from) && !triggerNodeIds.has(route.to)),
    });
  };
  const removeInteraction = (start: DialogueStart) => {
    const sourceId = `dialogue-start:${event.id}:${start.id}`;
    const routes = (event.transitions ?? []).filter((route) => route.from === sourceId || route.to === sourceId);
    if (routes.length && !window.confirm(`Removing this interaction also removes ${routes.length} linked route${routes.length === 1 ? "" : "s"}. Continue?`)) return;
    onUpdateEvent(event.id, {
      dialogueStarts: (event.dialogueStarts ?? []).filter((item) => item.id !== start.id),
      transitions: (event.transitions ?? []).filter((route) => route.from !== sourceId && route.to !== sourceId),
    });
  };
  return <div className="event-config-scroll">
    <section className="event-config-card event-config-place"><div className="event-config-card-heading"><MapPin size={16} /><div><span>Place</span><h3>Event location</h3></div></div><label className="field-label">Primary location<select value={event.locationRef ?? ""} onChange={(input) => onUpdateEvent(event.id, { locationRef: input.target.value || undefined })}><option value="">No location selected</option>{selectableLocations.map((ref) => <option key={ref.id} value={ref.id}>{ref.label ?? ref.id}{ref.kind ? ` · ${ref.kind}` : ""}</option>)}</select></label></section>
    <section className="event-config-card"><div className="event-config-card-heading"><MessageCircle size={16} /><div><span>Speech pacing</span><h3>Target per speech beat</h3></div></div><div className="event-config-add"><label className="field-label">Measure<select disabled={!event.speechBeatLengthTarget} value={event.speechBeatLengthTarget?.unit ?? "words"} onChange={(input) => onUpdateEvent(event.id, { speechBeatLengthTarget: { unit: input.target.value as "words" | "characters", target: event.speechBeatLengthTarget?.target ?? 1 } })}><option value="words">Words</option><option value="characters">Characters</option></select></label><label className="field-label">Maximum<input type="number" min="1" step="1" value={event.speechBeatLengthTarget?.target ?? ""} placeholder="No counter" onChange={(input) => { const target = Number(input.target.value); onUpdateEvent(event.id, { speechBeatLengthTarget: Number.isInteger(target) && target > 0 ? { unit: event.speechBeatLengthTarget?.unit ?? "words", target } : undefined }); }} /></label></div><p className="event-config-empty">Shows the current count on every speech beat in this event.</p></section>
    <section className="event-config-card"><div className="event-config-card-heading"><UserRound size={16} /><div><span>Cast & props</span><h3>Entities present in this event</h3></div></div><div className="event-config-add"><select value={entityToAdd} onChange={(input) => setEntityToAdd(input.target.value)}><option value="">Add a present entity…</option>{project.canonRefs.filter((ref) => !presentSet.has(ref.id)).map((ref) => <option key={ref.id} value={ref.id}>{ref.label ?? ref.id}{ref.kind ? ` · ${ref.kind}` : ""}</option>)}</select><button type="button" disabled={!entityToAdd} onClick={() => { onUpdateEvent(event.id, { presentEntityRefs: [...presentEntityRefs, entityToAdd] }); setEntityToAdd(""); }}><Plus size={14} /> Add</button></div>
      <div className="event-config-entity-groups">{grouped.map(({ group, refs }) => <div className="event-config-group" key={group}><h4>{group}</h4>{refs.length ? refs.map((ref) => {
        const eligibleProperties = Array.from(propertiesById.values()).filter((property) => propertySupportsDialogueTrigger(project, "canon", property.id) && [ref.properties, ref.frontmatter].some((record) => Boolean(record && Object.prototype.hasOwnProperty.call(record, property.id))));
        return <details className="event-config-entity" key={ref.id} open><summary><span>{group === "Characters" ? <UserRound size={14} /> : group === "Items" ? <Package size={14} /> : <GitBranch size={14} />}</span><strong>{ref.label ?? ref.id}</strong><small>{ref.kind ?? "entity"}</small><button type="button" className="icon-only danger" title="Remove from event" aria-label={`Remove ${ref.label ?? ref.id}`} onClick={(click) => { click.preventDefault(); removeEntity(ref.id); }}><Trash2 size={13} /></button><ChevronDown className="event-config-entity-caret" size={14} /></summary><div className="event-config-interactions"><div className="event-config-interactions-heading"><span>Interactions by property</span><small>{eligibleProperties.length ? "Enable the properties that start dialogue in this event." : "No globally eligible dialogue-trigger properties on this entity."}</small></div>{eligibleProperties.map((property) => {
          const starts = (event.dialogueStarts ?? []).filter((start) => start.source?.kind === "canonRef" && start.source.id === ref.id && start.source.propertyId === property.id);
          const start = starts[0];
          return <div className="event-config-property" key={property.id}><label><input type="checkbox" checked={Boolean(start)} onChange={(input) => input.target.checked ? onCreateTrigger({ kind: "canonRef", id: ref.id, propertyId: property.id }) : start ? removeInteraction(start) : undefined} /><span><strong>{property.label}</strong><small>{property.id}</small></span></label>{start ? <details className="event-config-availability"><summary>Availability</summary><InlineConditionEditor value={start.availability} canonRefs={project.canonRefs.map((item) => item.id)} dataObjects={project.projectDataObjects ?? []} onChange={(availability) => onUpdateTrigger(start.id, { availability })} /></details> : null}</div>;
        })}</div></details>;
      }) : <p className="event-config-empty">No {group.toLowerCase()} are present.</p>}</div>)}</div>
    </section>
  </div>;
}

export function EventScriptWorkspace({ project, eventId, primaryLocale, locales, localeNames, focusedTextKey, breadcrumb, portraitUrlForRef, propertiesConfig, onUpdateEvent, onUpdateText, onUpdateBlock, onCreateEventBeat, onCreateDialogueBeat, onUpdateBeat, onDeleteBeat, onCreateDecision, onUpdateDecision, onDeleteDecision, onUpdateOutcome, onCreateTrigger, onUpdateTrigger, onDeleteTrigger, onCreateTransition, onUpdateTransition, onDeleteTransition }: {
  project: BranchingProject; eventId: string; primaryLocale: string; locales: string[]; localeNames?: LocaleNames; focusedTextKey?: string; breadcrumb: Array<{ label: string; onClick: () => void }>; portraitUrlForRef?: (refId: string) => string | undefined; propertiesConfig?: Record<string, unknown>;
  onUpdateEvent: (eventId: string, updates: Partial<EventNode>) => void; onUpdateText: (key: string, locale: string, value: string) => void; onUpdateBlock: (scriptId: string, blockId: string, updates: Partial<ScriptBlock>) => void; onCreateEventBeat: (eventId: string, kind: DialogueBeat["kind"]) => void; onCreateDialogueBeat: (eventId: string, dialogueId: string, kind: DialogueBeat["kind"]) => void; onUpdateBeat: (dialogueId: string | undefined, beatId: string, updates: Partial<DialogueBeat>) => void; onDeleteBeat: (dialogueId: string | undefined, beatId: string) => void; onCreateDecision: (eventId: string, dialogueId?: string) => void; onUpdateDecision: (eventId: string, decisionId: string, updates: { name?: string }) => void; onDeleteDecision: (eventId: string, decisionId: string) => void; onUpdateOutcome: (eventId: string, decisionId: string, outcomeId: string, updates: Partial<Outcome>) => void; onCreateTrigger: (source?: DialogueStart["source"]) => void; onUpdateTrigger: (triggerId: string, updates: Partial<DialogueStart>) => void; onDeleteTrigger: (triggerId: string) => void; onCreateTransition: (from: string, to: string) => void; onUpdateTransition: (transitionId: string, updates: Partial<Transition>) => void; onDeleteTransition: (transitionId: string) => void;
}) {
  const event = project.events.find((candidate) => candidate.id === eventId);
  const [tab, setTab] = useState<"configuration" | "script">("script");
  const [query, setQuery] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const languages = normalizeLocaleList(primaryLocale, locales);
  const blocks = useMemo(() => new Map((project.scriptDocuments ?? []).flatMap((script) => script.blocks.map((block) => [`${script.id}:${block.id}`, block] as const))), [project.scriptDocuments]);
  const sections = useMemo(() => buildEventScriptOutline(project, eventId), [project, eventId]);
  const targets = useMemo<RouteTarget[]>(() => {
    const internal = sections.flatMap((section) => section.items).map((item) => ({ id: item.nodeId, label: item.label }));
    const external = project.events.filter((candidate) => candidate.id !== eventId).map((candidate) => ({ id: candidate.id, label: `Event · ${candidate.name}` }));
    return Array.from(new Map([...internal, ...external].map((item) => [item.id, item])).values());
  }, [eventId, project.events, sections]);
  useEffect(() => {
    if (!event) return;
    setExpandedNodeIds(new Set((event.dialogues ?? []).map((dialogue) => `dialogue:${event.id}:${dialogue.id}`)));
    setSelectedNodeId(undefined);
  }, [event?.id]);
  if (!event) return null;
  const createBeat = (dialogueId: string | undefined, kind: DialogueBeat["kind"]) => dialogueId ? onCreateDialogueBeat(event.id, dialogueId, kind) : onCreateEventBeat(event.id, kind);
  const toggleExpanded = (nodeId: string) => setExpandedNodeIds((current) => { const next = new Set(current); next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId); return next; });
  const treeContext: ScriptTreeContext = { project, event, primaryLocale, languages, localeNames, focusedTextKey, blocks, targets, onUpdateText, onDeleteBeat, onUpdateDecision, onUpdateOutcome, selectedNodeId, expandedNodeIds, onSelectNode: (nodeId) => { setSelectedNodeId(nodeId); setExpandedNodeIds((current) => new Set(current).add(nodeId)); }, onToggleExpanded: toggleExpanded };
  return <section className="event-script-workspace" aria-label={`Event workspace for ${event.name}`}>
    <div className="canvas-modebar event-script-modebar"><nav className="canvas-breadcrumb" aria-label="Canvas path">{breadcrumb.map((item, index) => <span className="breadcrumb-crumb" key={`${item.label}:${index}`}><button type="button" onClick={item.onClick}>{index === 0 ? <Home size={14} /> : <GitBranch size={14} />}<span>{item.label}</span></button></span>)}<span className="breadcrumb-crumb"><button type="button" className="active" aria-current="page"><FileText size={14} /><span>Event</span></button></span></nav></div>
    <header className="event-script-header"><div><span>{event.name}</span><h2>Event editor</h2></div><div className="event-script-tabs" role="tablist" aria-label="Event editor sections"><button type="button" role="tab" aria-selected={tab === "configuration"} className={tab === "configuration" ? "active" : ""} onClick={() => setTab("configuration")}>Configuration</button><button type="button" role="tab" aria-selected={tab === "script"} className={tab === "script" ? "active" : ""} onClick={() => setTab("script")}>Script</button></div>{tab === "script" ? <><label className="event-script-search"><input value={query} onChange={(input) => setQuery(input.target.value)} placeholder="Search script…" /></label><button type="button" className={missingOnly ? "active" : ""} onClick={() => setMissingOnly((value) => !value)}><Filter size={14} /> Missing</button></> : null}</header>
    {tab === "configuration" ? <EventConfiguration context={{ project, event, propertiesConfig, onUpdateEvent, onCreateTrigger, onUpdateTrigger }} /> : <div className="script-sheet-scroll"><table className="script-sheet script-outline-sheet"><thead><tr><th scope="col" className="script-outline-track-heading" aria-label="Narrative tracking" /><th scope="col">Element</th><th scope="col">Dialogue</th>{languages.map((locale) => <th scope="col" key={locale}>{localeDisplayName(locale, localeNames)}</th>)}</tr></thead><tbody>{sections.map((section) => {
      const visibleItems = section.items.filter((item) => {
        const block = item.beat ? blocks.get(`${item.beat.blockRef.scriptId}:${item.beat.blockRef.blockId}`) : undefined;
        const key = localizedKey(item, event.id, block);
        const values = project.localizationCatalog?.entries[key]?.values ?? (block && item.beat ? blockValues(project, item.beat.blockRef.scriptId, block, primaryLocale) : {});
        const haystack = `${item.label} ${Object.values(values).join(" ")}`.toLowerCase();
        const missing = item.kind !== "dialogue" && languages.some((locale) => !(values[locale] ?? (locale === primaryLocale ? block?.content ?? item.label : "")).trim());
        return haystack.includes(query.toLowerCase()) && (!missingOnly || missing);
      });
      const sourceId = section.trigger ? `dialogue-start:${event.id}:${section.trigger.id}` : event.id;
      const sectionIcon = section.kind === "trigger" ? <CircleDot size={14} /> : section.kind === "unassigned" ? <AlertTriangle size={14} /> : <Flag size={14} />;
      return <Fragment key={section.id}><tr className={`script-sheet-section ${section.kind}`}><td className="script-outline-track"><span /></td><td className="script-sheet-section-flow">{sectionIcon}<span>{section.kind === "trigger" ? "Interaction trigger" : section.kind === "unassigned" ? "No entry" : "Event start"}</span><strong>{section.label}</strong><em>{visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}</em>{section.trigger ? <button type="button" className="danger script-row-delete" aria-label="Delete trigger" title="Delete trigger" onClick={() => { if (window.confirm("Delete this trigger and its linked routes?")) onDeleteTrigger(section.trigger!.id); }}><Trash2 size={12} /></button> : null}</td><td colSpan={languages.length + 1} className="script-sheet-section-note">{section.kind === "event-start" ? "Normal narrative entry." : section.kind === "trigger" ? "Interaction configured in Configuration." : "Preserved content without a narrative entry."}</td></tr><RouteConnectorRow transitions={(event.transitions ?? []).filter((route) => route.from === sourceId)} targets={targets} colSpan={languages.length + 3} depth={1} /><tr className="script-sheet-insert"><td className="script-outline-track" style={{ "--script-tree-depth": 1 } as CSSProperties}><span>+</span></td><td colSpan={languages.length + 2}><button type="button" onClick={() => createBeat(section.dialogueId, "speech")}><Plus size={13} /> Speech beat</button><button type="button" onClick={() => createBeat(section.dialogueId, "direction")}><Plus size={13} /> Direction</button><button type="button" onClick={() => onCreateDecision(event.id, section.dialogueId)}><Plus size={13} /> Decision</button>{section.sharedItemIds.length ? <small>Shared with another path · {section.sharedItemIds.length}</small> : null}</td></tr><ScriptTree nodes={section.trees} visibleIds={new Set([...visibleItems.map((item) => item.nodeId), ...(!query && !missingOnly ? section.sharedItemIds : [])])} context={treeContext} /></Fragment>;
    })}</tbody></table></div>}
  </section>;
}
