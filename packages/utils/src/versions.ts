const historical: Record<string, string> = {
  "0.1.0": "AW 0.1", "0.2.0": "AW 0.2", "0.3.0": "AW 0.3",
  "0.4.0": "AW 0.4", "0.5.0": "AW 0.5", "0.6.0": "AW 0.6",
  "0.7.0": "AW 0.7", "0.7.1": "AW 0.71", "0.8.0": "AW 0.8",
  "0.8.1": "AW 0.81", "0.8.2": "AW 0.82",
}
/** Presentation only. Update comparisons must use machine SemVer. */
export function displayVersion(machine: string): string {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(machine))
    throw new Error("Invalid machine version")
  if (historical[machine]) return historical[machine]
  if (machine.startsWith("0.")) return `AW ${machine}`
  return `W ${machine.replace(/\.0$/, "")}`
}
export function releaseChannel(machine: string): "stable" | "dev" {
  return machine.includes("-") || machine.startsWith("0.") ? "dev" : "stable"
}
