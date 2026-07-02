import type { BranchingProject, ProjectDataObject } from "../domain.js";

function groupDataObjects(project: BranchingProject) {
  return (project.projectDataObjects ?? []).reduce<Record<string, ProjectDataObject[]>>((groups, dataObject) => {
    groups[dataObject.classId] ??= [];
    groups[dataObject.classId].push(dataObject);
    return groups;
  }, {});
}

export function DataDrawer({
  project,
  selectedId,
  onSelect,
  onCreateDataObject,
  onCreateKnowledgeObject,
  onClose,
}: {
  project: BranchingProject;
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreateDataObject: (classId: string) => void;
  onCreateKnowledgeObject: () => void;
  onClose: () => void;
}) {
  const groups = groupDataObjects(project);
  const dataObjectCount = project.projectDataObjects?.length ?? 0;

  return (
    <aside className="data-drawer">
      <div className="inspector-header">
        <div>
          <strong>Project Data</strong>
          <span>{dataObjectCount} object(s)</span>
        </div>
        <button type="button" title="Close data drawer" onClick={onClose}>
          x
        </button>
      </div>
      <div className="inspector-scroll">
        <section className="inspector-section">
          <h2>Create Data</h2>
          <div className="inspector-actions wrap">
            <button type="button" onClick={onCreateKnowledgeObject}>
              Knowledge from selection
            </button>
            {(project.dataClasses ?? []).map((dataClass) => (
              <button type="button" key={dataClass.id} onClick={() => onCreateDataObject(dataClass.id)}>
                {dataClass.label}
              </button>
            ))}
          </div>
        </section>
        {Object.entries(groups).map(([classId, objects]) => (
          <section className="inspector-section" key={classId}>
            <h2>{project.dataClasses?.find((dataClass) => dataClass.id === classId)?.label ?? classId}</h2>
            <div className="stack-list">
              {objects.map((dataObject) => (
                <button
                  className={`list-item ${selectedId === dataObject.id ? "active" : ""}`}
                  key={dataObject.id}
                  type="button"
                  onClick={() => onSelect(dataObject.id)}
                >
                  <strong>{dataObject.name}</strong>
                  <span>{dataObject.canonRefs?.join(", ") ?? "manual project data"}</span>
                  <span>{Object.keys(dataObject.fields).length} field(s)</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {dataObjectCount === 0 ? (
          <section className="inspector-section">
            <h2>No project data yet</h2>
            <span className="empty-line">Create Knowledge entries or manual data objects from canon refs.</span>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
