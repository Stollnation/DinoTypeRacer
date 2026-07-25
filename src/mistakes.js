export function keyLabel(char) {
  if (char === " ") return "Space";
  if (char === "\n") return "Enter";
  if (char === "\t") return "Tab";
  return char || "Unknown";
}

export function summarizeMistakes(mistakes = []) {
  const expected = new Map();
  const confusions = new Map();
  mistakes.forEach((mistake) => {
    const expectedKey = keyLabel(mistake.expected);
    const typedKey = keyLabel(mistake.typed);
    expected.set(expectedKey, (expected.get(expectedKey) || 0) + 1);
    const pair = `${expectedKey}\u0000${typedKey}`;
    confusions.set(pair, (confusions.get(pair) || 0) + 1);
  });
  const byCount = (a, b) => b.count - a.count || a.label.localeCompare(b.label);
  return {
    expected: [...expected].map(([label, count]) => ({ label, count })).sort(byCount),
    confusions: [...confusions].map(([pair, count]) => {
      const [expectedLabel, typedLabel] = pair.split("\u0000");
      return { expected: expectedLabel, typed: typedLabel, label: `${expectedLabel} → ${typedLabel}`, count };
    }).sort(byCount),
  };
}