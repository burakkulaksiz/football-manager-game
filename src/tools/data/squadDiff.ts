/**
 * Kadro değişiklik raporu (`npm run data:diff`): iki veri anlık görüntüsü (ör. git'teki sürüm ve çalışma kopyası, yani
 * Transfermarkt çekiminden önce ve sonra) arasında gelen, giden, kulüp değiştiren ve değeri / mevkisi / gücü değişen oyuncular.
 * Oyuncu ad + doğum yılıyla eşleşir. Saf: dosyaları betik (scripts/data.mjs) okur.
 */
import type { SquadData, SquadPlayerData } from '../../engine/data';

export interface PlayerRef {
  name: string;
  clubId: string;
  player: SquadPlayerData;
}

export interface SquadDiff {
  /** Önceki veride hiç olmayan oyuncular. */
  arrived: PlayerRef[];
  /** Yeni veride hiç olmayan oyuncular. */
  left: PlayerRef[];
  moved: { name: string; from: string; to: string }[];
  changed: { name: string; clubId: string; changes: string[] }[];
}

const fullName = (p: SquadPlayerData) => (p.firstName ? `${p.firstName} ${p.lastName}` : p.lastName);
const primary = (p: SquadPlayerData) => (Array.isArray(p.positions) ? p.positions[0] : Object.keys(p.positions)[0]);

function money(v: number | undefined): string {
  if (v === undefined) return '—';
  return v >= 1e6 ? `€${Math.round(v / 1e5) / 10} M` : `€${Math.round(v / 1e3)} bin`;
}

/** Ad + doğum yılı → oyuncu (aynı anahtar iki kez varsa ilki; yinelenenleri data:check bildirir). */
function index(squads: Record<string, SquadData>): Map<string, PlayerRef> {
  const out = new Map<string, PlayerRef>();
  for (const [clubId, squad] of Object.entries(squads)) {
    for (const p of squad.players) {
      const key = `${fullName(p).toLocaleLowerCase('tr')}|${String(p.born).slice(0, 4)}`;
      if (!out.has(key)) out.set(key, { name: fullName(p), clubId, player: p });
    }
  }
  return out;
}

function fieldChanges(a: SquadPlayerData, b: SquadPlayerData): string[] {
  const out: string[] = [];
  if (a.marketValue !== b.marketValue) out.push(`değer ${money(a.marketValue)} → ${money(b.marketValue)}`);
  if (primary(a) !== primary(b)) out.push(`mevki ${primary(a)} → ${primary(b)}`);
  if (a.ability !== b.ability) out.push(`güç ${a.ability} → ${b.ability}`);
  if (a.nationality !== b.nationality) out.push(`uyruk ${a.nationality} → ${b.nationality}`);
  if (a.contractExpires !== b.contractExpires) out.push(`sözleşme ${a.contractExpires ?? '—'} → ${b.contractExpires ?? '—'}`);
  return out;
}

export function diffSquads(before: Record<string, SquadData>, after: Record<string, SquadData>): SquadDiff {
  const old = index(before);
  const now = index(after);
  const diff: SquadDiff = { arrived: [], left: [], moved: [], changed: [] };
  for (const [key, ref] of now) {
    const prev = old.get(key);
    if (!prev) {
      diff.arrived.push(ref);
      continue;
    }
    if (prev.clubId !== ref.clubId) diff.moved.push({ name: ref.name, from: prev.clubId, to: ref.clubId });
    const changes = fieldChanges(prev.player, ref.player);
    if (changes.length > 0) diff.changed.push({ name: ref.name, clubId: ref.clubId, changes });
  }
  for (const [key, ref] of old) if (!now.has(key)) diff.left.push(ref);
  return diff;
}

/** Markdown rapor (reports/data/ altına yazılır). */
export function formatDiff(diff: SquadDiff, title: string): string {
  const ref = (r: PlayerRef) => `${r.clubId}: ${r.name} (${primary(r.player)}, ${String(r.player.born).slice(0, 4)}, ${money(r.player.marketValue)})`;
  const out = [
    `# Kadro değişiklikleri: ${title}`,
    '',
    `Gelen ${diff.arrived.length} · Giden ${diff.left.length} · Kulüp değiştiren ${diff.moved.length} · Bilgisi değişen ${diff.changed.length}`,
  ];
  const section = (heading: string, lines: string[]) => {
    if (lines.length > 0) out.push('', `## ${heading} (${lines.length})`, ...lines.map((l) => `- ${l}`));
  };
  section('Gelen', diff.arrived.map(ref));
  section('Giden', diff.left.map(ref));
  section('Kulüp değiştiren', diff.moved.map((m) => `${m.name}: ${m.from} → ${m.to}`));
  section('Bilgisi değişen', diff.changed.map((c) => `${c.clubId}: ${c.name} — ${c.changes.join('; ')}`));
  return out.join('\n') + '\n';
}
