export function hashStringToSeed(input = "default") {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seedValue = "default") {
  let state = typeof seedValue === "string" ? hashStringToSeed(seedValue) : seedValue >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}

export function randRange(rng, min, max) {
  return min + (max - min) * rng();
}
