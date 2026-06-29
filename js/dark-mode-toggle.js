/**
 * dark-mode-toggle.js
 *
 * Adds a dark mode toggle button below the nav links.
 * Persists preference in localStorage.
 * Respects prefers-color-scheme as the default when no preference is saved.
 */

const STORAGE_KEY = "msb-dark-mode";
const DARK_CLASS = "dark-mode";

function getSystemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function getSavedPreference() {
  return localStorage.getItem(STORAGE_KEY);
}
function savePreference(value) {
  localStorage.setItem(STORAGE_KEY, value);
}
function isDarkActive() {
  return document.body.classList.contains(DARK_CLASS);
}
function applyDark() {
  document.body.classList.add(DARK_CLASS);
}
function removeDark() {
  document.body.classList.remove(DARK_CLASS);
}

function applyPreference(pref) {
  if (pref === "dark") applyDark();
  else if (pref === "light") removeDark();
  else if (getSystemPrefersDark()) applyDark();
  else removeDark();
}

function getIcon() {
  return isDarkActive() ? "☀" : "☾";
}

function createToggleButton() {
  const btn = document.createElement("button");
  btn.id = "dark-mode-toggle";
  btn.setAttribute("aria-label", "Toggle dark mode");
  btn.setAttribute("title", "Toggle dark mode");
  btn.textContent = getIcon();

  btn.addEventListener("click", () => {
    if (isDarkActive()) {
      removeDark();
      savePreference("light");
    } else {
      applyDark();
      savePreference("dark");
    }
    btn.textContent = getIcon();
  });

  return btn;
}

export function initDarkModeToggle() {
  applyPreference(getSavedPreference());

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!getSavedPreference()) {
        if (e.matches) applyDark();
        else removeDark();
        const btn = document.getElementById("dark-mode-toggle");
        if (btn) btn.textContent = getIcon();
      }
    });

  const header = document.querySelector("header");
  if (!header) return;

  const row = document.createElement("div");
  row.id = "dark-mode-row";
  row.appendChild(createToggleButton());
  header.appendChild(row);
}
