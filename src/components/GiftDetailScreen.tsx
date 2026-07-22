import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getGiftImageUrl } from "../utils/giftImageStorage";
import { getDefaultGiftColor, parseGiftColors } from "../utils/giftColors";
import { getGiftOptionLabel, parseGiftOptions } from "../utils/giftOptions";

const client = generateClient<Schema>();

type GiftItem = Schema["GiftItem"]["type"];
type GiftImage = Schema["GiftImage"]["type"];

type GiftDetailScreenProps = {
  gift: GiftItem;
  quantityInCart: number;
  remainingPoints: number;
  allowOverPoints: boolean;
  onBack: () => void;
  onAddToCart: (gift: GiftItem, selectedOption?: string, selectedColorId?: string) => void;
};

export default function GiftDetailScreen({
  gift,
  quantityInCart,
  remainingPoints,
  allowOverPoints,
  onBack,
  onAddToCart,
}: GiftDetailScreenProps) {
  const [detailGift, setDetailGift] = useState(gift);
  const [giftImages, setGiftImages] = useState<GiftImage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const giftOptions = parseGiftOptions(detailGift.optionValues);
  const giftColors = parseGiftColors(detailGift.colorOptions);
  const [selectedOption, setSelectedOption] = useState(giftOptions[0] ?? "");
  const [selectedColorId, setSelectedColorId] = useState(
    getDefaultGiftColor(giftColors)?.id ?? ""
  );
  const selectedColor =
    giftColors.find((color) => color.id === selectedColorId) ||
    getDefaultGiftColor(giftColors);

  const sortedImages = useMemo(() => {
    const orderedImages = [...giftImages].sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
    });

    if (!selectedColor) return orderedImages;

    const colorImages = orderedImages.filter(
      (image) =>
        image.colorOptionId === selectedColor.id ||
        selectedColor.imageIds.includes(image.id)
    );

    return colorImages.length > 0 ? colorImages : orderedImages;
  }, [giftImages, selectedColor]);

  const activeImage = sortedImages[selectedImageIndex];
  const activeImageUrl = activeImage ? imageUrls[activeImage.id] : detailGift.imageUrl;

  const cannotAfford = !allowOverPoints && (detailGift.pointCost ?? 0) > remainingPoints;
  const requiresOption = giftOptions.length > 0;
  const requiresColor = giftColors.length > 0;
  const missingRequiredSelection =
    (requiresOption && !selectedOption) || (requiresColor && !selectedColor);

  useEffect(() => {
    setDetailGift(gift);
    loadGiftDetails();
    loadImages();
  }, [gift.id]);

  useEffect(() => {
    const nextOptions = parseGiftOptions(detailGift.optionValues);
    const nextColors = parseGiftColors(detailGift.colorOptions);

    setSelectedOption(nextOptions[0] ?? "");
    setSelectedColorId(getDefaultGiftColor(nextColors)?.id ?? "");
  }, [detailGift.id, detailGift.optionValues, detailGift.colorOptions]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [selectedColorId]);

  async function loadImages() {
    try {
      setIsLoadingImages(true);

      const result = await client.models.GiftImage.list({
        filter: {
          giftItemId: {
            eq: gift.id,
          },
        },
      });

      setGiftImages(result.data);

      const entries = await Promise.all(
        result.data.map(async (image) => {
          const url = await getGiftImageUrl(image.imageKey);
          return [image.id, url] as const;
        })
      );

      setImageUrls(Object.fromEntries(entries));
      setSelectedImageIndex(0);
    } catch (error) {
      console.error("Gift detail image load error:", error);
    } finally {
      setIsLoadingImages(false);
    }
  }

  async function loadGiftDetails() {
    try {
      const result = await client.models.GiftItem.get({ id: gift.id });

      if (result.data) {
        setDetailGift(result.data);
      } else {
        setDetailGift(gift);
      }
    } catch (error) {
      console.error("Gift detail load error:", error);
      setDetailGift(gift);
    }
  }

  function goPreviousImage() {
    setSelectedImageIndex((current) =>
      current === 0 ? Math.max(sortedImages.length - 1, 0) : current - 1
    );
  }

  function goNextImage() {
    setSelectedImageIndex((current) =>
      current >= sortedImages.length - 1 ? 0 : current + 1
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.container}>
        <button type="button" onClick={onBack} style={styles.backButton}>
          ← Back to Gifts
        </button>

        <section style={styles.detailGrid}>
          <div style={styles.galleryCard}>
            <div style={styles.mainImageWrapper}>
              {activeImageUrl ? (
                <img src={activeImageUrl} alt={detailGift.title} style={styles.mainImage} />
              ) : (
                <div style={styles.placeholderImage}>
                  {isLoadingImages ? "Loading images..." : "No Image"}
                </div>
              )}

              {sortedImages.length > 1 && (
                <>
                  <button type="button" onClick={goPreviousImage} style={styles.galleryLeft}>
                    <span style={styles.arrowIconRight}>‹</span>
                  </button>

                  <button type="button" onClick={goNextImage} style={styles.galleryRight}>
                    <span style={styles.arrowIconLeft}>›</span>
                  </button>
                </>
              )}
            </div>

            {sortedImages.length > 1 && (
              <div style={styles.thumbnailRow}>
                {sortedImages.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    style={{
                      ...styles.thumbnailButton,
                      ...(index === selectedImageIndex ? styles.activeThumbnail : {}),
                    }}
                  >
                    <img
                      src={imageUrls[image.id]}
                      alt={image.altText || detailGift.title}
                      style={styles.thumbnailImage}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside style={styles.infoCard}>
            <p style={styles.pointBadge}>{detailGift.pointCost} points</p>

            <h1 style={styles.title}>{detailGift.title}</h1>

            <p style={styles.description}>
              {detailGift.description || "No description available."}
            </p>

            {quantityInCart > 0 && (
              <p style={styles.inCart}>Currently in cart: {quantityInCart}</p>
            )}

            {giftOptions.length > 0 && (
              <div style={styles.optionBox}>
                <label htmlFor="gift-option" style={styles.optionLabel}>
                  Choose {getGiftOptionLabel(detailGift.optionLabel)}
                </label>
                <select
                  id="gift-option"
                  value={selectedOption}
                  onChange={(event) => setSelectedOption(event.target.value)}
                  style={styles.optionSelect}
                >
                  {giftOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {giftColors.length > 0 && (
              <div style={styles.optionBox}>
                <span style={styles.optionLabel}>Choose Color</span>
                <div style={styles.colorGrid}>
                  {giftColors.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setSelectedColorId(color.id)}
                      style={{
                        ...styles.colorOption,
                        ...(selectedColor?.id === color.id ? styles.selectedColorOption : {}),
                      }}
                    >
                      <span
                        style={{
                          ...styles.colorSwatch,
                          backgroundColor: color.hex,
                        }}
                      />
                      <span>{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => onAddToCart(detailGift, selectedOption, selectedColor?.id ?? "")}
              disabled={cannotAfford || missingRequiredSelection}
              style={{
                ...styles.addButton,
                ...(cannotAfford || missingRequiredSelection ? styles.disabledButton : {}),
              }}
            >
              {cannotAfford
                ? "Not Enough Points"
                : missingRequiredSelection
                  ? "Choose Options"
                  : "Add to Cart"}
            </button>

            <p style={styles.muted}>Remaining Points: {remainingPoints}</p>
          </aside>
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #eef5f0 0%, #f8faf9 45%, #e7efe9 100%)",
    padding: "clamp(16px, 4vw, 32px)",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: "1180px",
    margin: "0 auto",
  },
  backButton: {
    border: "none",
    background: "transparent",
    color: "var(--tg-primary)",
    fontWeight: 800,
    cursor: "pointer",
    padding: 0,
    marginBottom: "20px",
    fontSize: "15px",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
    gap: "clamp(18px, 4vw, 28px)",
    alignItems: "start",
  },
  galleryCard: {
    backgroundColor: "#ffffff",
    borderRadius: "clamp(18px, 5vw, 24px)",
    border: "1px solid #dce8e1",
    boxShadow: "0 14px 40px rgba(0,0,0,0.1)",
    padding: "clamp(14px, 4vw, 22px)",
    boxSizing: "border-box",
  },
  mainImageWrapper: {
    position: "relative",
    height: "clamp(280px, 70vw, 520px)",
    borderRadius: "clamp(14px, 4vw, 18px)",
    overflow: "hidden",
    backgroundColor: "#edf3ef",
  },
  mainImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    backgroundColor: "#edf3ef",
  },
  placeholderImage: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#5f6f68",
    fontWeight: 800,
  },
  galleryLeft: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    borderRadius: "999px",
    width: "42px",
    height: "42px",
    backgroundColor: "rgba(18,60,44,0.85)",
    color: "#ffffff",
    fontSize: "30px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 10,
    padding: 0,
    },
  galleryRight: {
    position: "absolute",
    right: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    borderRadius: "999px",
    width: "42px",
    height: "42px",
    backgroundColor: "rgba(18,60,44,0.85)",
    color: "#ffffff",
    fontSize: "30px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    padding: 0,
    },
arrowIconRight: {
  display: "block",
  lineHeight: 1,
  transform: "translate(-1px, -4px)",
},
arrowIconLeft: {
  display: "block",
  lineHeight: 1,
  transform: "translate(+1px, -4px)",
},
  thumbnailRow: {
    display: "flex",
    gap: "12px",
    overflowX: "auto",
    marginTop: "16px",
    paddingBottom: "4px",
  },
  thumbnailButton: {
    border: "2px solid transparent",
    borderRadius: "12px",
    padding: "4px",
    backgroundColor: "#ffffff",
    cursor: "pointer",
    flex: "0 0 auto",
  },
  activeThumbnail: {
    borderColor: "var(--tg-primary)",
  },
  thumbnailImage: {
    width: "clamp(70px, 20vw, 86px)",
    height: "clamp(58px, 16vw, 70px)",
    objectFit: "cover",
    borderRadius: "8px",
    display: "block",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: "clamp(18px, 5vw, 24px)",
    border: "1px solid #dce8e1",
    boxShadow: "0 14px 40px rgba(0,0,0,0.1)",
    padding: "clamp(22px, 6vw, 28px)",
    position: "sticky",
    top: "16px",
    boxSizing: "border-box",
  },
  pointBadge: {
    display: "inline-block",
    backgroundColor: "#e5f0ea",
    color: "var(--tg-primary)",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: 900,
    margin: 0,
  },
  title: {
    color: "var(--tg-primary)",
    fontSize: "clamp(26px, 8vw, 34px)",
    lineHeight: 1.1,
    margin: "18px 0 12px",
    overflowWrap: "anywhere",
  },
  description: {
    color: "#5f6f68",
    fontSize: "16px",
    lineHeight: 1.6,
  },
  muted: {
    color: "#5f6f68",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  inCart: {
    color: "var(--tg-primary)",
    fontWeight: 900,
  },
  addButton: {
    width: "100%",
    border: "none",
    borderRadius: "14px",
    padding: "15px 18px",
    color: "#ffffff",
    backgroundColor: "var(--tg-primary)",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: "18px",
    fontSize: "16px",
  },
  disabledButton: {
    backgroundColor: "#9aa7a0",
    cursor: "not-allowed",
  },
  optionBox: {
    border: "1px solid #dce8e1",
    borderRadius: "14px",
    backgroundColor: "#f4f8f6",
    padding: "14px",
    marginTop: "16px",
  },
  optionLabel: {
    display: "block",
    color: "#263a32",
    fontSize: "13px",
    fontWeight: 900,
    marginBottom: "8px",
  },
  optionSelect: {
    width: "100%",
    border: "1px solid #ccd8d1",
    borderRadius: "12px",
    padding: "12px 14px",
    color: "#263a32",
    backgroundColor: "#ffffff",
    fontSize: "15px",
  },
  colorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "10px",
  },
  colorOption: {
    border: "1px solid #ccd8d1",
    borderRadius: "12px",
    padding: "10px",
    backgroundColor: "#ffffff",
    color: "#263a32",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    fontWeight: 800,
  },
  selectedColorOption: {
    borderColor: "var(--tg-primary)",
    backgroundColor: "#e5f0ea",
  },
  colorSwatch: {
    width: "24px",
    height: "24px",
    borderRadius: "999px",
    border: "1px solid rgba(0,0,0,0.18)",
    flex: "0 0 auto",
  },
};
