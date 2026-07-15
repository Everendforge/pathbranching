import { Handle, NodeToolbar, Position, type NodeProps, type NodeTypes } from "@xyflow/react";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { BookOpen, CircleHelp, ImagePlus, Trash2, UserRound } from "lucide-react";
import type { StoryCanvasNode, StoryCanvasNodeData } from "../canvas/storyCanvasModel.js";
import type { SceneImageAttachment } from "../domain.js";
import type { LocaleNames } from "../localization.js";
import { UNKNOWN_SPEAKER_REF, speakerLabel } from "../speakerRoles.js";

function badgeText(value: string) {
  return value.length > 22 ? `${value.slice(0, 19)}...` : value;
}

type DecisionOption = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  handleId: string;
};

function isDecisionOption(value: unknown): value is DecisionOption {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as DecisionOption).id === "string" &&
      typeof (value as DecisionOption).handleId === "string",
  );
}

type BeatQuickEditor = {
  values: Record<string, string>;
  directorNote?: string;
  sceneImage?: SceneImageAttachment & { name: string; url?: string };
  imageAssets?: Array<{ id: string; name: string }>;
  directorNoteOpen?: boolean;
  sceneImageOpen?: boolean;
  primaryLocale: string;
  activeLocale?: string;
  languages: string[];
  localeNames?: LocaleNames;
  characterRef?: string;
  characterVariantId?: string;
  textCounter?: { count: number; unit: "words" | "characters"; target: number };
  speakerOptions: Array<{
    id: string;
    label: string;
    portraitUrl?: string;
    variants: Array<{ id: string; label: string; portraitUrl?: string }>;
  }>;
  onTextUpdate: (locale: string, value: string) => void;
  onDirectorNoteUpdate?: (value: string) => void;
  onSceneImageUpdate?: (assetId?: string) => void;
  onImportSceneImage?: () => void;
  onAuxiliaryPanelChange?: (panel: "directorNote" | "sceneImage", open: boolean) => void;
  onCharacterUpdate: (characterRef?: string) => void;
  onCharacterVariantUpdate?: (variantId: string) => void;
};

function isBeatQuickEditor(value: unknown): value is BeatQuickEditor {
  return Boolean(
    value && typeof value === "object" &&
    typeof (value as BeatQuickEditor).primaryLocale === "string" &&
    Array.isArray((value as BeatQuickEditor).languages) &&
    Array.isArray((value as BeatQuickEditor).speakerOptions) &&
    typeof (value as BeatQuickEditor).onTextUpdate === "function",
  );
}

type BoundaryRouteEditor = {
  selectedTargetId?: string;
  targets: Array<{ id: string; label: string }>;
  onTargetChange: (eventId: string) => void;
  onCreateTarget: () => void;
  onDeleteEnd?: () => void;
};

function isBoundaryRouteEditor(value: unknown): value is BoundaryRouteEditor {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as BoundaryRouteEditor).targets) &&
      typeof (value as BoundaryRouteEditor).onTargetChange === "function" &&
      typeof (value as BoundaryRouteEditor).onCreateTarget === "function",
  );
}

type WorkspaceEditor = {
  bounds: { x: number; y: number; width: number; height: number };
  onPreview: (bounds: { x: number; y: number; width: number; height: number }) => void;
  onCommit: (bounds: { x: number; y: number; width: number; height: number }) => void;
};

type WorkspaceResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const WORKSPACE_RESIZE_DIRECTIONS: WorkspaceResizeDirection[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];

function isWorkspaceEditor(value: unknown): value is WorkspaceEditor {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as WorkspaceEditor).bounds === "object" &&
      typeof (value as WorkspaceEditor).onPreview === "function" &&
      typeof (value as WorkspaceEditor).onCommit === "function",
  );
}

type EndAdder = {
  onAdd: () => void;
};

function isEndAdder(value: unknown): value is EndAdder {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as EndAdder).onAdd === "function",
  );
}

