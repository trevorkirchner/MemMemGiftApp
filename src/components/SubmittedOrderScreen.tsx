import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { formatGiftColor } from "../utils/giftColors";
import { formatGiftOption } from "../utils/giftOptions";

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

  function downloadReceipt() {
    if (!order) return;

    const receiptPdf = buildReceiptPdf(order, orderItems);
    const receiptUrl = URL.createObjectURL(
      new Blob([receiptPdf], { type: "application/pdf" })
    );
    const link = document.createElement("a");

    link.href = receiptUrl;
    link.download = `${slugify(tournament.name)}-${slugify(
      `${participant.firstName}-${participant.lastName}`
    )}-receipt.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(() => URL.revokeObjectURL(receiptUrl), 1000);
  }

  function buildReceiptPdf(submittedOrder: Order, submittedItems: OrderItem[]) {
    const totalPointsUsed = submittedOrder.totalPointsUsed ?? 0;
    const startingPoints = participant.startingPoints ?? 0;
    const remainingPoints = startingPoints - totalPointsUsed;
    const overagePoints = Math.max(0, totalPointsUsed - startingPoints);
    const pointDollarValue = tournament.pointDollarValue ?? 0;
    const amountOwed = overagePoints * pointDollarValue;

    const pdf = createPdfWriter();

    pdf.text("Order Receipt", 48, 30, true);
    pdf.text(tournament.name, 48, 12);
    pdf.text(`Order ID: ${submittedOrder.id}`, 360, 9);
    pdf.text(`Status: ${submittedOrder.status ?? ""}`, 360, 9);
    pdf.text(`Submitted: ${formatSubmittedAt(submittedOrder.submittedAt)}`, 360, 9);
    pdf.rule();

    pdf.text("Member Details", 48, 16, true);
    pdf.text(`Member: ${participant.firstName} ${participant.lastName}`, 48, 11);
    pdf.text(`Email: ${participant.email}`, 48, 11);
    pdf.text(`Member #: ${participant.memberNumber}`, 48, 11);
    pdf.text(`Total Items: ${totalQuantity}`, 48, 11);
    pdf.space(10);

    pdf.text("Gift Selections", 48, 16, true);
    pdf.rule();
    pdf.text("Gift", 48, 10, true);
    pdf.sameLine("Qty", 372, 10, true);
    pdf.sameLine("Each", 426, 10, true);
    pdf.sameLine("Total", 492, 10, true);
    pdf.rule();

    if (submittedItems.length === 0) {
      pdf.text("No order items found.", 48, 11);
    } else {
      submittedItems.forEach((item) => {
        const lineTotal = (item.quantity ?? 0) * (item.pointCostAtTime ?? 0);
        const details = [
          item.descriptionAtTime,
          item.selectedOptionAtTime
            ? formatGiftOption(item.selectedOptionLabelAtTime, item.selectedOptionAtTime)
            : "",
          item.selectedColorNameAtTime
            ? formatGiftColor(item.selectedColorNameAtTime)
            : "",
        ].filter(Boolean);

        pdf.text(item.titleAtTime ?? "Gift Item", 48, 11, true, 46);
        details.forEach((detail) => pdf.text(String(detail), 58, 9, false, 44));
        pdf.sameLine(String(item.quantity ?? 0), 372, 10);
        pdf.sameLine(String(item.pointCostAtTime ?? 0), 426, 10);
        pdf.sameLine(String(lineTotal), 492, 10);
        pdf.space(8);
      });
    }

    pdf.space(8);
    pdf.rule();
    pdf.text("Point Summary", 360, 16, true);
    pdf.text(`Starting Points: ${startingPoints}`, 360, 11);
    pdf.text(`Total Points Used: ${totalPointsUsed}`, 360, 11);
    pdf.text(`Remaining Points: ${remainingPoints}`, 360, 11, true);

    if (tournament.allowOverPoints && overagePoints > 0) {
      pdf.space(4);
      pdf.text(`Overage Points: ${overagePoints}`, 360, 11, true);
      pdf.text(`Amount Owed: ${formatCurrency(amountOwed)}`, 360, 11, true);
    }

    return pdf.output();
  }

  function formatCurrency(value: number) {
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function slugify(value: string) {
    return (
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "receipt"
    );
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
                          {item.selectedOptionAtTime && (
                            <p style={styles.itemDetails}>
                              {formatGiftOption(
                                item.selectedOptionLabelAtTime,
                                item.selectedOptionAtTime
                              )}
                            </p>
                          )}
                          {item.selectedColorNameAtTime && (
                            <p style={styles.itemDetails}>
                              {formatGiftColor(item.selectedColorNameAtTime)}
                            </p>
                          )}
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

        <div style={styles.actionRow}>
          {order && (
            <button type="button" style={styles.secondaryButton} onClick={downloadReceipt}>
              Download Receipt
            </button>
          )}

          <button type="button" style={styles.button} onClick={onReturnToStart}>
            Return to Start
          </button>
        </div>
      </section>
    </main>
  );
}

