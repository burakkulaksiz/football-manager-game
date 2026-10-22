/**
 * Türkçe maç anlatımı şablonları.
 * İsimlerden sonra ek (-in, -a…) gelmeyecek şekilde yazıldı; ünlü uyumu derdi olmasın.
 */
import type { Rng } from '../rng';

type Vars = Record<string, string | number>;

function fill(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
}

const TEMPLATES = {
  kickoff: ['Hakem düdüğü çaldı, {home} – {away} karşılaşması başladı!'],
  halftime: ['İlk yarı sona erdi. {home} {hg}-{ag} {away}'],
  secondhalf: ['İkinci yarı başladı.'],
  fulltime: ['Maç sona erdi! {home} {hg}-{ag} {away}'],
  shootoutStart: ['Eşitlik bozulmadı; kazanan penaltı atışlarıyla belirlenecek!'],
  shootoutGoal: ['{player} penaltıyı gole çevirdi. ({hp}-{ap})', '{player} kaleciyi ters köşeye yatırdı. ({hp}-{ap})'],
  shootoutMiss: ['{player} kaçırdı, {keeper} kurtardı! ({hp}-{ap})', '{player} topu direğin dışına gönderdi! ({hp}-{ap})'],
  shootoutEnd: ['{winner} penaltı atışlarını {hp}-{ap} kazandı ve turu geçti!'],
  goal: [
    'GOL! {player} topu ağlara gönderdi! {score}',
    'GOOOL! {player} fileleri havalandırıyor! {score}',
    'GOL! {player} kaleciyi avlıyor! {score}',
  ],
  goalHeader: ['GOL! {player} kafayı vurdu, top ağlarda! {score}', 'GOL! Yerden yükselen {player} kafayla tamamladı! {score}'],
  goalLong: ['GOL! {player} uzaktan çaktı, top doksana gitti! {score}', 'GOL! Ceza sahası dışından {player}, muhteşem bir vuruş! {score}'],
  goalFreekick: ['GOL! {player} serbest vuruşu barajın üstünden ağlara gönderdi! {score}'],
  goalPenalty: ['GOL! {player} penaltıyı gole çevirdi! {score}', 'GOL! {player} penaltıda hata yapmıyor! {score}'],
  assist: ['Asist: {assist}.', 'Pas {assist} ayağından geldi.'],
  save: [
    '{player} şutunu çekti, kaleci {keeper} kurtarıyor!',
    '{player} denedi ama {keeper} yerinde! Güzel kurtarış.',
    'Kaleci {keeper} gole izin vermiyor, {player} bu kez başaramadı.',
  ],
  saveHeader: ['{player} kafayı vurdu, {keeper} topu kontrol etti.'],
  miss: [
    '{player} şutunu çekti… top az farkla auta gitti.',
    '{player} vurdu, top yandan auta çıktı.',
    '{player} iyi pozisyonda ama şutu kalenin üstünden gitti.',
  ],
  missLong: ['{player} ceza sahası dışından denedi, top üstten auta.', 'Uzaktan {player} şansını denedi, isabet yok.'],
  missHeader: ['{player} kafayla vurdu ama top kaleyi bulmadı.'],
  blocked: ['{player} şut attı ama {defender} araya girdi!', '{player} vuruşunda {defender} topu bloke etti.'],
  corner: ['{team} korner kazandı.', 'Top kornere çıktı, {team} atacak.'],
  foul: ['{player} faul yaptı, hakem oyunu durdurdu.', 'Hakem {player} için faul kararı verdi.'],
  freekick: ['Tehlikeli bölgede serbest vuruş! Topun başında {player}.'],
  penalty: ['PENALTI! {fouler} ceza sahasında faul yaptı. Topun başında {player}.'],
  penaltyMiss: ['{player} penaltıyı kaçırdı! {keeper} köşeyi doğru tahmin etti!', '{player} penaltıda topu dışarı attı!'],
  yellow: ['{player} sarı kart gördü.', 'Hakem {player} için sarı kartını çıkardı.'],
  secondYellow: ['{player} ikinci sarıdan kırmızı kart gördü! {team} 10 kişi kaldı.'],
  red: ['Direkt kırmızı kart! {player} oyundan atıldı, {team} eksik kaldı.'],
  injury: ['{player} sakatlandı, sağlık ekibi sahada.', '{player} yerde kaldı, devam etmekte zorlanıyor.'],
  sub: ['Oyuncu değişikliği ({team}): {in} oyuna girdi, {out} çıktı.'],
  tactic: ['{team} taktik değiştirdi: yeni diziliş {formation}.'],
  tackle: ['{player} topu kaptı, atak kesildi.', '{player} araya girerek tehlikeyi önledi.'],
  info: [
    '{team} topu ayağında tutuyor, sabırla pas yapıyor.',
    '{team} oyunu rakip yarı sahaya yıkmaya çalışıyor.',
    'Orta sahada ikili mücadeleler sürüyor.',
    '{player} topla ilerliyor, pas arıyor.',
    '{team} kanattan hücum geliştiriyor.',
  ],
} as const;

export type CommentaryKey = keyof typeof TEMPLATES;

export function commentary(rng: Rng, key: CommentaryKey, vars: Vars): string {
  return fill(rng.pick(TEMPLATES[key]), vars);
}
