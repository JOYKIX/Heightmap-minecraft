export class Profiler {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.marks = new Map();
    this.timings = [];
  }

  start(label) {
    if (!this.enabled) return;
    this.marks.set(label, performance.now());
  }

  end(label) {
    if (!this.enabled) return;
    const start = this.marks.get(label);
    if (start === undefined) return;
    this.timings.push({ label, ms: performance.now() - start });
  }

  report(extra = {}) {
    if (!this.enabled) return { timings: [], ...extra };
    const memory = globalThis.performance?.memory?.usedJSHeapSize ?? null;
    return { timings: this.timings.slice(), memory, ...extra };
  }
}
