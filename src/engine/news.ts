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
