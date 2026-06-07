import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import GiftDetailScreen from "./GiftDetailScreen";
import { getGiftImageUrl } from "../utils/giftImageStorage";

const client = generateClient<Schema>();

type Tournament = Schema["Tournament"]["type"];
type Participant = Schema["Participant"]["type"];
type GiftItem = Schema["GiftItem"]["type"];
type GiftImage = Schema["GiftImage"]["type"];
type CartItem = Schema["CartItem"]["type"];

type GiftCatalogScreenProps = {
  tournament: Tournament;
  participant: Participant;
  onBack: () => void;
  onContinueToCheckout: () => void;
};

export default function GiftCatalogScreen({
  tournament,
  participant,
  onBack,
  onContinueToCheckout,
}: GiftCatalogScreenProps) {
  const [giftItems, setGiftItems] = useState<GiftItem[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCartUpdating, setIsCartUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [giftImageUrlsByGiftId, setGiftImageUrlsByGiftId] = useState<Record<string, string>>({});

  const startingPoints = participant.startingPoints ?? 0;
  const allowOverPoints = tournament.allowOverPoints ?? false;
  const pointDollarValue = tournament.pointDollarValue ?? 0;

  const usedPoints = useMemo(() => {
    return cartItems.reduce((total, item) => {
      return total + (item.quantity ?? 0) * (item.pointCostAtTime ?? 0);
    }, 0);
  }, [cartItems]);

  const remainingPoints = startingPoints - usedPoints;
  const overagePoints = Math.max(0, usedPoints - startingPoints);
  const overageAmount = overagePoints * pointDollarValue;

  const cartItemCount = useMemo(() => {
    return cartItems.reduce((total, item) => total + (item.quantity ?? 0), 0);
  }, [cartItems]);

  useEffect(() => {
    loadPageData();
  }, [tournament.id, participant.id]);

  async function loadPageData() {
    try {
        setIsLoading(true);
        setErrorMessage("");

        const loadedGifts = await loadGiftItems();
        await Promise.all([loadCartItems(), loadGiftCardImages(loadedGifts)]);
    } catch (error) {
        console.error("Page load error:", error);
        setErrorMessage("Something went wrong while loading the gift catalog.");
    } finally {
        setIsLoading(false);
    }
    }

  async function loadGiftItems() {
  const result = await client.models.GiftItem.list({
    filter: {
      and: [
        {
          tournamentId: {
            eq: tournament.id,
          },
        },
        {
          isActive: {
            eq: true,
          },
        },
      ],
    },
  });

  const sortedGifts = [...result.data].sort((a, b) => {
    const aSort = a.sortOrder ?? 9999;
    const bSort = b.sortOrder ?? 9999;

    if (aSort !== bSort) {
      return aSort - bSort;
    }

    return a.title.localeCompare(b.title);
  });

  setGiftItems(sortedGifts);

  return sortedGifts;
}

  async function loadCartItems() {
    const result = await client.models.CartItem.list({
      filter: {
        and: [
          {
            tournamentId: {
              eq: tournament.id,
            },
          },
          {
            participantId: {
              eq: participant.id,
            },
          },
        ],
      },
    });

    setCartItems(result.data);
  }

  function getCartItemForGift(giftId: string) {
    return cartItems.find((item) => item.giftItemId === giftId);
  }

  function getGiftForCartItem(cartItem: CartItem) {
    return giftItems.find((gift) => gift.id === cartItem.giftItemId);
  }

  async function handleAddToCart(gift: GiftItem) {
    if (participant.hasSubmittedOrder) {
      setErrorMessage("Your order has already been submitted and can no longer be changed.");
      return;
    }

    const giftCost = gift.pointCost ?? 0;

    if (!allowOverPoints && giftCost > remainingPoints) {
      setErrorMessage(
        `You do not have enough remaining points to add ${gift.title}.`
      );
      return;
    }

    try {
      setIsCartUpdating(true);
      setErrorMessage("");

      const existingCartItem = getCartItemForGift(gift.id);

      if (existingCartItem) {
        const currentQuantity = existingCartItem.quantity ?? 0;

        await client.models.CartItem.update({
          id: existingCartItem.id,
          quantity: currentQuantity + 1,
        });
      } else {
        await client.models.CartItem.create({
          tournamentId: tournament.id,
          participantId: participant.id,
          giftItemId: gift.id,
          quantity: 1,
          pointCostAtTime: giftCost,
        });
      }

      await loadCartItems();
    } catch (error) {
      console.error("Add to cart error:", error);
      setErrorMessage("Something went wrong while adding this item to your cart.");
    } finally {
      setIsCartUpdating(false);
    }
  }

  async function loadGiftCardImages(gifts: GiftItem[]) {
  const result = await client.models.GiftImage.list({
    filter: {
      tournamentId: {
        eq: tournament.id,
      },
    },
  });

  const imagesByGiftId = new Map<string, GiftImage[]>();

  result.data.forEach((image) => {
    const existing = imagesByGiftId.get(image.giftItemId) || [];
    existing.push(image);
    imagesByGiftId.set(image.giftItemId, existing);
  });

  const urlEntries = await Promise.all(
    gifts.map(async (gift) => {
      const images = imagesByGiftId.get(gift.id) || [];

      const sortedImages = [...images].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
      });

      const primaryImage = sortedImages[0];

      if (!primaryImage) {
        return [gift.id, gift.imageUrl || ""] as const;
      }

      const url = await getGiftImageUrl(primaryImage.imageKey);

      return [gift.id, url] as const;
    })
  );

  setGiftImageUrlsByGiftId(Object.fromEntries(urlEntries));
}

  async function handleDecreaseQuantity(cartItem: CartItem) {
    if (participant.hasSubmittedOrder) {
      setErrorMessage("Your order has already been submitted and can no longer be changed.");
      return;
    }

    try {
      setIsCartUpdating(true);
      setErrorMessage("");

      const currentQuantity = cartItem.quantity ?? 0;

      if (currentQuantity <= 1) {
        await client.models.CartItem.delete({
          id: cartItem.id,
        });
      } else {
        await client.models.CartItem.update({
          id: cartItem.id,
          quantity: currentQuantity - 1,
        });
      }

      await loadCartItems();
    } catch (error) {
      console.error("Decrease quantity error:", error);
      setErrorMessage("Something went wrong while updating your cart.");
    } finally {
      setIsCartUpdating(false);
    }
  }

  async function handleRemoveFromCart(cartItem: CartItem) {
    if (participant.hasSubmittedOrder) {
      setErrorMessage("Your order has already been submitted and can no longer be changed.");
      return;
    }

    try {
      setIsCartUpdating(true);
      setErrorMessage("");

      await client.models.CartItem.delete({
        id: cartItem.id,
      });

      await loadCartItems();
    } catch (error) {
      console.error("Remove from cart error:", error);
      setErrorMessage("Something went wrong while removing this item from your cart.");
    } finally {
      setIsCartUpdating(false);
    }
  }

  function formatCurrency(value: number) {
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (selectedGift) {
  const cartItem = getCartItemForGift(selectedGift.id);
  const quantityInCart = cartItem?.quantity ?? 0;

  return (
      <GiftDetailScreen
        gift={selectedGift}
        quantityInCart={quantityInCart}
        remainingPoints={remainingPoints}
        allowOverPoints={allowOverPoints}
        onBack={() => setSelectedGift(null)}
        onAddToCart={handleAddToCart}
      />
  );
}

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <button type="button" onClick={onBack} style={styles.backButton}>
            ← Back
          </button>

          <h1 style={styles.title}>{tournament.name}</h1>

          <p style={styles.subtitle}>
            Welcome, {participant.firstName}. Select gifts using your available
            points.
          </p>
        </div>

        <aside style={styles.pointsCard}>
          <p style={styles.pointsLabel}>Remaining Points</p>
          <p style={styles.pointsValue}>{remainingPoints}</p>

          <div style={styles.pointsBreakdown}>
            <span>Starting: {startingPoints}</span>
            <span>Used: {usedPoints}</span>
          </div>
        </aside>
      </header>

      {errorMessage && <p style={styles.error}>{errorMessage}</p>}

      {allowOverPoints && overagePoints > 0 && (
        <section style={styles.overageNotice}>
          <strong>You are over your point allotment by {overagePoints} points.</strong>
          <span>
            At {formatCurrency(pointDollarValue)} per point, you will owe{" "}
            {formatCurrency(overageAmount)} to the club if you submit this order.
          </span>
        </section>
      )}

      {isLoading && <p style={styles.message}>Loading gifts...</p>}

      {!isLoading && (
        <section style={styles.layout}>
          <section style={styles.catalogArea}>
            {giftItems.length === 0 ? (
              <p style={styles.message}>No gift items are available yet.</p>
            ) : (
              <div style={styles.grid}>
                {giftItems.map((gift) => {
                  const cartItem = getCartItemForGift(gift.id);
                  const quantityInCart = cartItem?.quantity ?? 0;
                  const cannotAfford =
                    !allowOverPoints && (gift.pointCost ?? 0) > remainingPoints;

                  return (
                    <article key={gift.id} style={styles.card}>
                        <button
                            type="button"
                            onClick={() => setSelectedGift(gift)}
                            style={styles.imageButton}
                        >
                            {giftImageUrlsByGiftId[gift.id] ? (
                            <img
                                src={giftImageUrlsByGiftId[gift.id]}
                                alt={gift.title}
                                style={styles.image}
                            />
                            ) : (
                            <div style={styles.placeholderImage}>No Image</div>
                            )}
                        </button>

                        <div style={styles.cardBody}>
                        <div style={styles.cardHeader}>
                          <button
                            type="button"
                            onClick={() => setSelectedGift(gift)}
                            style={styles.giftTitleButton}
                            >
                            {gift.title}
                          </button>
                          <span style={styles.pointBadge}>
                            {gift.pointCost} pts
                          </span>
                        </div>

                        <p style={styles.description}>
                          {gift.description || "No description available."}
                        </p>


                        {quantityInCart > 0 && (
                          <p style={styles.inCart}>
                            In Cart: {quantityInCart}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => handleAddToCart(gift)}
                          disabled={
                            isCartUpdating ||
                            participant.hasSubmittedOrder === true ||
                            cannotAfford
                          }
                          style={{
                            ...styles.addButton,
                            ...(cannotAfford ? styles.disabledButton : {}),
                          }}
                        >
                          {cannotAfford ? "Not Enough Points" : "Add to Cart"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside style={styles.cartPanel}>
            <h2 style={styles.cartTitle}>Your Cart</h2>

            <div style={styles.cartSummary}>
              <div style={styles.cartSummaryRow}>
                <span>Items</span>
                <strong>{cartItemCount}</strong>
              </div>

              <div style={styles.cartSummaryRow}>
                <span>Used Points</span>
                <strong>{usedPoints}</strong>
              </div>

              <div style={styles.cartSummaryRow}>
                <span>Remaining</span>
                <strong>{remainingPoints}</strong>
              </div>
            </div>

            {cartItems.length === 0 ? (
              <p style={styles.emptyCart}>Your cart is empty.</p>
            ) : (
              <div style={styles.cartItems}>
                {cartItems.map((cartItem) => {
                  const gift = getGiftForCartItem(cartItem);

                  return (
                    <div key={cartItem.id} style={styles.cartItem}>
                      <div>
                        <p style={styles.cartItemTitle}>
                          {gift?.title || "Gift Item"}
                        </p>

                        <p style={styles.cartItemDetails}>
                          Qty: {cartItem.quantity} × {cartItem.pointCostAtTime} pts
                        </p>
                      </div>

                      <div style={styles.cartActions}>
                        <button
                          type="button"
                          onClick={() => handleDecreaseQuantity(cartItem)}
                          disabled={isCartUpdating}
                          style={styles.smallButton}
                        >
                          -
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(cartItem)}
                          disabled={isCartUpdating}
                          style={styles.removeButton}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
                type="button"
                disabled={cartItems.length === 0 || participant.hasSubmittedOrder === true}
                style={{
                    ...styles.checkoutButton,
                    ...(cartItems.length === 0 ? styles.disabledButton : {}),
                }}
                onClick={onContinueToCheckout}
                >
                Continue to Checkout
                </button>
          </aside>
        </section>
      )}
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
  header: {
    maxWidth: "1280px",
    margin: "0 auto 28px",
    display: "flex",
    justifyContent: "space-between",
    gap: "clamp(16px, 4vw, 24px)",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  backButton: {
    border: "none",
    background: "transparent",
    color: "#123c2c",
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    marginBottom: "14px",
    fontSize: "15px",
  },
  title: {
    margin: 0,
    fontSize: "clamp(28px, 8vw, 34px)",
    lineHeight: 1.1,
    color: "#123c2c",
  },
  subtitle: {
    color: "#5f6f68",
    fontSize: "16px",
    lineHeight: 1.5,
    marginTop: "10px",
  },
  pointsCard: {
    width: "min(100%, 300px)",
    minWidth: 0,
    boxSizing: "border-box",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    boxShadow: "0 14px 40px rgba(0, 0, 0, 0.1)",
    padding: "22px",
    textAlign: "center",
    border: "1px solid #dce8e1",
  },
  pointsLabel: {
    margin: 0,
    color: "#5f6f68",
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  pointsValue: {
    margin: "8px 0 0",
    color: "#123c2c",
    fontSize: "clamp(34px, 10vw, 42px)",
    fontWeight: 800,
  },
  pointsBreakdown: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    color: "#5f6f68",
    fontSize: "13px",
    marginTop: "10px",
  },
  layout: {
    maxWidth: "1280px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
    gap: "clamp(18px, 4vw, 24px)",
    alignItems: "start",
  },
  catalogArea: {
    minWidth: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: "clamp(16px, 4vw, 24px)",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "22px",
    boxShadow: "0 14px 40px rgba(0, 0, 0, 0.1)",
    overflow: "hidden",
    border: "1px solid #dce8e1",
    display: "flex",
    flexDirection: "column",
  },
  imageWrapper: {
    height: "190px",
    backgroundColor: "#edf3ef",
  },
  image: {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  display: "block",
  backgroundColor: "#edf3ef",
},
  placeholderImage: {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#5f6f68",
  fontWeight: 700,
},
  cardBody: {
    padding: "clamp(16px, 5vw, 20px)",
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  giftTitle: {
    margin: 0,
    color: "#123c2c",
    fontSize: "clamp(18px, 5.5vw, 20px)",
    lineHeight: 1.2,
  },
  pointBadge: {
    backgroundColor: "#e5f0ea",
    color: "#123c2c",
    borderRadius: "999px",
    padding: "6px 10px",
    fontWeight: 800,
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  description: {
    color: "#5f6f68",
    fontSize: "15px",
    lineHeight: 1.5,
    marginTop: "12px",
    flex: 1,
  },
  quantity: {
    color: "#5f6f68",
    fontSize: "13px",
    marginTop: "8px",
  },
  inCart: {
    color: "#123c2c",
    fontSize: "14px",
    fontWeight: 800,
    marginTop: "8px",
  },
  addButton: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    padding: "13px 16px",
    fontSize: "15px",
    fontWeight: 800,
    color: "#ffffff",
    backgroundColor: "#123c2c",
    cursor: "pointer",
    marginTop: "18px",
  },
  disabledButton: {
    backgroundColor: "#9aa7a0",
    cursor: "not-allowed",
  },
  cartPanel: {
    position: "sticky",
    top: "16px",
    boxSizing: "border-box",
    backgroundColor: "#ffffff",
    borderRadius: "22px",
    boxShadow: "0 14px 40px rgba(0, 0, 0, 0.1)",
    border: "1px solid #dce8e1",
    padding: "clamp(18px, 5vw, 22px)",
  },
  cartTitle: {
    margin: 0,
    color: "#123c2c",
    fontSize: "24px",
  },
  cartSummary: {
    backgroundColor: "#f4f8f6",
    borderRadius: "14px",
    padding: "14px",
    marginTop: "16px",
    marginBottom: "16px",
  },
  cartSummaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
    color: "#263a32",
    fontSize: "15px",
    marginBottom: "8px",
  },
  emptyCart: {
    color: "#5f6f68",
    fontSize: "15px",
    lineHeight: 1.5,
  },
  cartItems: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  cartItem: {
    border: "1px solid #dce8e1",
    borderRadius: "14px",
    padding: "12px",
  },
  cartItemTitle: {
    margin: 0,
    color: "#123c2c",
    fontWeight: 800,
    fontSize: "15px",
  },
  cartItemDetails: {
    margin: "4px 0 0",
    color: "#5f6f68",
    fontSize: "13px",
  },
  cartActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "10px",
  },
  smallButton: {
    border: "1px solid #ccd8d1",
    borderRadius: "10px",
    backgroundColor: "#ffffff",
    color: "#123c2c",
    fontWeight: 800,
    cursor: "pointer",
    padding: "8px 12px",
  },
  removeButton: {
    border: "none",
    borderRadius: "10px",
    backgroundColor: "#fbe9e7",
    color: "#b42318",
    fontWeight: 800,
    cursor: "pointer",
    padding: "8px 12px",
  },
  checkoutButton: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    padding: "14px 16px",
    fontSize: "15px",
    fontWeight: 800,
    color: "#ffffff",
    backgroundColor: "#123c2c",
    cursor: "pointer",
    marginTop: "18px",
  },
  message: {
    maxWidth: "1280px",
    margin: "40px auto",
    color: "#5f6f68",
    fontSize: "17px",
  },
imageButton: {
  width: "100%",
  aspectRatio: "1 / 1",
  border: "none",
  padding: 0,
  backgroundColor: "#edf3ef",
  cursor: "pointer",
  display: "block",
  overflow: "hidden",
},
giftTitleButton: {
  border: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  color: "#123c2c",
  fontSize: "clamp(18px, 5.5vw, 20px)",
  lineHeight: 1.2,
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "left",
  overflowWrap: "anywhere",
},
  error: {
    maxWidth: "1280px",
    margin: "0 auto 20px",
    color: "#b42318",
    backgroundColor: "#fff4f2",
    border: "1px solid #ffd6d1",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "15px",
    fontWeight: 700,
  },
  overageNotice: {
    maxWidth: "1280px",
    margin: "0 auto 20px",
    color: "#7a3e00",
    backgroundColor: "#fff4df",
    border: "1px solid #f1c27d",
    borderRadius: "14px",
    padding: "14px 16px",
    fontSize: "15px",
    fontWeight: 700,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
};
