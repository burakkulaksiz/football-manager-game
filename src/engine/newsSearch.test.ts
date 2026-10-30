import { describe, expect, it } from 'vitest';
import { searchNews } from './news';

describe('haber arama', () => {
  const items = [
    { title: 'İcardi Galatasaray yolunda', body: 'Bonservis: €10 Mn.' },
    { title: 'Yönetimden uyarı', body: 'Takım ISPARTA deplasmanında kaybetti.' },
    { title: 'Kiralık tamamlandı', body: 'Oyuncu sezon sonuna kadar kiralandı.' },
  ];

  it('boş arama hepsini döndürür', () => {
    expect(searchNews(items, '  ')).toHaveLength(3);
  });

  it('Türkçe büyük/küçük harf duyarsız; başlık ve metinde; her kelime geçmeli', () => {
    expect(searchNews(items, 'icardi')).toEqual([items[0]]);
    expect(searchNews(items, 'ısparta')).toEqual([items[1]]);
    expect(searchNews(items, 'kiralık sezon')).toEqual([items[2]]);
    expect(searchNews(items, 'kiralık galatasaray')).toEqual([]);
  });
});
