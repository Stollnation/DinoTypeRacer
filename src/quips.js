export const WINNER_QUIPS = [
  "You came, you typed, you conquered!",
  "That victory was dino-mite!",
  "A roaring good finish!",
  "You made extinction look slow!",
  "No bones about it—you crushed that race!",
  "Your keyboard just earned its racing stripes!",
  "Tyrannosaurus Wrecked the competition!",
  "That pace belongs in the fossil record!",
  "You put the sprint in spell-check!",
  "A first-place finish, letter perfect!",
  "You typed circles around the herd!",
  "The keys never saur you coming!",
  "Prehistoric pace, future-perfect typing!",
  "You left the competition in the dust age!",
  "That was one velocirapturous victory!",
  "Fast fingers, fierce finish!",
  "You found the write route to victory!",
  "The crown fits—no typo there!",
  "You shifted into first and never looked back!",
  "A capital performance from start to period!",
  "You spaced perfectly and raced perfectly!",
  "The track has a new type champion!",
  "Your WPM just went full roar!",
  "You made every character count!",
  "That finish deserves an exclamation point!",
  "You were key to that victory!",
  "The competition got spellbound!",
  "You took first without missing a beat—or key!",
  "A bronto-sized win!",
  "Your typing had serious byte!",
  "You turned home row into victory lane!",
  "The fastest claws on the keyboard win again!",
  "You passed the field with flying typefaces!",
  "That race was yours from A to Z!",
  "You are officially top of the food chain!",
  "A clean getaway at keyboard speed!",
];

export const FINISH_QUIPS = [
  "You kept your claws on the keys!",
  "A solid run—time to fossilize those mistakes!",
  "You are one race closer to a roaring comeback!",
  "Keep typing—the next finish is yours to spell!",
  "No need to go extinct; retry and evolve!",
  "That run had plenty of byte!",
  "You stayed on track from start to period!",
  "Good form—now sharpen those keyboard claws!",
  "Every keystroke adds to your next victory!",
  "The herd is quick, but you are adapting!",
  "Strong finish—your rematch is already hatching!",
  "You have the write stuff for the next race!",
];

function hash(value) {
  return [...String(value)].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
}

export function resultQuip(result) {
  const choices = result.place === 1 ? WINNER_QUIPS : FINISH_QUIPS;
  return choices[hash(`${result.id}|${result.passageId}|${result.place}`) % choices.length];
}
