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
const familyPicker = document.querySelector(".picker");
const families = [...document.querySelectorAll(".partner")];

function chooseFamily(index) {
  families.forEach((panel, i) => {
    panel.hidden = i !== index;
    familyPicker.children[i].setAttribute("aria-pressed", String(i === index));
  });
}

function selectBadge(target) {
  const gym = target?.closest(".leader") || document.querySelector(".leader");
  gyms.forEach((link) => {
    const detail = document.getElementById(link.hash.slice(1));
    detail.hidden = detail !== gym;
    link.classList.toggle("chosen", detail === gym);
    if (detail === gym) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}

familyPicker.hidden = false;
chooseFamily(0);
familyPicker.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-family]");
  if (button) chooseFamily(Number(button.dataset.family));
});
// Badge details stay inside their case. The main navigation uses ordinary section anchors.
for (const link of gyms) {
  link.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, "", link.hash);
    selectBadge(document.querySelector(link.hash));
  });
}
function restoreBadge() {
  const target = document.getElementById(location.hash.slice(1));
  if (target?.classList.contains("leader")) selectBadge(target);
}
selectBadge(document.getElementById(location.hash.slice(1)));
window.addEventListener("hashchange", restoreBadge);

const sections = journalLinks.map((link) => document.querySelector(link.hash));
function showReadingPosition() {
  const threshold = Math.min(190, innerHeight * 0.3);
  const section =
    sections
      .filter((section) => section.getBoundingClientRect().top <= threshold)
      .at(-1) || sections[0];
  journalLinks.forEach((link) => {
    const active = link.hash === "#" + section.id;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}
let scheduled = false;
addEventListener(
  "scroll",
  () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        showReadingPosition();
      });
    }
  },
  { passive: true },
);
showReadingPosition();

document.querySelector("#start-console").addEventListener("click", (event) => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const game = document.createElement("iframe");
  game.title = "Play Wildlight: The Asterra League";
  game.allowFullscreen = true;
  game.src = event.currentTarget.href;
  game.addEventListener("load", () => {
    const guideLink = document.getElementById("return-guide");
    guideLink.hidden = false;
    if (game.contentDocument) {
      guideLink.textContent = "Return to controls (Shift + Esc)";
      game.contentWindow.addEventListener("keydown", (key) => {
        if (!key.shiftKey || key.key !== "Escape") return;
        key.preventDefault();
        key.stopImmediatePropagation();
        guideLink.click();
        document.getElementById("guide").focus();
      }, true);
    }
    game.focus();
  }, { once: true });
  document.querySelector(".cabinet").replaceChildren(game);
});
