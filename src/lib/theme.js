const THEME_KEY = "ns_theme";

export function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

export function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
}

export function setStoredTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function toggleTheme() {
  const next = getStoredTheme() === "dark" ? "light" : "dark";
  setStoredTheme(next);
  return next;
}

export function initTheme() {
  applyTheme(getStoredTheme());
}
