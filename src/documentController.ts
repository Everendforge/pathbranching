import type { BranchingProject } from "./domain.js";
import {
  saveUniverseManifest,
  saveUniverseStory,
  type ProjectFileState,
  type SaveUniverseStoryResult,
  type WriteResult,
} from "./projectPersistence.js";
import { storyPath, type PathBranchingStoryManifestEntry, type PathBranchingWorkspace } from "./pathBranchingWorkspace.js";
import { createEmptyBranchingProjectFromWorldNotionIndex } from "./worldnotionBridge.js";
import { normalizeProject } from "./projectSerialization.js";
import { slugify, uniqueId } from "./projectMutations.js";

export type DocumentSaveInput = {
  project: BranchingProject;
  workspace: PathBranchingWorkspace;
  fileState: ProjectFileState;
  revision: number;
};

export type DocumentSaveSnapshot = {
  result: SaveUniverseStoryResult;
  savedProject: BranchingProject;
  nextFileState: ProjectFileState;
  nextWorkspace: PathBranchingWorkspace;
};

export type CreateStoryInput = {
  workspace: PathBranchingWorkspace;
  fileState: ProjectFileState;
  name?: string;
  revision: number;
};

export type RenameStoryInput = {
  project: BranchingProject;
  workspace: PathBranchingWorkspace;
  fileState: ProjectFileState;
  name: string;
  revision: number;
};

export type DeleteStoryInput = {
  workspace: PathBranchingWorkspace;
  fileState: ProjectFileState;
  storyId: string;
};

export type DeleteStorySnapshot = {
  result: WriteResult;
  nextWorkspace: PathBranchingWorkspace;
  nextFileState: ProjectFileState;
};

export async function saveBranchingDocument(input: DocumentSaveInput): Promise<DocumentSaveSnapshot> {
  if (!input.fileState.universePath) {
    throw new Error("Open a universe before saving a PathBranching story.");
  }

  const result = await saveUniverseStory(
    input.fileState.universePath,
    input.workspace,
    input.project,
    input.fileState.modifiedMs,
  );
  if (!result.ok) {
    throw new Error(result.message ?? "Could not save project.");
  }

  const savedProject = normalizeProject({
    ...input.project,
    storyId: input.workspace.activeStory?.id ?? input.project.storyId,
    universeRootPath: input.fileState.universePath,
  });

  const nextFileState: ProjectFileState = {
    ...input.fileState,
    path: result.storyPath ?? input.fileState.storyPath,
    storyPath: result.storyPath ?? input.fileState.storyPath,
    dirty: false,
    lastSavedAt: Date.now(),
    modifiedMs: result.storyModifiedMs ?? result.modifiedMs,
  };

  const nextWorkspace: PathBranchingWorkspace = {
    ...input.workspace,
    manifest: result.manifest ?? input.workspace.manifest,
    activeProject: savedProject,
    createdDefaultStory: false,
    storyModifiedMs: result.storyModifiedMs ?? result.modifiedMs,
  };

  return {
    result,
    savedProject,
    nextFileState,
    nextWorkspace,
  };
}

