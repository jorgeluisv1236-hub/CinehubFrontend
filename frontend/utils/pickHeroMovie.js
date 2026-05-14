/** Fondo de cabecera: preferir backdrop real si existe. */
export function pickHeroMovie(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const hasBackdrop = (m) => {
    const b = m?.artwork?.backdrop;
    return [b?.large, b?.medium, b?.small].some((u) => typeof u === 'string' && u.trim().length > 0);
  };
  return list.find(hasBackdrop) ?? list[0];
}
