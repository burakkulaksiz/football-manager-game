/**
 * Denge raporu koşusu (normal testlere girmez; `npm run balance` ile çalışır, bkz. vitest.balance.config.ts).
 *
 * Ortam değişkenleri (hepsi isteğe bağlı):
 *   BALANCE_CAREERS  kariyer sayısı (varsayılan 6); her biri farklı bir kulüple başlar (güçlüden zayıfa)
 *   BALANCE_SEASONS  kariyer başına sezon (varsayılan 4)
 *   BALANCE_SEED     ilk tohum (varsayılan 9000); kariyer i tohum + i ile başlar → koşular tekrarlanabilir
 *   BALANCE_CLUBS    başlangıç kulüpleri, virgülle (verilirse kariyer sayısı bunun uzunluğu olur)
 *   BALANCE_OUT      çıktı klasörü (varsayılan reports/balance)
 *
 * Çıktı: latest.md (okunur rapor), latest.json (sonraki koşuyla karşılaştırma için), tarihli kopya.
 * Rapor, aynı klasördeki önceki latest.json ile karşılaştırılır.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { createWorld, leagueClubs } from '../../engine';
import { gameData } from '../../gameData';
import { collectCareer } from './collect';
import { buildReport } from './metrics';
import { renderMarkdown } from './report';
import type { RawData, Report } from './types';

const env = (name: string, fallback: number): number => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
};

/** Kulüpleri itibara göre sıralayıp eşit aralıklarla seçer: güçlüden zayıfa çeşitli başlangıçlar. */
function pickClubs(count: number): string[] {
  const world = createWorld(gameData, 1, gameData.clubs[0]!.id, '2026-07-01');
  const ids = leagueClubs(world).sort((a, b) => b.reputation - a.reputation).map((c) => c.id);
  return Array.from({ length: count }, (_, i) => ids[Math.floor((i * ids.length) / count)]!);
}

it('denge raporu', () => {
  const explicit = (process.env.BALANCE_CLUBS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const careers = explicit.length > 0 ? explicit.length : env('BALANCE_CAREERS', 6);
  const seasons = env('BALANCE_SEASONS', 4);
  const baseSeed = env('BALANCE_SEED', 9000);
  const clubs = explicit.length > 0 ? explicit : pickClubs(careers);
  const outDir = process.env.BALANCE_OUT ?? 'reports/balance';

  const started = Date.now();
  const raw: RawData = { config: { careers, seasons, baseSeed, clubs }, careers: [], elapsedSec: 0 };
  for (let i = 0; i < careers; i++) {
    const log = collectCareer({
      career: i,
      seed: baseSeed + i,
      clubId: clubs[i]!,
      seasons,
      onSeason: (c, s) => console.log(`[denge] kariyer ${c + 1}/${careers} (${clubs[c]}): sezon ${s}/${seasons} bitti — ${((Date.now() - started) / 1000).toFixed(0)} sn`),
    });
    raw.careers.push(log);
  }
  raw.elapsedSec = (Date.now() - started) / 1000;

  const report = buildReport(raw);
  mkdirSync(outDir, { recursive: true });
  const latestJson = join(outDir, 'latest.json');
  let previous: Report | null = null;
  if (existsSync(latestJson)) {
    try {
      previous = JSON.parse(readFileSync(latestJson, 'utf8')) as Report;
    } catch {
      previous = null; // bozuk eski dosya: karşılaştırmasız devam
    }
  }
  const markdown = renderMarkdown(report, previous);
  const stamp = report.generatedAt.slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1_');
  writeFileSync(join(outDir, 'latest.md'), markdown);
  writeFileSync(join(outDir, `${stamp}.md`), markdown);
  writeFileSync(latestJson, JSON.stringify(report, null, 1));
  console.log(`\n[denge] rapor: ${join(outDir, 'latest.md')}\n`);
  console.log(markdown.split('\n').slice(0, 24).join('\n'));
}, 6 * 60 * 60 * 1000);
