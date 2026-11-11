import { useMemo, useSyncExternalStore } from "react";
import { dictionary } from "./messages";
import {
  localeSnapshot,
  subscribeLanguage,
  type Locale,
  type t,
} from "./locale";
export * from "./locale";
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLanguage, localeSnapshot);
}
export function useT(): typeof t {
  const locale = useLocale();
  return useMemo(
    () => (key: string, values?: Record<string, string | number>) => {
      const message = dictionary[key]?.[locale] ?? key;
      return values
        ? message.replace(/\{(\w+)\}/g, (whole, name: string) =>
            String(values[name] ?? whole),
          )
        : message;
    },
    [locale],
  );
}
