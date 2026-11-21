export function helpSearchWords(value) {
  return String(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

export function bindHelp(screen) {
  const search = screen.querySelector("#helpSearch");
  const clear = screen.querySelector("#helpClear");
  const status = screen.querySelector("#helpSearchStatus");
  const empty = screen.querySelector("#helpEmpty");
  const sections = [...screen.querySelectorAll(".help-section")].map(section => {
    const heading = section.querySelector("h3");
    const words = helpSearchWords(heading.textContent).join(" ");
    return {
      section, heading,
      entries: [...section.querySelectorAll("[data-help-entry]")].map(element => ({
        element, haystack: words + " " + helpSearchWords(element.textContent).join(" "),
      })),
    };
  });
  const topics = new Map([...screen.querySelectorAll("[data-help-topic]")].map(button => [button.dataset.helpTopic, button]));
  let previousOpen;

  function jumpTo(heading) {
    if (!heading) return;
    heading.scrollIntoView({ block: "start", behavior: "instant" });
    heading.focus({ preventScroll: true });
  }

  function update() {
    const words = helpSearchWords(search.value);
    const isFiltering = words.length > 0;
    if (isFiltering && !previousOpen) {
      previousOpen = new Map([...screen.querySelectorAll("details")].map(element => [element, element.open]));
    }
    let count = 0;
    for (const { section, heading, entries } of sections) {
      let matches = 0;
      for (const { element, haystack } of entries) {
        const visible = !isFiltering || words.every(word => haystack.includes(word));
        element.hidden = !visible;
        if ("open" in element) {
          if (isFiltering) element.open = visible;
          else if (previousOpen) element.open = previousOpen.get(element);
        }
        matches += Number(visible);
      }
      section.hidden = matches === 0;
      topics.get(heading.id).closest("li").hidden = matches === 0;
      count += matches;
    }
    if (!isFiltering) previousOpen = undefined;
    screen.querySelector(".help-topics").hidden = count === 0;
    empty.hidden = count !== 0;
    clear.hidden = !search.value;
    status.textContent = isFiltering ? `${count} matching guide ${count === 1 ? "entry" : "entries"}` : "";
  }

  search.addEventListener("input", update);
  clear.addEventListener("click", () => {
    search.value = "";
    update();
    search.focus();
  });
  for (const { heading } of sections) topics.get(heading.id).addEventListener("click", () => jumpTo(heading));
  screen.querySelector("#helpTop").addEventListener("click", () => jumpTo(screen.querySelector("#helpTitle")));
}