function stopCanvasInteraction(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function StoryNode({ id, data, selected }: NodeProps<StoryCanvasNode>) {
  const nodeData = data as StoryCanvasNodeData;
  const [openBeatMenu, setOpenBeatMenu] = useState(false);
  const quickEditor = isBeatQuickEditor(nodeData.details?.quickEditor)
    ? nodeData.details.quickEditor
    : undefined;
  const draftLocale = quickEditor?.activeLocale ?? quickEditor?.primaryLocale ?? "und";
  const draftExternalText = quickEditor?.values[draftLocale] ?? "";
  const directorNote = quickEditor?.directorNote ?? "";
  const sceneImage = quickEditor?.sceneImage;
  const imageAssets = quickEditor?.imageAssets ?? [];
  const directorNoteOpen = quickEditor?.directorNoteOpen ?? false;
  const sceneImagesOpen = quickEditor?.sceneImageOpen ?? false;
  const setAuxiliaryPanelOpen = (panel: "directorNote" | "sceneImage", open: boolean) =>
    quickEditor?.onAuxiliaryPanelChange?.(panel, open);
  const beatContentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = beatContentRef.current;
    if (!element || document.activeElement === element || element.textContent === draftExternalText) return;
    element.textContent = draftExternalText;
  }, [draftExternalText, draftLocale]);
  const isEvent = nodeData.kind === "event";
  const isFinalEvent = nodeData.kind === "event" && nodeData.badges.includes("terminal");
  const boundaryDirection =
    nodeData.kind === "boundary" && nodeData.details?.direction === "input"
      ? "input"
      : nodeData.kind === "boundary" && nodeData.details?.direction === "output"
        ? "output"
        : undefined;
  const focusClass = typeof nodeData.focusState === "string" ? ` focus-${nodeData.focusState}` : "";
  const inspectorFocusClass =
    typeof nodeData.inspectorState === "string"
      ? ` inspector-${nodeData.inspectorState}`
      : "";
  const sequenceEntryClass =
    nodeData.details?.sequenceEntry || nodeData.details?.sequenceEntryEventId
      ? " sequence-entry-puzzle"
      : "";
  const canReceive = boundaryDirection
    ? boundaryDirection === "output"
    : nodeData.kind !== "start" && nodeData.kind !== "sequence" && nodeData.kind !== "missingRef" && nodeData.kind !== "dialogueStart";
  const canSource = boundaryDirection
    ? boundaryDirection === "input"
    : nodeData.kind !== "missingRef" && (nodeData.kind === "start" || (nodeData.kind !== "sequence" && !isFinalEvent));
  const summaryBadges = Array.isArray(nodeData.summaryBadges)
    ? nodeData.summaryBadges.filter((badge): badge is string => typeof badge === "string" && badge.length > 0)
    : [];
  const detailBadges = nodeData.badges.filter((badge) => !/^\d+ decisions?$/.test(badge));
  const colorStyle = {
    "--node-accent": typeof nodeData.accentColor === "string" ? nodeData.accentColor : undefined,
    "--node-branch": typeof nodeData.branchColor === "string" ? nodeData.branchColor : undefined,
    "--node-type": typeof nodeData.details?.typeColor === "string" ? nodeData.details.typeColor : undefined,
  } as CSSProperties;

  if (nodeData.isContainer) {
    return (
      <div className={`story-node branch-container${focusClass}${inspectorFocusClass} ${selected ? "selected" : ""}`} style={colorStyle}>
        {canReceive ? <Handle type="target" position={Position.Left} /> : null}
        <div className="node-title">{nodeData.title}</div>
        {nodeData.subtitle ? <div className="node-subtitle">{nodeData.subtitle}</div> : null}
        {nodeData.badges.length > 0 ? (
          <div className="node-badges">
            {nodeData.badges.slice(0, 5).map((badge) => (
              <span key={badge}>{badgeText(badge)}</span>
            ))}
          </div>
        ) : null}
        {canSource ? <Handle type="source" position={Position.Right} /> : null}
      </div>
    );
  }

  if (nodeData.kind === "start") {
    return (
      <div className={`story-node start${sequenceEntryClass}${focusClass}${inspectorFocusClass}${selected ? " selected" : ""}`} style={colorStyle}>
        <span className="node-start-icon" aria-hidden="true" />
        <div className="node-start-title">{nodeData.title}</div>
        {canSource ? <Handle type="source" position={Position.Right} /> : null}
      </div>
    );
  }

  if (nodeData.kind === "workspace") {
    const workspaceEditor = isWorkspaceEditor(nodeData.details?.workspaceEditor)
      ? nodeData.details.workspaceEditor
      : undefined;
    const startResize = (
      direction: WorkspaceResizeDirection,
      event: PointerEvent<HTMLButtonElement>,
    ) => {
      if (!workspaceEditor) return;
      event.preventDefault();
      stopCanvasInteraction(event);
      const origin = workspaceEditor.bounds;
      const startX = event.clientX;
      const startY = event.clientY;
      let latest = origin;
      const resize = (moveEvent: globalThis.PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        let x = origin.x;
        let y = origin.y;
        let width = origin.width;
        let height = origin.height;
        if (direction.includes("w")) {
          x = Math.min(origin.x + deltaX, origin.x + origin.width - 720);
          width = origin.width + origin.x - x;
        } else if (direction.includes("e")) {
          width = Math.max(720, origin.width + deltaX);
        }
        if (direction.includes("n")) {
          y = Math.min(origin.y + deltaY, origin.y + origin.height - 460);
          height = origin.height + origin.y - y;
        } else if (direction.includes("s")) {
          height = Math.max(460, origin.height + deltaY);
        }
        latest = { x, y, width, height };
        workspaceEditor.onPreview(latest);
      };
      const finish = () => {
        workspaceEditor.onCommit(latest);
        window.removeEventListener("pointermove", resize);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      };
      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", finish, { once: true });
      window.addEventListener("pointercancel", finish, { once: true });
    };
    return (
      <div className="story-node workspace-node" style={colorStyle}>
        {workspaceEditor ? (
          WORKSPACE_RESIZE_DIRECTIONS.map((direction) => (
            <button
              key={direction}
              type="button"
              className={`workspace-resize-handle workspace-resize-${direction} nodrag nopan`}
              aria-label={`Resize working area ${direction}`}
              onPointerDown={(event) => startResize(direction, event)}
            />
          ))
        ) : null}
      </div>
    );
  }

  if (nodeData.kind === "endAdder") {
    const endAdder = isEndAdder(nodeData.details?.endAdder)
      ? nodeData.details.endAdder
      : undefined;
    return (
      <div className="story-node end-adder">
        <button
          type="button"
          className="nodrag nopan"
          aria-label="Add End"
          title="Add End"
          onPointerDown={stopCanvasInteraction}
          onClick={(event) => {
            stopCanvasInteraction(event);
            endAdder?.onAdd();
          }}
        >
          +
        </button>
      </div>
    );
  }

  if (boundaryDirection) {
    const routeEditor = isBoundaryRouteEditor(nodeData.details?.routeEditor)
      ? nodeData.details.routeEditor
      : undefined;
    return (
      <div
        className={`story-node boundary boundary-${boundaryDirection}${focusClass}${inspectorFocusClass}${selected ? " selected" : ""}`}
        style={colorStyle}
      >
        {canReceive ? <Handle type="target" position={Position.Left} /> : null}
        <span className="node-boundary-icon" aria-hidden="true" />
        <div className="node-boundary-copy">
          <div className="node-title">{nodeData.title}</div>
          {nodeData.subtitle ? <div className="node-subtitle">{nodeData.subtitle}</div> : null}
        </div>
        {boundaryDirection === "output" && routeEditor ? (
          <NodeToolbar nodeId={id} isVisible={selected} position={Position.Bottom} offset={14}>
            <div className="canvas-node-toolbar node-boundary-actions nodrag nopan">
              <select
                aria-label="Route destination"
                value={routeEditor.selectedTargetId ?? ""}
                onPointerDown={stopCanvasInteraction}
                onMouseDown={stopCanvasInteraction}
                onChange={(event) => {
                  stopCanvasInteraction(event);
                  if (event.target.value) routeEditor.onTargetChange(event.target.value);
                }}
              >
                <option value="">Choose existing event…</option>
                {routeEditor.targets.map((target) => (
                  <option key={target.id} value={target.id}>{target.label}</option>
                ))}
              </select>
              <button
                type="button"
                onPointerDown={stopCanvasInteraction}
                onMouseDown={stopCanvasInteraction}
                onClick={(event) => {
                  stopCanvasInteraction(event);
                  routeEditor.onCreateTarget();
                }}
              >
                New event
              </button>
              {routeEditor.onDeleteEnd ? (
                <button
                  type="button"
                  className="boundary-delete-end"
                  aria-label="Delete End"
                  title="Delete End"
                  onPointerDown={stopCanvasInteraction}
                  onMouseDown={stopCanvasInteraction}
                  onClick={(event) => {
                    stopCanvasInteraction(event);
                    routeEditor.onDeleteEnd?.();
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          </NodeToolbar>
        ) : null}
        {canSource ? <Handle type="source" position={Position.Right} /> : null}
      </div>
    );
  }

  if (nodeData.kind === "decision") {
    const decision = nodeData.details?.decision as { optionStyle?: string } | undefined;
    const optionStyle = decision?.optionStyle ?? "visibleText";
    const options = Array.isArray(nodeData.details?.options)
      ? nodeData.details.options.filter(isDecisionOption)
      : [];
    const styleLabel =
      optionStyle === "followUpText"
        ? "next text"
        : optionStyle === "iconOnly"
          ? "icon only"
          : "visible text";

    return (
      <div
        className={`story-node decision decision-container${focusClass}${inspectorFocusClass}${selected ? " selected" : ""}`}
        style={colorStyle}
      >
        <Handle type="target" position={Position.Left} />
        <div className="decision-header">
          <div>
            <div className="node-title">{nodeData.title}</div>
          </div>
          <span className="decision-style">{styleLabel}</span>
        </div>
        {nodeData.subtitle ? <div className="node-subtitle">{nodeData.subtitle}</div> : null}
        <div className="decision-options">
          {options.map((option, index) => {
            const label =
              optionStyle === "followUpText"
                ? option.description || option.name
                : optionStyle === "iconOnly"
                  ? option.icon || "◇"
                  : option.name;
            return (
              <div className="decision-option" key={option.id}>
                <span className="decision-option-key">{String.fromCharCode(65 + index)}</span>
                <span className={`decision-option-label ${optionStyle === "iconOnly" ? "icon" : ""}`}>{label}</span>
                <Handle id={option.handleId} type="source" position={Position.Right} />
              </div>
            );
          })}
          {options.length === 0 ? <span className="decision-empty">Add an outcome to create an option.</span> : null}
        </div>
      </div>
    );
  }

  if (nodeData.kind === "speechBeat" || nodeData.kind === "directionBeat") {
    const block = nodeData.details?.block as {
      content?: string;
      translations?: Record<string, string>;
      speakerRef?: string;
    } | undefined;
    const primaryLocale = quickEditor?.primaryLocale ?? "und";
    const selectedLocale = quickEditor?.activeLocale ?? primaryLocale;
    const speakerRef = quickEditor?.characterRef ?? block?.speakerRef;
    const speakerOptions = quickEditor?.speakerOptions ?? [];
    const selectedSpeaker = speakerOptions.find((speaker) => speaker.id === speakerRef);
    const selectedVariantId = selectedSpeaker?.variants.some(
      (variant) => variant.id === quickEditor?.characterVariantId,
    )
      ? quickEditor?.characterVariantId
      : "base";
    const selectedVariant = selectedSpeaker?.variants.find(
      (variant) => variant.id === selectedVariantId,
    );
    const speakerPortraitUrl = selectedVariant?.portraitUrl ?? selectedSpeaker?.portraitUrl;
    const speakerDisplayName = speakerLabel(speakerRef, selectedSpeaker?.label);
    const isSpeech = nodeData.kind === "speechBeat";
    const textCounter = isSpeech ? quickEditor?.textCounter : undefined;
    const portraitFallback = !speakerRef
      ? <BookOpen size={25} aria-hidden="true" />
      : speakerRef === UNKNOWN_SPEAKER_REF
        ? <CircleHelp size={25} aria-hidden="true" />
        : <UserRound size={25} aria-hidden="true" />;
    return (
      <div
        className={`story-node speech-beat-node inline-editor${focusClass}${inspectorFocusClass}${selected ? " selected" : ""}`}
        style={colorStyle}
      >
        {canReceive ? <Handle type="target" position={Position.Left} /> : null}
        {isSpeech && quickEditor?.onDirectorNoteUpdate ? (
          <div className={`speech-beat-director-tools nodrag nopan${directorNoteOpen ? " open" : ""}`}>
            <span className="speech-beat-director-pocket" aria-hidden="true" />
            <button
              type="button"
              className={`speech-beat-director-toggle${directorNote.trim() ? " has-note" : ""}`}
              aria-label={directorNote.trim() ? "Edit director note" : "Add director note"}
              aria-expanded={directorNoteOpen}
              title={directorNote.trim() ? "Edit director note" : "Add director note"}
              onPointerDown={stopCanvasInteraction}
              onClick={(event) => {
                stopCanvasInteraction(event);
                setAuxiliaryPanelOpen("directorNote", !directorNoteOpen);
              }}
            >
              {directorNote.trim() ? "✎" : "+"}
            </button>
            {directorNoteOpen ? (
              <div className="speech-beat-director-panel">
                <div className="speech-beat-director-panel-header">
                  <label htmlFor={`${id}-director-note`}>Director note</label>
                  <button
                    type="button"
                    className="speech-beat-director-minimize"
                    aria-label="Minimize director note"
                    title="Minimize director note"
                    onPointerDown={stopCanvasInteraction}
                    onClick={(event) => {
                      stopCanvasInteraction(event);
                      setAuxiliaryPanelOpen("directorNote", false);
                    }}
                  >
                    −
                  </button>
                </div>
                <textarea
                  id={`${id}-director-note`}
                  className="nodrag nopan"
                  rows={3}
                  value={directorNote}
                  placeholder="Add a note for direction, mood, timing…"
                  onPointerDown={stopCanvasInteraction}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape") setAuxiliaryPanelOpen("directorNote", false);
                  }}
                  onChange={(event) => quickEditor.onDirectorNoteUpdate?.(event.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className={`speech-beat-inline${isSpeech ? "" : " direction"}`}>
          {isSpeech ? <div className="speech-beat-character">
            <div className="speech-beat-drag-surface" title="Drag to move">
              {speakerPortraitUrl ? <img className="speech-beat-avatar" src={speakerPortraitUrl} alt="" /> : <span className="speech-beat-avatar-fallback">{portraitFallback}</span>}
            </div>
            <div className="speech-beat-menu-anchor nodrag nopan" onPointerDown={stopCanvasInteraction}>
              <button
                type="button"
                className="speech-beat-menu-trigger speech-beat-speaker"
                aria-label="Character"
                aria-haspopup="listbox"
                aria-expanded={openBeatMenu}
                onClick={(event) => {
                  stopCanvasInteraction(event);
                  setOpenBeatMenu((open) => !open);
                }}
              >
                <span>{speakerDisplayName}</span>
                <span className="speech-beat-menu-chevron" aria-hidden="true">⌄</span>
              </button>
              {openBeatMenu ? <div className="speech-beat-menu" role="listbox" aria-label="Character">
                <button type="button" role="option" aria-selected={!speakerRef} onClick={(event) => {
                  stopCanvasInteraction(event);
                  quickEditor?.onCharacterUpdate(undefined);
                  setOpenBeatMenu(false);
                }}>Narrator</button>
                <button type="button" role="option" aria-selected={speakerRef === UNKNOWN_SPEAKER_REF} onClick={(event) => {
                  stopCanvasInteraction(event);
                  quickEditor?.onCharacterUpdate(UNKNOWN_SPEAKER_REF);
                  setOpenBeatMenu(false);
                }}>???</button>
                {speakerOptions.map((speaker) => <button key={speaker.id} type="button" role="option" aria-selected={speaker.id === speakerRef} onClick={(event) => {
                  stopCanvasInteraction(event);
                  quickEditor?.onCharacterUpdate(speaker.id);
                  setOpenBeatMenu(false);
                }}>
                  {speaker.portraitUrl ? <img className="speech-beat-menu-portrait" src={speaker.portraitUrl} alt="" /> : null}
                  <span>{speaker.label}</span>
                </button>)}
              </div> : null}
            </div>
            {selectedSpeaker && selectedSpeaker.variants.length > 1 ? (
              <label className="speech-beat-variant nodrag nopan">
                <span>Variant</span>
                <select
                  value={selectedVariantId}
                  onPointerDown={stopCanvasInteraction}
                  onChange={(event) => quickEditor?.onCharacterVariantUpdate?.(event.target.value)}
                >
                  {selectedSpeaker.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div> : null}
          <div
            className={`speech-beat-dialogue nodrag nopan${textCounter ? " has-counter" : ""}`}
            onPointerDown={stopCanvasInteraction}
            onClick={stopCanvasInteraction}
            onDoubleClick={stopCanvasInteraction}
          >
            <div
              ref={beatContentRef}
              className="speech-beat-content"
              role="textbox"
              aria-label={isSpeech ? "Dialogue text" : "Stage direction text"}
              aria-multiline="true"
              contentEditable
              suppressContentEditableWarning
              data-placeholder={isSpeech ? "Write dialogue…" : "Write stage direction…"}
              onFocus={() => setOpenBeatMenu(false)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape") {
                  event.currentTarget.blur();
                  setOpenBeatMenu(false);
                }
              }}
              onInput={(event) => {
                stopCanvasInteraction(event);
                const nextText = event.currentTarget.textContent ?? "";
                quickEditor?.onTextUpdate(selectedLocale, nextText);
              }}
            />
            {textCounter ? (
              <output className={`speech-beat-text-counter${textCounter.count > textCounter.target ? " over" : ""}`}>
                {textCounter.count} / {textCounter.target} {textCounter.unit === "words" ? "words" : "characters"}
              </output>
            ) : null}
          </div>
        </div>
        {isSpeech && quickEditor?.onImportSceneImage ? (
          <div className={`speech-beat-scene-image-tools nodrag nopan${sceneImagesOpen ? " open" : ""}`}>
            <span className="speech-beat-scene-image-pocket" aria-hidden="true" />
            <button
              type="button"
              className={`speech-beat-scene-image-toggle${sceneImage ? " has-images" : ""}`}
              aria-label={sceneImage ? "Edit scene image" : "Add scene image"}
              aria-expanded={sceneImagesOpen}
              title={sceneImage ? "Edit scene image" : "Add scene image"}
              onPointerDown={stopCanvasInteraction}
              onClick={(event) => {
                stopCanvasInteraction(event);
                setAuxiliaryPanelOpen("sceneImage", !sceneImagesOpen);
              }}
            >
              <ImagePlus size={14} aria-hidden="true" />
            </button>
            <div className="speech-beat-scene-image-panel">
              <div className="speech-beat-scene-image-panel-header">
                <span>Scene image</span>
                <div>
                  <button
                    type="button"
                    className="speech-beat-scene-image-import"
                    onPointerDown={stopCanvasInteraction}
                    onClick={(event) => {
                      stopCanvasInteraction(event);
                      quickEditor.onImportSceneImage?.();
                    }}
                  ><ImagePlus size={13} /> Upload image</button>
                  <button
                    type="button"
                    className="speech-beat-director-minimize"
                    aria-label="Minimize scene images"
                    title="Minimize scene images"
                    onPointerDown={stopCanvasInteraction}
                    onClick={(event) => {
                      stopCanvasInteraction(event);
                      setAuxiliaryPanelOpen("sceneImage", false);
                    }}
                  >−</button>
                </div>
              </div>
              <label className="speech-beat-scene-image-select">
                <span>Use an existing image</span>
                <select
                  value={sceneImage?.assetId ?? ""}
                  onPointerDown={stopCanvasInteraction}
                  onChange={(event) => quickEditor.onSceneImageUpdate?.(event.target.value || undefined)}
                >
                  <option value="">Choose an image…</option>
                  {imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
              </label>
              {sceneImage ? (
                <article className="speech-beat-scene-image-item">
                  {sceneImage.url ? <img src={sceneImage.url} alt={sceneImage.name} /> : <span className="speech-beat-scene-image-placeholder"><ImagePlus size={18} /></span>}
                  <span title={sceneImage.name}>{sceneImage.name}</span>
                  <div className="speech-beat-scene-image-actions">
                    <button
                      type="button"
                      className="danger"
                      aria-label={`Remove ${sceneImage.name}`}
                      onPointerDown={stopCanvasInteraction}
                      onClick={(event) => {
                        stopCanvasInteraction(event);
                        quickEditor.onSceneImageUpdate?.();
                      }}
                    ><Trash2 size={13} /></button>
                  </div>
                </article>
              ) : <button
                type="button"
                className="speech-beat-scene-image-empty"
                onPointerDown={stopCanvasInteraction}
                onClick={(event) => {
                  stopCanvasInteraction(event);
                  quickEditor.onImportSceneImage?.();
                }}
              ><ImagePlus size={16} /> Upload a PNG or JPEG image</button>}
            </div>
          </div>
        ) : null}
        {canSource ? <Handle type="source" position={Position.Right} /> : null}
      </div>
    );
  }

  return (
    <div
      className={`story-node ${nodeData.kind}${sequenceEntryClass}${focusClass}${inspectorFocusClass}${isFinalEvent ? " terminal" : ""}${selected ? " selected" : ""}`}
      style={colorStyle}
    >
      {canReceive ? <Handle type="target" position={Position.Left} /> : null}
      <div className="node-title">{nodeData.title}</div>
      {summaryBadges.length > 0 ? (
        <div className="node-summary-badges">
          {summaryBadges.slice(0, 3).map((badge) => (
            <span key={badge}>{badgeText(badge)}</span>
          ))}
        </div>
      ) : null}
      {nodeData.subtitle ? <div className="node-subtitle">{nodeData.subtitle}</div> : null}
      {detailBadges.length > 0 ? (
        <div className="node-badges">
          {detailBadges.slice(0, 4).map((badge) => (
            <span key={badge}>{badgeText(badge)}</span>
          ))}
        </div>
      ) : null}
      {canSource ? <Handle type="source" position={boundaryDirection === "input" ? Position.Right : Position.Right} /> : null}
    </div>
  );
}

export const nodeTypes = {
  story: StoryNode,
} satisfies NodeTypes;
