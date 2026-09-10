export type ArtFormat = "feed" | "shorts";
export const ART_FORMATS = {
  feed: {
    width: 1080,
    height: 1350,
    label: "Instagram / Threads · 1080 × 1350 (4:5)",
    suffix: "4x5",
  },
  shorts: {
    width: 1080,
    height: 1920,
    label: "YouTube / Shorts · 1080 × 1920 (9:16)",
    suffix: "shorts-9x16",
  },
} as const;
export const artFormatOptions = () =>
  Object.entries(ART_FORMATS)
    .map(([key, value]) => `<option value="${key}">${value.label}</option>`)
    .join("");
