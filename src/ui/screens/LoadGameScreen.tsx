import { useCallback, useEffect, useRef, useState } from 'react';
import { seasonLabel } from '../../engine';
import { gameData } from '../../gameData';
import type { SaveSlot } from '../../persistence/db';
import { MAX_IMPORT_BYTES } from '../../persistence/exchange';
import { deleteSave, exportSlot, importSave, listSaves } from '../../persistence/saves';
import { useGameStore } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { Modal } from '../components/Modal';
import { formatSavedAt } from '../components/SaveDialogs';
import { formatDateShort } from '../labels';

/** Kayıt yükleme ekranı (ana menüden). */
export function LoadGameScreen() {
  const loadSave = useGameStore((s) => s.loadSave);
  const quitToMenu = useGameStore((s) => s.quitToMenu);
  const [saves, setSaves] = useState<SaveSlot[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SaveSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    listSaves()
      .then((all) => {
        setSaves(all);
        setSelected((cur) => (cur !== null && all.some((s) => s.id === cur) ? cur : all[0]?.id ?? null));
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(refresh, [refresh]);

  const remove = async (slot: SaveSlot) => {
    await deleteSave(slot.id);
    setConfirmDelete(null);
    refresh();
  };

  /** Slotu .json dosyası olarak indirir. */
  const exportFile = async (slot: SaveSlot) => {
    try {
      const { fileName, text } = await exportSlot(slot.id);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      // İndirme başlamadan bağlantı geçersiz kalmasın
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Seçilen .json yedeği yeni slot olarak ekler; hatada sebep listenin üstünde görünür. */
  const importFile = async (file: File) => {
    setError(null);
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Dosya çok büyük; bir oyun kaydı olamaz.');
      const id = await importSave(await file.text());
      refresh();
      setSelected(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const clubOf = (id: string) => gameData.clubs.find((c) => c.id === id);

  return (
    <div className="new-game pitch-bg">
      <div className="new-game-inner">
        <div className="splash-kicker">Kariyere Devam</div>
        <h1 className="splash-title small">Kayıt Yükle</h1>
        <section className="panel">
          <h2 className="panel-title">Kayıtlı Oyunlar</h2>
          {error && <div className="panel-body warnings">{error}</div>}
          {saves === null && <div className="panel-body muted">Kayıtlar okunuyor…</div>}
          {saves?.length === 0 && <div className="panel-body muted">Henüz kayıtlı oyun yok.</div>}
          {saves && saves.length > 0 && (
            <table className="data-table clickable">
              <thead>
                <tr>
                  <th>Tür</th>
                  <th>Kayıt</th>
                  <th>Kulüp</th>
                  <th>Sezon</th>
                  <th>Oyun Tarihi</th>
                  <th>Kaydedildi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {saves.map((s) => {
                  const club = clubOf(s.clubId);
                  return (
                    <tr
                      key={s.id}
                      className={s.id === selected ? 'selected' : ''}
                      onClick={() => setSelected(s.id)}
                      onDoubleClick={() => void loadSave(s.id)}
                    >
                      <td>
                        <span className={`save-kind${s.isAutosave ? ' auto' : ''}`}>{s.isAutosave ? 'Otomatik' : 'Kayıt'}</span>
                      </td>
                      <td className="strong">
                        {s.name}
                        {s.liveMatch && <div className="save-live">Maç ortasında: {s.liveMatch}</div>}
                      </td>
                      <td>
                        <span className="club-cell">
                          {club && <ClubBadge club={club} size={16} />} {s.clubName}
                          {s.managerName && <span className="muted"> · {s.managerName}</span>}
                        </span>
                      </td>
                      <td>{seasonLabel(s.season)}</td>
                      <td>{formatDateShort(s.gameDate)}</td>
                      <td className="muted">{formatSavedAt(s.updatedAt)}</td>
                      <td className="right">
                        <button
                          className="btn btn-small"
                          title="Kaydı .json dosyası olarak indir (yedek ya da başka tarayıcıya taşımak için)"
                          onClick={(e) => {
                            e.stopPropagation();
                            void exportFile(s);
                          }}
                        >
                          Dışa Aktar
                        </button>{' '}
                        <button
                          className="btn btn-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(s);
                          }}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        <div className="button-row">
          <button className="btn" onClick={quitToMenu}>‹ Ana Menü</button>
          <button className="btn" onClick={() => fileInput.current?.click()} title="Dışa aktarılmış .json kaydını yeni slot olarak ekle">
            İçe Aktar
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ''; // aynı dosya yeniden seçilebilsin
              if (file) void importFile(file);
            }}
          />
          <button className="btn-continue" disabled={selected === null} onClick={() => selected !== null && void loadSave(selected)}>
            Yükle <span className="btn-continue-arrow">›</span>
          </button>
        </div>
      </div>

      {confirmDelete && (
        <Modal
          title="Kaydı Sil"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDelete(null)}>Vazgeç</button>
              <button className="btn btn-danger" onClick={() => void remove(confirmDelete)}>Sil</button>
            </>
          }
        >
          <p>
            <strong>{confirmDelete.name}</strong> kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </p>
        </Modal>
      )}
    </div>
  );
}
