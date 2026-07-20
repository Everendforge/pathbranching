import { ChevronDown, Search, UserRound, Package, GitBranch } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { UNKNOWN_SPEAKER_REF, speakerLabel } from "../speakerRoles.js";

type SpeakerOption = {
  id: string;
  label: string;
  portraitUrl?: string;
  kind?: string;
  variants: Array<{ id: string; label: string; portraitUrl?: string }>;
};

function entityGroup(kind: string | undefined) {
  const normalized = (kind ?? "").toLowerCase();
  if (normalized.includes("character") || normalized.includes("speaker")) return "Characters";
  if (normalized.includes("item") || normalized.includes("inventory")) return "Items";
  return "Other entities";
}

export function SpeakerSelector({
  value,
  options,
  presentEntityIds,
  onChange,
  onVariantChange,
  onClose,
  onCanvasInteraction,
}: {
  value?: string;
  options: SpeakerOption[];
  presentEntityIds: string[];
  onChange: (speakerId?: string) => void;
  onVariantChange?: (variantId: string) => void;
  onClose: () => void;
  onCanvasInteraction: (event: React.PointerEvent | React.MouseEvent | React.KeyboardEvent) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedSpeaker = options.find((s) => s.id === value);
  const selectedVariant = selectedSpeaker?.variants.find((v) => v.id === "base");

  const presentSet = useMemo(() => new Set(presentEntityIds), [presentEntityIds]);

  // Flat list of speakers to show below the Narrator/Unknown options.
  // - No search: only entities present in the parent event (continuation of the list).
  // - Searching: all entities (selecting one adds it to the parent event automatically).
  const visibleSpeakers = useMemo(() => {
    const normalized = searchTerm.toLowerCase();
    const base = searchTerm
      ? options.filter(
          (speaker) =>
            speaker.label.toLowerCase().includes(normalized) ||
            speaker.kind?.toLowerCase().includes(normalized),
        )
      : options.filter((speaker) => presentSet.has(speaker.id));

    const rank = (kind: string | undefined) => {
      const group = entityGroup(kind);
      return group === "Characters" ? 0 : group === "Items" ? 1 : 2;
    };

    return [...base].sort((a, b) => {
      if (rank(a.kind) !== rank(b.kind)) return rank(a.kind) - rank(b.kind);
      return a.label.localeCompare(b.label);
    });
  }, [options, searchTerm, presentSet]);

  const totalResults = visibleSpeakers.length;

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [searchOpen, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!searchOpen) return;
    const handleClickOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        onClose();
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [searchOpen, onClose]);

  const handleSelectSpeaker = (speakerId?: string) => {
    onChange(speakerId);
    setSearchOpen(false);
    setSearchTerm("");
    onClose();
  };

  return (
    <div className="speaker-selector-container nodrag nopan" ref={menuRef}>
      {/* Main trigger button */}
      <button
        type="button"
        className="speech-beat-menu-trigger speech-beat-speaker"
        aria-label="Character"
        aria-haspopup="dialog"
        aria-expanded={searchOpen}
        onPointerDown={onCanvasInteraction}
        onClick={(event) => {
          onCanvasInteraction(event);
          setSearchOpen(!searchOpen);
        }}
      >
        <span>{speakerLabel(value, selectedSpeaker?.label)}</span>
        <span className="speech-beat-menu-chevron" aria-hidden="true">⌄</span>
      </button>

      {/* Search menu */}
      {searchOpen ? (
        <div className="speaker-selector-menu" role="dialog" aria-label="Select a speaker">
          {/* Search input */}
          <div className="speaker-selector-search-container">
            <Search size={16} className="speaker-selector-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="speaker-selector-search-input"
              placeholder="Search speaker…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onPointerDown={onCanvasInteraction}
              onKeyDown={(e) => {
                onCanvasInteraction(e);
                if (e.key === "Escape") {
                  setSearchOpen(false);
                  onClose();
                }
                if (e.key === "Enter" && totalResults === 1) {
                  const speaker = visibleSpeakers[0];
                  if (speaker) {
                    handleSelectSpeaker(speaker.id);
                  }
                }
              }}
            />
          </div>

          {/* Special options */}
          <button
            key="narrator"
            type="button"
            role="option"
            className="speaker-selector-option"
            aria-selected={!value}
            onClick={(event) => {
              onCanvasInteraction(event);
              handleSelectSpeaker(undefined);
            }}
          >
            <span className="speaker-selector-icon"><UserRound size={14} /></span>
            <span className="speaker-selector-label">Narrator</span>
          </button>

          <button
            key="unknown"
            type="button"
            role="option"
            className="speaker-selector-option"
            aria-selected={value === UNKNOWN_SPEAKER_REF}
            onClick={(event) => {
              onCanvasInteraction(event);
              handleSelectSpeaker(UNKNOWN_SPEAKER_REF);
            }}
          >
            <span className="speaker-selector-icon">❓</span>
            <span className="speaker-selector-label">Unknown speaker</span>
          </button>

          {/* Present entities (continuation) / all entities when searching */}
          {visibleSpeakers.length > 0 ? (
            visibleSpeakers.map((speaker) => {
              const group = entityGroup(speaker.kind);
              return (
                <button
                  key={speaker.id}
                  type="button"
                  role="option"
                  className="speaker-selector-option"
                  aria-selected={speaker.id === value}
                  onClick={(event) => {
                    onCanvasInteraction(event);
                    handleSelectSpeaker(speaker.id);
                  }}
                >
                  {speaker.portraitUrl ? (
                    <img
                      className="speaker-selector-portrait"
                      src={speaker.portraitUrl}
                      alt=""
                    />
                  ) : (
                    <span className="speaker-selector-icon">
                      {group === "Characters" ? (
                        <UserRound size={14} />
                      ) : group === "Items" ? (
                        <Package size={14} />
                      ) : (
                        <GitBranch size={14} />
                      )}
                    </span>
                  )}
                  <div className="speaker-selector-info">
                    <span className="speaker-selector-label">{speaker.label}</span>
                    {speaker.kind ? (
                      <span className="speaker-selector-kind">{speaker.kind}</span>
                    ) : null}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="speaker-selector-empty">
              <p>
                {searchTerm
                  ? `No speakers match "${searchTerm}"`
                  : "No entities present in this event yet. Search to add one."}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
