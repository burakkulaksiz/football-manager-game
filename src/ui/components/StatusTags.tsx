import { YELLOW_LIMIT, type Player } from '../../engine';
import { useGameStore } from '../../store/gameStore';

/** Oyuncunun durum etiketleri: sakatlık, ceza, kart sınırı, milli takım. */
export function StatusTags({ player }: { player: Player }) {
  const onDuty = useGameStore((s) => s.world?.international.onDuty.includes(player.id) ?? false);
  return (
    <span className="status-tags">
      {onDuty && <span className="st st-intl" title="Milli takımda">MİLLİ</span>}
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
