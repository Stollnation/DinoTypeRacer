export class TypingSession {
  constructor(text, { ignoreMistakes = false } = {}) {
    this.text = text;
    this.index = 0;
    this.errorChar = "";
    this.correctKeystrokes = 0;
    this.totalKeystrokes = 0;
    this.errors = 0;
    this.startTime = null;
    this.endTime = null;
    this.samples = [];
    this.mistakes = [];
    this.ignoreMistakes = ignoreMistakes;
  }

  type(char, now = performance.now()) {
    if (this.finished || char.length !== 1) return false;
    if (this.startTime === null) this.startTime = now;
    this.totalKeystrokes += 1;
    if (this.errorChar) { this.errors += 1; this.recordMistake(char, now); this.errorChar = char; return false; }
    if (char === this.text[this.index]) {
      this.index += 1;
      this.correctKeystrokes += 1;
      this.sample(now);
      if (this.index >= this.text.length) this.endTime = now;
      return true;
    }
    this.errors += 1;
    this.recordMistake(char, now);
    if (this.ignoreMistakes) {
      this.index += 1;
      this.sample(now);
      if (this.index >= this.text.length) this.endTime = now;
      return false;
    }
    this.errorChar = char;
    return false;
  }

  recordMistake(typed, now) {
    if (this.mistakes.length >= 500) return;
    const start = Math.max(0, this.index - 18);
    const end = Math.min(this.text.length, this.index + 19);
    this.mistakes.push({
      expected: this.text[this.index] || "",
      typed,
      index: this.index,
      time: this.elapsed(now),
      context: `${start ? "..." : ""}${this.text.slice(start, this.index)}[${this.text[this.index] || ""}]${this.text.slice(this.index + 1, end)}${end < this.text.length ? "..." : ""}`,
    });
  }

  backspace() {
    if (this.errorChar) { this.errorChar = ""; return; }
    if (this.index > 0) this.index -= 1;
  }

  sample(now = performance.now()) {
    const elapsed = this.elapsed(now);
    this.samples.push({ t: elapsed, p: this.progress, chars: this.correctKeystrokes });
    if (this.samples.length > 1000) this.samples.shift();
  }

  elapsed(now = performance.now()) {
    if (this.startTime === null) return 0;
    return Math.max(0, ((this.endTime ?? now) - this.startTime) / 1000);
  }

  get progress() { return this.text.length ? this.index / this.text.length : 0; }
  get finished() { return this.index >= this.text.length; }
  get accuracy() { return this.totalKeystrokes ? this.correctKeystrokes / this.totalKeystrokes : 1; }
  wpm(now = performance.now()) { const minutes = this.elapsed(now) / 60; return minutes > 0 ? (this.correctKeystrokes / 5) / minutes : 0; }
  peakWpm() {
    if (this.samples.length < 2) return this.wpm();
    let peak = 0;
    for (let i = 0; i < this.samples.length; i += 1) {
      const end = this.samples[i];
      let start = this.samples[0];
      for (let j = i; j >= 0; j -= 1) { if (end.t - this.samples[j].t <= 5) start = this.samples[j]; else break; }
      const seconds = end.t - start.t;
      if (seconds >= 1) peak = Math.max(peak, ((end.chars - start.chars) / 5) / (seconds / 60));
    }
    return peak || this.wpm();
  }
}

export function ordinal(value) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  return `${value}${{ 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th"}`;
}
