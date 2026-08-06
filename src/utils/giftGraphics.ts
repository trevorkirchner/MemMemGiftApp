export type GiftGraphicOption = {
  id: string;
  name: string;
  imageKey: string;
  imageUrl: string;
  isDefault: boolean;
};

function fallbackGraphicId(index: number) {
  return `graphic-${index + 1}`;
}

export function createGiftGraphicOption(
  overrides: Partial<GiftGraphicOption> = {}
): GiftGraphicOption {
  return {
    id: overrides.id || crypto.randomUUID(),
    name: overrides.name || "",
    imageKey: overrides.imageKey || "",
    imageUrl: overrides.imageUrl || "",
    isDefault: overrides.isDefault ?? false,
  };
}

export function parseGiftGraphics(value?: string | null): GiftGraphicOption[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((graphic, index) => ({
        id: String(graphic.id || fallbackGraphicId(index)),
        name: String(graphic.name || "").trim(),
        imageKey: String(graphic.imageKey || ""),
        imageUrl: String(graphic.imageUrl || ""),
        isDefault: Boolean(graphic.isDefault),
      }))
      .filter((graphic) => graphic.name.length > 0);
  } catch {
    return [];
  }
}

export function normalizeGiftGraphics(graphics: GiftGraphicOption[]) {
  const cleaned = graphics
    .map((graphic) => ({
      ...graphic,
      id: graphic.id || crypto.randomUUID(),
      name: graphic.name.trim(),
      imageKey: graphic.imageKey || "",
      imageUrl: graphic.imageUrl || "",
    }))
    .filter((graphic) => graphic.name.length > 0);

  if (cleaned.length === 0) return [];

  const defaultIndex = cleaned.findIndex((graphic) => graphic.isDefault);

  return cleaned.map((graphic, index) => ({
    ...graphic,
    isDefault: defaultIndex === -1 ? index === 0 : index === defaultIndex,
  }));
}

export function serializeGiftGraphics(graphics: GiftGraphicOption[]) {
  return JSON.stringify(normalizeGiftGraphics(graphics));
}

export function getDefaultGiftGraphic(graphics: GiftGraphicOption[]) {
  return graphics.find((graphic) => graphic.isDefault) || graphics[0] || null;
}

export function formatGiftGraphic(name?: string | null) {
  return name ? `Graphic: ${name}` : "";
}
