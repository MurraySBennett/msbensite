/**
 * dark-mode-toggle.js
 *
 * Adds a dark mode toggle button to the header, beside the nav links.
 * Persists preference in localStorage.
 * Respects prefers-color-scheme as the default when no preference is saved.
 */

const STORAGE_KEY = "msb-dark-mode";
const DARK_CLASS = "dark-mode";
const LIGHT_CLASS = "light-mode";

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
// light-mode switches off the prefers-color-scheme rules in style.css, so a
// manual choice of light wins even when the system prefers dark.
function applyDark() {
  document.body.classList.add(DARK_CLASS);
  document.body.classList.remove(LIGHT_CLASS);
}
function removeDark() {
  document.body.classList.remove(DARK_CLASS);
  document.body.classList.add(LIGHT_CLASS);
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
function getLabel() {
  return isDarkActive() ? "Switch to light mode" : "Switch to dark mode";
}
function updateButton(btn) {
  btn.textContent = getIcon();
  btn.setAttribute("aria-label", getLabel());
  btn.setAttribute("title", getLabel());
}

function createToggleButton() {
  const btn = document.createElement("button");
  btn.id = "dark-mode-toggle";
  btn.type = "button";
  updateButton(btn);

  btn.addEventListener("click", () => {
    if (isDarkActive()) {
      removeDark();
      savePreference("light");
    } else {
      applyDark();
      savePreference("dark");
    }
    updateButton(btn);
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
        if (btn) updateButton(btn);
      }
    });

  const header = document.querySelector("header");
  if (!header) return;

  const row = document.createElement("div");
  row.id = "dark-mode-row";
  row.appendChild(createToggleButton());
  header.appendChild(row);
}
