import type { ScreenId } from '../store/gameStore';

export interface ScreenInfo {
  id: ScreenId;
  label: string;
  /** Ekranın gerçek içeriğinin geleceği aşama (yer tutucu metni için). */
  stage: number;
}

export interface MenuGroup {
  title: string;
  items: ScreenInfo[];
}

export const MENU: MenuGroup[] = [
  {
    title: 'Kulüp',
    items: [
      { id: 'inbox', label: 'Gelen Kutusu', stage: 9 },
      { id: 'squad', label: 'Kadro', stage: 2 },
      { id: 'dynamics', label: 'Takım Dinamikleri', stage: 10 },
      { id: 'tactics', label: 'Taktik', stage: 5 },
      { id: 'training', label: 'Antrenman', stage: 8 },
      { id: 'academy', label: 'Altyapı', stage: 10 },
      { id: 'club', label: 'Kulüp Bilgisi', stage: 2 },
      { id: 'manager', label: 'Menajer Kariyeri', stage: 10 },
      { id: 'finance', label: 'Finans', stage: 7 },
      { id: 'facilities', label: 'Tesisler', stage: 10 },
      { id: 'transfers', label: 'Transfer Merkezi', stage: 7 },
    ],
  },
  {
    title: 'Süper Lig',
    items: [
      { id: 'fixtures', label: 'Fikstür & Sonuçlar', stage: 3 },
      { id: 'table', label: 'Puan Durumu', stage: 3 },
      { id: 'stats', label: 'Lig İstatistikleri', stage: 3 },
    ],
  },
  {
    title: 'Uluslararası',
    items: [{ id: 'international', label: 'Milli Takımlar', stage: 10 }],
  },
  {
    title: 'Oyun',
    items: [{ id: 'settings', label: 'Ayarlar', stage: 11 }],
  },
];

export function screenInfo(id: ScreenId): ScreenInfo {
  for (const group of MENU) {
    const found = group.items.find((i) => i.id === id);
    if (found) return found;
  }
  throw new Error(`Bilinmeyen ekran: ${id}`);
}
