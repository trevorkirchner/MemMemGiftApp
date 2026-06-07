import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

type Tournament = Schema["Tournament"]["type"];
type Participant = Schema["Participant"]["type"];
type GiftItem = Schema["GiftItem"]["type"];
type CartItem = Schema["CartItem"]["type"];

type CheckoutScreenProps = {
  tournament: Tournament;
  participant: Participant;
  onBackToCatalog: () => void;
  onOrderSubmitted: (updatedParticipant: Participant) => void;
};

export default function CheckoutScreen({
  tournament,
  participant,
  onBackToCatalog,
  onOrderSubmitted,
}: CheckoutScreenProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [giftItems, setGiftItems] = useState<GiftItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const startingPoints = participant.startingPoints ?? 0;
  const allowOverPoints = tournament.allowOverPoints ?? false;
  const pointDollarValue = tournament.pointDollarValue ?? 0;

  const cartRows = useMemo(() => {
    return cartItems.map((cartItem) => {
      const gift = giftItems.find((item) => item.id === cartItem.giftItemId);

      return {
        cartItem,
        gift,
        title: gift?.title || "Gift Item",
        description: gift?.description || "",
        quantity: cartItem.quantity ?? 0,
        pointCost: cartItem.pointCostAtTime ?? 0,
        lineTotal: (cartItem.quantity ?? 0) * (cartItem.pointCostAtTime ?? 0),
      };
    });
  }, [cartItems, giftItems]);

  const totalPointsUsed = useMemo(() => {
    return cartRows.reduce((total, row) => total + row.lineTotal, 0);
  }, [cartRows]);

  const remainingPoints = startingPoints - totalPointsUsed;
  const overagePoints = Math.max(0, totalPointsUsed - startingPoints);
  const overageAmount = overagePoints * pointDollarValue;

  useEffect(() => {
    loadCheckoutData();
  }, [tournament.id, participant.id]);

  async function loadCheckoutData() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const [cartResult, giftResult] = await Promise.all([
        client.models.CartItem.list({
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
        }),

        client.models.GiftItem.list({
          filter: {
            tournamentId: {
              eq: tournament.id,
            },
          },
        }),
      ]);

      setCartItems(cartResult.data);
      setGiftItems(giftResult.data);
    } catch (error) {
      console.error("Checkout load error:", error);
      setErrorMessage("Something went wrong while loading your checkout.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmitOrder() {
    if (participant.hasSubmittedOrder) {
      setErrorMessage("Your order has already been submitted.");
      return;
    }

    if (cartItems.length === 0) {
      setErrorMessage("Your cart is empty.");
      return;
    }

    if (!allowOverPoints && totalPointsUsed > startingPoints) {
      setErrorMessage("Your cart exceeds your available points.");
      return;
    }

    const missingGift = cartRows.find((row) => !row.gift);

    if (missingGift) {
      setErrorMessage(
        "One or more cart items could not be matched to a gift item. Please go back and review your cart."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const submittedAt = new Date().toISOString();

      const orderResult = await client.models.Order.create({
        tournamentId: tournament.id,
        participantId: participant.id,
        totalPointsUsed,
        status: "Submitted",
        submittedAt,
      });

      const order = orderResult.data;

      if (!order?.id) {
        throw new Error("Order was not created.");
      }

      for (const row of cartRows) {
        await client.models.OrderItem.create({
          orderId: order.id,
          giftItemId: row.cartItem.giftItemId,
          titleAtTime: row.title,
          descriptionAtTime: row.description,
          pointCostAtTime: row.pointCost,
          quantity: row.quantity,
        });
      }

      const participantResult = await client.models.Participant.update({
        id: participant.id,
        hasSubmittedOrder: true,
        submittedAt,
      });

      const updatedParticipant =
        participantResult.data ||
        ({
          ...participant,
          hasSubmittedOrder: true,
          submittedAt,
        } as Participant);

      onOrderSubmitted(updatedParticipant);
    } catch (error) {
      console.error("Submit order error:", error);
      setErrorMessage("Something went wrong while submitting your order.");
    } finally {
      setIsSubmitting(false);
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

  return (
    <main style={styles.page}>
      <section style={styles.container}>
        <button
          type="button"
          onClick={onBackToCatalog}
          disabled={isSubmitting}
          style={styles.backButton}
        >
          ← Back to Gifts
        </button>

        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Review Your Order</h1>
            <p style={styles.subtitle}>
              Please review your gift selections before submitting. Once
              submitted, your order cannot be changed.
            </p>
          </div>

          <aside style={styles.pointsCard}>
            <p style={styles.pointsLabel}>Remaining Points</p>
            <p style={styles.pointsValue}>{remainingPoints}</p>
            <div style={styles.pointsBreakdown}>
              <span>Starting: {startingPoints}</span>
              <span>Used: {totalPointsUsed}</span>
            </div>
          </aside>
        </header>

        {errorMessage && <p style={styles.error}>{errorMessage}</p>}

        {allowOverPoints && overagePoints > 0 && (
          <section style={styles.overageWarning}>
            <h2 style={styles.overageTitle}>Point Overage Notice</h2>
            <p style={styles.overageText}>
              Your order is {overagePoints} points over your allotment. At{" "}
              {formatCurrency(pointDollarValue)} per point, you will owe{" "}
              <strong>{formatCurrency(overageAmount)}</strong> to the club when
              this order is submitted.
            </p>
          </section>
        )}

        {isLoading ? (
          <p style={styles.message}>Loading checkout...</p>
        ) : cartRows.length === 0 ? (
          <section style={styles.emptyCard}>
            <h2 style={styles.emptyTitle}>Your cart is empty</h2>
            <p style={styles.subtitle}>
              Go back to the gift catalog and add items before checking out.
            </p>
            <button type="button" onClick={onBackToCatalog} style={styles.primaryButton}>
              Back to Gifts
            </button>
          </section>
        ) : (
          <section style={styles.checkoutGrid}>
            <div style={styles.orderCard}>
              <h2 style={styles.sectionTitle}>Selected Gifts</h2>

              <div style={styles.rows}>
                {cartRows.map((row) => (
                  <div key={row.cartItem.id} style={styles.row}>
                    <div>
                      <p style={styles.itemTitle}>{row.title}</p>
                      <p style={styles.itemDetails}>
                        Qty: {row.quantity} × {row.pointCost} pts
                      </p>
                    </div>

                    <strong style={styles.lineTotal}>{row.lineTotal} pts</strong>
                  </div>
                ))}
              </div>
            </div>

            <aside style={styles.summaryCard}>
              <h2 style={styles.sectionTitle}>Order Summary</h2>

              <div style={styles.summaryRow}>
                <span>Member</span>
                <strong>
                  {participant.firstName} {participant.lastName}
                </strong>
              </div>

              <div style={styles.summaryRow}>
                <span>Email</span>
                <strong>{participant.email}</strong>
              </div>

              <div style={styles.summaryRow}>
                <span>Member #</span>
                <strong>{participant.memberNumber}</strong>
              </div>

              <hr style={styles.divider} />

              <div style={styles.summaryRow}>
                <span>Starting Points</span>
                <strong>{startingPoints}</strong>
              </div>

              <div style={styles.summaryRow}>
                <span>Total Used</span>
                <strong>{totalPointsUsed}</strong>
              </div>

              <div style={styles.summaryRowLarge}>
                <span>Remaining</span>
                <strong>{remainingPoints}</strong>
              </div>

              {allowOverPoints && overagePoints > 0 && (
                <div style={styles.summaryOverageBox}>
                  <div style={styles.summaryRow}>
                    <span>Overage Points</span>
                    <strong>{overagePoints}</strong>
                  </div>

                  <div style={styles.summaryRowLarge}>
                    <span>Amount Owed</span>
                    <strong>{formatCurrency(overageAmount)}</strong>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={
                  isSubmitting ||
                  cartRows.length === 0 ||
                  (!allowOverPoints && totalPointsUsed > startingPoints)
                }
                style={{
                  ...styles.submitButton,
                  ...(isSubmitting ||
                  (!allowOverPoints && totalPointsUsed > startingPoints)
                    ? styles.disabledButton
                    : {}),
                }}
              >
                {isSubmitting ? "Submitting..." : "Submit Final Order"}
              </button>

              <p style={styles.lockNotice}>
                By submitting, you confirm your gift selections are final.
              </p>
            </aside>
          </section>
        )}
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "clamp(16px, 4vw, 24px)",
    alignItems: "flex-start",
    marginBottom: "28px",
    flexWrap: "wrap",
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
  checkoutGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
    gap: "clamp(18px, 4vw, 24px)",
    alignItems: "start",
  },
  orderCard: {
    backgroundColor: "#ffffff",
    borderRadius: "22px",
    boxShadow: "0 14px 40px rgba(0, 0, 0, 0.1)",
    border: "1px solid #dce8e1",
    padding: "clamp(18px, 5vw, 24px)",
    boxSizing: "border-box",
  },
  summaryCard: {
    position: "sticky",
    top: "16px",
    backgroundColor: "#ffffff",
    borderRadius: "22px",
    boxShadow: "0 14px 40px rgba(0, 0, 0, 0.1)",
    border: "1px solid #dce8e1",
    padding: "clamp(18px, 5vw, 24px)",
    boxSizing: "border-box",
  },
  sectionTitle: {
    margin: "0 0 18px",
    color: "#123c2c",
    fontSize: "24px",
  },
  rows: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    border: "1px solid #dce8e1",
    borderRadius: "14px",
    padding: "16px",
  },
  itemTitle: {
    margin: 0,
    color: "#123c2c",
    fontWeight: 800,
    fontSize: "16px",
  },
  itemDetails: {
    margin: "6px 0 0",
    color: "#5f6f68",
    fontSize: "14px",
  },
  lineTotal: {
    color: "#123c2c",
    whiteSpace: "nowrap",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    color: "#263a32",
    fontSize: "14px",
    marginBottom: "12px",
  },
  summaryRowLarge: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    color: "#123c2c",
    fontSize: "20px",
    fontWeight: 800,
    marginTop: "12px",
  },
  divider: {
    border: "none",
    borderTop: "1px solid #dce8e1",
    margin: "16px 0",
  },
  submitButton: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    padding: "14px 16px",
    fontSize: "15px",
    fontWeight: 800,
    color: "#ffffff",
    backgroundColor: "#123c2c",
    cursor: "pointer",
    marginTop: "20px",
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    padding: "14px 16px",
    fontSize: "15px",
    fontWeight: 800,
    color: "#ffffff",
    backgroundColor: "#123c2c",
    cursor: "pointer",
    marginTop: "12px",
  },
  disabledButton: {
    backgroundColor: "#9aa7a0",
    cursor: "not-allowed",
  },
  lockNotice: {
    color: "#5f6f68",
    fontSize: "13px",
    lineHeight: 1.5,
    marginTop: "12px",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: "22px",
    boxShadow: "0 14px 40px rgba(0, 0, 0, 0.1)",
    border: "1px solid #dce8e1",
    padding: "clamp(22px, 6vw, 28px)",
    textAlign: "center",
  },
  emptyTitle: {
    margin: 0,
    color: "#123c2c",
  },
  message: {
    color: "#5f6f68",
    fontSize: "17px",
  },
  error: {
    color: "#b42318",
    backgroundColor: "#fff4f2",
    border: "1px solid #ffd6d1",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "15px",
    fontWeight: 700,
    marginBottom: "20px",
  },
  overageWarning: {
    color: "#7a3e00",
    backgroundColor: "#fff4df",
    border: "1px solid #f1c27d",
    borderRadius: "16px",
    padding: "clamp(16px, 5vw, 20px)",
    marginBottom: "22px",
  },
  overageTitle: {
    margin: 0,
    color: "#7a3e00",
    fontSize: "20px",
  },
  overageText: {
    margin: "8px 0 0",
    color: "#7a3e00",
    fontSize: "15px",
    lineHeight: 1.5,
  },
  summaryOverageBox: {
    border: "1px solid #f1c27d",
    borderRadius: "14px",
    backgroundColor: "#fff8eb",
    padding: "14px",
    marginTop: "16px",
  },
};
