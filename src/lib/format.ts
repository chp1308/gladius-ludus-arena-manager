// Shared countdown formatter: under an hour shows minutes only ("45m"),
// an hour or more shows hours and minutes ("2h 15m"). Used everywhere a
// cooldown or time-remaining value is displayed.
export function formatMinutes(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m <= 0) return "now";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function minutesUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
}
