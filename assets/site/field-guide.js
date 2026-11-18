for (const card of document.querySelectorAll(".partner")) {
  const stages = card.querySelector(".stages");
  stages.hidden = false;
  stages.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-name]");
    if (!button) return;
    const { name, number, element, note } = button.dataset;
    const sprite = card.querySelector(".sprite");
    sprite.src = "assets/site/" + name.toLowerCase() + ".png";
    sprite.alt = name;
    card.querySelector(".index").textContent = "№ " + number;
    card.querySelector(".element").textContent = element;
    card.querySelector("h3").textContent = name;
    card.querySelector(".partner-body p").textContent = note;
    for (const choice of stages.querySelectorAll("button")) {
      choice.setAttribute("aria-pressed", String(choice === button));
    }
  });
}
