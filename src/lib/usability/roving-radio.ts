/** Arrow-key movement for a radiogroup of buttons. Returns null when the key is unrelated. */
export function nextRadioIndex(current: number, length: number, key: string): number | null {
  if (length <= 0 || current < 0 || current >= length) return null;
  if (key === "ArrowRight" || key === "ArrowDown") return (current + 1) % length;
  if (key === "ArrowLeft" || key === "ArrowUp") return (current - 1 + length) % length;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return null;
}

export function nextEnabledRadioIndex(
  current: number,
  disabled: readonly boolean[],
  key: string,
): number | null {
  const length = disabled.length;
  const first = nextRadioIndex(current, length, key);
  if (first === null) return null;
  if (key === "Home" || key === "End") {
    const direction = key === "Home" ? 1 : -1;
    for (let step = 0; step < length; step += 1) {
      const index = (first + direction * step + length) % length;
      if (!disabled[index]) return index;
    }
    return null;
  }
  let index = first;
  for (let step = 0; step < length; step += 1) {
    if (!disabled[index]) return index;
    index = nextRadioIndex(index, length, key === "ArrowLeft" || key === "ArrowUp" ? "ArrowLeft" : "ArrowRight") ?? index;
  }
  return null;
}
