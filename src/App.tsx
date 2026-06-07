import { useState } from "react";
import type { Schema } from "../amplify/data/resource";
import PasscodeScreen from "./components/PasscodeScreen";
import ParticipantVerificationScreen from "./components/ParticipantVerificationScreen";
import GiftCatalogScreen from "./components/GiftCatalogScreen";
import CheckoutScreen from "./components/CheckoutScreen";
import SubmittedOrderScreen from "./components/SubmittedOrderScreen";
import AdminAuthGate from "./components/AdminAuthGate";
//import AdminDevScreen from "./components/AdminDevScreen";

type Tournament = Schema["Tournament"]["type"];
type Participant = Schema["Participant"]["type"];

type PortalStep = "passcode" | "participant" | "catalog" | "checkout" | "submitted";

function App() {
  const [portalStep, setPortalStep] = useState<PortalStep>("passcode");

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(
    null
  );

  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);

  const isAdminRoute =
    window.location.pathname === "/admin" ||
    window.location.pathname.startsWith("/admin/");

  if (isAdminRoute) {
    return <AdminAuthGate />;
  }
    

  if (portalStep === "passcode" || !selectedTournament) {
    return (
      <PasscodeScreen
        onTournamentVerified={(tournament) => {
          setSelectedTournament(tournament);
          setPortalStep("participant");
        }}
      />
    );
  }

  if (portalStep === "participant" || !selectedParticipant) {
    return (
      <ParticipantVerificationScreen
        tournament={selectedTournament}
        onParticipantVerified={(participant) => {
          setSelectedParticipant(participant);

          if (participant.hasSubmittedOrder) {
            setPortalStep("submitted");
          } else {
            setPortalStep("catalog");
          }
        }}
        onBack={() => {
          setSelectedTournament(null);
          setPortalStep("passcode");
        }}
      />
    );
  }

  if (portalStep === "checkout") {
    return (
      <CheckoutScreen
        tournament={selectedTournament}
        participant={selectedParticipant}
        onBackToCatalog={() => {
          setPortalStep("catalog");
        }}
        onOrderSubmitted={(updatedParticipant) => {
          setSelectedParticipant(updatedParticipant);
          setPortalStep("submitted");
        }}
      />
    );
  }

  if (portalStep === "submitted") {
  return (
    <SubmittedOrderScreen
      tournament={selectedTournament}
      participant={selectedParticipant}
      onReturnToStart={() => {
        setSelectedTournament(null);
        setSelectedParticipant(null);
        setPortalStep("passcode");
      }}
    />
  );
}

  return (
    <GiftCatalogScreen
      tournament={selectedTournament}
      participant={selectedParticipant}
      onBack={() => {
        setSelectedParticipant(null);
        setPortalStep("participant");
      }}
      onContinueToCheckout={() => {
        setPortalStep("checkout");
      }}
    />
  );
}

export default App;
