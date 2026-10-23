export function auditAccessibility(root = document) {
  const issues = [];
  root.querySelectorAll('img:not([alt])').forEach((node) => issues.push({ rule: 'img-alt', node }));
  root.querySelectorAll('button:not([type])').forEach((node) => issues.push({ rule: 'button-type', node }));
  root.querySelectorAll('input,select,textarea').forEach((node) => {
    if (!node.labels?.length && !node.getAttribute('aria-label') && !node.getAttribute('aria-labelledby')) issues.push({ rule: 'form-label', node });
  });
  return issues;
}

export default auditAccessibility;
