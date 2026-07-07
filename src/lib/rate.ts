export function canSubmit(lastSubmitMs: number | null, nowMs: number, cooldownMs: number = 1500): boolean {
  return lastSubmitMs === null || nowMs - lastSubmitMs >= cooldownMs;
}
