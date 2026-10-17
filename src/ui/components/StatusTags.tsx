import { YELLOW_LIMIT, type Player } from '../../engine';

/** Oyuncunun durum etiketleri: sakatlık, ceza, kart sınırı. */
export function StatusTags({ player }: { player: Player }) {
  return (
    <span className="status-tags">
      {player.injury && (
        <span className="st st-injury" title={`${player.injury.name} — ${player.injury.daysOut} gün`}>✚ {player.injury.daysOut}g</span>
      )}
      {player.suspension > 0 && (
        <span className="st st-ban" title={`${player.suspension} maç cezalı`}>CEZA {player.suspension}</span>
      )}
      {player.suspension === 0 && player.yellowCards === YELLOW_LIMIT - 1 && (
        <span className="st st-warn" title="Bir sarı kart daha görürse cezalı duruma düşer">{player.yellowCards} SK</span>
      )}
    </span>
  );
}
