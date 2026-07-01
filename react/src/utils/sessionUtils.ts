export function getSignedInUserId(): number | null {
  try {
    const keys = ['user_id', 'userId', 'USER_ID'];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const num = Number(raw);
        if (Number.isFinite(num)) return num;
      }
    }
    return null;
  } catch {
    return null;
  }
}
