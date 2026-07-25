export function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "passage";
}

export function validatePassage(passage) {
  const title = String(passage?.title || "").trim();
  const text = normalizeText(passage?.text);
  const category = String(passage?.category || "General").trim() || "General";
  if (!title) throw new Error("Give this passage a name.");
  if (text.length < 30) throw new Error("Passages need at least 30 characters.");
  if (text.length > 5000) throw new Error("Passages cannot exceed 5,000 characters.");
  const source = String(passage?.source || "").trim();
  return { id: passage.id || `${category === "Biblical Passages" ? "bible-" : ""}${slugify(title)}`, title, text, category, source, enabled: passage.enabled !== false };
}

export function exportPassages(passages) {
  const categories = new Map();
  passages.forEach((passage) => {
    const category = passage.category || "General";
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(passage);
  });
  const sections = [...categories].map(([category, items]) => {
    const blocks = items.map((item) => [
      `@id: ${item.id}`,
      item.source ? `@source: ${item.source}` : "",
      item.enabled === false ? "@disabled" : "",
      item.title,
      item.text,
    ].filter(Boolean).join("\n"));
    return `[${category}]\n\n${blocks.join("\n\n")}`;
  });
  return `# Dino Type Racer Passage Library\n# Each passage is a title followed by its text. Sections appear in square brackets.\n\n${sections.join("\n\n")}\n`;
}

export function importPassages(source) {
  const rawLines = String(source ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const usefulLines = rawLines.map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  const hasStructuredSections = usefulLines.some((line) => /^\[[^\]]+\]$/.test(line));
  const hasMetadata = usefulLines.some((line) => line.startsWith("@id:") || line.startsWith("@source:") || line === "@disabled");
  if (!hasStructuredSections && !hasMetadata && usefulLines.length >= 2) return importLinePassages(usefulLines);

  const passages = [];
  const seenIds = new Set();
  let category = "General";
  let block = [];
  const flush = () => {
    if (!block.length) return;
    let id = "";
    let enabled = true;
    let source = "";
    const content = block.filter((line) => {
      if (line.startsWith("@id:")) { id = line.slice(4).trim(); return false; }
      if (line.startsWith("@source:")) { source = line.slice(8).trim(); return false; }
      if (line === "@disabled") { enabled = false; return false; }
      return true;
    });
    block = [];
    if (content.length < 2) throw new Error("Each passage needs a title and text.");
    const title = content.shift();
    const baseId = id || `${category === "Biblical Passages" ? "bible-" : ""}${slugify(title)}`;
    let uniqueId = baseId;
    let suffix = 2;
    while (seenIds.has(uniqueId)) uniqueId = `${baseId}-${suffix++}`;
    seenIds.add(uniqueId);
    passages.push(validatePassage({ id: uniqueId, title, text: content.join(" "), category, source, enabled }));
  };
  rawLines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) { flush(); return; }
    if (line.startsWith("#")) return;
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) { flush(); category = heading[1].trim() || "General"; return; }
    block.push(line);
  });
  flush();
  if (!passages.length) throw new Error("The text file does not contain any passages.");
  return passages;
}

function importLinePassages(lines) {
  const category = lines[0] || "Imported Passages";
  return lines.slice(1).map((line, index) => validatePassage({
    id: `${slugify(category)}-${String(index + 1).padStart(2, "0")}`,
    title: `${category} ${index + 1}`,
    text: line,
    category,
    source: category,
    enabled: true,
  }));
}
export function choosePassage(passages, preferredId) {
  const enabled = passages.filter((item) => item.enabled);
  return enabled.find((item) => item.id === preferredId) || enabled[0] || passages[0] || null;
}
