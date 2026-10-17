/** Haberler: transfer, teklif, finans olayları. 9. aşamada gelen kutusunun temeli olacak. */
import type { GameWorld, NewsItem } from './types';

/** Saklanan en fazla haber sayısı (eskiler silinir). */
export const NEWS_LIMIT = 400;

export function addNews(world: GameWorld, item: Omit<NewsItem, 'id' | 'date' | 'read'>): NewsItem {
  const news: NewsItem = { ...item, id: world.nextNewsId++, date: world.date, read: false };
  world.news.push(news);
  if (world.news.length > NEWS_LIMIT) world.news.splice(0, world.news.length - NEWS_LIMIT);
  return news;
}

/** Gelen kutusu: kullanıcıyı ilgilendiren haberler (önemliler ve kulübümüzle ilgili olanlar), en yeni önce. */
export function inboxItems(world: GameWorld): NewsItem[] {
  return world.news.filter((n) => n.important || n.clubId === world.playerClubId).reverse();
}

export function unreadCount(world: GameWorld): number {
  return world.news.filter((n) => !n.read && (n.important || n.clubId === world.playerClubId)).length;
}
