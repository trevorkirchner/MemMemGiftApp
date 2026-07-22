import { useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { clientBranding } from "../clientBranding";

const client = generateClient<Schema>();

type Tournament = Schema["Tournament"]["type"];

type PasscodeScreenProps = {
  onTournamentVerified: (tournament: Tournament) => void;
};

export default function PasscodeScreen({
  onTournamentVerified,
}: PasscodeScreenProps) {
  const [passcode, setPasscode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedPasscode = passcode.trim().toLowerCase();

    if (!cleanedPasscode) {
      setErrorMessage("Please enter the tournament passcode.");
      return;
    }

    try {
      setIsChecking(true);
      setErrorMessage("");

      const result = await client.models.Tournament.list({
        filter: {
          and: [
            {
              passcode: {
                eq: cleanedPasscode,
              },
            },
            {
              isOpen: {
                eq: true,
              },
            },
          ],
        },
      });

      const tournament = result.data[0];

      if (!tournament) {
        setErrorMessage("Invalid passcode. Please check the passcode and try again.");
        return;
      }

      onTournamentVerified(tournament);
    } catch (error) {
      console.error("Passcode lookup error:", error);
      setErrorMessage("Something went wrong while checking the passcode.");
    } finally {
      setIsChecking(false);
    }
  }

  function goToAdminLogin() {
    window.location.href = "/admin";
    }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <img
            src={clientBranding.logoUrl}
            alt={`${clientBranding.orgName} Logo`}
            style={styles.logoImage}
        />

        <h1 style={styles.title}>{clientBranding.participantPortalTitle}</h1>

        <p style={styles.subtitle}>
          Enter your tournament passcode to access the gift selection portal.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label htmlFor="passcode" style={styles.label}>
            Tournament Passcode
          </label>

          <input
            id="passcode"
            type="text"
            value={passcode}
            onChange={(event) => {
              setPasscode(event.target.value);
              setErrorMessage("");
            }}
            placeholder="Enter passcode"
            style={styles.input}
            autoComplete="off"
          />

          {errorMessage && <p style={styles.error}>{errorMessage}</p>}

          <button type="submit" disabled={isChecking} style={styles.button}>
            {isChecking ? "Checking..." : "Continue"}
            </button>

            <button
            type="button"
            onClick={goToAdminLogin}
            style={styles.adminButton}
            >
            Admin Login
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
  backgroundImage: `linear-gradient(rgba(10, 30, 22, 0.35), rgba(10, 30, 22, 0.35)), url(${clientBranding.backgroundImageUrl})`,
  backgroundSize: "cover",
  backgroundPosition: "center center",
  backgroundRepeat: "no-repeat",
  padding: "clamp(16px, 5vw, 24px)",
  boxSizing: "border-box",
},
  card: {
  width: "100%",
  maxWidth: "440px",
  boxSizing: "border-box",
  backgroundColor: "rgba(255, 255, 255, 0.94)",
  backdropFilter: "blur(8px)",
  borderRadius: "clamp(18px, 5vw, 24px)",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.24)",
  padding: "clamp(24px, 7vw, 36px)",
  textAlign: "center",
},
  logoCircle: {
    width: "64px",
    height: "64px",
    borderRadius: "999px",
    backgroundColor: clientBranding.primaryColor,
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: 700,
    margin: "0 auto 20px",
  },
  logoImage: {
  width: "clamp(90px, 18vw, 150px)",
  height: "auto",
  objectFit: "contain",
  display: "block",
  margin: "0 auto 20px",
},
  title: {
    margin: 0,
    fontSize: "clamp(26px, 8vw, 30px)",
    lineHeight: 1.1,
    color: clientBranding.primaryColor,
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
    marginTop: "10px",
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
    backgroundColor: clientBranding.primaryColor,
    cursor: "pointer",
    marginTop: "20px",
  },
  adminButton: {
  width: "100%",
  border: `1px solid ${clientBranding.primaryColor}`,
  borderRadius: "12px",
  padding: "13px 16px",
  fontSize: "15px",
  fontWeight: 800,
  color: clientBranding.primaryColor,
  backgroundColor: "rgba(255, 255, 255, 0.8)",
  cursor: "pointer",
  marginTop: "12px",
},
};
