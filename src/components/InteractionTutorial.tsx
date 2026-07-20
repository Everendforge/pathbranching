import { useEffect } from "react";
import { Hand, Layers, MousePointerClick, Sparkles, X } from "lucide-react";

type InteractionTutorialLocale = "en" | "es";

const COPY = {
  en: {
    eyebrow: "Welcome to PathBranching",
    title: "How you interact with the canvas",
    description:
      "These are the core gestures for navigating narrative spaces and their contents.",
    steps: [
      {
        title: "Single left click",
        detail: "Select a node, entity, or property on the canvas.",
      },
      {
        title: "Hold left click",
        detail: "Keep the left button pressed for a moment to open the inspector.",
      },
      {
        title: "Double click",
        detail:
          "Travel inside narrative spaces and canvases to explore their contents.",
      },
    ],
    dismiss: "Got it",
    close: "Close tutorial",
  },
  es: {
    eyebrow: "Te damos la bienvenida a PathBranching",
    title: "Cómo interactúas con el canvas",
    description:
      "Estos son los gestos básicos para navegar por los espacios narrativos y su contenido.",
    steps: [
      {
        title: "Click izquierdo",
        detail: "Selecciona un nodo, entidad o propiedad en el canvas.",
      },
      {
        title: "Mantener click izquierdo",
        detail: "Mantén pulsado el botón izquierdo un momento para abrir el inspector.",
      },
      {
        title: "Doble click",
        detail:
          "Viaja dentro de los espacios narrativos y canvases para explorar su contenido.",
      },
    ],
    dismiss: "Entendido",
    close: "Cerrar tutorial",
  },
} as const;

const STEP_ICONS = [MousePointerClick, Hand, Layers] as const;

export function InteractionTutorial({
  locale,
  onDismiss,
}: {
  locale: InteractionTutorialLocale;
  onDismiss: () => void;
}) {
  const copy = COPY[locale] ?? COPY.en;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      className="interaction-tutorial-backdrop"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        className="interaction-tutorial-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interaction-tutorial-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="interaction-tutorial-header">
          <div className="interaction-tutorial-heading">
            <span className="interaction-tutorial-icon" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h2 id="interaction-tutorial-title">{copy.title}</h2>
            </div>
          </div>
          <button
            type="button"
            className="interaction-tutorial-close"
            onClick={onDismiss}
            aria-label={copy.close}
          >
            <X size={16} />
          </button>
        </header>
        <p className="interaction-tutorial-description">{copy.description}</p>
        <ol className="interaction-tutorial-steps">
          {copy.steps.map((step, index) => {
            const StepIcon = STEP_ICONS[index] ?? MousePointerClick;
            return (
              <li key={step.title}>
                <span className="interaction-tutorial-step-icon" aria-hidden="true">
                  <StepIcon size={18} />
                </span>
                <span className="interaction-tutorial-step-body">
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <footer className="interaction-tutorial-footer">
          <button type="button" onClick={onDismiss}>
            {copy.dismiss}
          </button>
        </footer>
      </div>
    </div>
  );
}
