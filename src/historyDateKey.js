/**
 * Single definition of "calendar day" for pricing history deduplication (CI script + app).
 * Snapshots use ISO instants from getToday12AMIST(); this normalizes any parseable date
 * so string-prefix compares stay consistent (avoids duplicate IST days if one row used date-only "YYYY-MM-DD").
 */
export function getHistoryDateMergeKey(date) {
  if (date == null || date === '') return '';
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch (_) {
    return '';
  }
}
