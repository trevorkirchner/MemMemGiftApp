export type GiftOptionChoice = {
  label: string;
  pointCost?: number | null;
};

export function parseGiftOptions(value?: string | null) {
  return parseGiftOptionChoices(value).map((option) => option.label);
}

export function parseGiftOptionChoices(value?: string | null): GiftOptionChoice[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((option) => {
        if (typeof option === "object" && option !== null) {
          const pointCost = Number(option.pointCost);

          return {
            label: String(option.label ?? option.value ?? "").trim(),
            pointCost: Number.isNaN(pointCost) ? null : pointCost,
          };
        }

        return {
          label: String(option).trim(),
          pointCost: null,
        };
      })
      .filter((option) => option.label.length > 0);
  } catch {
    return value
      .split("\n")
      .map((option) => ({
        label: option.trim(),
        pointCost: null,
      }))
      .filter((option) => option.label.length > 0);
  }
}

export function serializeGiftOptions(options: Array<string | GiftOptionChoice>) {
  return JSON.stringify(
    options
      .map((option) => {
        if (typeof option === "string") {
          return {
            label: option.trim(),
            pointCost: null,
          };
        }

        return {
          label: option.label.trim(),
          pointCost:
            typeof option.pointCost === "number" && !Number.isNaN(option.pointCost)
              ? option.pointCost
              : null,
        };
      })
      .filter((option) => option.label.length > 0)
  );
}

export function getGiftOptionLabel(label?: string | null) {
  return label?.trim() || "Option";
}

export function formatGiftOption(label?: string | null, value?: string | null) {
  if (!value) return "";
  return `${getGiftOptionLabel(label)}: ${value}`;
}

export function getGiftOptionPointCost(
  options: GiftOptionChoice[],
  selectedOption?: string | null,
  fallbackPointCost = 0
) {
  const option = options.find((choice) => choice.label === selectedOption);

  return typeof option?.pointCost === "number"
    ? option.pointCost
    : fallbackPointCost;
}
