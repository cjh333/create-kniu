let localizer = null;

export function setComponentTextLocalizer(fn) {
  localizer = typeof fn === 'function' ? fn : null;
  return localizer;
}

export function getComponentTextLocalizer() {
  return localizer;
}

export function resetComponentTextLocalizer() {
  localizer = null;
}

export function localizeMarkup(markup, lang) {
  if (!localizer) return markup;
  try {
    return localizer(markup, lang);
  } catch {
    return markup;
  }
}