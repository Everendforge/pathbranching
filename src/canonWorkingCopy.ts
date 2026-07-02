import type { CanonRef } from "./domain.js";
import type { MarkdownDraftFormat } from "./appTypes.js";

export const MARKDOWN_FORMAT_LABELS: Record<MarkdownDraftFormat, string> = {
  markdown: "Markdown",
  ink: "Ink Beat",
  gameData: "GameData",
  frontmatter: "Frontmatter",
};

export function canonMarkdownDraft(ref: CanonRef): string {
  const title = ref.label ?? ref.id;
  const lines = [
    `# ${title}`,
    "",
    `> Canon source: ${ref.canonSourcePath ?? ref.id}`,
    "",
    ref.preview?.trim() ?? "",
  ];
  return `${lines.filter((line, index) => index < 4 || line.length > 0).join("\n")}\n`;
}

export function markdownFormatTemplate(format: MarkdownDraftFormat, ref: CanonRef): string {
  const title = ref.label ?? ref.id;
  switch (format) {
    case "ink":
      return `# ${title}\n\n## Ink Beat\n\n\`\`\`ink\n=== ${ref.id.replace(/[^a-zA-Z0-9_]+/g, "_")} ===\n${title}\n+ [Continue]\n  -> DONE\n\`\`\`\n`;
    case "gameData":
      return `# ${title}\n\n## GameData Note\n\n\`\`\`json\n{\n  "canonRef": "${ref.id}",\n  "source": "${ref.canonSourcePath ?? ""}",\n  "tags": []\n}\n\`\`\`\n`;
    case "frontmatter":
      return `---\ncanonRef: ${ref.id}\ncanonSourcePath: ${ref.canonSourcePath ?? ""}\nformat: pathbranching-working-copy\n---\n\n# ${title}\n\n`;
    case "markdown":
    default:
      return canonMarkdownDraft(ref);
  }
}
