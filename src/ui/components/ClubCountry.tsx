import type { Club } from '../../engine';
import { nationName } from '../labels';

/** Yurtdışı kulübünün ülkesi (kulüp adının yanında küçük etiket); Türk kulübünde hiçbir şey. */
export function ClubCountry({ club }: { club: Club }) {
  if (!club.country) return null;
  return <span className="tag tag-country" title={nationName(club.country)}>{club.country}</span>;
}
