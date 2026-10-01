export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional test id for the button (kept stable for browser tests). */
  testId?: string;
}

/** Pill-style single-choice control (radiogroup semantics). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className="seg-btn"
          data-testid={option.testId}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
