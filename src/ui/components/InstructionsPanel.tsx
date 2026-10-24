import {
  FORMATION_IDS,
  formationName,
  PLAN_LABELS,
  type CustomFormation,
  type FormationId,
  type Mentality,
  type PlayerOrders,
  type TeamInstructions,
} from '../../engine';
import {
  CHANNEL_OPTIONS,
  DUTY_OPTIONS,
  INSTRUCTION_OPTIONS,
  INSTRUCTION_TOGGLES,
  MENTALITY_HINTS,
  MENTALITY_LABELS,
  ORDER_FLAGS,
} from '../labels';

type OptionKey = keyof typeof INSTRUCTION_OPTIONS;
type ToggleKey = keyof typeof INSTRUCTION_TOGGLES;

/** Talimat grupları: seçenekli satırlar ve aç / kapa talimatlar. */
const GROUPS: { title: string; rows: { key: OptionKey; label: string }[]; toggles: ToggleKey[] }[] = [
  {
    title: 'Hücum',
    rows: [
      { key: 'passing', label: 'Pas Tarzı' },
      { key: 'tempo', label: 'Tempo' },
      { key: 'width', label: 'Genişlik' },
      { key: 'crossing', label: 'Ortalar' },
      { key: 'freedom', label: 'Yaratıcılık' },
    ],
    toggles: ['counterAttack', 'playOutOfDefence'],
  },
  {
    title: 'Savunma',
    rows: [
      { key: 'pressing', label: 'Pres' },
      { key: 'defensiveLine', label: 'Savunma Hattı' },
      { key: 'tackling', label: 'Müdahale' },
    ],
    toggles: ['offsideTrap', 'timeWasting'],
  },
];

/** Bir talimat satırı: segmentli seçim + seçilenin açıklaması. */
function Segmented<T extends string | number | boolean>({ label, value, options, onChange, disabled }: {
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

/** Aç / kapa talimatlar: işaretlenebilir etiketler, açık olanların açıklaması altta. */
function Toggles<K extends string>({ items, value, onChange, disabled }: {
  items: readonly { key: K; label: string; hint: string }[];
  value: (key: K) => boolean;
  onChange: (key: K, on: boolean) => void;
  disabled?: boolean;
}) {
  const on = items.filter((i) => value(i.key));
  return (
    <div className="instr-toggles">
      <div className="chips">
        {items.map((i) => (
          <button
            key={i.key}
            className={`chip${value(i.key) ? ' active' : ''}`}
            disabled={disabled}
            title={i.hint}
            aria-pressed={value(i.key)}
            onClick={() => onChange(i.key, !value(i.key))}
          >
            {value(i.key) ? '✓ ' : ''}{i.label}
          </button>
        ))}
      </div>
      {on.map((i) => <div key={i.key} className="instr-hint">{i.label}: {i.hint}</div>)}
    </div>
  );
}

/** Diziliş seçici (hazır dizilişler; özel diziliş varsa ayrı bir sekme olarak görünür). */
export function FormationPicker({ value, custom, onChange, disabled }: {
  value: FormationId;
  custom?: CustomFormation | null;
  onChange: (f: FormationId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="tabs formation-tabs" role="group" aria-label="Diziliş">
      {FORMATION_IDS.map((f) => (
        <button key={f} className={`tab${!custom && f === value ? ' active' : ''}`} disabled={disabled} onClick={() => onChange(f)}>
          {f}
        </button>
      ))}
      {custom && (
        <button className="tab active" disabled={disabled} title="Kendi dizilişin">
          Özel {formationName({ formation: value, custom })}
        </button>
      )}
    </div>
  );
}

/** Taktik seti seçici (A / B / C). */
export function PlanPicker({ value, onChange, disabled }: { value: number; onChange: (index: number) => void; disabled?: boolean }) {
  return (
    <div className="tabs plan-tabs" role="group" aria-label="Taktik seti">
      {PLAN_LABELS.map((label, i) => (
        <button key={label} className={`tab${i === value ? ' active' : ''}`} disabled={disabled} onClick={() => onChange(i)} title={`Taktik ${label}`}>
          {label}
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

const TOGGLE_ITEMS = (keys: ToggleKey[]) => keys.map((key) => ({ key, ...INSTRUCTION_TOGGLES[key] }));

/** Takım talimatları: mentalite, hücum ve savunma talimatları. */
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
      {GROUPS.map((g) => (
        <div key={g.title} className="instr-group">
          <div className="sub-head">{g.title}</div>
          {g.rows.map(({ key, label }) => (
            <Segmented
              key={key}
              label={label}
              value={instructions[key] as string}
              options={INSTRUCTION_OPTIONS[key]}
              onChange={(v) => onChange({ [key]: v } as Partial<TeamInstructions>)}
              disabled={disabled}
            />
          ))}
          <Toggles
            items={TOGGLE_ITEMS(g.toggles)}
            value={(key) => instructions[key] === true}
            onChange={(key, on) => onChange({ [key]: on } as Partial<TeamInstructions>)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}

/** Duran top tarzları: korner ve serbest vuruş. */
export function SetPieceStyles({ instructions, onChange, disabled }: {
  instructions: TeamInstructions;
  onChange: (change: Partial<TeamInstructions>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="instructions">
      <Segmented
        label="Kornerler"
        value={instructions.cornerStyle}
        options={INSTRUCTION_OPTIONS.cornerStyle}
        onChange={(cornerStyle) => onChange({ cornerStyle })}
        disabled={disabled}
      />
      <Segmented
        label="Serbest Vuruş"
        value={instructions.freeKickStyle}
        options={INSTRUCTION_OPTIONS.freeKickStyle}
        onChange={(freeKickStyle) => onChange({ freeKickStyle })}
        disabled={disabled}
      />
    </div>
  );
}

const FLAG_ITEMS = (Object.keys(ORDER_FLAGS) as (keyof typeof ORDER_FLAGS)[]).map((key) => ({ key, ...ORDER_FLAGS[key] }));

/** Bir mevkinin bireysel talimatları: görev, koşu yolu ve aç / kapa talimatlar. */
export function OrdersEditor({ orders, wide, onChange }: {
  orders: PlayerOrders;
  /** Kanat mevkisi mi (içe kat / kanada aç anlamlı). */
  wide: boolean;
  onChange: (change: Partial<PlayerOrders>) => void;
}) {
  return (
    <div className="instructions">
      <Segmented label="Görev" value={orders.duty} options={DUTY_OPTIONS} onChange={(duty) => onChange({ duty })} />
      <Segmented
        label="Koşu Yolu"
        value={orders.channel}
        options={wide ? CHANNEL_OPTIONS : CHANNEL_OPTIONS.filter((o) => o.value !== 'inside')}
        onChange={(channel) => onChange({ channel })}
      />
      <Toggles items={FLAG_ITEMS} value={(key) => orders[key]} onChange={(key, on) => onChange({ [key]: on })} />
    </div>
  );
}
