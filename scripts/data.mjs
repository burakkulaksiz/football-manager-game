// Veri hattı: kadro verisinin denetimi ve değişiklik raporu. Ağ isteği atmaz; yalnızca data/ ve git'i okur.
//
//   npm run data:check            → data/ dosyalarını denetler (hata / uyarı); hata varsa çıkış kodu 1
//   npm run data:diff             → git'teki son sürüm (HEAD) ile çalışma kopyası arasındaki kadro değişiklikleri
//   npm run data:diff -- <sürüm>  → verilen sürümle karşılaştırır (ör. HEAD~3, main)
//
// Denetim ve fark mantığı src/tools/data/ altında (testli); TypeScript modülleri Vite ile yüklenir.
// Değişiklik raporu reports/data/ altına yazılır (git'e girmez).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const OUT = join(ROOT, 'reports', 'data');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
/** Klasördeki <ad>.json dosyaları → { ad: içerik }. */
const jsonDir = (dir) =>
  Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => [basename(f, '.json'), readJson(join(dir, f))]));
const load = async (path) => (await runnerImport(join(ROOT, path), { root: ROOT, configFile: false, logLevel: 'error' })).module;
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 100e6, stdio: 'pipe' });

async function check() {
  const { checkData, formatIssues } = await load('src/tools/data/squadCheck.ts');
  const { SEASON_START_DATE } = await load('src/engine/index.ts');
  const raw = {
    clubs: readJson(join(DATA, 'clubs.json')),
    lowerClubs: readJson(join(DATA, 'lower_league.json')),
    foreignClubs: readJson(join(DATA, 'foreign_clubs.json')),
    nations: readJson(join(DATA, 'nations.json')),
    namePools: jsonDir(join(DATA, 'names')),
    squads: jsonDir(join(DATA, 'squads')),
  };
  const issues = checkData(raw, SEASON_START_DATE);
  const players = Object.values(raw.squads).reduce((n, s) => n + (Array.isArray(s?.players) ? s.players.length : 0), 0);
  console.log(formatIssues(issues, `Veri denetimi (${SEASON_START_DATE}): ${Object.keys(raw.squads).length} kadro, ${players} oyuncu`));
  if (issues.some((i) => i.level === 'error')) process.exitCode = 1;
}

async function diff(ref = 'HEAD') {
  const { diffSquads, formatDiff } = await load('src/tools/data/squadDiff.ts');
  const files = git('ls-tree', '--name-only', ref, 'data/squads/').split('\n').filter((f) => f.endsWith('.json'));
  const before = Object.fromEntries(files.map((f) => [basename(f, '.json'), JSON.parse(git('show', `${ref}:${f}`))]));
  const result = diffSquads(before, jsonDir(join(DATA, 'squads')));
  const markdown = formatDiff(result, `${ref} → çalışma kopyası`);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'diff-latest.md'), markdown);
  console.log(markdown.split('\n').slice(0, 3).join('\n'));
  console.log(`\nRapor: reports/data/diff-latest.md`);
}

const [command, ...args] = process.argv.slice(2);
const commands = { check, diff };
if (!commands[command]) {
  console.error('Kullanım: node scripts/data.mjs check | diff [sürüm]');
  process.exit(2);
}
commands[command](...args).catch((e) => {
  // git hatası (ör. bilinmeyen sürüm) kendi mesajıyla
  console.error(e.stderr?.toString().trim() || e);
  process.exit(1);
});
