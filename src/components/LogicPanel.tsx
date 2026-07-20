import {
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleDot,
  Info,
  LockKeyhole,
  MessageSquare,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type { Selection } from "../appTypes.js";
import type {
  BranchingProject,
  ExplorerPropertyOption,
  LocalExplorerProperty,
  LogicPropertyOverride,
  LogicVariable,
  LogicVariableGroup,
  LogicVariableType,
} from "../domain.js";
import {
  canonExplorerPropertyTypes,
  canonExplorerTypeProperty,
  flattenCanonExplorerProperties,
  propertyCapability,
  type CanonExplorerProperty,
} from "../explorerSchema.js";
import { WorkspaceSidePanel } from "./WorkspaceSidePanel.js";

const CLICK_SEQUENCE_WINDOW_MS = 360;
const variableTypes: LogicVariableType[] = ["text", "number", "boolean", "list", "canonRef"];
const propertyTypes = [
  ["text", "Text"],
  ["number", "Number"],
  ["boolean", "Boolean"],
  ["select", "Select"],
  ["multiselect", "Multi-select"],
  ["entity-ref", "Entity reference"],
] as const;
type PropertySource = "canon" | "local";
type PropertyEditorState = { id: string; source: PropertySource; top: number; left: number };

function optionKey(index: number) {
  return `option-${index + 1}`;
}

export function LogicPanel({
  project,
  propertiesConfig,
  collapsed,
  onCollapsedChange,
  onContextMenu,
  onUpdate,
  selected,
  onSelect,
  onOpenInspector,
  onCreateProperty,
  onInitializeProperties,
  onUpdateLocalExplorerProperty,
  onUpdateLogicPropertyOverride,
  onDeleteLocalExplorerProperty,
}: {
  project: BranchingProject;
  propertiesConfig?: Record<string, unknown>;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onUpdate: (project: BranchingProject) => void;
  selected?: Selection;
  onSelect: (selection: Selection) => void;
  onOpenInspector: (selection: Selection) => void;
  onCreateProperty: (label: string, valueType: LocalExplorerProperty["valueType"]) => void;
  onInitializeProperties?: () => void;
  onUpdateLocalExplorerProperty: (id: string, updates: Partial<LocalExplorerProperty>) => void;
  onUpdateLogicPropertyOverride: (
    propertyId: string,
    source: PropertySource,
    changes: Partial<LogicPropertyOverride>,
  ) => void;
  onDeleteLocalExplorerProperty?: (id: string) => void;
}) {
  const [tab, setTab] = useState<"properties" | "variables">("properties");
  const [collapsedCanonTypes, setCollapsedCanonTypes] = useState<Set<string>>(() => {
    const canonPropertyTypes = canonExplorerPropertyTypes(propertiesConfig);
    return new Set(canonPropertyTypes.map((type) => type.id));
  });
  const [propertyEditor, setPropertyEditor] = useState<PropertyEditorState>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPropertyLabel, setNewPropertyLabel] = useState("");
  const [newPropertyType, setNewPropertyType] = useState<LocalExplorerProperty["valueType"]>("text");
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingInspectorClickRef = useRef<{ propertyId: string; source: PropertySource; timer: number } | undefined>(undefined);
  const groups = [...(project.logicVariableGroups ?? [])].sort((a, b) => a.order - b.order);
  const canonPropertyTypes = useMemo(() => canonExplorerPropertyTypes(propertiesConfig), [propertiesConfig]);
  const localProperties = project.localExplorerProperties ?? [];
  const canonProperties = useMemo(
    () => canonPropertyTypes.flatMap((type) => [canonExplorerTypeProperty(type), ...flattenCanonExplorerProperties(type.properties)]),
    [canonPropertyTypes],
  );
  const editingProperty = propertyEditor
    ? propertyEditor.source === "canon"
      ? canonProperties.find((property) => property.id === propertyEditor.id)
      : localProperties.find((property) => property.id === propertyEditor.id)
    : undefined;
  const editingCapability = editingProperty && propertyEditor
    ? propertyCapability(project, propertyEditor.source, editingProperty.id)
    : undefined;
  const isCanonEditor = propertyEditor?.source === "canon";

  useEffect(() => {
    if (!propertyEditor) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !editorRef.current?.contains(event.target)) {
        setPropertyEditor(undefined);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPropertyEditor(undefined);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [propertyEditor]);

  const updateGroups = (next: LogicVariableGroup[]) => onUpdate({ ...project, logicVariableGroups: next });
  const updateVariables = (next: LogicVariable[]) => onUpdate({ ...project, logicVariables: next });
  const addGroup = () => updateGroups([...groups, { id: `group:${crypto.randomUUID()}`, name: `Group ${groups.length + 1}`, order: groups.length }]);
  const addVariable = (groupId: string) => updateVariables([
    ...(project.logicVariables ?? []),
    { id: `variable:${crypto.randomUUID()}`, name: `variable_${(project.logicVariables?.length ?? 0) + 1}`, type: "text", value: "", groupId },
  ]);
  const variableValue = (variable: LogicVariable) => variable.type === "list" && Array.isArray(variable.value) ? variable.value.join(", ") : String(variable.value);
  const updateVariable = (id: string, changes: Partial<LogicVariable>) => updateVariables((project.logicVariables ?? []).map((variable) => variable.id === id ? { ...variable, ...changes } : variable));
  const toggleCanonType = (typeId: string) => setCollapsedCanonTypes((current) => {
    const next = new Set(current);
    if (next.has(typeId)) next.delete(typeId); else next.add(typeId);
    return next;
  });
  const expandAllProperties = () => {
    setCollapsedCanonTypes(new Set());
  };
  const collapseAllProperties = () => {
    setCollapsedCanonTypes(new Set(canonPropertyTypes.map((type) => type.id)));
  };
  
  const clearPendingInspectorClick = () => {
    if (pendingInspectorClickRef.current) {
      window.clearTimeout(pendingInspectorClickRef.current.timer);
      pendingInspectorClickRef.current = undefined;
    }
  };

  const handleCreateProperty = () => {
    const trimmedLabel = newPropertyLabel.trim();
    if (!trimmedLabel) return;
    onCreateProperty(trimmedLabel, newPropertyType);
    setIsCreateModalOpen(false);
    setNewPropertyLabel("");
    setNewPropertyType("text");
  };

  const handlePropertyPointerDown = (propertyId: string, source: PropertySource) => {
    clearPendingInspectorClick();
    const selection = { type: "explorerProperty" as const, id: propertyId, source };
    const timer = window.setTimeout(() => {
      onOpenInspector(selection);
      pendingInspectorClickRef.current = undefined;
    }, CLICK_SEQUENCE_WINDOW_MS);
    pendingInspectorClickRef.current = { propertyId, source, timer };
  };

  const handlePropertyPointerUp = (propertyId: string, source: PropertySource) => {
    if (pendingInspectorClickRef.current) {
      clearPendingInspectorClick();
      onSelect({ type: "explorerProperty" as const, id: propertyId, source });
    }
  };

  const openPropertyEditor = (event: ReactMouseEvent<HTMLButtonElement>, id: string, source: PropertySource) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 340;
    const height = 600;
    const viewportWidth = typeof window === "undefined" ? width + 24 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? height + 24 : window.innerHeight;
    setPropertyEditor({
      id,
      source,
      top: Math.max(8, Math.min(rect.top, viewportHeight - height - 8)),
      left: Math.max(8, Math.min(rect.right + 8, viewportWidth - width - 8)),
    });
    onSelect({ type: "explorerProperty", id, source });
  };
  
  const propertySelected = (id: string, source: PropertySource) => selected?.type === "explorerProperty" && selected.id === id && selected.source === source;
  const propertyCount = (properties: CanonExplorerProperty[]): number => properties.reduce((count, property) => count + 1 + propertyCount(property.children), 0);

  const updateLocal = (changes: Partial<LocalExplorerProperty>) => {
    if (propertyEditor?.source === "local" && editingProperty) {
      onUpdateLocalExplorerProperty(editingProperty.id, changes);
    }
  };
  const updateCapability = (changes: Partial<LogicPropertyOverride>) => {
    if (propertyEditor && editingProperty) {
      onUpdateLogicPropertyOverride(editingProperty.id, propertyEditor.source, changes);
    }
  };
  const updateOptions = (options: ExplorerPropertyOption[]) => updateLocal({ options: options.length ? options : undefined });
  
  const renderCapabilityCard = (
    icon: ReactNode,
    title: string,
    description: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    nested?: boolean,
  ) => (
    <button
      type="button"
      className={`logic-capability-card${checked ? " active" : ""}${nested ? " nested" : ""}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <div className="logic-capability-icon">{icon}</div>
      <div className="logic-capability-content">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="logic-capability-toggle">
        {checked ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </div>
    </button>
  );

  const renderEditorOptions = () => {
    if (!editingProperty) return null;
    const options = editingProperty.options ?? [];
    return <div className="logic-property-options">
      <div className="logic-property-editor-subheading"><strong>Options</strong><span>{options.length}</span></div>
      {options.map((option, index) => <div className="logic-property-option" key={`${option.value}-${index}`}>
        <input aria-label={`Option ${index + 1} value`} disabled={isCanonEditor} value={option.value} onChange={(event) => updateOptions(options.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} />
        <input aria-label={`Option ${index + 1} label`} disabled={isCanonEditor} value={option.label} onChange={(event) => updateOptions(options.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
        {!isCanonEditor ? <button type="button" className="icon-only" aria-label={`Remove option ${index + 1}`} onClick={() => updateOptions(options.filter((_, itemIndex) => itemIndex !== index))}><X size={13} /></button> : null}
      </div>)}
      {!isCanonEditor ? <button type="button" className="logic-property-add-option" onClick={() => updateOptions([...options, { value: optionKey(options.length), label: `Option ${options.length + 1}` }])}><Plus size={13} /> Add option</button> : null}
    </div>;
  };

  const renderPropertyAction = (property: { id: string }, source: PropertySource) => <button
    type="button"
    className="icon-only logic-property-edit-button"
    title={source === "canon" ? "View imported property" : "Edit property"}
    aria-label={source === "canon" ? `View ${property.id}` : `Edit ${property.id}`}
    onClick={(event) => openPropertyEditor(event, property.id, source)}
  ><MoreHorizontal size={14} /></button>;

  const renderCanonProperty = (property: CanonExplorerProperty, depth = 0): ReactNode => <div className="logic-property-tree-node" key={`${property.id}-${depth}`} style={{ "--property-depth": depth } as CSSProperties}>
    <div className="logic-property-row-shell">
      <button type="button" className={`explorer-entity-open logic-property-row ${propertySelected(property.id, "canon") ? "active" : ""}`} onPointerDown={() => handlePropertyPointerDown(property.id, "canon")} onPointerUp={() => handlePropertyPointerUp(property.id, "canon")} onPointerLeave={clearPendingInspectorClick}>
        {property.valueType === "group" ? <Boxes size={14} /> : <CircleDot size={14} />}
        <span className="explorer-entity-name">{property.label}</span>
        <em className="explorer-origin canon">{property.valueType}</em>
        <LockKeyhole className="logic-property-lock" size={12} aria-label="Imported from canon" />
      </button>
      {renderPropertyAction(property, "canon")}
    </div>
    {property.children.length ? <div className="logic-property-children">{property.children.map((child) => renderCanonProperty(child, depth + 1))}</div> : null}
  </div>;

  const renderLocalProperty = (property: LocalExplorerProperty) => <div className="logic-property-row-shell" key={property.id}>
    <button type="button" className={`explorer-entity-open logic-property-row ${propertySelected(property.id, "local") ? "active" : ""}`} onPointerDown={() => handlePropertyPointerDown(property.id, "local")} onPointerUp={() => handlePropertyPointerUp(property.id, "local")} onPointerLeave={clearPendingInspectorClick}><CircleDot size={14} /><span className="explorer-entity-name">{property.label}</span><em className="explorer-origin local">{property.valueType}</em></button>
    {renderPropertyAction(property, "local")}
  </div>;

  return <WorkspaceSidePanel title="Logic" side="left" collapsed={collapsed} onCollapsedChange={onCollapsedChange} onContextMenu={onContextMenu}>
    <div className="explorer-view-tabs" role="tablist" aria-label="Logic views">
      <button type="button" role="tab" aria-selected={tab === "properties"} className={tab === "properties" ? "active" : ""} onClick={() => setTab("properties")}>Properties</button>
      <button type="button" role="tab" aria-selected={tab === "variables"} className={tab === "variables" ? "active" : ""} onClick={() => setTab("variables")}>Variables</button>
    </div>
    {tab === "properties" ? <>
      <div className="panel-toolbar"><strong>Property schema</strong><div style={{display: "flex", gap: "4px"}}><button type="button" title="Expand all properties" onClick={expandAllProperties}><ChevronDown size={14} /></button><button type="button" title="Collapse all properties" onClick={collapseAllProperties}><ChevronRight size={14} /></button></div><button type="button" onClick={() => setIsCreateModalOpen(true)}><Plus size={14} /> Property</button></div>
      <p className="inspector-connection-hint">Edit local properties here. Imported canon properties are protected; only their Pathbranching capabilities can be overridden.</p>
      <div className="explorer-tree logic-property-tree">
        {canonPropertyTypes.map((type) => {
          const typeExpanded = !collapsedCanonTypes.has(type.id);
          const count = propertyCount(type.properties);
          const typeProperty = canonExplorerTypeProperty(type);
          return <section className="logic-canon-type-group" key={type.id}>
            <div className="logic-canon-type-heading">
              <button type="button" className="logic-canon-type-toggle" aria-label={`${typeExpanded ? "Collapse" : "Expand"} ${type.label}`} onClick={() => toggleCanonType(type.id)}>{typeExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
              <div className="logic-property-row-shell">
                <button type="button" className={`explorer-entity-open logic-property-row logic-canon-type-row ${propertySelected(typeProperty.id, "canon") ? "active" : ""}`} onPointerDown={() => handlePropertyPointerDown(typeProperty.id, "canon")} onPointerUp={() => handlePropertyPointerUp(typeProperty.id, "canon")} onPointerLeave={clearPendingInspectorClick}><CircleDot size={13} /><span className="explorer-entity-name">{type.label}</span><em className="explorer-origin canon">{typeProperty.valueType}</em><LockKeyhole className="logic-property-lock" size={12} /><span className="logic-canon-type-count">{count}</span></button>
                {renderPropertyAction(typeProperty, "canon")}
              </div>
            </div>
            {typeExpanded && type.properties.map((property) => renderCanonProperty(property))}
            {typeExpanded && !type.properties.length ? <span className="empty-line">No properties for this type.</span> : null}
          </section>;
        })}
        {localProperties.map((property) => renderLocalProperty(property))}
        {canonPropertyTypes.length === 0 && localProperties.length === 0 ? (
          !propertiesConfig ? (
            <div className="empty-state" style={{ padding: "16px", textAlign: "center" }}>
              <span className="empty-line" style={{ display: "block", marginBottom: "12px" }}>No properties configured.</span>
              <button 
                type="button" 
                onClick={onInitializeProperties}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                <Plus size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                Initialize Properties
              </button>
            </div>
          ) : (
            <span className="empty-line">No properties.</span>
          )
        ) : null}
      </div>
      {propertyEditor && editingProperty ? <div ref={editorRef} className="logic-property-editor" style={{ top: propertyEditor.top, left: propertyEditor.left }} role="dialog" aria-label={`${isCanonEditor ? "Imported" : "Edit"} property`}>
        <header className="logic-property-editor-header">
          <span className="logic-property-editor-icon">{isCanonEditor ? <LockKeyhole size={15} /> : <ShieldCheck size={15} />}</span>
          <div><strong>{editingProperty.label}</strong><small>{isCanonEditor ? "Imported canon property" : "Local property"}</small></div>
          <div style={{ display: "flex", gap: "4px" }}>
            {!isCanonEditor ? <button type="button" className="icon-only" title="Delete property" aria-label="Delete property" onClick={() => { onDeleteLocalExplorerProperty?.(editingProperty.id); setPropertyEditor(undefined); }}><Trash2 size={15} /></button> : null}
            <button type="button" className="icon-only" aria-label="Close property editor" onClick={() => setPropertyEditor(undefined)}><X size={15} /></button>
          </div>
        </header>
        <div className={`logic-property-protection ${isCanonEditor ? "canon" : "local"}`}><LockKeyhole size={13} />{isCanonEditor ? "Canon property — only capabilities can be overridden" : "Local property"}</div>
        <div className="logic-property-capabilities">
          <div className="logic-property-editor-subheading"><strong>PathBranching capabilities</strong><span>Configure behavior</span></div>
          {renderCapabilityCard(
            <ShieldCheck size={16} />,
            "Available in conditions",
            "Can be used in conditions and logic checks",
            editingCapability?.conditionReadable ?? true,
            (checked) => updateCapability({ conditionReadable: checked }),
          )}
          {renderCapabilityCard(
            <Pencil size={16} />,
            "Writable in actions",
            "Can be modified by story actions",
            editingCapability?.actionWritable ?? propertyEditor.source === "local",
            (checked) => updateCapability({ actionWritable: checked }),
          )}
          {renderCapabilityCard(
            <Package size={16} />,
            "Grantable",
            "Can be granted or unlocked during gameplay",
            editingCapability?.grantable ?? false,
            (checked) => updateCapability({ grantable: checked }),
          )}
          {renderCapabilityCard(
            <UserRound size={16} />,
            "Present as entity",
            "Values can appear as characters/items in events",
            editingCapability?.entityPresentable ?? false,
            (checked) => updateCapability({ 
              entityPresentable: checked, 
              dialogueTrigger: checked ? editingCapability?.dialogueTrigger : false 
            }),
          )}
          {editingCapability?.entityPresentable ? renderCapabilityCard(
            <MessageSquare size={16} />,
            "Dialogue trigger source",
            "Can start dialogue based on property value",
            editingCapability.dialogueTrigger ?? false,
            (checked) => updateCapability({ dialogueTrigger: checked }),
            true,
          ) : null}
          <label className="field-label">Can relate to<input value={(editingCapability?.relationTargetTypes ?? []).join(", ")} placeholder="character, worldbuilding" onChange={(event) => updateCapability({ relationTargetTypes: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
        </div>
        <details className="logic-property-technical-info">
          <summary><Info size={12} /> Schema fields</summary>
          <div className="logic-property-technical-content">
            <label className="field-label">Name<input value={editingProperty.label} disabled={isCanonEditor} onChange={(event) => updateLocal({ label: event.target.value })} /></label>
            <label className="field-label">Value type<select value={editingProperty.valueType} disabled={isCanonEditor} onChange={(event) => updateLocal({ valueType: event.target.value })}>{!propertyTypes.some(([value]) => value === editingProperty.valueType) ? <option value={editingProperty.valueType}>{editingProperty.valueType}</option> : null}{propertyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="field-label">Applies to types<input value={(editingProperty.appliesToTypes ?? []).join(", ")} disabled={isCanonEditor} placeholder="All types" onChange={(event) => updateLocal({ appliesToTypes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
            <label className="field-label">Description<textarea rows={3} value={editingProperty.description ?? ""} disabled={isCanonEditor} onChange={(event) => updateLocal({ description: event.target.value })} /></label>
            <label className="logic-property-checkbox"><input type="checkbox" checked={editingProperty.required ?? false} disabled={isCanonEditor} onChange={(event) => updateLocal({ required: event.target.checked })} /> Required</label>
            {renderEditorOptions()}
          </div>
        </details>
        <details className="logic-property-technical-info">
          <summary><Info size={12} /> Technical information</summary>
          <div className="logic-property-technical-content">
            <div className="logic-property-technical-field">
              <label>Property ID</label>
              <code>{editingProperty.id}</code>
            </div>
            {"path" in editingProperty && editingProperty.path && editingProperty.path.length > 0 ? (
              <div className="logic-property-technical-field">
                <label>YAML path</label>
                <code>{(editingProperty as any).path.join(".")}</code>
              </div>
            ) : null}
          </div>
        </details>
      </div> : null}
    </> : <>
      <div className="panel-toolbar"><strong>Variables</strong><button type="button" onClick={addGroup}><Plus size={14} /> Group</button></div>
      <div className="logic-groups">{groups.map((group, index) => <section className="logic-group" key={group.id}>
        <header><input aria-label="Group name" value={group.name} onChange={(event) => updateGroups(groups.map((item) => item.id === group.id ? { ...item, name: event.target.value } : item))} /><button type="button" disabled={index === 0} onClick={() => updateGroups(groups.map((item, position) => position === index ? { ...item, order: index - 1 } : position === index - 1 ? { ...item, order: index } : item))}><ChevronUp size={13} /></button><button type="button" disabled={index === groups.length - 1} onClick={() => updateGroups(groups.map((item, position) => position === index ? { ...item, order: index + 1 } : position === index + 1 ? { ...item, order: index } : item))}><ChevronDown size={13} /></button><button type="button" disabled={group.id === "ungrouped"} onClick={() => updateGroups(groups.filter((item) => item.id !== group.id))}><Trash2 size={13} /></button></header>
        {(project.logicVariables ?? []).filter((variable) => variable.groupId === group.id).map((variable) => <div className="logic-variable" key={variable.id}><input aria-label="Variable name" value={variable.name} onChange={(event) => updateVariable(variable.id, { name: event.target.value })} /><select value={variable.type} onChange={(event) => updateVariable(variable.id, { type: event.target.value as LogicVariableType, value: event.target.value === "boolean" ? false : event.target.value === "number" ? 0 : event.target.value === "list" ? [] : "" })}>{variableTypes.map((type) => <option key={type}>{type}</option>)}</select><input aria-label="Variable value" value={variableValue(variable)} onChange={(event) => updateVariable(variable.id, { value: variable.type === "number" ? Number(event.target.value) || 0 : variable.type === "list" ? event.target.value.split(",").map((item) => item.trim()).filter(Boolean) : event.target.value })} /><button type="button" onClick={() => updateVariables((project.logicVariables ?? []).filter((item) => item.id !== variable.id))}><Trash2 size={13} /></button></div>)}
        <button type="button" className="logic-add-variable" onClick={() => addVariable(group.id)}><Plus size={13} /> Variable</button>
      </section>)}</div>
    </>}
    {isCreateModalOpen ? (
      <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <header className="modal-header">
            <h3>Create New Property</h3>
            <button type="button" className="icon-only" onClick={() => setIsCreateModalOpen(false)}><X size={16} /></button>
          </header>
          <div className="modal-body">
            <label>
              <span>Label</span>
              <input
                type="text"
                value={newPropertyLabel}
                onChange={(e) => setNewPropertyLabel(e.target.value)}
                placeholder="Property label"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateProperty();
                  if (e.key === "Escape") setIsCreateModalOpen(false);
                }}
              />
            </label>
            <label>
              <span>Type</span>
              <select value={newPropertyType} onChange={(event) => setNewPropertyType(event.target.value as LocalExplorerProperty["valueType"])}>
                {propertyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <footer className="modal-footer">
            <button type="button" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
            <button type="button" className="primary" onClick={handleCreateProperty} disabled={!newPropertyLabel.trim()}>Create</button>
          </footer>
        </div>
      </div>
    ) : null}
  </WorkspaceSidePanel>;
}
