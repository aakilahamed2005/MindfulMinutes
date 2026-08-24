const THEME_KEY = "visualMode";

function automaticMode() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}

function applyMode(mode) {
  document.documentElement.dataset.sky = mode;
  document.querySelectorAll(".sky-toggle").forEach((button) => {
    const nextMode = mode === "day" ? "night" : "day";
    button.setAttribute("aria-label", `Switch to ${nextMode} mode`);
    button.setAttribute("title", `Switch to ${nextMode} mode`);
  });
}

async function savedMode() {
  try {
    const stored = await chrome.storage.local.get({ [THEME_KEY]: "auto" });
    return stored[THEME_KEY];
  } catch {
    return "auto";
  }
}

async function storeMode(mode) {
  try { await chrome.storage.local.set({ [THEME_KEY]: mode }); } catch { /* Preview outside Chrome. */ }
}

function enablePointerLight() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let frame = 0;
  window.addEventListener("pointermove", (event) => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      document.documentElement.style.setProperty("--mouse-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${event.clientY}px`);
    });
  }, { passive: true });

  document.querySelectorAll(".interactive-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - .5;
      const y = (event.clientY - bounds.top) / bounds.height - .5;
      card.style.transform = `perspective(900px) rotateX(${y * -2.2}deg) rotateY(${x * 2.2}deg) translateY(-2px)`;
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });
}

export async function initAmbience() {
  const preference = await savedMode();
  applyMode(preference === "auto" ? automaticMode() : preference);
  document.querySelectorAll(".sky-toggle").forEach((button) => {
    button.addEventListener("click", async () => {
      const next = document.documentElement.dataset.sky === "day" ? "night" : "day";
      applyMode(next);
      await storeMode(next);
    });
  });
  enablePointerLight();
}
