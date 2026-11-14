function applySystemTheme(): void {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = dark ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function watchSystemTheme(): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = (): void => {
    applySystemTheme();
  };
  applySystemTheme();
  media.addEventListener("change", onChange);
  return () => {
    media.removeEventListener("change", onChange);
  };
}
