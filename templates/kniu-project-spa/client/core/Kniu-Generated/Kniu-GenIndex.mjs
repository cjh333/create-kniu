export { styles, getStyles, stylesPaths } from "./Kniu-GenStyles.mjs";
export { templates, getTemplates, templatesPaths } from "./Kniu-GenTemplate.mjs";
import { styles } from "./Kniu-GenStyles.mjs";
import { templates } from "./Kniu-GenTemplate.mjs";
export function getAsset(path) { return styles[path] ?? templates[path] ?? undefined; }
export const assetPaths = Object.freeze([...Object.keys(styles), ...Object.keys(templates)]);