import { dictionary } from "./messages";

export type LanguageChoice = "system" | "ru" | "en";
export type Locale = "ru" | "en";
let choice: LanguageChoice = "system";
let observed: Locale | undefined;
const listeners = new Set<() => void>();
export function resolveLocale(
  value: LanguageChoice,
  system = typeof navigator === "undefined" ? "en" : navigator.language,
): Locale {
  return value === "system"
    ? system.toLowerCase().startsWith("ru")
      ? "ru"
      : "en"
    : value;
}
export const localeSnapshot = (): Locale => resolveLocale(choice);
export function setLanguage(value: LanguageChoice): void {
  const next = resolveLocale(value);
  if (choice === value && next === observed) return;
  choice = value;
  observed = next;
  listeners.forEach((fn) => fn());
}
export function t(
  key: string,
  values?: Record<string, string | number>,
): string {
  const message = dictionary[key]?.[localeSnapshot()] ?? key;
  return values
    ? message.replace(/\{(\w+)\}/g, (whole, name: string) =>
        String(values[name] ?? whole),
      )
    : message;
}
export function plural(
  value: number,
  forms: { ru: [string, string, string]; en: [string, string] },
): string {
  const rule = new Intl.PluralRules(localeSnapshot()).select(value);
  return localeSnapshot() === "en"
    ? forms.en[rule === "one" ? 0 : 1]
    : forms.ru[rule === "one" ? 0 : rule === "few" ? 1 : 2];
}

export function subscribeLanguage(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
