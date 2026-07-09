import { Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

export type ReferenceOption = { id: string; label: string; detail?: string };

export function ReferencePicker({
  label,
  options,
  value,
  multiple = false,
  onChange,
}: {
  label: string;
  options: ReferenceOption[];
  value: string[];
  multiple?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const selected = useMemo(
    () => value.flatMap((id) => options.filter((option) => option.id === id)),
    [options, value],
  );
  const matches = useMemo(
    () =>
      options.filter(
        (option) =>
          !value.includes(option.id) &&
          (!deferredQuery ||
            `${option.label} ${option.detail ?? ""}`
              .toLowerCase()
              .includes(deferredQuery)),
      ),
    [deferredQuery, options, value],
  );

  return (
    <section className="reference-picker">
      <strong>{label}</strong>
      {selected.length ? (
        <div className="reference-picker-values">
          {selected.map((option) => (
            <span key={option.id}>
              {option.label}
              <button
                type="button"
                title={`Remove ${option.label}`}
                onClick={() => onChange(value.filter((id) => id !== option.id))}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {multiple || selected.length === 0 ? (
        <>
          <label className="reference-picker-search">
            <Search size={13} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}`}
            />
          </label>
          {query ? (
            <div className="reference-picker-results">
              {matches.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(multiple ? [...value, option.id] : [option.id]);
                    setQuery("");
                  }}
                >
                  <strong>{option.label}</strong>
                  {option.detail ? <span>{option.detail}</span> : null}
                </button>
              ))}
              {matches.length === 0 ? (
                <span className="empty-line">No matching references.</span>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
