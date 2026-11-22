import { TypingSession } from "./typing.js";

export const CHALLENGE_SECONDS = 60;
export const CHALLENGE_PASSAGE = {
  id: "challenge-missing-biscuit-v1",
  title: "The Case of the Missing Biscuit",
  source: "An original Holmes-inspired mystery",
  text: [
    'At half past seven, a woman in a green coat burst into Baker Street and announced that her biscuit had been stolen. Holmes asked whether it was buttered. She said it was not. Then, he said, we may proceed without the fire brigade. I had known him to be brisk with nervous visitors, but this was the first time I had seen him rule out a public emergency on the strength of a dry biscuit.',
    'Our visitor ran the Goose and Lantern, a tea shop distinguished by excellent jam and a floor that sloped toward the till. Every morning she put a single biscuit on a blue plate in the front window. Every morning at precisely seven, it vanished. She had blamed a delivery boy, a pigeon, and the man who sold umbrellas across the road. The man had been in Brighton for a week, which she considered a suspiciously elaborate alibi.',
    "Holmes examined the plate and found a narrow band of flour across its rim. There was flour on Mrs. Patterson's sleeves, flour on the windowsill, and a surprising amount of flour on my left shoe. I remarked that surely the thief was a baker. Holmes asked me whether I had stepped on the windowsill. I said I had not. Excellent, he replied. We have reduced our suspects by one and our supply of useful observations by two.",
    'The following morning we waited behind a curtain. A clock struck seven. The plate tilted, the biscuit slid quietly through a crack in the window frame, and a small copper bell rang outside. In the alley, a retired racing pigeon caught the biscuit, dropped it into a flowerpot, and looked around with the air of a gentleman waiting for his carriage. Across the road, a baker opened his back door and exchanged the biscuit for a piece of toast.',
    'The baker explained that he had trained the pigeon to ring the bell whenever the shop opened. The bird had since discovered that the bell worked twice as well when attached to a robbery. Mrs. Patterson considered the matter for a moment, then put up a sign announcing a daily performance at seven. By Friday she had doubled her breakfast trade. The pigeon received a small pension in toast, and Holmes complimented it on being the first criminal of his acquaintance to insist on a fair exchange.',
    'On the way home I asked how he had known there was no danger. Elementary, Watson, he said. The plate was blue, the window was cracked, and Mrs. Patterson had left a spare biscuit on the mantelpiece. I asked what the spare had to do with anything. Nothing whatsoever, he replied, handing me half of it. But it was rather good with tea.',
  ].join(" "),
};

export class TimedChallenge extends TypingSession {
  constructor(mode = "strict") { super(CHALLENGE_PASSAGE.text, { ignoreMistakes: mode === "flow" }); }

  remaining(now) {
    return this.startTime === null ? CHALLENGE_SECONDS : Math.max(0, Math.min(CHALLENGE_SECONDS, CHALLENGE_SECONDS - (now - this.startTime) / 1000));
  }

  type(char, now = performance.now()) {
    return this.remaining(now) > 0 && super.type(char, now);
  }

  get scoreWpm() { return (this.correctKeystrokes / 5) / (CHALLENGE_SECONDS / 60); }

  get trackProgress() {
    // One-minute track distance is separate from the much longer typing passage.
    const chars = this.correctKeystrokes;
    return chars <= 350 ? chars / 500 : 0.7 + 0.299 * (1 - Math.exp(-(chars - 350) / 210));
  }
}
