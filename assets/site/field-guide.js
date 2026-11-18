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

const journalLinks = [...document.querySelectorAll(".tabstrip a")];
const gyms = [...document.querySelectorAll(".case a")];
const pages = [...document.querySelectorAll(".page")];
const familyPicker = document.querySelector(".picker");
const families = [...document.querySelectorAll(".partner")];

function chooseFamily(index) {
  families.forEach((panel, i) => {
    panel.hidden = i !== index;
    familyPicker.children[i].setAttribute("aria-pressed", String(i === index));
  });
}

function openPage(scroll = false) {
  const target = document.getElementById(location.hash.slice(1));
  const page = target?.closest(".page") || pages[0];
  const gym = target?.closest(".leader") || document.querySelector(".leader");
  pages.forEach((panel) => {
    panel.hidden = panel !== page;
  });
  journalLinks.forEach((link) => {
    const active = link.hash === "#" + page.id;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  gyms.forEach((link) => {
    const detail = document.getElementById(link.hash.slice(1));
    detail.hidden = detail !== gym;
    link.classList.toggle("chosen", detail === gym);
    if (detail === gym) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
  if (scroll && target)
    document
      .querySelector(".tabs")
      .scrollIntoView({ behavior: "instant", block: "start" });
}

familyPicker.hidden = false;
chooseFamily(0);
familyPicker.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-family]");
  if (button) chooseFamily(Number(button.dataset.family));
});
// Keep the register in view while paging. Native fragment links still work without script.
for (const link of [...journalLinks, ...gyms]) {
  link.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, "", link.hash);
    openPage();
  });
}
openPage(Boolean(location.hash));
window.addEventListener("hashchange", () => openPage(true));
