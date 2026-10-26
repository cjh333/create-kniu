export function auditAccessibility(root = document) {
  const issues = [];
  root.querySelectorAll('img:not([alt])').forEach((node) => issues.push({ rule: 'img-alt', node }));
  root.querySelectorAll('button:not([type])').forEach((node) => issues.push({ rule: 'button-type', node }));
  root.querySelectorAll('input,select,textarea').forEach((node) => {
    if (!node.labels?.length && !node.getAttribute('aria-label') && !node.getAttribute('aria-labelledby')) issues.push({ rule: 'form-label', node });
  });
  const headings = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  if (headings.length && !headings.some((h) => h.tagName === 'H1')) issues.push({ rule: 'missing-h1', node: headings[0] });
  headings.forEach((heading) => {
    const level = Number(heading.tagName.slice(1));
    const prev = headings.slice(0, headings.indexOf(heading)).pop();
    if (prev && level > Number(prev.tagName.slice(1)) + 1) issues.push({ rule: 'heading-skip', node: heading });
  });
  root.querySelectorAll('[role="button"],[role="tab"],[role="menuitem"]').forEach((node) => {
    const tabindex = node.getAttribute('tabindex');
    if (tabindex === null || Number(tabindex) < 0) issues.push({ rule: 'focusable-tabindex', node });
  });
  root.querySelectorAll('input[required],select[required]').forEach((node) => {
    if (!node.labels?.length && !node.getAttribute('aria-required') && !node.getAttribute('aria-label') && !node.getAttribute('aria-labelledby')) {
      issues.push({ rule: 'required-label', node });
    }
  });
  return issues;
}

export default auditAccessibility;