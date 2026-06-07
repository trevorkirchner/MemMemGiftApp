import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getGiftImageUrl } from "../utils/giftImageStorage";

const client = generateClient<Schema>();

type GiftItem = Schema["GiftItem"]["type"];
type GiftImage = Schema["GiftImage"]["type"];

type GiftDetailScreenProps = {
  gift: GiftItem;
  quantityInCart: number;
  remainingPoints: number;
  allowOverPoints: boolean;
  onBack: () => void;
  onAddToCart: (gift: GiftItem) => void;
};

export default function GiftDetailScreen({
  gift,
  quantityInCart,
  remainingPoints,
  allowOverPoints,
  onBack,
  onAddToCart,
}: GiftDetailScreenProps) {
  const [giftImages, setGiftImages] = useState<GiftImage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLoadingImages, setIsLoadingImages] = useState(true);

  const sortedImages = useMemo(() => {
    return [...giftImages].sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
    });
  }, [giftImages]);

  const activeImage = sortedImages[selectedImageIndex];
  const activeImageUrl = activeImage ? imageUrls[activeImage.id] : gift.imageUrl;

  const cannotAfford = !allowOverPoints && (gift.pointCost ?? 0) > remainingPoints;

  useEffect(() => {
    loadImages();
  }, [gift.id]);

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
                <img src={activeImageUrl} alt={gift.title} style={styles.mainImage} />
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
                      alt={image.altText || gift.title}
                      style={styles.thumbnailImage}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside style={styles.infoCard}>
            <p style={styles.pointBadge}>{gift.pointCost} points</p>

            <h1 style={styles.title}>{gift.title}</h1>

            <p style={styles.description}>
              {gift.description || "No description available."}
            </p>

            {typeof gift.quantityAvailable === "number" && (
              <p style={styles.muted}>Quantity Available: {gift.quantityAvailable}</p>
            )}

            {quantityInCart > 0 && (
              <p style={styles.inCart}>Currently in cart: {quantityInCart}</p>
            )}

            <button
              type="button"
              onClick={() => onAddToCart(gift)}
              disabled={cannotAfford}
              style={{
                ...styles.addButton,
                ...(cannotAfford ? styles.disabledButton : {}),
              }}
            >
              {cannotAfford ? "Not Enough Points" : "Add to Cart"}
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
    color: "#123c2c",
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
    borderColor: "#123c2c",
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
    color: "#123c2c",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: 900,
    margin: 0,
  },
  title: {
    color: "#123c2c",
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
    color: "#123c2c",
    fontWeight: 900,
  },
  addButton: {
    width: "100%",
    border: "none",
    borderRadius: "14px",
    padding: "15px 18px",
    color: "#ffffff",
    backgroundColor: "#123c2c",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: "18px",
    fontSize: "16px",
  },
  disabledButton: {
    backgroundColor: "#9aa7a0",
    cursor: "not-allowed",
  },
};
