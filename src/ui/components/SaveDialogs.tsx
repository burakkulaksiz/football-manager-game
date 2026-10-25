import { useEffect, useState } from 'react';
import type { SaveSlot } from '../../persistence/db';
import { careerIdOf, defaultSaveName, listSaves, liveMatchLabel } from '../../persistence/saves';
import { hasUnsavedProgress, useGameStore, useWorld } from '../../store/gameStore';
import { formatDateShort } from '../labels';
import { Modal } from './Modal';

export function formatSavedAt(ts: number): string {
  return new Date(ts).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Oyunu kaydet: yeni slot ya da bu kariyerin elle alınmış bir kaydının üzerine. */
export function SaveDialog({ onClose }: { onClose: () => void }) {
  const world = useWorld();
  const liveMatch = useGameStore((s) => s.liveMatch);
  const currentSaveId = useGameStore((s) => s.currentSaveId);
  const saveCurrent = useGameStore((s) => s.saveCurrent);
  const [name, setName] = useState(defaultSaveName(world));
  const [slots, setSlots] = useState<SaveSlot[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const career = careerIdOf(world);
    listSaves()
      .then((all) => setSlots(all.filter((s) => s.careerId === career && !s.isAutosave)))
      .catch(() => setSlots([]));
  }, [world]);

  const save = async (overwriteId?: number) => {
    setBusy(true);
    const ok = await saveCurrent(name.trim() || defaultSaveName(world), overwriteId);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title="Oyunu Kaydet"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn-continue" disabled={busy} onClick={() => save()}>
            Yeni Kayıt <span className="btn-continue-arrow">›</span>
          </button>
        </>
      }
    >
      {liveMatch && (
        <div className="panel-note save-live-note">
          Maç sürüyor: kayıt maçın şu anki durumunu da içerir ({liveMatchLabel(world, liveMatch)}); yüklediğinde maç buradan devam eder.
        </div>
      )}
      <label className="field">
        <span>Kayıt adı</span>
        <input
          value={name}
          maxLength={60}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) void save();
          }}
        />
      </label>

      <div className="sub-head sub-head-gap">Bu kariyerin kayıtları — üzerine yaz</div>
      {slots === null && <div className="muted">Yükleniyor…</div>}
      {slots?.length === 0 && <div className="muted">Henüz elle alınmış kayıt yok.</div>}
      {slots?.map((s) => (
        <div key={s.id} className={`save-row${s.id === currentSaveId ? ' current' : ''}`}>
          <div className="save-row-main">
            <div className="strong">{s.name}</div>
            <div className="muted">
              Oyun tarihi {formatDateShort(s.gameDate)} · kaydedildi {formatSavedAt(s.updatedAt)}
            </div>
            {s.liveMatch && <div className="save-live">Maç ortasında: {s.liveMatch}</div>}
          </div>
          <button className="btn" disabled={busy} onClick={() => save(s.id)}>Üzerine Kaydet</button>
        </div>
      ))}
      <div className="panel-note">Otomatik kayıt her maç gününden sonra ayrıca alınır.</div>
    </Modal>
  );
}

/** Ana menüye dönüş: kaydedilmemiş ilerleme varsa uyar. */
export function QuitDialog({ onClose }: { onClose: () => void }) {
  const world = useWorld();
  const liveMatch = useGameStore((s) => s.liveMatch);
  const currentSaveId = useGameStore((s) => s.currentSaveId);
  const saveCurrent = useGameStore((s) => s.saveCurrent);
  const quitToMenu = useGameStore((s) => s.quitToMenu);
  const unsaved = useGameStore(hasUnsavedProgress);
  const [busy, setBusy] = useState(false);

  const saveAndQuit = async () => {
    setBusy(true);
    const ok = await saveCurrent(defaultSaveName(world), currentSaveId ?? undefined);
    setBusy(false);
    if (ok) quitToMenu();
  };

  return (
    <Modal
      title="Ana Menüye Dön"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn" onClick={quitToMenu}>{unsaved ? 'Kaydetmeden Çık' : 'Çık'}</button>
          {unsaved && (
            <button className="btn-continue" disabled={busy} onClick={saveAndQuit}>
              Kaydet ve Çık <span className="btn-continue-arrow">›</span>
            </button>
          )}
        </>
      }
    >
      {liveMatch && unsaved ? (
        <p>
          Maç sürüyor ve son kayıttan bu yana ilerledi. Kaydet ve Çık maçı bu dakikadan sürdürülecek şekilde kaydeder;
          kaydetmeden çıkarsan maçtaki ilerleme kaybolur.
        </p>
      ) : unsaved ? (
        <p>
          Son kayıttan bu yana ilerleme var. Kaydetmeden çıkarsan bu ilerleme kaybolur
          {currentSaveId !== null ? ' (Kaydet ve Çık son kaydın üzerine yazar).' : '.'}
        </p>
      ) : (
        <p>Tüm ilerleme kayıtlı. Ana menüye dönmek istiyor musun?</p>
      )}
    </Modal>
  );
}
