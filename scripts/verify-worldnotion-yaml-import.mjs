import assert from "node:assert/strict";
import { indexWorldNotionVaultFiles } from "../lib/worldnotionBridge.js";

const files = [
  {
    relativePath: ".everend/properties.json",
    content: JSON.stringify({
      version: "2.0",
      properties: {
        stats: {
          label: "Stats",
          type: "object",
        },
        favorite: {
          label: "Favorite",
          type: "boolean",
        },
      },
    }),
  },
  {
    relativePath: "Characters/Mara.md",
    content: `---
id: character:mara
type: character
name: "Mara Vey"
status: canon
tags:
  - cast
  - favorite
aliases:
  - "The Lens"
parentId: faction:archive
childrenIds: [item:glass-key]
folder: Characters
stats:
  power: 7
  traits:
    - curious
    - guarded
nested:
  visibility:
    level: 3
favorite: true
---
Mara studies the glass key.
`,
  },
  {
    relativePath: "Broken.md",
    content: `---
id: broken
broken: [
---
This note has invalid YAML.
`,
  },
  {
    relativePath: ".everend/templates/Character.md",
    content: `---
id: "{{id}}"
type: character-template
name: "{{name}}"
---
Template content.
`,
  },
  {
    relativePath: ".everend/.pathbranching/working-copies/character-mara.md",
    content: `---
id: should-not-import
type: working-copy
name: Branch Copy
---
PathBranching-owned working copy.
`,
  },
];

const index = indexWorldNotionVaultFiles(files);

assert.equal(index.propertiesConfig?.version, "2.0");
assert.equal(index.entities.length, 1);
assert.equal(index.canonRefs.length, 2);

const entity = index.entities[0];
assert.equal(entity.id, "character:mara");
assert.equal(entity.frontmatter.stats.power, 7);
assert.deepEqual(entity.frontmatter.stats.traits, ["curious", "guarded"]);
assert.equal(entity.customProperties.stats.power, 7);
assert.equal(entity.customProperties.nested.visibility.level, 3);

const canonRef = index.canonRefs.find((ref) => ref.id === "character:mara");
assert.ok(canonRef);
assert.deepEqual(canonRef.aliases, ["The Lens"]);
assert.equal(canonRef.parentId, "faction:archive");
assert.deepEqual(canonRef.childrenIds, ["item:glass-key"]);
assert.equal(canonRef.properties?.stats.power, 7);
assert.equal(canonRef.frontmatter?.favorite, true);
assert.equal(canonRef.favorite, true);
assert.equal(canonRef.folderDescription, true);

const invalidYamlFinding = index.findings.find((finding) => finding.code === "invalid_frontmatter");
assert.ok(invalidYamlFinding);
assert.equal(invalidYamlFinding.ref, "Broken.md");

assert.equal(
  index.canonRefs.some((ref) => ref.id === "should-not-import"),
  false,
);

console.log("WorldNotion YAML import verified.");
