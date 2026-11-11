/* The Tailwind v3 counterpart to `theme.css`: the same token names bound to the
   same utilities, as the JS object NativeWind's preset wants. CommonJS because
   a `tailwind.config.js` is loaded by Node outside the bundler, so it cannot
   reach a TypeScript module.

   Spread into `theme.extend.colors`. The consumer must also set
   `darkMode: "class"`, or NativeWind reads `.dark:root` in `tokens.css` as an
   ordinary class rule and never applies the dark values. */

const color = (name) => `var(--${name})`

module.exports = {
  background: color("background"),
  foreground: color("foreground"),
  card: { DEFAULT: color("card"), foreground: color("card-foreground") },
  popover: {
    DEFAULT: color("popover"),
    foreground: color("popover-foreground"),
  },
  primary: {
    DEFAULT: color("primary"),
    foreground: color("primary-foreground"),
  },
  secondary: {
    DEFAULT: color("secondary"),
    foreground: color("secondary-foreground"),
  },
  muted: { DEFAULT: color("muted"), foreground: color("muted-foreground") },
  accent: { DEFAULT: color("accent"), foreground: color("accent-foreground") },
  destructive: color("destructive"),
  success: { DEFAULT: color("success"), foreground: color("success-foreground") },
  border: color("border"),
  input: color("input"),
  ring: color("ring"),
  sidebar: {
    DEFAULT: color("sidebar"),
    foreground: color("sidebar-foreground"),
    primary: color("sidebar-primary"),
    "primary-foreground": color("sidebar-primary-foreground"),
    accent: color("sidebar-accent"),
    "accent-foreground": color("sidebar-accent-foreground"),
    border: color("sidebar-border"),
  },
}
