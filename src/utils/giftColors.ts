export type GiftColorOption = {
  id: string;
  name: string;
  hex: string;
  isDefault: boolean;
  imageIds: string[];
};

function fallbackColorId(index: number) {
  return `color-${index + 1}`;
}

export function createGiftColorOption(
  overrides: Partial<GiftColorOption> = {}
): GiftColorOption {
  return {
    id: overrides.id || crypto.randomUUID(),
    name: overrides.name || "",
    hex: normalizeHexColor(overrides.hex || "#ffffff"),
    isDefault: overrides.isDefault ?? false,
    imageIds: overrides.imageIds || [],
  };
}

export function normalizeHexColor(value?: string | null) {
  const color = (value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffffff";
}

export function parseGiftColors(value?: string | null): GiftColorOption[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((color, index) => ({
        id: String(color.id || fallbackColorId(index)),
        name: String(color.name || "").trim(),
        hex: normalizeHexColor(color.hex),
        isDefault: Boolean(color.isDefault),
        imageIds: Array.isArray(color.imageIds)
          ? color.imageIds.map((id: unknown) => String(id)).filter(Boolean)
          : [],
      }))
      .filter((color) => color.name.length > 0);
  } catch {
    return [];
  }
}

export function normalizeGiftColors(colors: GiftColorOption[]) {
  const cleaned = colors
    .map((color) => ({
      ...color,
      id: color.id || crypto.randomUUID(),
      name: color.name.trim(),
      hex: normalizeHexColor(color.hex),
      imageIds: color.imageIds.filter(Boolean),
    }))
    .filter((color) => color.name.length > 0);

  if (cleaned.length === 0) return [];

  const defaultIndex = cleaned.findIndex((color) => color.isDefault);

  return cleaned.map((color, index) => ({
    ...color,
    isDefault: defaultIndex === -1 ? index === 0 : index === defaultIndex,
  }));
}

export function serializeGiftColors(colors: GiftColorOption[]) {
  return JSON.stringify(normalizeGiftColors(colors));
}

export function getDefaultGiftColor(colors: GiftColorOption[]) {
  return colors.find((color) => color.isDefault) || colors[0] || null;
}

export function formatGiftColor(name?: string | null) {
  return name ? `Color: ${name}` : "";
}
