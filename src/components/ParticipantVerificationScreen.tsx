import { useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import hole7 from "../assets/hole7.png";
import penLogo from "../assets/PenGoldLogo.png";

const client = generateClient<Schema>();

type Tournament = Schema["Tournament"]["type"];
type Participant = Schema["Participant"]["type"];

type ParticipantVerificationScreenProps = {
  tournament: Tournament;
  onParticipantVerified: (participant: Participant) => void;
  onBack: () => void;
};

export default function ParticipantVerificationScreen({
  tournament,
  onParticipantVerified,
  onBack,
}: ParticipantVerificationScreenProps) {
  const [email, setEmail] = useState("");
  const [memberNumber, setMemberNumber] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedEmail = email.trim().toLowerCase();
    const cleanedMemberNumber = memberNumber.trim();

    if (!cleanedEmail || !cleanedMemberNumber) {
      setErrorMessage("Please enter your email and member number.");
      return;
    }

    try {
      setIsChecking(true);
      setErrorMessage("");

      const result = await client.models.Participant.list({
        filter: {
          and: [
            {
              tournamentId: {
                eq: tournament.id,
              },
            },
            {
              email: {
                eq: cleanedEmail,
              },
            },
            {
              memberNumber: {
                eq: cleanedMemberNumber,
              },
            },
          ],
        },
      });

      const participant = result.data[0];

      if (!participant) {
        setErrorMessage(
          "We could not find a participant matching that email and member number."
        );
        return;
      }

      onParticipantVerified(participant);
    } catch (error) {
      console.error("Participant verification error:", error);
      setErrorMessage("Something went wrong while verifying your information.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <button type="button" onClick={onBack} style={styles.backButton}>
          ← Back
        </button>

        <img
            src={penLogo}
            alt="Peninsula Logo"
            style={styles.logoImage}
        />

        <h1 style={styles.title}>Verify Your Information</h1>

        <p style={styles.subtitle}>
          You are entering <strong>{tournament.name}</strong>. Please verify
          your email and member number to continue.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label htmlFor="email" style={styles.label}>
            Email
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrorMessage("");
            }}
            placeholder="Enter your email"
            style={styles.input}
            autoComplete="email"
          />

          <label htmlFor="memberNumber" style={styles.label}>
            Member Number
          </label>

          <input
            id="memberNumber"
            type="text"
            value={memberNumber}
            onChange={(event) => {
              setMemberNumber(event.target.value);
              setErrorMessage("");
            }}
            placeholder="Enter your member number"
            style={styles.input}
            autoComplete="off"
          />

          {errorMessage && <p style={styles.error}>{errorMessage}</p>}

          <button type="submit" disabled={isChecking} style={styles.button}>
            {isChecking ? "Verifying..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundImage: `linear-gradient(rgba(10, 30, 22, 0.35), rgba(10, 30, 22, 0.35)), url(${hole7})`,
  backgroundSize: "cover",
  backgroundPosition: "center center",
  backgroundRepeat: "no-repeat",
  padding: "clamp(16px, 5vw, 24px)",
  boxSizing: "border-box",
},
  card: {
  position: "relative",
  width: "100%",
  maxWidth: "460px",
  boxSizing: "border-box",
  backgroundColor: "rgba(255, 255, 255, 0.94)",
  backdropFilter: "blur(8px)",
  borderRadius: "clamp(18px, 5vw, 24px)",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.24)",
  padding: "clamp(30px, 8vw, 36px) clamp(24px, 7vw, 36px)",
  textAlign: "center",
},
logoImage: {
  width: "clamp(90px, 18vw, 150px)",
  height: "auto",
  objectFit: "contain",
  display: "block",
  margin: "0 auto 20px",
},
  backButton: {
    position: "absolute",
    top: "20px",
    left: "20px",
    border: "none",
    background: "transparent",
    color: "#123c2c",
    fontWeight: 700,
    cursor: "pointer",
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
    fontSize: "28px",
    fontWeight: 700,
    margin: "0 auto 20px",
  },
  title: {
    margin: 0,
    fontSize: "clamp(25px, 8vw, 30px)",
    lineHeight: 1.1,
    color: "#123c2c",
  },
  subtitle: {
    color: "#5f6f68",
    fontSize: "16px",
    lineHeight: 1.5,
    marginTop: "12px",
    marginBottom: "28px",
  },
  form: {
    textAlign: "left",
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#263a32",
    marginBottom: "8px",
    marginTop: "14px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #ccd8d1",
    borderRadius: "12px",
    padding: "14px 16px",
    fontSize: "16px",
    outline: "none",
  },
  error: {
    color: "#b42318",
    fontSize: "14px",
    marginTop: "12px",
    marginBottom: 0,
  },
  button: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    padding: "14px 16px",
    fontSize: "16px",
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "#123c2c",
    cursor: "pointer",
    marginTop: "22px",
  },
};
