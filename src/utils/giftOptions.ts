export function parseGiftOptions(value?: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((option) => String(option).trim())
      .filter((option) => option.length > 0);
  } catch {
    return value
      .split("\n")
      .map((option) => option.trim())
      .filter((option) => option.length > 0);
  }
}

export function serializeGiftOptions(options: string[]) {
  return JSON.stringify(
    options.map((option) => option.trim()).filter((option) => option.length > 0)
  );
}

export function getGiftOptionLabel(label?: string | null) {
  return label?.trim() || "Option";
}

export function formatGiftOption(label?: string | null, value?: string | null) {
  if (!value) return "";
  return `${getGiftOptionLabel(label)}: ${value}`;
}
