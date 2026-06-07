import { useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

export default function SeedDataButton() {
  const [status, setStatus] = useState("");

  async function seedData() {
    try {
      setStatus("Checking for existing tournament...");

      const existingTournaments = await client.models.Tournament.list({
        filter: {
          passcode: {
            eq: "penmem26",
          },
        },
      });

      if (existingTournaments.data.length > 0) {
        setStatus("Seed data already exists. Tournament with passcode penmem26 was found.");
        return;
      }

      setStatus("Creating tournament...");

      const tournamentResult = await client.models.Tournament.create({
        name: "Peninsula Member-Member 2026",
        passcode: "penmem26",
        defaultPoints: 30,
        isOpen: true,
      });

      const tournament = tournamentResult.data;

      if (!tournament?.id) {
        throw new Error("Tournament was not created.");
      }

      setStatus("Creating participant...");

      await client.models.Participant.create({
        tournamentId: tournament.id,
        firstName: "Trevor",
        lastName: "Test",
        email: "test@example.com",
        memberNumber: "12345",
        startingPoints: 30,
        hasSubmittedOrder: false,
      });

      setStatus("Creating gift items...");

      const giftItems = [
        {
          title: "Titleist Pro V1 Golf Balls",
          description: "One dozen Titleist Pro V1 golf balls.",
          pointCost: 8,
          quantityAvailable: 50,
          sortOrder: 1,
          isActive: true,
          imageUrl: "https://placehold.co/600x400?text=Golf+Balls",
        },
        {
          title: "Golf Polo",
          description: "Tournament golf polo shirt.",
          pointCost: 15,
          quantityAvailable: 40,
          sortOrder: 2,
          isActive: true,
          imageUrl: "https://placehold.co/600x400?text=Golf+Polo",
        },
        {
          title: "Clubhouse Gift Card",
          description: "Gift card redeemable at the clubhouse.",
          pointCost: 20,
          quantityAvailable: 30,
          sortOrder: 3,
          isActive: true,
          imageUrl: "https://placehold.co/600x400?text=Gift+Card",
        },
        {
          title: "Golf Towel",
          description: "Premium tournament golf towel.",
          pointCost: 5,
          quantityAvailable: 75,
          sortOrder: 4,
          isActive: true,
          imageUrl: "https://placehold.co/600x400?text=Golf+Towel",
        },
      ];

      for (const gift of giftItems) {
        await client.models.GiftItem.create({
          tournamentId: tournament.id,
          ...gift,
        });
      }

      setStatus("Seed data created successfully.");
    } catch (error) {
      console.error("Seed data error:", error);
      setStatus("Error creating seed data. Check the browser console.");
    }
  }

  return (
    <div style={{ padding: "24px", border: "1px solid #ccc", margin: "24px" }}>
      <h2>Dev Seed Data</h2>

      <p>
        This will create one tournament, one test participant, and four gift items.
      </p>

      <button onClick={seedData}>Create Seed Data</button>

      {status && <p>{status}</p>}
    </div>
  );
}