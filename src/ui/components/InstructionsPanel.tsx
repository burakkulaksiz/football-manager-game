import {
  FORMATION_IDS,
  type FormationId,
  type Mentality,
  type TeamInstructions,
} from '../../engine';
import { INSTRUCTION_OPTIONS, MENTALITY_HINTS, MENTALITY_LABELS } from '../labels';

type OptionKey = keyof typeof INSTRUCTION_OPTIONS;

const ROWS: { key: OptionKey; label: string }[] = [
  { key: 'passing', label: 'Pas Tarzı' },
  { key: 'tempo', label: 'Tempo' },
  { key: 'pressing', label: 'Pres' },
  { key: 'defensiveLine', label: 'Savunma Hattı' },
];

/** Bir talimat satırı: segmentli seçim + seçilenin açıklaması. */
function Segmented<T extends string | number>({ label, value, options, onChange, disabled }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; hint: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className="instr-row">
      <div className="instr-label">{label}</div>
      <div className="tabs instr-tabs">
        {options.map((o) => (
          <button
            key={String(o.value)}
            className={`tab${o.value === value ? ' active' : ''}`}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="instr-hint">{current?.hint}</div>
    </div>
  );
}

/** Diziliş seçici (6 diziliş). */
export function FormationPicker({ value, onChange, disabled }: {
  value: FormationId;
  onChange: (f: FormationId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="tabs formation-tabs" role="group" aria-label="Diziliş">
      {FORMATION_IDS.map((f) => (
        <button key={f} className={`tab${f === value ? ' active' : ''}`} disabled={disabled} onClick={() => onChange(f)}>
          {f}
        </button>
      ))}
    </div>
  );
}

const MENTALITY_OPTIONS = ([-2, -1, 0, 1, 2] as const).map((m) => ({
  value: m as Mentality,
  label: MENTALITY_LABELS[m],
  hint: MENTALITY_HINTS[m],
}));

/** Takım talimatları: mentalite, pas, tempo, pres, savunma hattı. */
export function InstructionsPanel({ instructions, onChange, disabled }: {
  instructions: TeamInstructions;
  onChange: (change: Partial<TeamInstructions>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="instructions">
      <Segmented
        label="Mentalite"
        value={instructions.mentality}
        options={MENTALITY_OPTIONS}
        onChange={(mentality) => onChange({ mentality })}
        disabled={disabled}
      />
      {ROWS.map(({ key, label }) => (
        <Segmented
          key={key}
          label={label}
          value={instructions[key] as string}
          options={INSTRUCTION_OPTIONS[key]}
          onChange={(v) => onChange({ [key]: v } as Partial<TeamInstructions>)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