export async function createBranchingStory(input: CreateStoryInput): Promise<DocumentSaveSnapshot> {
  if (!input.fileState.universePath) {
    throw new Error("Open a universe before creating a PathBranching story.");
  }

  const now = new Date().toISOString();
  const defaultStory = input.workspace.createdDefaultStory ? input.workspace.activeStory : undefined;
  const storyName = input.name?.trim() || "New Branching Story";
  const newStoryId = uniqueId(
    slugify(storyName) || "new-branching-story",
    input.workspace.manifest.stories.map((item) => item.id),
  );
  const story: PathBranchingStoryManifestEntry = defaultStory
    ? {
        ...defaultStory,
        id: defaultStory.id,
        path: defaultStory.path,
        name: input.name?.trim() || defaultStory.name || "Branching Story",
        createdAt: defaultStory.createdAt ?? now,
        updatedAt: now,
      }
    : {
        id: newStoryId,
        name: storyName,
        path: storyPath(newStoryId),
        createdAt: now,
        updatedAt: now,
      };
  const reusingDefaultStory = Boolean(defaultStory);

  const baseProject = reusingDefaultStory
    ? input.workspace.activeProject
    : createEmptyBranchingProjectFromWorldNotionIndex(input.workspace.canonIndex, {
        projectId: `pathbranching:${story.id}`,
        name: story.name,
        vaultRelativePath: ".",
      });

  const project = normalizeProject({
    ...baseProject,
    projectId: `pathbranching:${story.id}`,
    name: story.name,
    storyId: story.id,
    universeRootPath: input.fileState.universePath,
  });

  const stories = reusingDefaultStory
    ? input.workspace.manifest.stories.map((item) => (item.id === story.id ? story : item))
    : [...input.workspace.manifest.stories, story];

  const workspace: PathBranchingWorkspace = {
    ...input.workspace,
    manifest: {
      ...input.workspace.manifest,
      activeStoryId: story.id,
      stories,
    },
    activeStory: story,
    activeProject: project,
    storyModifiedMs: undefined,
    createdDefaultStory: true,
  };

  return saveBranchingDocument({
    project,
    workspace,
    fileState: {
      ...input.fileState,
      path: story.path,
      storyPath: story.path,
      modifiedMs: undefined,
      dirty: true,
    },
    revision: input.revision,
  });
}

export async function renameBranchingStory(input: RenameStoryInput): Promise<DocumentSaveSnapshot> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Story name cannot be empty.");
  }
  const activeStory = input.workspace.activeStory;
  if (!activeStory) {
    throw new Error("No active PathBranching story is available to rename.");
  }

  const renamedStory = {
    ...activeStory,
    name,
    updatedAt: new Date().toISOString(),
  };
  const workspace: PathBranchingWorkspace = {
    ...input.workspace,
    manifest: {
      ...input.workspace.manifest,
      stories: input.workspace.manifest.stories.map((story) => (story.id === renamedStory.id ? renamedStory : story)),
    },
    activeStory: renamedStory,
    activeProject: normalizeProject({
      ...input.project,
      name,
      storyId: renamedStory.id,
    }),
  };

  return saveBranchingDocument({
    project: workspace.activeProject,
    workspace,
    fileState: input.fileState,
    revision: input.revision,
  });
}

export async function deleteBranchingStory(input: DeleteStoryInput): Promise<DeleteStorySnapshot> {
  if (!input.fileState.universePath) {
    throw new Error("Open a universe before deleting a PathBranching story.");
  }
  if (input.workspace.manifest.stories.length <= 1) {
    throw new Error("Cannot delete the only story in this universe.");
  }

  const deletedStory = input.workspace.manifest.stories.find((story) => story.id === input.storyId);
  if (!deletedStory) {
    throw new Error("Story not found.");
  }
  const remainingStories = input.workspace.manifest.stories.filter((story) => story.id !== input.storyId);
  const nextStory =
    input.workspace.activeStory?.id === input.storyId
      ? remainingStories[0]
      : input.workspace.activeStory ?? remainingStories[0];
  if (!nextStory) {
    throw new Error("No replacement story is available.");
  }

  const manifest = {
    ...input.workspace.manifest,
    activeStoryId: nextStory.id,
    stories: remainingStories,
  };
  const result = await saveUniverseManifest(input.fileState.universePath, manifest);
  if (!result.ok) {
    throw new Error(result.message ?? "Could not update PathBranching manifest.");
  }

  return {
    result,
    nextWorkspace: {
      ...input.workspace,
      manifest,
      activeStory: nextStory,
      createdDefaultStory: false,
    },
    nextFileState: {
      ...input.fileState,
      path: nextStory.path,
      storyPath: nextStory.path,
      dirty: false,
      lastSavedAt: Date.now(),
    },
  };
}