function createPdfWriter() {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const bottomMargin = 54;
  let y = pageHeight - margin;
  let pages: string[][] = [[]];

  function currentPage() {
    return pages[pages.length - 1];
  }

  function addPage() {
    pages.push([]);
    y = pageHeight - margin;
  }

  function ensureSpace(height: number) {
    if (y - height < bottomMargin) {
      addPage();
    }
  }

  function escapePdfText(value: string) {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[^\x20-\x7E]/g, " ");
  }

  function wrapText(value: string, maxChars: number) {
    const words = value.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";

    words.forEach((word) => {
      const nextLine = line ? `${line} ${word}` : word;

      if (nextLine.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = nextLine;
      }
    });

    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function drawTextLine(
    value: string,
    x: number,
    size: number,
    bold = false,
    moveDown = true
  ) {
    ensureSpace(size + 8);
    currentPage().push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdfText(
        value
      )}) Tj ET`
    );

    if (moveDown) {
      y -= size + 6;
    }
  }

  return {
    text(value: string, x: number, size = 10, bold = false, maxChars = 72) {
      wrapText(value, maxChars).forEach((line) => drawTextLine(line, x, size, bold));
    },
    sameLine(value: string, x: number, size = 10, bold = false) {
      currentPage().push(
        `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y + size + 6} Td (${escapePdfText(
          value
        )}) Tj ET`
      );
    },
    rule() {
      ensureSpace(12);
      currentPage().push(`0.85 w ${margin} ${y} m ${pageWidth - margin} ${y} l S`);
      y -= 14;
    },
    space(amount: number) {
      ensureSpace(amount);
      y -= amount;
    },
    output() {
      const objects: string[] = [];
      const pageObjectIds: number[] = [];

      objects.push("<< /Type /Catalog /Pages 2 0 R >>");
      objects.push("PAGES_PLACEHOLDER");
      objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
      objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

      pages.forEach((commands, index) => {
        const content = commands.join("\n");
        const contentId = 5 + index * 2;
        const pageId = contentId + 1;

        objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
        objects.push(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`
        );
        pageObjectIds.push(pageId);
      });

      objects[1] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds
        .map((id) => `${id} 0 R`)
        .join(" ")}] >>`;

      let pdf = "%PDF-1.4\n";
      const offsets = [0];

      objects.forEach((object, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
      });

      const xrefOffset = pdf.length;
      pdf += `xref\n0 ${objects.length + 1}\n`;
      pdf += "0000000000 65535 f \n";
      offsets.slice(1).forEach((offset) => {
        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
      });
      pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

      return pdf;
    },
  };
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
    backgroundColor: "var(--tg-primary)",
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
    color: "var(--tg-primary)",
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
    color: "var(--tg-primary)",
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
    color: "var(--tg-primary)",
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
    color: "var(--tg-primary)",
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
    color: "var(--tg-primary)",
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
  actionRow: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "12px",
  },
  button: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 18px",
    fontSize: "15px",
    fontWeight: 800,
    color: "#ffffff",
    backgroundColor: "var(--tg-primary)",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5d1",
    borderRadius: "12px",
    padding: "12px 18px",
    fontSize: "15px",
    fontWeight: 800,
    color: "var(--tg-primary)",
    backgroundColor: "#ffffff",
    cursor: "pointer",
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
