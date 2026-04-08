const KST_TIME_ZONE = 'Asia/Seoul';

export function getKstDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: KST_TIME_ZONE }).format(date);
}

export function shiftKstDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;

  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return getKstDateString(shifted);
}
