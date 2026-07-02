import { Save } from "lucide-react";
import { MARKDOWN_FORMAT_LABELS } from "../canonWorkingCopy.js";
import type { MarkdownDraftFormat, MarkdownEditorTab } from "../appTypes.js";

export function MarkdownEditorDock({
  tabs,
  activeTabId,
  onActivate,
  onClose,
  onChangeContent,
  onChangeFormat,
  onSave,
}: {
  tabs: MarkdownEditorTab[];
  activeTabId?: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onChangeContent: (id: string, content: string) => void;
  onChangeFormat: (id: string, format: MarkdownDraftFormat) => void;
  onSave: (id: string) => void;
}) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  if (!activeTab) return null;

  return (
    <aside className="markdown-dock" aria-label="Markdown working copy editor">
      <div className="markdown-tab-stack" role="tablist" aria-label="Open Markdown drafts">
        {tabs.map((tab, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab.id}
            className={tab.id === activeTab.id ? "active" : ""}
            key={tab.id}
            style={{ transform: `translateY(${index * -3}px)` }}
            onClick={() => onActivate(tab.id)}
          >
            <span>{tab.title}</span>
            {tab.dirty ? <i aria-label="unsaved changes" /> : null}
          </button>
        ))}
      </div>

      <div className="markdown-editor-panel">
        <div className="markdown-editor-header">
          <div>
            <strong>{activeTab.title}</strong>
            <span>{activeTab.workingCopyPath ?? activeTab.sourcePath ?? "new working copy"}</span>
          </div>
          <div className="markdown-editor-actions">
            <select
              value={activeTab.format}
              title="Draft format"
              onChange={(event) => onChangeFormat(activeTab.id, event.target.value as MarkdownDraftFormat)}
            >
              {Object.entries(MARKDOWN_FORMAT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="button" title="Save working copy" disabled={activeTab.saving} onClick={() => onSave(activeTab.id)}>
              <Save size={14} />
              <span>{activeTab.saving ? "Saving" : "Save"}</span>
            </button>
            <button type="button" title="Close tab" onClick={() => onClose(activeTab.id)}>
              x
            </button>
          </div>
        </div>

        <textarea
          spellCheck
          value={activeTab.content}
          onChange={(event) => onChangeContent(activeTab.id, event.target.value)}
        />
      </div>
    </aside>
  );
}
