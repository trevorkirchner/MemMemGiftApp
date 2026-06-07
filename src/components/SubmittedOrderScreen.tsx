import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

type Tournament = Schema["Tournament"]["type"];
type Participant = Schema["Participant"]["type"];
type Order = Schema["Order"]["type"];
type OrderItem = Schema["OrderItem"]["type"];

type SubmittedOrderScreenProps = {
  tournament: Tournament;
  participant: Participant;
  onReturnToStart: () => void;
};

export default function SubmittedOrderScreen({
  tournament,
  participant,
  onReturnToStart,
}: SubmittedOrderScreenProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const totalQuantity = useMemo(() => {
    return orderItems.reduce((total, item) => total + (item.quantity ?? 0), 0);
  }, [orderItems]);

  useEffect(() => {
    loadSubmittedOrder();
  }, [tournament.id, participant.id]);

  async function loadSubmittedOrder() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const orderResult = await client.models.Order.list({
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
            {
              status: {
                eq: "Submitted",
              },
            },
          ],
        },
      });

      const submittedOrders = [...orderResult.data].sort((a, b) => {
        const aDate = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bDate = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return bDate - aDate;
      });

      const latestOrder = submittedOrders[0];

      if (!latestOrder) {
        setOrder(null);
        setOrderItems([]);
        return;
      }

      setOrder(latestOrder);

      const orderItemsResult = await client.models.OrderItem.list({
        filter: {
          orderId: {
            eq: latestOrder.id,
          },
        },
      });

      setOrderItems(orderItemsResult.data);
    } catch (error) {
      console.error("Submitted order load error:", error);
      setErrorMessage("Something went wrong while loading your submitted order.");
    } finally {
      setIsLoading(false);
    }
  }

  function formatSubmittedAt(value?: string | null) {
    if (!value) return "Not available";

    return new Date(value).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logoCircle}>✓</div>

        <h1 style={styles.title}>Order Submitted</h1>

        <p style={styles.subtitle}>
          Thank you, {participant.firstName}. Your gift order for{" "}
          <strong>{tournament.name}</strong> has been submitted and is now locked.
        </p>

        {errorMessage && <p style={styles.error}>{errorMessage}</p>}

        {isLoading ? (
          <p style={styles.message}>Loading submitted order...</p>
        ) : !order ? (
          <div style={styles.noticeBox}>
            <p style={styles.noticeTitle}>No submitted order found</p>
            <p style={styles.noticeText}>
              Your participant record is marked as submitted, but no submitted
              order record was found.
            </p>
          </div>
        ) : (
          <>
            <div style={styles.summaryBox}>
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

              <div style={styles.summaryRow}>
                <span>Submitted</span>
                <strong>{formatSubmittedAt(order.submittedAt)}</strong>
              </div>

              <div style={styles.summaryRow}>
                <span>Total Items</span>
                <strong>{totalQuantity}</strong>
              </div>

              <div style={styles.summaryRowLarge}>
                <span>Total Points Used</span>
                <strong>{order.totalPointsUsed}</strong>
              </div>
            </div>

            <section style={styles.orderItemsCard}>
              <h2 style={styles.sectionTitle}>Selected Gifts</h2>

              {orderItems.length === 0 ? (
                <p style={styles.message}>No order items were found.</p>
              ) : (
                <div style={styles.orderItems}>
                  {orderItems.map((item) => {
                    const lineTotal =
                      (item.quantity ?? 0) * (item.pointCostAtTime ?? 0);

                    return (
                      <div key={item.id} style={styles.orderItem}>
                        <div>
                          <p style={styles.itemTitle}>{item.titleAtTime}</p>

                          {item.descriptionAtTime && (
                            <p style={styles.itemDescription}>
                              {item.descriptionAtTime}
                            </p>
                          )}

                          <p style={styles.itemDetails}>
                            Qty: {item.quantity} × {item.pointCostAtTime} pts
                          </p>
                        </div>

                        <strong style={styles.lineTotal}>{lineTotal} pts</strong>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <p style={styles.lockNotice}>
          Your selections are final and can no longer be changed through the portal.
        </p>

        <button type="button" style={styles.button} onClick={onReturnToStart}>
          Return to Start
        </button>
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: "760px",
    boxSizing: "border-box",
    backgroundColor: "#ffffff",
    borderRadius: "clamp(18px, 5vw, 24px)",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.12)",
    padding: "clamp(22px, 6vw, 36px)",
    textAlign: "center",
  },
  logoCircle: {
    width: "64px",
    height: "64px",
    borderRadius: "999px",
    backgroundColor: "#123c2c",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "30px",
    fontWeight: 800,
    margin: "0 auto 20px",
  },
  title: {
    margin: 0,
    fontSize: "clamp(27px, 8vw, 32px)",
    lineHeight: 1.1,
    color: "#123c2c",
  },
  subtitle: {
    color: "#5f6f68",
    fontSize: "16px",
    lineHeight: 1.5,
    marginTop: "12px",
  },
  summaryBox: {
    textAlign: "left",
    backgroundColor: "#f4f8f6",
    border: "1px solid #dce8e1",
    borderRadius: "18px",
    padding: "clamp(16px, 5vw, 20px)",
    marginTop: "24px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    color: "#263a32",
    fontSize: "15px",
    marginBottom: "12px",
  },
  summaryRowLarge: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    color: "#123c2c",
    fontSize: "20px",
    fontWeight: 800,
    marginTop: "16px",
    paddingTop: "16px",
    borderTop: "1px solid #dce8e1",
  },
  orderItemsCard: {
    textAlign: "left",
    marginTop: "24px",
  },
  sectionTitle: {
    margin: "0 0 16px",
    color: "#123c2c",
    fontSize: "24px",
  },
  orderItems: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  orderItem: {
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
  itemDescription: {
    margin: "6px 0 0",
    color: "#5f6f68",
    fontSize: "14px",
    lineHeight: 1.4,
  },
  itemDetails: {
    margin: "6px 0 0",
    color: "#5f6f68",
    fontSize: "14px",
  },
  lineTotal: {
    color: "#123c2c",
    whiteSpace: "nowrap",
    marginLeft: "auto",
  },
  noticeBox: {
    backgroundColor: "#fff8e6",
    border: "1px solid #f6d98d",
    borderRadius: "14px",
    padding: "16px",
    marginTop: "24px",
    textAlign: "left",
  },
  noticeTitle: {
    margin: 0,
    color: "#7a4b00",
    fontWeight: 800,
  },
  noticeText: {
    margin: "6px 0 0",
    color: "#7a4b00",
    fontSize: "14px",
  },
  lockNotice: {
    color: "#5f6f68",
    fontSize: "14px",
    lineHeight: 1.5,
    marginTop: "24px",
  },
  button: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 18px",
    fontSize: "15px",
    fontWeight: 800,
    color: "#ffffff",
    backgroundColor: "#123c2c",
    cursor: "pointer",
    marginTop: "12px",
  },
  message: {
    color: "#5f6f68",
    fontSize: "15px",
  },
  error: {
    color: "#b42318",
    backgroundColor: "#fff4f2",
    border: "1px solid #ffd6d1",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "15px",
    fontWeight: 700,
    marginTop: "20px",
  },
};
