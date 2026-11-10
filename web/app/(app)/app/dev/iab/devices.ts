/** iPhone screens in points: status bar and home bar heights, screen corner radius. */
export const DEVICES = {
  "iphone-16": { width: 393, height: 852, statusBar: 59, homeBar: 34, corner: 55, island: true },
  "iphone-16-pro-max": { width: 440, height: 956, statusBar: 62, homeBar: 34, corner: 62, island: true },
  "iphone-se": { width: 375, height: 667, statusBar: 20, homeBar: 0, corner: 0, island: false },
} as const;

export type DeviceName = keyof typeof DEVICES;

export function isDeviceName(value: unknown): value is DeviceName {
  return typeof value === "string" && Object.hasOwn(DEVICES, value);
}
