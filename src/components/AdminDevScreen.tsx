import { useEffect, useMemo, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import {
  getGiftImageUrl,
  removeGiftImage,
  uploadGiftImage,
} from "../utils/giftImageStorage";
import {
  createGiftColorOption,
  formatGiftColor,
  getDefaultGiftColor,
  normalizeGiftColors,
  parseGiftColors,
  serializeGiftColors,
  type GiftColorOption,
} from "../utils/giftColors";
import {
  formatGiftOption,
  parseGiftOptions,
  serializeGiftOptions,
} from "../utils/giftOptions";

const client = generateClient<Schema>();

type Tournament = Schema["Tournament"]["type"];
type Participant = Schema["Participant"]["type"];
type GiftItem = Schema["GiftItem"]["type"];
type Order = Schema["Order"]["type"];
type OrderItem = Schema["OrderItem"]["type"];
type CartItem = Schema["CartItem"]["type"];
type GiftImage = Schema["GiftImage"]["type"];

type SortDirection = "asc" | "desc";

type SortConfig<TSortKey extends string> = {
  key: TSortKey;
  direction: SortDirection;
};

type ParticipantSortKey =
  | "name"
  | "email"
  | "memberNumber"
  | "tournament"
  | "startingPoints"
  | "submitted";

type OrderSortKey =
  | "member"
  | "tournament"
  | "totalPointsUsed"
  | "status"
  | "submittedAt";

type CsvParticipantRow = {
  firstName: string;
  lastName: string;
  email: string;
  memberNumber: string;
  startingPoints: number;
  rowNumber: number;
};

type SubmittedOrderExportRow = {
  tournamentName: string;
  orderId: string;
  participantName: string;
  firstName: string;
  lastName: string;
  email: string;
  memberNumber: string;
  status: string;
  submittedAt: string;
  startingPoints: number;
  totalPointsUsed: number;
  remainingPoints: number;
  overagePoints: number;
  dollarPerPoint: number;
  amountOwed: number;
  itemCount: number;
  uniqueGiftCount: number;
  giftDetails: string;
};

type ButtonIconName =
  | "check"
  | "download"
  | "edit"
  | "eye"
  | "image"
  | "plus"
  | "receipt"
  | "refresh"
  | "reset"
  | "save"
  | "trash"
  | "upload"
  | "x";

const commonColorHexByName: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  red: "#dc2626",
  maroon: "#7f1d1d",
  orange: "#f97316",
  gold: "#d4af37",
  yellow: "#facc15",
  green: "#16a34a",
  lime: "#84cc16",
  blue: "#2563eb",
  navy: "#1e3a8a",
  purple: "#9333ea",
  pink: "#ec4899",
  brown: "#92400e",
  tan: "#d2b48c",
};

export default function AdminDevScreen() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [giftItems, setGiftItems] = useState<GiftItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");

  const [participantSearch, setParticipantSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [giftSearch, setGiftSearch] = useState("");

  const [participantSort, setParticipantSort] =
    useState<SortConfig<ParticipantSortKey>>({
      key: "name",
      direction: "asc",
    });

  const [orderSort, setOrderSort] = useState<SortConfig<OrderSortKey>>({
    key: "submittedAt",
    direction: "desc",
  });

  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    () => new Set()
  );

  const [isCreateTournamentOpen, setIsCreateTournamentOpen] = useState(false);
  const [isEditTournamentOpen, setIsEditTournamentOpen] = useState(false);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [isAddGiftOpen, setIsAddGiftOpen] = useState(false);

  const [csvTournamentId, setCsvTournamentId] = useState("");
  const [csvRows, setCsvRows] = useState<CsvParticipantRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const [giftImages, setGiftImages] = useState<GiftImage[]>([]);
  const [selectedGiftImageUrls, setSelectedGiftImageUrls] = useState<Record<string, string>>({});
  const [imageUploadFiles, setImageUploadFiles] = useState<FileList | null>(null);
  const [newGiftImageFiles, setNewGiftImageFiles] = useState<FileList | null>(null);
  const [newGiftPrimaryImageIndex, setNewGiftPrimaryImageIndex] = useState(0);
  const [editGiftImages, setEditGiftImages] = useState<GiftImage[]>([]);
  const [editGiftPrimaryImageId, setEditGiftPrimaryImageId] = useState("");
  const [draggedGiftImageId, setDraggedGiftImageId] = useState("");
  const [dragOverGiftImageId, setDragOverGiftImageId] = useState("");
  const [previewGiftImage, setPreviewGiftImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);
  const [giftCardImageUrlsByGiftId, setGiftCardImageUrlsByGiftId] =
  useState<Record<string, string>>({});
  const [selectedGiftForEdit, setSelectedGiftForEdit] = useState<GiftItem | null>(null);

    const [editGift, setEditGift] = useState({
    title: "",
    description: "",
    pointCost: "",
    sortOrder: "",
    hasOptions: false,
    optionLabel: "",
    optionValues: [""],
    hasColors: false,
    colorOptions: [createGiftColorOption({ isDefault: true })],
    isActive: true,
    });

  const [newTournament, setNewTournament] = useState({
    name: "",
    passcode: "",
    defaultPoints: "30",
    allowOverPoints: false,
    pointDollarValue: "0",
    isOpen: true,
  });

  const [editTournament, setEditTournament] = useState({
    name: "",
    passcode: "",
    defaultPoints: "",
    allowOverPoints: false,
    pointDollarValue: "0",
    isOpen: true,
  });

  const [newParticipant, setNewParticipant] = useState({
    tournamentId: "",
    firstName: "",
    lastName: "",
    email: "",
    memberNumber: "",
    startingPoints: "30",
  });

  const [newGift, setNewGift] = useState({
    tournamentId: "",
    title: "",
    description: "",
    imageUrl: "",
    pointCost: "",
    sortOrder: "",
    hasOptions: false,
    optionLabel: "",
    optionValues: [""],
    hasColors: false,
    colorOptions: [createGiftColorOption({ isDefault: true })],
    isActive: true,
  });

  const participantsById = useMemo(() => {
    return new Map(participants.map((participant) => [participant.id, participant]));
  }, [participants]);

  const tournamentsById = useMemo(() => {
    return new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  }, [tournaments]);

  const selectedTournament = useMemo(() => {
    return tournamentsById.get(selectedTournamentId) ?? null;
  }, [selectedTournamentId, tournamentsById]);

  const tournamentParticipants = useMemo(() => {
    if (!selectedTournamentId) return [];
    return participants.filter(
      (participant) => participant.tournamentId === selectedTournamentId
    );
  }, [participants, selectedTournamentId]);

  const tournamentGiftItems = useMemo(() => {
    if (!selectedTournamentId) return [];
    return giftItems.filter((gift) => gift.tournamentId === selectedTournamentId);
  }, [giftItems, selectedTournamentId]);

  const tournamentOrders = useMemo(() => {
    if (!selectedTournamentId) return [];
    return orders.filter((order) => order.tournamentId === selectedTournamentId);
  }, [orders, selectedTournamentId]);

  const tournamentCartItems = useMemo(() => {
    if (!selectedTournamentId) return [];
    return cartItems.filter((cartItem) => cartItem.tournamentId === selectedTournamentId);
  }, [cartItems, selectedTournamentId]);

  const tournamentSubmittedPoints = useMemo(() => {
    return tournamentOrders.reduce((total, order) => {
      return total + (order.totalPointsUsed ?? 0);
    }, 0);
  }, [tournamentOrders]);

  const tournamentAveragePointsUsed = useMemo(() => {
    if (tournamentOrders.length === 0) return 0;
    return Math.round(tournamentSubmittedPoints / tournamentOrders.length);
  }, [tournamentOrders.length, tournamentSubmittedPoints]);

  const orderItemsForSelectedOrder = useMemo(() => {
    if (!selectedOrder) return [];
    return orderItems.filter((item) => item.orderId === selectedOrder.id);
  }, [selectedOrder, orderItems]);

  const selectedParticipantCartItems = useMemo(() => {
    if (!selectedParticipant) return [];

    return tournamentCartItems.filter(
      (cartItem) => cartItem.participantId === selectedParticipant.id
    );
  }, [selectedParticipant, tournamentCartItems]);

  const selectedParticipantOrders = useMemo(() => {
    if (!selectedParticipant) return [];

    return tournamentOrders
      .filter((order) => order.participantId === selectedParticipant.id)
      .sort((a, b) => {
        const aDate = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bDate = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return bDate - aDate;
      });
  }, [selectedParticipant, tournamentOrders]);

  const selectedParticipantCartTotal = useMemo(() => {
    return selectedParticipantCartItems.reduce((total, cartItem) => {
      return total + (cartItem.quantity ?? 0) * (cartItem.pointCostAtTime ?? 0);
    }, 0);
  }, [selectedParticipantCartItems]);

  const selectedSubmittedOrders = useMemo(() => {
    return tournamentOrders.filter((order) => selectedOrderIds.has(order.id));
  }, [selectedOrderIds, tournamentOrders]);

  const filteredParticipants = useMemo(() => {
    const search = participantSearch.trim().toLowerCase();

    const filtered = tournamentParticipants.filter((participant) => {
      const tournament = tournamentsById.get(participant.tournamentId);

      const searchable = [
        participant.firstName,
        participant.lastName,
        participant.email,
        participant.memberNumber,
        tournament?.name,
        participant.hasSubmittedOrder ? "submitted" : "not submitted",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(search);
    });

    return [...filtered].sort((a, b) => {
      const aValue = getParticipantSortValue(a, participantSort.key);
      const bValue = getParticipantSortValue(b, participantSort.key);

      return compareValues(aValue, bValue, participantSort.direction);
    });
  }, [tournamentParticipants, participantSearch, participantSort, tournamentsById]);

  const filteredOrders = useMemo(() => {
    const search = orderSearch.trim().toLowerCase();

    const filtered = tournamentOrders.filter((order) => {
      const participant = participantsById.get(order.participantId);
      const tournament = tournamentsById.get(order.tournamentId);

      const searchable = [
        participant?.firstName,
        participant?.lastName,
        participant?.email,
        participant?.memberNumber,
        tournament?.name,
        order.totalPointsUsed,
        order.status,
        order.submittedAt,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(search);
    });

    return [...filtered].sort((a, b) => {
      const aValue = getOrderSortValue(a, orderSort.key);
      const bValue = getOrderSortValue(b, orderSort.key);

      return compareValues(aValue, bValue, orderSort.direction);
    });
  }, [tournamentOrders, orderSearch, orderSort, participantsById, tournamentsById]);

  const filteredGifts = useMemo(() => {
    const search = giftSearch.trim().toLowerCase();

    return tournamentGiftItems
      .filter((gift) => {
        const tournament = tournamentsById.get(gift.tournamentId);

        const searchable = [
          gift.title,
          gift.description,
          gift.pointCost,
          gift.quantityAvailable,
          tournament?.name,
          gift.isActive ? "active" : "inactive",
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(search);
      })
      .sort((a, b) => {
        const aSort = a.sortOrder ?? 9999;
        const bSort = b.sortOrder ?? 9999;

        if (aSort !== bSort) return aSort - bSort;
        return a.title.localeCompare(b.title);
      });
  }, [tournamentGiftItems, giftSearch, tournamentsById]);

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) return;

    setNewParticipant((current) => ({
      ...current,
      tournamentId: selectedTournamentId,
    }));

    setNewGift((current) => ({
      ...current,
      tournamentId: selectedTournamentId,
    }));

    setCsvTournamentId(selectedTournamentId);

    if (selectedOrder?.tournamentId !== selectedTournamentId) {
      setSelectedOrder(null);
    }

    if (selectedParticipant?.tournamentId !== selectedTournamentId) {
      setSelectedParticipant(null);
    }
  }, [
    selectedTournamentId,
    selectedOrder?.tournamentId,
    selectedParticipant?.tournamentId,
  ]);

  useEffect(() => {
    setSelectedOrderIds((current) => {
      const validOrderIds = new Set(tournamentOrders.map((order) => order.id));
      const next = new Set(
        Array.from(current).filter((orderId) => validOrderIds.has(orderId))
      );

      return next.size === current.size ? current : next;
    });
  }, [tournamentOrders]);

  async function loadAdminData() {
    try {
      setIsLoading(true);
      setMessage("");

      const [
        tournamentResult,
        participantResult,
        giftResult,
        giftImageResult,
        orderResult,
        orderItemResult,
        cartResult,
        ] = await Promise.all([
        client.models.Tournament.list(),
        client.models.Participant.list(),
        client.models.GiftItem.list(),
        client.models.GiftImage.list(),
        client.models.Order.list(),
        client.models.OrderItem.list(),
        client.models.CartItem.list(),
     ]);

      setTournaments(tournamentResult.data);
    setParticipants(participantResult.data);
    setGiftItems(giftResult.data);
    setGiftImages(giftImageResult.data);
    setOrders(orderResult.data);
    setOrderItems(orderItemResult.data);
    setCartItems(cartResult.data);

    await loadAdminGiftCardImages(giftResult.data, giftImageResult.data);

      const firstTournamentId = tournamentResult.data[0]?.id ?? "";

      setSelectedTournamentId((current) => {
        if (current && tournamentResult.data.some((tournament) => tournament.id === current)) {
          return current;
        }

        return firstTournamentId;
      });

      if (firstTournamentId) {

        setNewParticipant((current) => ({
          ...current,
          tournamentId: current.tournamentId || selectedTournamentId || firstTournamentId,
        }));

        setNewGift((current) => ({
          ...current,
          tournamentId: current.tournamentId || selectedTournamentId || firstTournamentId,
        }));

        setCsvTournamentId((current) => current || selectedTournamentId || firstTournamentId);
      }
    } catch (error) {
      console.error("Admin load error:", error);
      setMessage("Error loading admin data. Check the browser console.");
    } finally {
      setIsLoading(false);
    }
  }

  function compareValues(
    aValue: string | number | boolean | null | undefined,
    bValue: string | number | boolean | null | undefined,
    direction: SortDirection
  ) {
    const modifier = direction === "asc" ? 1 : -1;

    const a = aValue ?? "";
    const b = bValue ?? "";

    if (typeof a === "number" && typeof b === "number") {
      return (a - b) * modifier;
    }

    return String(a).localeCompare(String(b)) * modifier;
  }

  function getParticipantSortValue(
    participant: Participant,
    key: ParticipantSortKey
  ) {
    const tournament = tournamentsById.get(participant.tournamentId);

    switch (key) {
      case "name":
        return `${participant.lastName} ${participant.firstName}`;
      case "email":
        return participant.email;
      case "memberNumber":
        return participant.memberNumber;
      case "tournament":
        return tournament?.name ?? "";
      case "startingPoints":
        return participant.startingPoints ?? 0;
      case "submitted":
        return participant.hasSubmittedOrder ? 1 : 0;
      default:
        return "";
    }
  }

  function getOrderSortValue(order: Order, key: OrderSortKey) {
    const participant = participantsById.get(order.participantId);
    const tournament = tournamentsById.get(order.tournamentId);

    switch (key) {
      case "member":
        return participant
          ? `${participant.lastName} ${participant.firstName}`
          : "";
      case "tournament":
        return tournament?.name ?? "";
      case "totalPointsUsed":
        return order.totalPointsUsed ?? 0;
      case "status":
        return order.status ?? "";
      case "submittedAt":
        return order.submittedAt
          ? new Date(order.submittedAt).getTime()
          : 0;
      default:
        return "";
    }
  }

  function toggleParticipantSort(key: ParticipantSortKey) {
    setParticipantSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function toggleOrderSort(key: OrderSortKey) {
    setOrderSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function openCreateTournamentModal() {
    setMessage("");
    setIsCreateTournamentOpen(true);
  }

  function openEditTournamentModal() {
    if (!selectedTournament) {
      setMessage("Select a tournament to edit.");
      return;
    }

    setMessage("");
    setEditTournament({
      name: selectedTournament.name ?? "",
      passcode: selectedTournament.passcode ?? "",
      defaultPoints: String(selectedTournament.defaultPoints ?? ""),
      allowOverPoints: selectedTournament.allowOverPoints ?? false,
      pointDollarValue: String(selectedTournament.pointDollarValue ?? 0),
      isOpen: selectedTournament.isOpen ?? true,
    });
    setIsEditTournamentOpen(true);
  }

  function openAddParticipantModal() {
    setMessage("");
    if (selectedTournamentId) {
      setNewParticipant((current) => ({
        ...current,
        tournamentId: selectedTournamentId,
      }));
    }
    setIsAddParticipantOpen(true);
  }

  function openCsvUploadModal() {
    setMessage("");
    setCsvRows([]);
    setCsvErrors([]);
    if (selectedTournamentId) setCsvTournamentId(selectedTournamentId);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsCsvUploadOpen(true);
  }

  function openAddGiftModal() {
    setMessage("");
    if (selectedTournamentId) {
      const nextSortOrder = getNextGiftSortOrder(selectedTournamentId);
      setNewGift((current) => ({
        ...current,
        tournamentId: selectedTournamentId,
        sortOrder: String(nextSortOrder),
      }));
    }
    setNewGiftPrimaryImageIndex(0);
    setIsAddGiftOpen(true);
  }

  async function openEditGiftModal(gift: GiftItem) {
  setMessage("");

  setSelectedGiftForEdit(gift);

  const currentSortPosition =
    getOrderedTournamentGifts(gift.tournamentId).findIndex(
      (item) => item.id === gift.id
    ) + 1;

  const colorOptions = parseGiftColors(gift.colorOptions);

  setEditGift({
    title: gift.title ?? "",
    description: gift.description ?? "",
    pointCost: String(gift.pointCost ?? ""),
    sortOrder: gift.sortOrder === null || gift.sortOrder === undefined
      ? String(Math.max(currentSortPosition, 1))
      : String(gift.sortOrder),
    hasOptions: parseGiftOptions(gift.optionValues).length > 0,
    optionLabel: gift.optionLabel ?? "",
    optionValues: parseGiftOptions(gift.optionValues).length > 0
      ? parseGiftOptions(gift.optionValues)
      : [""],
    hasColors: colorOptions.length > 0,
    colorOptions: colorOptions.length > 0
      ? colorOptions
      : [createGiftColorOption({ isDefault: true })],
    isActive: gift.isActive ?? true,
  });

  const images = giftImages
    .filter((image) => image.giftItemId === gift.id)
    .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
  setEditGiftImages(images);
  setEditGiftPrimaryImageId(
    images.find((image) => image.isPrimary)?.id ?? images[0]?.id ?? ""
  );

  const missingUrls = images.filter((image) => !selectedGiftImageUrls[image.id]);
  if (missingUrls.length > 0) {
    const urlEntries = await Promise.all(
      missingUrls.map(async (image) => {
        const url = await getGiftImageUrl(image.imageKey);
        return [image.id, url] as const;
      })
    );

    setSelectedGiftImageUrls((current) => ({
      ...current,
      ...Object.fromEntries(urlEntries),
    }));
  }
}

  function getOrderedTournamentGifts(tournamentId: string) {
    return giftItems
      .filter((gift) => gift.tournamentId === tournamentId)
      .sort((a, b) => {
        const aSort = a.sortOrder ?? 9999;
        const bSort = b.sortOrder ?? 9999;

        if (aSort !== bSort) return aSort - bSort;
        return a.title.localeCompare(b.title);
      });
  }

  function getNextGiftSortOrder(tournamentId: string) {
    return getOrderedTournamentGifts(tournamentId).length + 1;
  }

  function normalizeSortOrder(value: string, maxPosition: number) {
    const numericValue = Number(value);

    if (!value.trim() || Number.isNaN(numericValue)) {
      return maxPosition;
    }

    return Math.min(Math.max(Math.round(numericValue), 1), maxPosition);
  }

  async function insertGiftSortOrderBeforeCreate(
    tournamentId: string,
    desiredPosition: number
  ) {
    const orderedGifts = getOrderedTournamentGifts(tournamentId);
    const clampedPosition = Math.min(
      Math.max(desiredPosition, 1),
      orderedGifts.length + 1
    );

    await Promise.all(
      orderedGifts
        .map((gift, index) => ({ gift, currentPosition: index + 1 }))
        .filter(({ currentPosition }) => currentPosition >= clampedPosition)
        .map(({ gift, currentPosition }) =>
          client.models.GiftItem.update({
            id: gift.id,
            sortOrder: (gift.sortOrder ?? currentPosition) + 1,
          })
        )
    );

    return clampedPosition;
  }

  async function reorderGiftItemsAfterEdit(
    gift: GiftItem,
    desiredPosition: number
  ) {
    const orderedGifts = getOrderedTournamentGifts(gift.tournamentId).filter(
      (item) => item.id !== gift.id
    );
    const clampedPosition = Math.min(
      Math.max(desiredPosition, 1),
      orderedGifts.length + 1
    );
    const reorderedGifts = [...orderedGifts];

    reorderedGifts.splice(clampedPosition - 1, 0, gift);

    await Promise.all(
      reorderedGifts.map((item, index) => {
        const nextSortOrder = index + 1;

        if (item.id === gift.id || item.sortOrder === nextSortOrder) {
          return Promise.resolve();
        }

        return client.models.GiftItem.update({
          id: item.id,
          sortOrder: nextSortOrder,
        });
      })
    );

    return clampedPosition;
  }

async function addTournament(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const name = newTournament.name.trim();
  const passcode = newTournament.passcode.trim().toLowerCase();
  const defaultPoints = Number(newTournament.defaultPoints);
  const pointDollarValue = Number(newTournament.pointDollarValue);

  if (
    !name ||
    !passcode ||
    Number.isNaN(defaultPoints) ||
    Number.isNaN(pointDollarValue)
  ) {
    setMessage(
      "Please enter a tournament name, passcode, default points, and dollar amount per point."
    );
    return;
  }

  const duplicate = tournaments.some(
    (tournament) => tournament.passcode?.toLowerCase() === passcode
  );

  if (duplicate) {
    setMessage("A tournament with that passcode already exists.");
    return;
  }

  try {
    setIsWorking(true);
    setMessage("");

    const tournamentResult = await client.models.Tournament.create({
      name,
      passcode,
      defaultPoints,
      allowOverPoints: newTournament.allowOverPoints,
      pointDollarValue,
      isOpen: newTournament.isOpen,
    });

    const createdTournament = tournamentResult.data;

    if (!createdTournament?.id) {
      throw new Error("Tournament was not created.");
    }

    setSelectedTournamentId(createdTournament.id);
    setNewTournament({
      name: "",
      passcode: "",
      defaultPoints: "30",
      allowOverPoints: false,
      pointDollarValue: "0",
      isOpen: true,
    });
    setIsCreateTournamentOpen(false);
    setMessage("Tournament created.");

    await loadAdminData();
  } catch (error) {
    console.error("Add tournament error:", error);
    setMessage("Error creating tournament. Check the browser console.");
  } finally {
    setIsWorking(false);
  }
}

async function updateTournament(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!selectedTournament) {
    setMessage("Select a tournament to edit.");
    return;
  }

  const name = editTournament.name.trim();
  const passcode = editTournament.passcode.trim().toLowerCase();
  const defaultPoints = Number(editTournament.defaultPoints);
  const pointDollarValue = Number(editTournament.pointDollarValue);

  if (
    !name ||
    !passcode ||
    Number.isNaN(defaultPoints) ||
    Number.isNaN(pointDollarValue)
  ) {
    setMessage(
      "Please enter a tournament name, passcode, default points, and dollar amount per point."
    );
    return;
  }

  const duplicate = tournaments.some(
    (tournament) =>
      tournament.id !== selectedTournament.id &&
      tournament.passcode?.toLowerCase() === passcode
  );

  if (duplicate) {
    setMessage("A tournament with that passcode already exists.");
    return;
  }

  try {
    setIsWorking(true);
    setMessage("");

    await client.models.Tournament.update({
      id: selectedTournament.id,
      name,
      passcode,
      defaultPoints,
      allowOverPoints: editTournament.allowOverPoints,
      pointDollarValue,
      isOpen: editTournament.isOpen,
    });

    setIsEditTournamentOpen(false);
    setMessage("Tournament updated.");
    await loadAdminData();
  } catch (error) {
    console.error("Update tournament error:", error);
    setMessage("Error updating tournament. Check the browser console.");
  } finally {
    setIsWorking(false);
  }
}

async function updateGift(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!selectedGiftForEdit) {
    setMessage("No gift selected for editing.");
    return;
  }

  const title = editGift.title.trim();
  const description = editGift.description.trim();
  const pointCost = Number(editGift.pointCost);
  const sortOrder = normalizeSortOrder(
    editGift.sortOrder,
    getOrderedTournamentGifts(selectedGiftForEdit.tournamentId).length
  );
  const optionValues = editGift.hasOptions
    ? normalizeGiftOptionValues(editGift.optionValues)
    : [];
  const colorOptions = editGift.hasColors
    ? normalizeGiftColors(editGift.colorOptions)
    : [];

  if (!title || Number.isNaN(pointCost)) {
    setMessage("Please enter a gift title and valid point cost.");
    return;
  }

  if (editGift.hasOptions && optionValues.length === 0) {
    setMessage("Please add at least one option value for this gift.");
    return;
  }

  if (editGift.hasColors && colorOptions.length === 0) {
    setMessage("Please add at least one color option for this gift.");
    return;
  }

  try {
    setIsWorking(true);
    setMessage("");

    const nextSortOrder = await reorderGiftItemsAfterEdit(
      selectedGiftForEdit,
      sortOrder
    );

    await client.models.GiftItem.update({
      id: selectedGiftForEdit.id,
      title,
      description,
      pointCost,
      sortOrder: nextSortOrder,
      optionLabel: editGift.hasOptions ? editGift.optionLabel.trim() || "Option" : null,
      optionValues: editGift.hasOptions ? serializeGiftOptions(optionValues) : null,
      colorOptions: editGift.hasColors ? serializeGiftColors(colorOptions) : null,
      isActive: editGift.isActive,
    });

    const selectedGiftImages = editGiftImages.length
      ? editGiftImages
      : giftImages.filter((image) => image.giftItemId === selectedGiftForEdit.id);

    if (editGiftPrimaryImageId) {
      await Promise.all(
        selectedGiftImages.map((image, index) =>
          client.models.GiftImage.update({
            id: image.id,
            sortOrder: index + 1,
            isPrimary: image.id === editGiftPrimaryImageId,
            colorOptionId:
              colorOptions.find((color) => color.imageIds.includes(image.id))?.id ?? null,
          })
        )
      );
    }

    setSelectedGiftForEdit(null);
    setEditGiftImages([]);
    setEditGiftPrimaryImageId("");
    setDraggedGiftImageId("");
    setDragOverGiftImageId("");
    setMessage("Gift item updated.");
    await loadAdminData();
  } catch (error) {
    console.error("Update gift error:", error);
    setMessage("Error updating gift item. Check the browser console.");
  } finally {
    setIsWorking(false);
  }
}

  async function addParticipant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const firstName = newParticipant.firstName.trim();
    const lastName = newParticipant.lastName.trim();
    const email = newParticipant.email.trim().toLowerCase();
    const memberNumber = newParticipant.memberNumber.trim();
    const startingPoints = Number(newParticipant.startingPoints);

    if (
      !newParticipant.tournamentId ||
      !firstName ||
      !lastName ||
      !email ||
      !memberNumber ||
      Number.isNaN(startingPoints)
    ) {
      setMessage("Please complete all participant fields.");
      return;
    }

    const duplicate = participants.some(
      (participant) =>
        participant.tournamentId === newParticipant.tournamentId &&
        participant.email?.toLowerCase() === email &&
        participant.memberNumber === memberNumber
    );

    if (duplicate) {
      setMessage("A participant with that email and member number already exists for this tournament.");
      return;
    }

    try {
      setIsWorking(true);
      setMessage("");

      await client.models.Participant.create({
        tournamentId: newParticipant.tournamentId,
        firstName,
        lastName,
        email,
        memberNumber,
        startingPoints,
        hasSubmittedOrder: false,
      });

      setNewParticipant((current) => ({
        ...current,
        firstName: "",
        lastName: "",
        email: "",
        memberNumber: "",
        startingPoints: "30",
      }));

      setIsAddParticipantOpen(false);
      setMessage("Participant added.");
      await loadAdminData();
    } catch (error) {
      console.error("Add participant error:", error);
      setMessage("Error adding participant. Check the browser console.");
    } finally {
      setIsWorking(false);
    }
  }

async function uploadImagesForSelectedGift() {
  const giftForImages = selectedGiftForEdit;

  if (!giftForImages || !imageUploadFiles || imageUploadFiles.length === 0) {
    setMessage("Please choose one or more image files.");
    return;
  }

  try {
    setIsWorking(true);
    setMessage("");

    const existingImages = giftImages.filter(
      (image) => image.giftItemId === giftForImages.id
    );

    const files = Array.from(imageUploadFiles);

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];

      const imageKey = await uploadGiftImage({
        tournamentId: giftForImages.tournamentId,
        giftItemId: giftForImages.id,
        file,
      });

      await client.models.GiftImage.create({
        tournamentId: giftForImages.tournamentId,
        giftItemId: giftForImages.id,
        imageKey,
        altText: giftForImages.title,
        sortOrder: existingImages.length + index + 1,
        isPrimary: existingImages.length === 0 && index === 0,
      });
    }

    setMessage("Image upload complete.");
    setImageUploadFiles(null);
    await refreshSelectedGiftImages(giftForImages);
    await loadAdminData();
  } catch (error) {
    console.error("Upload gift images error:", error);
    setMessage("Error uploading images. Check the browser console.");
  } finally {
    setIsWorking(false);
  }
}

function reorderGiftImages(draggedImageId: string, targetImageId: string) {
  if (draggedImageId === targetImageId) return;

  const orderedImages = editGiftImages;

  const draggedIndex = orderedImages.findIndex(
    (image) => image.id === draggedImageId
  );
  const targetIndex = orderedImages.findIndex((image) => image.id === targetImageId);

  if (draggedIndex < 0 || targetIndex < 0) return;

  const reorderedImages = [...orderedImages];
  const [draggedImage] = reorderedImages.splice(draggedIndex, 1);
  reorderedImages.splice(targetIndex, 0, draggedImage);

  setEditGiftImages(reorderedImages);
  setEditGiftPrimaryImageId(reorderedImages[0]?.id ?? "");
  setDraggedGiftImageId("");
  setDragOverGiftImageId("");
}

async function deleteGiftImage(image: GiftImage) {
  const confirmed = window.confirm("Delete this image?");

  if (!confirmed) return;

  try {
    setIsWorking(true);
    setMessage("");

    await removeGiftImage(image.imageKey);
    await client.models.GiftImage.delete({ id: image.id });

    if (image.isPrimary) {
      const remainingImages = giftImages
        .filter(
          (giftImage) =>
            giftImage.giftItemId === image.giftItemId && giftImage.id !== image.id
        )
        .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));

      const nextPrimaryImage = remainingImages[0];

      if (nextPrimaryImage) {
        await client.models.GiftImage.update({
          id: nextPrimaryImage.id,
          isPrimary: true,
        });
      }
    }

    setMessage("Image deleted.");
    setEditGift((current) => ({
      ...current,
      colorOptions: current.colorOptions.map((color) => ({
        ...color,
        imageIds: color.imageIds.filter((id) => id !== image.id),
      })),
    }));
    if (selectedGiftForEdit) {
    await refreshSelectedGiftImages(selectedGiftForEdit);
    }

    await loadAdminData();
  } catch (error) {
    console.error("Delete gift image error:", error);
    setMessage("Error deleting image. Check the browser console.");
  } finally {
    setIsWorking(false);
  }
}

  async function handleCsvFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseParticipantCsv(text);
      setCsvRows(parsed.rows);
      setCsvErrors(parsed.errors);
    } catch (error) {
      console.error("CSV parse error:", error);
      setCsvRows([]);
      setCsvErrors(["Unable to read the selected CSV file."]);
    }
  }

  function parseParticipantCsv(csvText: string) {
    const rows = parseCsv(csvText).filter((row) =>
      row.some((cell) => cell.trim() !== "")
    );

    if (rows.length < 2) {
      return {
        rows: [] as CsvParticipantRow[],
        errors: ["CSV must include a header row and at least one participant row."],
      };
    }

    const headers = rows[0].map(normalizeHeader);

    const firstNameIndex = findHeaderIndex(headers, [
      "firstname",
      "first_name",
      "first name",
      "fname",
    ]);
    const lastNameIndex = findHeaderIndex(headers, [
      "lastname",
      "last_name",
      "last name",
      "lname",
    ]);
    const emailIndex = findHeaderIndex(headers, ["email", "emailaddress", "email address"]);
    const memberNumberIndex = findHeaderIndex(headers, [
      "membernumber",
      "member_number",
      "member number",
      "memberno",
      "member no",
      "memberid",
      "member id",
    ]);
    const startingPointsIndex = findHeaderIndex(headers, [
      "startingpoints",
      "starting_points",
      "starting points",
      "points",
    ]);

    const missingColumns: string[] = [];
    if (firstNameIndex === -1) missingColumns.push("firstName");
    if (lastNameIndex === -1) missingColumns.push("lastName");
    if (emailIndex === -1) missingColumns.push("email");
    if (memberNumberIndex === -1) missingColumns.push("memberNumber");

    if (missingColumns.length > 0) {
      return {
        rows: [] as CsvParticipantRow[],
        errors: [
          `Missing required column(s): ${missingColumns.join(", ")}.`,
          "Expected columns: firstName,lastName,email,memberNumber,startingPoints",
        ],
      };
    }

    const parsedRows: CsvParticipantRow[] = [];
    const errors: string[] = [];

    rows.slice(1).forEach((row, index) => {
      const rowNumber = index + 2;
      const firstName = row[firstNameIndex]?.trim() || "";
      const lastName = row[lastNameIndex]?.trim() || "";
      const email = row[emailIndex]?.trim().toLowerCase() || "";
      const memberNumber = row[memberNumberIndex]?.trim() || "";
      const startingPointsRaw =
        startingPointsIndex === -1 ? "30" : row[startingPointsIndex]?.trim() || "30";
      const startingPoints = Number(startingPointsRaw);

      if (!firstName || !lastName || !email || !memberNumber) {
        errors.push(`Row ${rowNumber}: firstName, lastName, email, and memberNumber are required.`);
        return;
      }

      if (Number.isNaN(startingPoints)) {
        errors.push(`Row ${rowNumber}: startingPoints must be a number.`);
        return;
      }

      parsedRows.push({
        firstName,
        lastName,
        email,
        memberNumber,
        startingPoints,
        rowNumber,
      });
    });

    return {
      rows: parsedRows,
      errors,
    };
  }

  function normalizeHeader(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function findHeaderIndex(headers: string[], acceptedNames: string[]) {
    const normalizedAcceptedNames = acceptedNames.map((name) => normalizeHeader(name));
    return headers.findIndex((header) => normalizedAcceptedNames.includes(header));
  }

  function parseCsv(text: string) {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"' && insideQuotes && nextChar === '"') {
        currentValue += '"';
        i += 1;
        continue;
      }

      if (char === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === "," && !insideQuotes) {
        currentRow.push(currentValue);
        currentValue = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !insideQuotes) {
        if (char === "\r" && nextChar === "\n") i += 1;
        currentRow.push(currentValue);
        rows.push(currentRow);
        currentRow = [];
        currentValue = "";
        continue;
      }

      currentValue += char;
    }

    currentRow.push(currentValue);
    rows.push(currentRow);

    return rows;
  }

  async function importCsvParticipants() {
    if (!csvTournamentId) {
      setCsvErrors(["Please select a tournament."]);
      return;
    }

    if (csvRows.length === 0) {
      setCsvErrors(["Please choose a valid CSV file first."]);
      return;
    }

    if (csvErrors.length > 0) {
      const confirmed = window.confirm(
        "The CSV has validation warnings. Import only the valid rows?"
      );

      if (!confirmed) return;
    }

    try {
      setIsWorking(true);
      setMessage("");

      let createdCount = 0;
      let skippedCount = 0;

      const existingKeys = new Set(
        participants
          .filter((participant) => participant.tournamentId === csvTournamentId)
          .map(
            (participant) =>
              `${participant.email?.toLowerCase()}|${participant.memberNumber}`
          )
      );

      const csvSeenKeys = new Set<string>();

      for (const row of csvRows) {
        const key = `${row.email}|${row.memberNumber}`;

        if (existingKeys.has(key) || csvSeenKeys.has(key)) {
          skippedCount += 1;
          continue;
        }

        csvSeenKeys.add(key);

        await client.models.Participant.create({
          tournamentId: csvTournamentId,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          memberNumber: row.memberNumber,
          startingPoints: row.startingPoints,
          hasSubmittedOrder: false,
        });

        createdCount += 1;
      }

      setIsCsvUploadOpen(false);
      setCsvRows([]);
      setCsvErrors([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setMessage(
        `CSV import complete. Added ${createdCount} participant(s). Skipped ${skippedCount} duplicate row(s).`
      );

      await loadAdminData();
    } catch (error) {
      console.error("CSV import error:", error);
      setMessage("Error importing CSV participants. Check the browser console.");
    } finally {
      setIsWorking(false);
    }
  }

  function buildSubmittedOrderExportRows(ordersToExport: Order[]) {
    const tournamentName = selectedTournament?.name ?? "";
    const dollarPerPoint = selectedTournament?.pointDollarValue ?? 0;

    return ordersToExport.map((order) => {
      const participant = participantsById.get(order.participantId);
      const orderItemsForOrder = orderItems.filter(
        (item) => item.orderId === order.id
      );
      const startingPoints = participant?.startingPoints ?? 0;
      const totalPointsUsed = order.totalPointsUsed ?? 0;
      const overagePoints = Math.max(0, totalPointsUsed - startingPoints);
      const itemCount = orderItemsForOrder.reduce(
        (total, item) => total + (item.quantity ?? 0),
        0
      );

      return {
        tournamentName,
        orderId: order.id,
        participantName: participant
          ? `${participant.firstName} ${participant.lastName}`
          : "",
        firstName: participant?.firstName ?? "",
        lastName: participant?.lastName ?? "",
        email: participant?.email ?? "",
        memberNumber: participant?.memberNumber ?? "",
        status: order.status ?? "",
        submittedAt: formatDate(order.submittedAt),
        startingPoints,
        totalPointsUsed,
        remainingPoints: startingPoints - totalPointsUsed,
        overagePoints,
        dollarPerPoint,
        amountOwed: overagePoints * dollarPerPoint,
        itemCount,
        uniqueGiftCount: orderItemsForOrder.length,
        giftDetails: orderItemsForOrder
          .map((item) => {
            const lineTotal =
              (item.quantity ?? 0) * (item.pointCostAtTime ?? 0);
            const optionText = item.selectedOptionAtTime
              ? `, ${formatGiftOption(item.selectedOptionLabelAtTime, item.selectedOptionAtTime)}`
              : "";
            const colorText = item.selectedColorNameAtTime
              ? `, ${formatGiftColor(item.selectedColorNameAtTime)}`
              : "";
            return `${item.titleAtTime} (Qty: ${item.quantity}${optionText}${colorText}, Points Each: ${item.pointCostAtTime}, Line Total: ${lineTotal})`;
          })
          .join(" | "),
      };
    });
  }

  function exportSubmittedOrdersCsv(ordersToExport: Order[], scope: string) {
    if (ordersToExport.length === 0) {
      setMessage("No submitted orders are available to export.");
      return;
    }

    const rows = buildSubmittedOrderExportRows(ordersToExport);
    const headers: Array<keyof SubmittedOrderExportRow> = [
      "tournamentName",
      "orderId",
      "participantName",
      "firstName",
      "lastName",
      "email",
      "memberNumber",
      "status",
      "submittedAt",
      "startingPoints",
      "totalPointsUsed",
      "remainingPoints",
      "overagePoints",
      "dollarPerPoint",
      "amountOwed",
      "itemCount",
      "uniqueGiftCount",
      "giftDetails",
    ];

    const csv = [
      headers.map(formatCsvHeader).join(","),
      ...rows.map((row) =>
        headers.map((header) => escapeCsvValue(row[header])).join(",")
      ),
    ].join("\r\n");

    const fileName = `${slugify(selectedTournament?.name ?? "tournament")}-${scope}-submitted-orders.csv`;
    downloadCsv(fileName, csv);
    setMessage(`Exported ${rows.length} submitted order row(s).`);
  }

  function exportSelectedParticipantOrders() {
    if (!selectedParticipant) {
      setMessage("Select a participant first.");
      return;
    }

    exportSubmittedOrdersCsv(
      selectedParticipantOrders,
      slugify(
        `${selectedParticipant.firstName}-${selectedParticipant.lastName}` ||
          "participant"
      )
    );
  }

  function exportSelectedSubmittedOrders() {
    exportSubmittedOrdersCsv(selectedSubmittedOrders, "selected");
  }

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((current) => {
      const next = new Set(current);

      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }

      return next;
    });
  }

  function toggleAllFilteredOrders() {
    setSelectedOrderIds((current) => {
      const filteredIds = filteredOrders.map((order) => order.id);
      const allSelected = filteredIds.every((orderId) => current.has(orderId));
      const next = new Set(current);

      filteredIds.forEach((orderId) => {
        if (allSelected) {
          next.delete(orderId);
        } else {
          next.add(orderId);
        }
      });

      return next;
    });
  }

  function openOrderReceipt(order: Order) {
    const participant = participantsById.get(order.participantId);
    const orderItemsForOrder = orderItems.filter((item) => item.orderId === order.id);
    const startingPoints = participant?.startingPoints ?? 0;
    const totalPointsUsed = order.totalPointsUsed ?? 0;
    const overagePoints = Math.max(0, totalPointsUsed - startingPoints);
    const dollarPerPoint = selectedTournament?.pointDollarValue ?? 0;
    const amountOwed = overagePoints * dollarPerPoint;
    const totalQuantity = orderItemsForOrder.reduce(
      (total, item) => total + (item.quantity ?? 0),
      0
    );
    const receiptHtml = buildReceiptHtml({
      order,
      participant,
      tournament: selectedTournament,
      orderItems: orderItemsForOrder,
      startingPoints,
      totalPointsUsed,
      overagePoints,
      dollarPerPoint,
      amountOwed,
      totalQuantity,
    });
    const receiptUrl = URL.createObjectURL(
      new Blob([receiptHtml], { type: "text/html" })
    );
    const receiptWindow = window.open(receiptUrl, "_blank");

    if (!receiptWindow) {
      URL.revokeObjectURL(receiptUrl);
      setMessage("Unable to open receipt window. Please allow pop-ups for this site.");
      return;
    }

    receiptWindow.focus();

    window.setTimeout(() => {
      URL.revokeObjectURL(receiptUrl);
    }, 30000);
  }

  function buildReceiptHtml({
    order,
    participant,
    tournament,
    orderItems,
    startingPoints,
    totalPointsUsed,
    overagePoints,
    dollarPerPoint,
    amountOwed,
    totalQuantity,
  }: {
    order: Order;
    participant?: Participant;
    tournament: Tournament | null;
    orderItems: OrderItem[];
    startingPoints: number;
    totalPointsUsed: number;
    overagePoints: number;
    dollarPerPoint: number;
    amountOwed: number;
    totalQuantity: number;
  }) {
    const participantName = participant
      ? `${participant.firstName} ${participant.lastName}`
      : "Unknown Member";
    const itemRows = orderItems
      .map((item) => {
        const lineTotal = (item.quantity ?? 0) * (item.pointCostAtTime ?? 0);

        return `
          <tr>
            <td>
              <strong>${escapeHtml(item.titleAtTime ?? "Gift Item")}</strong>
              ${
                item.descriptionAtTime
                  ? `<span>${escapeHtml(item.descriptionAtTime)}</span>`
                  : ""
              }
              ${
                item.selectedOptionAtTime
                  ? `<span>${escapeHtml(formatGiftOption(item.selectedOptionLabelAtTime, item.selectedOptionAtTime))}</span>`
                  : ""
              }
              ${
                item.selectedColorNameAtTime
                  ? `<span>${escapeHtml(formatGiftColor(item.selectedColorNameAtTime))}</span>`
                  : ""
              }
            </td>
            <td>${item.quantity ?? 0}</td>
            <td>${item.pointCostAtTime ?? 0}</td>
            <td>${lineTotal}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <!doctype html>
      <html>
        <head>
          <title>Order Receipt - ${escapeHtml(participantName)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 40px;
              color: #123c2c;
              font-family: Arial, sans-serif;
              background: #f4f8f6;
            }
            .invoice {
              max-width: 860px;
              margin: 0 auto;
              background: #fff;
              border: 1px solid #dce8e1;
              padding: 36px;
            }
            .top {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              border-bottom: 2px solid #123c2c;
              padding-bottom: 20px;
              margin-bottom: 24px;
            }
            h1 { margin: 0; font-size: 32px; }
            h2 { margin: 24px 0 12px; font-size: 18px; }
            p { margin: 4px 0; color: #42554d; }
            .meta {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 14px;
              margin-bottom: 18px;
            }
            .box {
              border: 1px solid #dce8e1;
              background: #f7f9f8;
              padding: 14px;
            }
            .label {
              display: block;
              color: #5f6f68;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: .04em;
              margin-bottom: 4px;
            }
            .value { font-size: 16px; font-weight: 800; color: #123c2c; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }
            th {
              text-align: left;
              border-bottom: 1px solid #dce8e1;
              padding: 10px;
              color: #5f6f68;
              font-size: 12px;
              text-transform: uppercase;
            }
            td {
              border-bottom: 1px solid #edf3ef;
              padding: 12px 10px;
              vertical-align: top;
            }
            td span { display: block; color: #5f6f68; margin-top: 4px; font-size: 13px; }
            .totals {
              margin-top: 22px;
              margin-left: auto;
              width: min(360px, 100%);
              border: 1px solid #dce8e1;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 12px 14px;
              border-bottom: 1px solid #edf3ef;
            }
            .row:last-child { border-bottom: none; }
            .owed {
              background: #fff4df;
              color: #7a3e00;
              font-weight: 900;
            }
            .actions { text-align: right; margin: 0 auto 18px; max-width: 860px; }
            button {
              border: none;
              border-radius: 10px;
              padding: 10px 14px;
              color: #fff;
              background: #123c2c;
              font-weight: 800;
              cursor: pointer;
            }
            @media print {
              body { background: #fff; padding: 0; }
              .invoice { border: none; max-width: none; }
              .actions { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="actions">
            <button onclick="window.print()">Print / Save PDF</button>
          </div>
          <main class="invoice">
            <section class="top">
              <div>
                <h1>Order Invoice</h1>
                <p>${escapeHtml(tournament?.name ?? "")}</p>
              </div>
              <div>
                <p><strong>Order ID:</strong> ${escapeHtml(order.id)}</p>
                <p><strong>Status:</strong> ${escapeHtml(order.status ?? "")}</p>
                <p><strong>Submitted:</strong> ${escapeHtml(formatDate(order.submittedAt))}</p>
              </div>
            </section>

            <section class="meta">
              <div class="box">
                <span class="label">Member</span>
                <span class="value">${escapeHtml(participantName)}</span>
              </div>
              <div class="box">
                <span class="label">Member Number</span>
                <span class="value">${escapeHtml(participant?.memberNumber ?? "")}</span>
              </div>
              <div class="box">
                <span class="label">Email</span>
                <span class="value">${escapeHtml(participant?.email ?? "")}</span>
              </div>
              <div class="box">
                <span class="label">Total Items</span>
                <span class="value">${totalQuantity}</span>
              </div>
            </section>

            <h2>Gift Selections</h2>
            <table>
              <thead>
                <tr>
                  <th>Gift</th>
                  <th>Qty</th>
                  <th>Points Each</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <section class="totals">
              <div class="row"><span>Starting Points</span><strong>${startingPoints}</strong></div>
              <div class="row"><span>Total Points Used</span><strong>${totalPointsUsed}</strong></div>
              <div class="row"><span>Remaining Points</span><strong>${startingPoints - totalPointsUsed}</strong></div>
              <div class="row"><span>Overage Points</span><strong>${overagePoints}</strong></div>
              <div class="row"><span>Dollar Per Point</span><strong>${formatCurrency(dollarPerPoint)}</strong></div>
              <div class="row owed"><span>Amount Owed to Club</span><strong>${formatCurrency(amountOwed)}</strong></div>
            </section>
          </main>
        </body>
      </html>
    `;
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatCsvHeader(value: string) {
    return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) =>
      char.toUpperCase()
    );
  }

  function escapeCsvValue(value: string | number | boolean | null | undefined) {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export";
  }

  function downloadCsv(fileName: string, csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function submitSelectedParticipantOrder() {
    if (!selectedParticipant) {
      setMessage("Select a participant first.");
      return;
    }

    if (selectedParticipant.hasSubmittedOrder) {
      setMessage("This participant already has a submitted order.");
      return;
    }

    if (selectedParticipantCartItems.length === 0) {
      setMessage("This participant does not have any cart items to submit.");
      return;
    }

    const startingPoints = selectedParticipant.startingPoints ?? 0;

    if (!selectedTournament?.allowOverPoints && selectedParticipantCartTotal > startingPoints) {
      setMessage("This participant's cart exceeds their available points.");
      return;
    }

    const cartRows = selectedParticipantCartItems.map((cartItem) => {
      const gift = giftItems.find((item) => item.id === cartItem.giftItemId);

      return {
        cartItem,
        gift,
        title: gift?.title || "Gift Item",
        description: gift?.description || "",
        quantity: cartItem.quantity ?? 0,
        pointCost: cartItem.pointCostAtTime ?? 0,
        selectedOption: cartItem.selectedOption ?? "",
        selectedOptionLabel: cartItem.selectedOptionLabel ?? gift?.optionLabel ?? "",
        selectedColorId: cartItem.selectedColorId ?? "",
        selectedColorName: cartItem.selectedColorName ?? "",
        selectedColorHex: cartItem.selectedColorHex ?? "",
      };
    });

    const missingGift = cartRows.find((row) => !row.gift);

    if (missingGift) {
      setMessage(
        "One or more cart items could not be matched to a gift item. Review the cart before submitting."
      );
      return;
    }

    const confirmed = window.confirm(
      `Submit ${selectedParticipant.firstName} ${selectedParticipant.lastName}'s order? This will lock their selections.`
    );

    if (!confirmed) return;

    try {
      setIsWorking(true);
      setMessage("");

      const submittedAt = new Date().toISOString();

      const orderResult = await client.models.Order.create({
        tournamentId: selectedParticipant.tournamentId,
        participantId: selectedParticipant.id,
        totalPointsUsed: selectedParticipantCartTotal,
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
          selectedOptionAtTime: row.selectedOption || null,
          selectedOptionLabelAtTime: row.selectedOptionLabel || null,
          selectedColorIdAtTime: row.selectedColorId || null,
          selectedColorNameAtTime: row.selectedColorName || null,
          selectedColorHexAtTime: row.selectedColorHex || null,
          quantity: row.quantity,
        });
      }

      const participantResult = await client.models.Participant.update({
        id: selectedParticipant.id,
        hasSubmittedOrder: true,
        submittedAt,
      });

      const updatedParticipant =
        participantResult.data ||
        ({
          ...selectedParticipant,
          hasSubmittedOrder: true,
          submittedAt,
        } as Participant);

      setSelectedParticipant(updatedParticipant);
      setSelectedOrder(order);
      setMessage("Participant order submitted.");
      await loadAdminData();
    } catch (error) {
      console.error("Admin submit order error:", error);
      setMessage("Error submitting participant order. Check the browser console.");
    } finally {
      setIsWorking(false);
    }
  }

  async function resetParticipant(participant: Participant) {
    const confirmed = window.confirm(
      `Reset ${participant.firstName} ${participant.lastName}? This will delete their cart, orders, and order items, then mark them as not submitted.`
    );

    if (!confirmed) return;

    await clearParticipantRelatedRecords(participant, false);
  }

  async function deleteParticipant(participant: Participant) {
    const confirmed = window.confirm(
      `Delete ${participant.firstName} ${participant.lastName}? This will delete their cart, orders, order items, and participant record.`
    );

    if (!confirmed) return;

    await clearParticipantRelatedRecords(participant, true);
  }

  async function clearParticipantRelatedRecords(
    participant: Participant,
    shouldDeleteParticipant: boolean
  ) {
    try {
      setIsWorking(true);
      setMessage("");

      const participantOrders = orders.filter(
        (order) => order.participantId === participant.id
      );

      const participantOrderIds = new Set(
        participantOrders.map((order) => order.id)
      );

      const participantOrderItems = orderItems.filter((item) =>
        participantOrderIds.has(item.orderId)
      );

      const participantCartItems = cartItems.filter(
        (item) => item.participantId === participant.id
      );

      for (const item of participantOrderItems) {
        await client.models.OrderItem.delete({ id: item.id });
      }

      for (const order of participantOrders) {
        await client.models.Order.delete({ id: order.id });
      }

      for (const cartItem of participantCartItems) {
        await client.models.CartItem.delete({ id: cartItem.id });
      }

      if (shouldDeleteParticipant) {
        await client.models.Participant.delete({ id: participant.id });
        if (selectedParticipant?.id === participant.id) {
          setSelectedParticipant(null);
        }
        setMessage(`Deleted ${participant.firstName} ${participant.lastName}.`);
      } else {
        const participantResult = await client.models.Participant.update({
          id: participant.id,
          hasSubmittedOrder: false,
          submittedAt: null,
        });

        if (selectedParticipant?.id === participant.id) {
          setSelectedParticipant(participantResult.data ?? {
            ...participant,
            hasSubmittedOrder: false,
            submittedAt: null,
          });
        }

        setMessage(`Reset ${participant.firstName} ${participant.lastName}.`);
      }

      await loadAdminData();
    } catch (error) {
      console.error("Participant action error:", error);
      setMessage("Error updating participant. Check the browser console.");
    } finally {
      setIsWorking(false);
    }
  }

  async function addGift(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const title = newGift.title.trim();
  const pointCost = Number(newGift.pointCost);
  const sortOrder = normalizeSortOrder(
    newGift.sortOrder,
    getOrderedTournamentGifts(newGift.tournamentId).length + 1
  );
  const optionValues = newGift.hasOptions
    ? normalizeGiftOptionValues(newGift.optionValues)
    : [];
  const colorOptions = newGift.hasColors
    ? normalizeGiftColors(newGift.colorOptions)
    : [];

  if (!newGift.tournamentId || !title || Number.isNaN(pointCost)) {
    setMessage("Please enter at least tournament, gift title, and point cost.");
    return;
  }

  if (newGift.hasOptions && optionValues.length === 0) {
    setMessage("Please add at least one option value for this gift.");
    return;
  }

  if (newGift.hasColors && colorOptions.length === 0) {
    setMessage("Please add at least one color option for this gift.");
    return;
  }

  try {
    setIsWorking(true);
    setMessage("");

    const nextSortOrder = await insertGiftSortOrderBeforeCreate(
      newGift.tournamentId,
      sortOrder
    );

    const giftResult = await client.models.GiftItem.create({
      tournamentId: newGift.tournamentId,
      title,
      description: newGift.description.trim(),
      pointCost,
      sortOrder: nextSortOrder,
      optionLabel: newGift.hasOptions ? newGift.optionLabel.trim() || "Option" : null,
      optionValues: newGift.hasOptions ? serializeGiftOptions(optionValues) : null,
      colorOptions: newGift.hasColors ? serializeGiftColors(colorOptions) : null,
      isActive: newGift.isActive,
    });

    const createdGift = giftResult.data;

    if (!createdGift?.id) {
      throw new Error("Gift item was not created.");
    }

    if (newGiftImageFiles && newGiftImageFiles.length > 0) {
      const files = Array.from(newGiftImageFiles);

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];

        const imageKey = await uploadGiftImage({
          tournamentId: createdGift.tournamentId,
          giftItemId: createdGift.id,
          file,
        });

        await client.models.GiftImage.create({
          tournamentId: createdGift.tournamentId,
          giftItemId: createdGift.id,
          imageKey,
          altText: createdGift.title,
          sortOrder: index + 1,
          isPrimary: index === newGiftPrimaryImageIndex,
        });
      }
    }

    setNewGift((current) => ({
      ...current,
      title: "",
      description: "",
      pointCost: "",
      sortOrder: "",
      hasOptions: false,
      optionLabel: "",
      optionValues: [""],
      hasColors: false,
      colorOptions: [createGiftColorOption({ isDefault: true })],
      isActive: true,
    }));

    setNewGiftImageFiles(null);
    setNewGiftPrimaryImageIndex(0);
    setIsAddGiftOpen(false);
    setMessage("Gift item added.");
    await loadAdminData();
  } catch (error) {
    console.error("Add gift error:", error);
    setMessage("Error adding gift item. Check the browser console.");
  } finally {
    setIsWorking(false);
  }
}

async function refreshSelectedGiftImages(gift: GiftItem) {
  const imageResult = await client.models.GiftImage.list({
    filter: {
      giftItemId: {
        eq: gift.id,
      },
    },
  });

  const sortedImages = [...imageResult.data].sort(
    (a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)
  );

  const urlEntries = await Promise.all(
    sortedImages.map(async (image) => {
      const url = await getGiftImageUrl(image.imageKey);
      return [image.id, url] as const;
    })
  );

  setGiftImages((current) => {
    const otherImages = current.filter((image) => image.giftItemId !== gift.id);
    return [...otherImages, ...sortedImages];
  });

  setSelectedGiftImageUrls(Object.fromEntries(urlEntries));

  if (selectedGiftForEdit?.id === gift.id) {
    setEditGiftImages(sortedImages);
    setEditGiftPrimaryImageId(
      sortedImages.find((image) => image.isPrimary)?.id ?? sortedImages[0]?.id ?? ""
    );
  }
}

async function loadAdminGiftCardImages(gifts: GiftItem[], images: GiftImage[]) {
  const imagesByGiftId = new Map<string, GiftImage[]>();

  images.forEach((image) => {
    const existing = imagesByGiftId.get(image.giftItemId) || [];
    existing.push(image);
    imagesByGiftId.set(image.giftItemId, existing);
  });

  const urlEntries = await Promise.all(
    gifts.map(async (gift) => {
      const giftImagesForGift = imagesByGiftId.get(gift.id) || [];

      const sortedImages = [...giftImagesForGift].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
      });
      const defaultColor = getDefaultGiftColor(parseGiftColors(gift.colorOptions));
      const defaultColorImages = defaultColor
        ? sortedImages.filter(
            (image) =>
              image.colorOptionId === defaultColor.id ||
              defaultColor.imageIds.includes(image.id)
          )
        : [];

      const primaryImage = defaultColorImages[0] || sortedImages[0];

      if (!primaryImage) {
        return [gift.id, ""] as const;
      }

      const url = await getGiftImageUrl(primaryImage.imageKey);

      return [gift.id, url] as const;
    })
  );

  setGiftCardImageUrlsByGiftId(Object.fromEntries(urlEntries));
}

  async function removeGift(gift: GiftItem) {
    const matchingOrderItems = orderItems.filter(
      (item) => item.giftItemId === gift.id
    );

    const matchingCartItems = cartItems.filter(
      (item) => item.giftItemId === gift.id
    );

    const usedInSubmittedOrder = matchingOrderItems.length > 0;

    const confirmed = window.confirm(
      usedInSubmittedOrder
        ? `${gift.title} is already used in a submitted order. It will be deactivated instead of deleted. Continue?`
        : `Remove ${gift.title}? This will delete the gift and any cart items using it.`
    );

    if (!confirmed) return false;

    try {
      setIsWorking(true);
      setMessage("");

      if (usedInSubmittedOrder) {
        await client.models.GiftItem.update({
          id: gift.id,
          isActive: false,
        });

        setMessage(`${gift.title} was deactivated because it is used in an order.`);
      } else {
        for (const cartItem of matchingCartItems) {
          await client.models.CartItem.delete({ id: cartItem.id });
        }

        await client.models.GiftItem.delete({ id: gift.id });
        setMessage(`${gift.title} was removed.`);
      }

      await loadAdminData();
      return true;
    } catch (error) {
      console.error("Remove gift error:", error);
      setMessage("Error removing gift item. Check the browser console.");
      return false;
    } finally {
      setIsWorking(false);
    }
  }

  function normalizeGiftOptionValues(values: string[]) {
    return values.map((value) => value.trim()).filter((value) => value.length > 0);
  }

  function updateOptionValue(
    values: string[],
    index: number,
    nextValue: string
  ) {
    return values.map((value, valueIndex) =>
      valueIndex === index ? nextValue : value
    );
  }

  function getColorNameHex(name: string) {
    return commonColorHexByName[name.trim().toLowerCase()];
  }

  function updateColorName(
    colors: GiftColorOption[],
    colorId: string,
    name: string
  ) {
    const matchingHex = getColorNameHex(name);

    return updateColorOption(colors, colorId, {
      name,
      ...(matchingHex ? { hex: matchingHex } : {}),
    });
  }

  function updateColorOption(
    colors: GiftColorOption[],
    colorId: string,
    updates: Partial<GiftColorOption>
  ) {
    return colors.map((color) =>
      color.id === colorId ? { ...color, ...updates } : color
    );
  }

  function setDefaultColor(colors: GiftColorOption[], colorId: string) {
    return colors.map((color) => ({
      ...color,
      isDefault: color.id === colorId,
    }));
  }

  function toggleImageColorLink(
    colors: GiftColorOption[],
    colorId: string,
    imageId: string
  ) {
    return colors.map((color) => {
      const withoutImage = color.imageIds.filter((id) => id !== imageId);

      if (color.id !== colorId) {
        return {
          ...color,
          imageIds: withoutImage,
        };
      }

      return {
        ...color,
        imageIds: color.imageIds.includes(imageId)
          ? withoutImage
          : [...withoutImage, imageId],
      };
    });
  }

  function removeColorOption(colors: GiftColorOption[], colorId: string) {
    const nextColors = colors.filter((color) => color.id !== colorId);

    if (nextColors.length === 0) {
      return [createGiftColorOption({ isDefault: true })];
    }

    if (!nextColors.some((color) => color.isDefault)) {
      return setDefaultColor(nextColors, nextColors[0].id);
    }

    return nextColors;
  }

  async function toggleGiftActive(gift: GiftItem) {
    try {
      setIsWorking(true);
      setMessage("");

      await client.models.GiftItem.update({
        id: gift.id,
        isActive: !gift.isActive,
      });

      setMessage(`${gift.title} updated.`);
      await loadAdminData();
    } catch (error) {
      console.error("Toggle gift error:", error);
      setMessage("Error updating gift item. Check the browser console.");
    } finally {
      setIsWorking(false);
    }
  }

  function formatDate(value?: string | null) {
    if (!value) return "";
    return new Date(value).toLocaleString();
  }

  function formatCurrency(value: number) {
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function sortLabel<TSortKey extends string>(
    config: SortConfig<TSortKey>,
    key: TSortKey
  ) {
    if (config.key !== key) return "";
    return config.direction === "asc" ? " ↑" : " ↓";
  }

  return (
    <main style={styles.page}>
      <section style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Tournament Gift Management</h1>
            <p style={styles.subtitle}>
              Select a tournament to manage its participants, gifts, carts, and
              submitted orders.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              onClick={openCreateTournamentModal}
              disabled={isWorking}
              style={styles.primaryButton}
            >
              <ButtonContent icon="plus" label="Create Tournament" />
            </button>

            <button type="button" onClick={loadAdminData} style={styles.secondaryButton}>
              <ButtonContent icon="refresh" label="Refresh" />
            </button>
          </div>
        </header>

        {message && <p style={styles.message}>{message}</p>}

        {isLoading ? (
          <p>Loading admin data...</p>
        ) : (
          <>
            <section style={styles.tournamentSelectorCard}>
              <div style={styles.tournamentSelectorHeader}>
                <div style={styles.tournamentTitleGroup}>
                  <p style={styles.tournamentSelectorLabel}>Tournament</p>

                  <select
                    aria-label="Select tournament"
                    value={selectedTournamentId}
                    onChange={(event) => {
                      setSelectedTournamentId(event.target.value);
                      setParticipantSearch("");
                      setOrderSearch("");
                      setGiftSearch("");
                    }}
                    style={styles.tournamentTitleSelect}
                  >
                    {tournaments.length === 0 && (
                      <option value="">No tournaments available</option>
                    )}

                    {tournaments.map((tournament) => (
                      <option key={tournament.id} value={tournament.id}>
                        {tournament.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.tournamentSelectorActions}>
                  <button
                    type="button"
                    onClick={openEditTournamentModal}
                    disabled={!selectedTournament || isWorking}
                    style={styles.secondaryButton}
                  >
                    <ButtonContent icon="edit" label="Edit" />
                  </button>
                </div>
              </div>

              {selectedTournament && (
                <div style={styles.tournamentMetaRow}>
                  <div style={styles.tournamentMetaChip}>
                    <span style={styles.tournamentMetaLabel}>Passcode</span>
                    <strong style={styles.tournamentMetaValue}>
                      {selectedTournament.passcode}
                    </strong>
                  </div>

                  <div style={styles.tournamentMetaChip}>
                    <span style={styles.tournamentMetaLabel}>Default Points</span>
                    <strong style={styles.tournamentMetaValue}>
                      {selectedTournament.defaultPoints}
                    </strong>
                  </div>

                  <div style={styles.tournamentMetaChip}>
                    <span style={styles.tournamentMetaLabel}>Overage</span>
                    <strong style={styles.tournamentMetaValue}>
                      {selectedTournament.allowOverPoints ? "Allowed" : "Not Allowed"}
                    </strong>
                  </div>

                  <div style={styles.tournamentMetaChip}>
                    <span style={styles.tournamentMetaLabel}>Per Point</span>
                    <strong style={styles.tournamentMetaValue}>
                      {formatCurrency(selectedTournament.pointDollarValue ?? 0)}
                    </strong>
                  </div>

                  <div
                    style={{
                      ...styles.tournamentMetaChip,
                      ...(selectedTournament.isOpen
                        ? styles.tournamentOpenChip
                        : styles.tournamentClosedChip),
                    }}
                  >
                    <span style={styles.tournamentMetaLabel}>Status</span>
                    <strong style={styles.tournamentMetaValue}>
                      {selectedTournament.isOpen ? "Open" : "Closed"}
                    </strong>
                  </div>
                </div>
              )}
            </section>

            <section style={styles.statsGrid}>
              <StatCard label="Participants" value={tournamentParticipants.length} />
              <StatCard label="Gift Items" value={tournamentGiftItems.length} />
              <StatCard label="Total Points Used" value={tournamentSubmittedPoints} />
              <StatCard label="Avg Points / Order" value={tournamentAveragePointsUsed} />
              <StatCard label="Submitted Orders" value={tournamentOrders.length} />
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Participants</h2>

                <div style={styles.sectionActions}>
                  <input
                    value={participantSearch}
                    onChange={(event) => setParticipantSearch(event.target.value)}
                    placeholder="Filter participants..."
                    style={styles.searchInput}
                  />

                  <button
                    type="button"
                    onClick={openAddParticipantModal}
                    disabled={!selectedTournamentId || isWorking}
                    style={styles.primaryButton}
                  >
                    <ButtonContent icon="plus" label="Add Participant" />
                  </button>

                  <button
                    type="button"
                    onClick={openCsvUploadModal}
                    disabled={!selectedTournamentId || isWorking}
                    style={styles.secondaryButton}
                  >
                    <ButtonContent icon="upload" label="Bulk Upload (CSV)" />
                  </button>
                </div>
              </div>

              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <SortableTh
                        label={`Name${sortLabel(participantSort, "name")}`}
                        onClick={() => toggleParticipantSort("name")}
                      />
                      <SortableTh
                        label={`Email${sortLabel(participantSort, "email")}`}
                        onClick={() => toggleParticipantSort("email")}
                      />
                      <SortableTh
                        label={`Member #${sortLabel(participantSort, "memberNumber")}`}
                        onClick={() => toggleParticipantSort("memberNumber")}
                      />
                      <SortableTh
                        label={`Points${sortLabel(participantSort, "startingPoints")}`}
                        onClick={() => toggleParticipantSort("startingPoints")}
                      />
                      <SortableTh
                        label={`Submitted${sortLabel(participantSort, "submitted")}`}
                        onClick={() => toggleParticipantSort("submitted")}
                      />
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredParticipants.map((participant) => {
                      return (
                        <tr key={participant.id}>
                          <td style={styles.td}>
                            {participant.firstName} {participant.lastName}
                          </td>
                          <td style={styles.td}>{participant.email}</td>
                          <td style={styles.td}>{participant.memberNumber}</td>
                          <td style={styles.td}>{participant.startingPoints}</td>
                          <td style={styles.td}>
                            {participant.hasSubmittedOrder ? "Yes" : "No"}
                          </td>
                          <td style={styles.td}>
                            <div style={styles.actionRow}>
                              <button
                                type="button"
                                onClick={() => setSelectedParticipant(participant)}
                                disabled={isWorking}
                                style={styles.smallButton}
                              >
                                <ButtonContent icon="eye" label="View" />
                              </button>

                              <button
                                type="button"
                                onClick={() => resetParticipant(participant)}
                                disabled={isWorking}
                                style={styles.smallNeutralButton}
                              >
                                <ButtonContent icon="reset" label="Reset" />
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteParticipant(participant)}
                                disabled={isWorking}
                                style={styles.smallDangerButton}
                              >
                                <ButtonContent icon="trash" label="Delete" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredParticipants.length === 0 && (
                      <tr>
                        <td style={styles.td} colSpan={6}>
                          No participants found for this tournament.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedParticipant && (
                <section style={styles.orderDetailPanel}>
                  <div style={styles.sectionHeader}>
                    <div>
                      <h3 style={styles.orderDetailTitle}>
                        {selectedParticipant.firstName} {selectedParticipant.lastName}
                      </h3>
                      <p style={styles.muted}>
                        {selectedParticipant.email} | Member #{" "}
                        {selectedParticipant.memberNumber}
                      </p>
                    </div>

                    <div style={styles.actionRow}>
                      <button
                        type="button"
                        onClick={exportSelectedParticipantOrders}
                        disabled={selectedParticipantOrders.length === 0}
                        style={styles.smallNeutralButton}
                      >
                        <ButtonContent icon="download" label="Export Orders" />
                      </button>

                      <button
                        type="button"
                        onClick={submitSelectedParticipantOrder}
                        disabled={
                          isWorking ||
                          selectedParticipant.hasSubmittedOrder === true ||
                          selectedParticipantCartItems.length === 0 ||
                          (!selectedTournament?.allowOverPoints &&
                            selectedParticipantCartTotal >
                              (selectedParticipant.startingPoints ?? 0))
                        }
                        style={styles.smallButton}
                      >
                        <ButtonContent icon="check" label="Submit Order" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedParticipant(null)}
                        style={styles.smallNeutralButton}
                      >
                        <ButtonContent icon="x" label="Close" />
                      </button>
                    </div>
                  </div>

                  <ParticipantCartAndOrders
                    participant={selectedParticipant}
                    cartItems={selectedParticipantCartItems}
                    giftItems={giftItems}
                    orders={selectedParticipantOrders}
                    orderItems={orderItems}
                    cartTotal={selectedParticipantCartTotal}
                    formatDate={formatDate}
                  />
                </section>
              )}
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Submitted Orders</h2>

                <div style={styles.sectionActions}>
                  <input
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                    placeholder="Filter orders..."
                    style={styles.searchInput}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      exportSubmittedOrdersCsv(tournamentOrders, "all")
                    }
                    disabled={tournamentOrders.length === 0}
                    style={styles.secondaryButton}
                  >
                    <ButtonContent icon="download" label="Export All Orders" />
                  </button>

                  <button
                    type="button"
                    onClick={exportSelectedSubmittedOrders}
                    disabled={selectedSubmittedOrders.length === 0}
                    style={styles.secondaryButton}
                  >
                    <ButtonContent
                      icon="download"
                      label={`Export Selected (${selectedSubmittedOrders.length})`}
                    />
                  </button>
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <p style={styles.muted}>No submitted orders found.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>
                          <input
                            type="checkbox"
                            checked={
                              filteredOrders.length > 0 &&
                              filteredOrders.every((order) =>
                                selectedOrderIds.has(order.id)
                              )
                            }
                            onChange={toggleAllFilteredOrders}
                            aria-label="Select all visible submitted orders"
                          />
                        </th>
                        <SortableTh
                          label={`Member${sortLabel(orderSort, "member")}`}
                          onClick={() => toggleOrderSort("member")}
                        />
                        <SortableTh
                          label={`Total Points${sortLabel(orderSort, "totalPointsUsed")}`}
                          onClick={() => toggleOrderSort("totalPointsUsed")}
                        />
                        <SortableTh
                          label={`Status${sortLabel(orderSort, "status")}`}
                          onClick={() => toggleOrderSort("status")}
                        />
                        <SortableTh
                          label={`Submitted${sortLabel(orderSort, "submittedAt")}`}
                          onClick={() => toggleOrderSort("submittedAt")}
                        />
                        <th style={styles.th}>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredOrders.map((order) => {
                        const participant = participantsById.get(order.participantId);

                        return (
                          <tr key={order.id}>
                            <td style={styles.td}>
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.has(order.id)}
                                onChange={() => toggleOrderSelection(order.id)}
                                aria-label={`Select order for ${
                                  participant
                                    ? `${participant.firstName} ${participant.lastName}`
                                    : "participant"
                                }`}
                              />
                            </td>
                            <td style={styles.td}>
                              {participant
                                ? `${participant.firstName} ${participant.lastName}`
                                : ""}
                            </td>
                            <td style={styles.td}>{order.totalPointsUsed}</td>
                            <td style={styles.td}>{order.status}</td>
                            <td style={styles.td}>{formatDate(order.submittedAt)}</td>
                            <td style={styles.td}>
                              <div style={styles.actionRow}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrder(order)}
                                  style={styles.smallButton}
                                >
                                  <ButtonContent icon="eye" label="View" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openOrderReceipt(order)}
                                  style={styles.smallNeutralButton}
                                >
                                  <ButtonContent icon="receipt" label="Receipt" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedOrder && (
                <section style={styles.orderDetailPanel}>
                  <div style={styles.sectionHeader}>
                    <h3 style={styles.orderDetailTitle}>Submitted Order Detail</h3>

                    <button
                      type="button"
                      onClick={() => setSelectedOrder(null)}
                      style={styles.smallNeutralButton}
                    >
                      <ButtonContent icon="x" label="Close" />
                    </button>
                  </div>

                  <OrderDetail
                    order={selectedOrder}
                    participant={participantsById.get(selectedOrder.participantId)}
                    tournament={tournamentsById.get(selectedOrder.tournamentId)}
                    orderItems={orderItemsForSelectedOrder}
                  />
                </section>
              )}
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Gift Items</h2>

                <div style={styles.sectionActions}>
                  <input
                    value={giftSearch}
                    onChange={(event) => setGiftSearch(event.target.value)}
                    placeholder="Filter gifts..."
                    style={styles.searchInput}
                  />

                  <button
                    type="button"
                    onClick={openAddGiftModal}
                    disabled={!selectedTournamentId || isWorking}
                    style={styles.primaryButton}
                  >
                    <ButtonContent icon="plus" label="Add Gift Item" />
                  </button>
                </div>
              </div>

              <div style={styles.giftGrid}>
                {filteredGifts.map((gift) => {
                  return (
                    <article key={gift.id} style={styles.giftCard}>
                      <div style={styles.giftImageBox}>
                        {giftCardImageUrlsByGiftId[gift.id] ? (
                            <img
                            src={giftCardImageUrlsByGiftId[gift.id]}
                            alt={gift.title}
                            style={styles.giftImage}
                            />
                        ) : (
                            <div style={styles.giftImagePlaceholder}>No Image</div>
                        )}
                        </div>

                      <h3 style={styles.giftTitle}>{gift.title}</h3>
                      <p style={styles.muted}>{gift.description}</p>
                      <p style={styles.giftPoints}>{gift.pointCost} points</p>
                      <p style={styles.muted}>
                        Active: {gift.isActive ? "Yes" : "No"}
                      </p>

                      <div style={styles.actionRow}>
                        <button
                            type="button"
                            onClick={() => openEditGiftModal(gift)}
                            disabled={isWorking}
                            style={styles.smallNeutralButton}
                        >
                            <ButtonContent icon="edit" label="Edit" />
                        </button>

                        <button
                            type="button"
                            onClick={() => toggleGiftActive(gift)}
                            disabled={isWorking}
                            style={styles.smallButton}
                        >
                            <ButtonContent
                              icon={gift.isActive ? "x" : "check"}
                              label={gift.isActive ? "Deactivate" : "Activate"}
                            />
                        </button>

                        <button
                            type="button"
                            onClick={() => removeGift(gift)}
                            disabled={isWorking}
                            style={styles.smallDangerButton}
                        >
                            <ButtonContent icon="trash" label="Remove" />
                        </button>
                        </div>
                    </article>
                  );
                })}
                {filteredGifts.length === 0 && (
                  <p style={styles.muted}>No gift items found for this tournament.</p>
                )}
              </div>
            </section>
          </>
        )}
      </section>

      {isCreateTournamentOpen && (
        <Modal title="Create Tournament" onClose={() => setIsCreateTournamentOpen(false)}>
          <form onSubmit={addTournament} style={styles.modalForm}>
            <FieldLabel label="Tournament Name" />
            <input
              value={newTournament.name}
              onChange={(event) =>
                setNewTournament((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Tournament name"
              style={styles.input}
            />

            <FieldLabel label="Passcode" />
            <input
              value={newTournament.passcode}
              onChange={(event) =>
                setNewTournament((current) => ({
                  ...current,
                  passcode: event.target.value,
                }))
              }
              placeholder="Tournament passcode"
              style={styles.input}
              autoComplete="off"
            />

            <FieldLabel label="Default Points" />
            <input
              value={newTournament.defaultPoints}
              onChange={(event) =>
                setNewTournament((current) => ({
                  ...current,
                  defaultPoints: event.target.value,
                }))
              }
              placeholder="Default points"
              type="number"
              style={styles.input}
            />

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={newTournament.allowOverPoints}
                onChange={(event) =>
                  setNewTournament((current) => ({
                    ...current,
                    allowOverPoints: event.target.checked,
                  }))
                }
              />
              Allow users to exceed their point allotment
            </label>

            <FieldLabel label="Dollar Amount Per Point" />
            <input
              value={newTournament.pointDollarValue}
              onChange={(event) =>
                setNewTournament((current) => ({
                  ...current,
                  pointDollarValue: event.target.value,
                }))
              }
              placeholder="10"
              type="number"
              min="0"
              step="0.01"
              style={styles.input}
            />

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={newTournament.isOpen}
                onChange={(event) =>
                  setNewTournament((current) => ({
                    ...current,
                    isOpen: event.target.checked,
                  }))
                }
              />
              Open
            </label>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setIsCreateTournamentOpen(false)}
                style={styles.secondaryButton}
              >
                <ButtonContent icon="x" label="Cancel" />
              </button>

              <button type="submit" disabled={isWorking} style={styles.primaryButton}>
                <ButtonContent icon="plus" label="Create Tournament" />
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isEditTournamentOpen && (
        <Modal title="Edit Tournament" onClose={() => setIsEditTournamentOpen(false)}>
          <form onSubmit={updateTournament} style={styles.modalForm}>
            <FieldLabel label="Tournament Name" />
            <input
              value={editTournament.name}
              onChange={(event) =>
                setEditTournament((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Tournament name"
              style={styles.input}
            />

            <FieldLabel label="Passcode" />
            <input
              value={editTournament.passcode}
              onChange={(event) =>
                setEditTournament((current) => ({
                  ...current,
                  passcode: event.target.value,
                }))
              }
              placeholder="Tournament passcode"
              style={styles.input}
              autoComplete="off"
            />

            <FieldLabel label="Default Points" />
            <input
              value={editTournament.defaultPoints}
              onChange={(event) =>
                setEditTournament((current) => ({
                  ...current,
                  defaultPoints: event.target.value,
                }))
              }
              placeholder="Default points"
              type="number"
              style={styles.input}
            />

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={editTournament.allowOverPoints}
                onChange={(event) =>
                  setEditTournament((current) => ({
                    ...current,
                    allowOverPoints: event.target.checked,
                  }))
                }
              />
              Allow users to exceed their point allotment
            </label>

            <FieldLabel label="Dollar Amount Per Point" />
            <input
              value={editTournament.pointDollarValue}
              onChange={(event) =>
                setEditTournament((current) => ({
                  ...current,
                  pointDollarValue: event.target.value,
                }))
              }
              placeholder="10"
              type="number"
              min="0"
              step="0.01"
              style={styles.input}
            />

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={editTournament.isOpen}
                onChange={(event) =>
                  setEditTournament((current) => ({
                    ...current,
                    isOpen: event.target.checked,
                  }))
                }
              />
              Open
            </label>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setIsEditTournamentOpen(false)}
                style={styles.secondaryButton}
              >
                <ButtonContent icon="x" label="Cancel" />
              </button>

              <button type="submit" disabled={isWorking} style={styles.primaryButton}>
                <ButtonContent icon="save" label="Save Tournament" />
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isAddParticipantOpen && (
        <Modal title="Add Participant" onClose={() => setIsAddParticipantOpen(false)}>
          <form onSubmit={addParticipant} style={styles.modalForm}>
            <FieldLabel label="Tournament" />
            <select
              value={newParticipant.tournamentId}
              disabled
              style={styles.input}
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>

            <FieldLabel label="First Name" />
            <input
              value={newParticipant.firstName}
              onChange={(event) =>
                setNewParticipant((current) => ({
                  ...current,
                  firstName: event.target.value,
                }))
              }
              placeholder="First name"
              style={styles.input}
            />

            <FieldLabel label="Last Name" />
            <input
              value={newParticipant.lastName}
              onChange={(event) =>
                setNewParticipant((current) => ({
                  ...current,
                  lastName: event.target.value,
                }))
              }
              placeholder="Last name"
              style={styles.input}
            />

            <FieldLabel label="Email" />
            <input
              value={newParticipant.email}
              onChange={(event) =>
                setNewParticipant((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="Email"
              style={styles.input}
            />

            <FieldLabel label="Member Number" />
            <input
              value={newParticipant.memberNumber}
              onChange={(event) =>
                setNewParticipant((current) => ({
                  ...current,
                  memberNumber: event.target.value,
                }))
              }
              placeholder="Member number"
              style={styles.input}
            />

            <FieldLabel label="Starting Points" />
            <input
              value={newParticipant.startingPoints}
              onChange={(event) =>
                setNewParticipant((current) => ({
                  ...current,
                  startingPoints: event.target.value,
                }))
              }
              placeholder="Starting points"
              style={styles.input}
              type="number"
            />

            <div style={styles.modalActions}>
              <button type="button" onClick={() => setIsAddParticipantOpen(false)} style={styles.secondaryButton}>
                <ButtonContent icon="x" label="Cancel" />
              </button>

              <button type="submit" disabled={isWorking} style={styles.primaryButton}>
                <ButtonContent icon="plus" label="Add Participant" />
              </button>
            </div>
          </form>
        </Modal>
      )}

        {selectedGiftForEdit && (
        <Modal
            title={`Edit Gift: ${selectedGiftForEdit.title}`}
            onClose={() => {
              setSelectedGiftForEdit(null);
              setEditGiftImages([]);
              setSelectedGiftImageUrls({});
              setImageUploadFiles(null);
              setEditGiftPrimaryImageId("");
              setDraggedGiftImageId("");
              setDragOverGiftImageId("");
            }}
        >
            <form onSubmit={updateGift} style={styles.modalForm}>
            <FieldLabel label="Gift Title" />
            <input
                value={editGift.title}
                onChange={(event) =>
                setEditGift((current) => ({
                    ...current,
                    title: event.target.value,
                }))
                }
                placeholder="Gift title"
                style={styles.input}
            />

            <FieldLabel label="Description" />
            <textarea
                value={editGift.description}
                onChange={(event) =>
                setEditGift((current) => ({
                    ...current,
                    description: event.target.value,
                }))
                }
                placeholder="Description"
                style={{ ...styles.input, minHeight: "90px" }}
            />

            <FieldLabel label="Point Cost" />
            <input
                value={editGift.pointCost}
                onChange={(event) =>
                setEditGift((current) => ({
                    ...current,
                    pointCost: event.target.value,
                }))
                }
                placeholder="Point cost"
                type="number"
                style={styles.input}
            />

            <FieldLabel label="Sort Order" />
            <select
                value={editGift.sortOrder}
                onChange={(event) =>
                setEditGift((current) => ({
                    ...current,
                    sortOrder: event.target.value,
                }))
                }
                style={styles.input}
            >
                {Array.from(
                {
                    length: Math.max(
                    getOrderedTournamentGifts(selectedGiftForEdit.tournamentId).length,
                    1
                    ),
                },
                (_, index) => index + 1
                ).map((position) => (
                <option key={position} value={position}>
                    Position {position}
                </option>
                ))}
            </select>

            <label style={styles.statusCheckboxLabel}>
                <input
                type="checkbox"
                checked={editGift.hasOptions}
                onChange={(event) =>
                    setEditGift((current) => ({
                    ...current,
                    hasOptions: event.target.checked,
                    optionValues: current.optionValues.length ? current.optionValues : [""],
                    }))
                }
                style={styles.largeCheckbox}
                />
                <span>
                    <strong style={styles.statusCheckboxTitle}>Gift Options</strong>
                    <span style={styles.statusCheckboxHint}>
                    Let participants choose a size, quantity, or custom option
                    </span>
                </span>
            </label>

            {editGift.hasOptions && (
                <div style={styles.optionEditorBox}>
                <FieldLabel label="Option Label" />
                <input
                    value={editGift.optionLabel}
                    onChange={(event) =>
                    setEditGift((current) => ({
                        ...current,
                        optionLabel: event.target.value,
                    }))
                    }
                    placeholder="Size, Quantity, or another custom choice..."
                    style={styles.input}
                />

                <FieldLabel label="Option Values" />
                {editGift.optionValues.map((optionValue, index) => (
                    <div key={index} style={styles.optionRow}>
                    <input
                        value={optionValue}
                        onChange={(event) =>
                        setEditGift((current) => ({
                            ...current,
                            optionValues: updateOptionValue(
                            current.optionValues,
                            index,
                            event.target.value
                            ),
                        }))
                        }
                        placeholder={`Option ${index + 1}`}
                        style={styles.input}
                    />
                    <button
                        type="button"
                        onClick={() =>
                        setEditGift((current) => ({
                            ...current,
                            optionValues:
                            current.optionValues.length <= 1
                                ? [""]
                                : current.optionValues.filter((_, valueIndex) => valueIndex !== index),
                        }))
                        }
                        style={styles.smallDangerButton}
                    >
                        <ButtonContent icon="trash" label="Remove" />
                    </button>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={() =>
                    setEditGift((current) => ({
                        ...current,
                        optionValues: [...current.optionValues, ""],
                    }))
                    }
                    style={styles.secondaryButton}
                >
                    <ButtonContent icon="plus" label="Add Option" />
                </button>
                </div>
            )}

            <label style={styles.statusCheckboxLabel}>
                <input
                type="checkbox"
                checked={editGift.hasColors}
                onChange={(event) =>
                    setEditGift((current) => ({
                    ...current,
                    hasColors: event.target.checked,
                    colorOptions: current.colorOptions.length
                        ? current.colorOptions
                        : [createGiftColorOption({ isDefault: true })],
                    }))
                }
                style={styles.largeCheckbox}
                />
                <span>
                    <strong style={styles.statusCheckboxTitle}>Color Options</strong>
                    <span style={styles.statusCheckboxHint}>
                    Let participants choose a color with swatches and color-specific images
                    </span>
                </span>
            </label>

            {editGift.hasColors && (
                <div style={styles.optionEditorBox}>
                <FieldLabel label="Colors" />
                {editGift.colorOptions.map((color, index) => (
                    <div key={color.id} style={styles.colorEditorRow}>
                    <input
                        value={color.name}
                        onChange={(event) =>
                        setEditGift((current) => ({
                            ...current,
                            colorOptions: updateColorName(
                            current.colorOptions,
                            color.id,
                            event.target.value
                            ),
                        }))
                        }
                        placeholder={`Color ${index + 1}`}
                        list="gift-color-name-options"
                        style={styles.input}
                    />
                    <input
                        type="color"
                        value={color.hex}
                        onChange={(event) =>
                        setEditGift((current) => ({
                            ...current,
                            colorOptions: updateColorOption(
                            current.colorOptions,
                            color.id,
                            { hex: event.target.value }
                            ),
                        }))
                        }
                        style={styles.colorInput}
                        aria-label={`${color.name || `Color ${index + 1}`} swatch`}
                    />
                    <span style={styles.colorValuePill}>{color.hex.toUpperCase()}</span>
                    <button
                        type="button"
                        onClick={() =>
                        setEditGift((current) => ({
                            ...current,
                            colorOptions: setDefaultColor(current.colorOptions, color.id),
                        }))
                        }
                        style={{
                        ...styles.colorActionButton,
                        ...(color.isDefault
                            ? styles.colorDefaultButton
                            : styles.colorSecondaryButton),
                        }}
                    >
                        {color.isDefault ? "Default" : "Set Default"}
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                        setEditGift((current) => ({
                            ...current,
                            colorOptions: removeColorOption(current.colorOptions, color.id),
                        }))
                        }
                        style={{ ...styles.colorActionButton, ...styles.colorRemoveButton }}
                    >
                        <ButtonContent icon="trash" label="Remove" />
                    </button>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={() =>
                    setEditGift((current) => ({
                        ...current,
                        colorOptions: [
                        ...current.colorOptions,
                        createGiftColorOption({ isDefault: current.colorOptions.length === 0 }),
                        ],
                    }))
                    }
                    style={styles.secondaryButton}
                >
                    <ButtonContent icon="plus" label="Add Color" />
                </button>
                </div>
            )}

            <label style={styles.statusCheckboxLabel}>
                <input
                type="checkbox"
                checked={editGift.isActive}
                onChange={(event) =>
                    setEditGift((current) => ({
                    ...current,
                    isActive: event.target.checked,
                    }))
                }
                style={styles.largeCheckbox}
                />
                <span>
                    <strong style={styles.statusCheckboxTitle}>Active Gift Item</strong>
                    <span style={styles.statusCheckboxHint}>
                    Visible to participants in the gift catalog
                    </span>
                </span>
            </label>

            <div style={styles.formSectionDivider} />

            <div>
                <h3 style={styles.modalSectionTitle}>Gift Images</h3>
                <p style={styles.muted}>
                Upload images, drag to reorder, choose the primary image, or remove images for this gift. Image order is saved when you save the gift.
                </p>
            </div>

            <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setImageUploadFiles(event.target.files)}
                style={styles.input}
            />

            <button
                type="button"
                onClick={uploadImagesForSelectedGift}
                disabled={isWorking || !imageUploadFiles || imageUploadFiles.length === 0}
                style={styles.primaryButton}
            >
                <ButtonContent icon="upload" label="Upload Images" />
            </button>

            <div style={styles.primaryImagePicker}>
                {editGiftImages.map((image, index) => (
                    <div
                    key={image.id}
                    draggable={!isWorking}
                    onClick={() => setEditGiftPrimaryImageId(image.id)}
                    onDragStart={(event) => {
                        setDraggedGiftImageId(image.id);
                        event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverGiftImageId(image.id);
                        event.dataTransfer.dropEffect = "move";
                    }}
                    onDragLeave={() => {
                        if (dragOverGiftImageId === image.id) {
                        setDragOverGiftImageId("");
                        }
                    }}
                    onDrop={(event) => {
                        event.preventDefault();
                        reorderGiftImages(draggedGiftImageId, image.id);
                    }}
                    onDragEnd={() => {
                        setDraggedGiftImageId("");
                        setDragOverGiftImageId("");
                    }}
                    style={{
                        ...styles.primaryImageOption,
                        ...(editGiftPrimaryImageId === image.id
                        ? styles.primaryImageSelectedOption
                        : {}),
                        ...(draggedGiftImageId === image.id
                        ? styles.primaryImageDraggingOption
                        : {}),
                        ...(dragOverGiftImageId === image.id &&
                        draggedGiftImageId !== image.id
                        ? styles.primaryImageDropTargetOption
                        : {}),
                    }}
                    >
                        <span style={styles.dragHandle} aria-hidden="true">
                        ::
                        </span>

                        {selectedGiftImageUrls[image.id] && (
                        <img
                            src={selectedGiftImageUrls[image.id]}
                            alt={image.altText || editGift.title}
                            style={styles.primaryImagePreview}
                        />
                        )}

                        <span style={styles.primaryImageLabel}>
                        {index === 0 ? "Primary Image" : `Gallery Image ${index + 1}`}
                        </span>

                        {editGift.hasColors && editGift.colorOptions.length > 0 && (
                        <select
                            value={
                            editGift.colorOptions.find((color) =>
                                color.imageIds.includes(image.id)
                            )?.id ?? ""
                            }
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                            setEditGift((current) => ({
                                ...current,
                                colorOptions: event.target.value
                                ? toggleImageColorLink(
                                    current.colorOptions,
                                    event.target.value,
                                    image.id
                                    )
                                : current.colorOptions.map((color) => ({
                                    ...color,
                                    imageIds: color.imageIds.filter((id) => id !== image.id),
                                    })),
                            }))
                            }
                            disabled={isWorking}
                            style={styles.imageColorSelect}
                        >
                            <option value="">All colors</option>
                            {editGift.colorOptions.map((color) => (
                            <option key={color.id} value={color.id}>
                                {color.name || "Unnamed color"}
                            </option>
                            ))}
                        </select>
                        )}

                        {selectedGiftImageUrls[image.id] && (
                        <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            setPreviewGiftImage({
                            url: selectedGiftImageUrls[image.id],
                            alt: image.altText || editGift.title,
                            });
                        }}
                        disabled={isWorking}
                        style={styles.smallNeutralButton}
                        >
                        <ButtonContent icon="eye" label="View" />
                        </button>
                        )}

                        <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            deleteGiftImage(image);
                        }}
                        disabled={isWorking}
                        style={styles.smallDangerButton}
                        >
                        <ButtonContent icon="trash" label="Delete" />
                        </button>
                    </div>
                ))}

                {editGiftImages.length === 0 && (
                <p style={styles.muted}>No images uploaded for this gift yet.</p>
                )}
            </div>

            <div style={styles.modalActions}>
                <button
                type="button"
                onClick={() => setSelectedGiftForEdit(null)}
                style={styles.secondaryButton}
                >
                <ButtonContent icon="x" label="Cancel" />
                </button>

                <button
                type="button"
                onClick={async () => {
                    const removed = await removeGift(selectedGiftForEdit);

                    if (removed) {
                    setSelectedGiftForEdit(null);
                    setEditGiftImages([]);
                    setSelectedGiftImageUrls({});
                    setImageUploadFiles(null);
                    setEditGiftPrimaryImageId("");
                    setDraggedGiftImageId("");
                    setDragOverGiftImageId("");
                    }
                }}
                disabled={isWorking}
                style={styles.dangerButton}
                >
                <ButtonContent icon="trash" label="Remove" />
                </button>

                <button type="submit" disabled={isWorking} style={styles.primaryButton}>
                <ButtonContent icon="save" label="Save Changes" />
                </button>
            </div>
            </form>
        </Modal>
        )}

      {previewGiftImage && (
        <Modal title="Gift Image Preview" onClose={() => setPreviewGiftImage(null)}>
          <div style={styles.imagePreviewModalContent}>
            <img
              src={previewGiftImage.url}
              alt={previewGiftImage.alt}
              style={styles.imagePreviewLarge}
            />
          </div>
        </Modal>
      )}

      {isCsvUploadOpen && (
        <Modal title="Upload Participants CSV" onClose={() => setIsCsvUploadOpen(false)}>
          <div style={styles.modalForm}>
            <p style={styles.muted}>
              Expected columns: <strong>firstName,lastName,email,memberNumber,startingPoints</strong>.
              The startingPoints column is optional and defaults to 30.
            </p>

            <div style={styles.csvExample}>
              firstName,lastName,email,memberNumber,startingPoints<br />
              Trevor,Test,test@example.com,12345,30
            </div>

            <FieldLabel label="Tournament" />
            <select
              value={csvTournamentId}
              disabled
              style={styles.input}
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>

            <FieldLabel label="CSV File" />
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileSelected}
              style={styles.input}
            />

            {csvErrors.length > 0 && (
              <div style={styles.csvErrorBox}>
                <strong>CSV Warnings</strong>
                <ul style={styles.csvList}>
                  {csvErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {csvRows.length > 0 && (
              <div style={styles.csvPreviewBox}>
                <strong>Preview: {csvRows.length} valid row(s)</strong>
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Name</th>
                        <th style={styles.th}>Email</th>
                        <th style={styles.th}>Member #</th>
                        <th style={styles.th}>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 8).map((row) => (
                        <tr key={`${row.email}-${row.memberNumber}-${row.rowNumber}`}>
                          <td style={styles.td}>{row.firstName} {row.lastName}</td>
                          <td style={styles.td}>{row.email}</td>
                          <td style={styles.td}>{row.memberNumber}</td>
                          <td style={styles.td}>{row.startingPoints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvRows.length > 8 && <p style={styles.muted}>Showing first 8 rows only.</p>}
              </div>
            )}

            <div style={styles.modalActions}>
              <button type="button" onClick={() => setIsCsvUploadOpen(false)} style={styles.secondaryButton}>
                <ButtonContent icon="x" label="Cancel" />
              </button>

              <button
                type="button"
                onClick={importCsvParticipants}
                disabled={isWorking || csvRows.length === 0}
                style={styles.primaryButton}
              >
                <ButtonContent icon="upload" label="Import Participants" />
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isAddGiftOpen && (
        <Modal title="Add Gift Item" onClose={() => setIsAddGiftOpen(false)}>
          <form onSubmit={addGift} style={styles.modalForm}>
            <FieldLabel label="Tournament" />
            <select
              value={newGift.tournamentId}
              disabled
              style={styles.input}
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>

            <FieldLabel label="Gift Title" />
            <input
              value={newGift.title}
              onChange={(event) =>
                setNewGift((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Gift title"
              style={styles.input}
            />

            <FieldLabel label="Description" />
            <textarea
              value={newGift.description}
              onChange={(event) =>
                setNewGift((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Description"
              style={{ ...styles.input, minHeight: "90px" }}
            />



            <FieldLabel label="Point Cost" />
            <input
            value={newGift.pointCost}
            onChange={(event) =>
                setNewGift((current) => ({
                ...current,
                pointCost: event.target.value,
                }))
            }
            placeholder="Point cost"
            type="number"
            style={styles.input}
            />

            <FieldLabel label="Gift Images" />
                <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                    setNewGiftImageFiles(event.target.files);
                    setNewGiftPrimaryImageIndex(0);
                }}
                style={styles.input}
                />

                {newGiftImageFiles && newGiftImageFiles.length > 0 && (
                <div style={styles.primaryImagePicker}>
                    {Array.from(newGiftImageFiles).map((file, index) => (
                    <label key={`${file.name}-${index}`} style={styles.primaryImageOption}>
                        <input
                        type="radio"
                        name="newGiftPrimaryImage"
                        checked={newGiftPrimaryImageIndex === index}
                        onChange={() => setNewGiftPrimaryImageIndex(index)}
                        />
                        <span>
                        {file.name} {newGiftPrimaryImageIndex === index ? "(Primary)" : ""}
                        </span>
                    </label>
                    ))}
                </div>
                )}

            <FieldLabel label="Sort Order" />
            <select
              value={newGift.sortOrder}
              onChange={(event) =>
                setNewGift((current) => ({
                  ...current,
                  sortOrder: event.target.value,
                }))
              }
              style={styles.input}
            >
              {Array.from(
                {
                  length: Math.max(
                    getOrderedTournamentGifts(newGift.tournamentId).length + 1,
                    1
                  ),
                },
                (_, index) => index + 1
              ).map((position) => (
                <option key={position} value={position}>
                  Position {position}
                </option>
              ))}
            </select>

            <label style={styles.statusCheckboxLabel}>
              <input
                type="checkbox"
                checked={newGift.hasOptions}
                onChange={(event) =>
                  setNewGift((current) => ({
                    ...current,
                    hasOptions: event.target.checked,
                    optionValues: current.optionValues.length ? current.optionValues : [""],
                  }))
                }
                style={styles.largeCheckbox}
              />
              <span>
                <strong style={styles.statusCheckboxTitle}>Gift Options</strong>
                <span style={styles.statusCheckboxHint}>
                  Let participants choose a size, quantity, or custom option
                </span>
              </span>
            </label>

            {newGift.hasOptions && (
              <div style={styles.optionEditorBox}>
                <FieldLabel label="Option Label" />
                <input
                  value={newGift.optionLabel}
                  onChange={(event) =>
                    setNewGift((current) => ({
                      ...current,
                      optionLabel: event.target.value,
                    }))
                  }
                  placeholder="Size, Quantity, or another custom choice..."
                  style={styles.input}
                />

                <FieldLabel label="Option Values" />
                {newGift.optionValues.map((optionValue, index) => (
                  <div key={index} style={styles.optionRow}>
                    <input
                      value={optionValue}
                      onChange={(event) =>
                        setNewGift((current) => ({
                          ...current,
                          optionValues: updateOptionValue(
                            current.optionValues,
                            index,
                            event.target.value
                          ),
                        }))
                      }
                      placeholder={`Option ${index + 1}`}
                      style={styles.input}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setNewGift((current) => ({
                          ...current,
                          optionValues:
                            current.optionValues.length <= 1
                              ? [""]
                              : current.optionValues.filter((_, valueIndex) => valueIndex !== index),
                        }))
                      }
                      style={styles.smallDangerButton}
                    >
                      <ButtonContent icon="trash" label="Remove" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setNewGift((current) => ({
                      ...current,
                      optionValues: [...current.optionValues, ""],
                    }))
                  }
                  style={styles.secondaryButton}
                >
                  <ButtonContent icon="plus" label="Add Option" />
                </button>
              </div>
            )}

            <label style={styles.statusCheckboxLabel}>
              <input
                type="checkbox"
                checked={newGift.hasColors}
                onChange={(event) =>
                  setNewGift((current) => ({
                    ...current,
                    hasColors: event.target.checked,
                    colorOptions: current.colorOptions.length
                      ? current.colorOptions
                      : [createGiftColorOption({ isDefault: true })],
                  }))
                }
                style={styles.largeCheckbox}
              />
              <span>
                <strong style={styles.statusCheckboxTitle}>Color Options</strong>
                <span style={styles.statusCheckboxHint}>
                  Let participants choose a color with swatches and color-specific images
                </span>
              </span>
            </label>

            {newGift.hasColors && (
              <div style={styles.optionEditorBox}>
                <FieldLabel label="Colors" />
                {newGift.colorOptions.map((color, index) => (
                  <div key={color.id} style={styles.colorEditorRow}>
                    <input
                      value={color.name}
                      onChange={(event) =>
                        setNewGift((current) => ({
                          ...current,
                          colorOptions: updateColorName(
                            current.colorOptions,
                            color.id,
                            event.target.value
                          ),
                        }))
                      }
                      placeholder={`Color ${index + 1}`}
                      list="gift-color-name-options"
                      style={styles.input}
                    />
                    <input
                      type="color"
                      value={color.hex}
                      onChange={(event) =>
                        setNewGift((current) => ({
                          ...current,
                          colorOptions: updateColorOption(
                            current.colorOptions,
                            color.id,
                            { hex: event.target.value }
                          ),
                        }))
                      }
                      style={styles.colorInput}
                      aria-label={`${color.name || `Color ${index + 1}`} swatch`}
                    />
                    <span style={styles.colorValuePill}>{color.hex.toUpperCase()}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setNewGift((current) => ({
                          ...current,
                          colorOptions: setDefaultColor(current.colorOptions, color.id),
                        }))
                      }
                      style={{
                        ...styles.colorActionButton,
                        ...(color.isDefault
                          ? styles.colorDefaultButton
                          : styles.colorSecondaryButton),
                      }}
                    >
                      {color.isDefault ? "Default" : "Set Default"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewGift((current) => ({
                          ...current,
                          colorOptions: removeColorOption(current.colorOptions, color.id),
                        }))
                      }
                      style={{ ...styles.colorActionButton, ...styles.colorRemoveButton }}
                    >
                      <ButtonContent icon="trash" label="Remove" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setNewGift((current) => ({
                      ...current,
                      colorOptions: [
                        ...current.colorOptions,
                        createGiftColorOption({ isDefault: current.colorOptions.length === 0 }),
                      ],
                    }))
                  }
                  style={styles.secondaryButton}
                >
                  <ButtonContent icon="plus" label="Add Color" />
                </button>
              </div>
            )}

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={newGift.isActive}
                onChange={(event) =>
                  setNewGift((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
              />
              Active
            </label>

            <div style={styles.modalActions}>
              <button type="button" onClick={() => setIsAddGiftOpen(false)} style={styles.secondaryButton}>
                <ButtonContent icon="x" label="Cancel" />
              </button>

              <button type="submit" disabled={isWorking} style={styles.primaryButton}>
                <ButtonContent icon="plus" label="Add Gift" />
              </button>
            </div>
          </form>
        </Modal>
      )}

      <datalist id="gift-color-name-options">
        {Object.keys(commonColorHexByName)
          .filter((name) => name !== "grey")
          .map((name) => (
            <option key={name} value={name.charAt(0).toUpperCase() + name.slice(1)} />
          ))}
      </datalist>
    </main>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div style={styles.modalOverlay}>
      <section style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{title}</h2>
          <button type="button" onClick={onClose} style={styles.modalCloseButton}>
            ×
          </button>
        </div>

        <div style={styles.modalBody}>{children}</div>
      </section>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <label style={styles.fieldLabel}>{label}</label>;
}

function SortableTh({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <th style={styles.th}>
      <button type="button" onClick={onClick} style={styles.sortButton}>
        {label}
      </button>
    </th>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
    </article>
  );
}

function ButtonContent({
  icon,
  label,
}: {
  icon: ButtonIconName;
  label: string;
}) {
  return (
    <span style={styles.buttonContent}>
      <ButtonIcon name={icon} />
      <span>{label}</span>
    </span>
  );
}

function ButtonIcon({ name }: { name: ButtonIconName }) {
  const paths: Record<ButtonIconName, React.ReactNode> = {
    check: <path d="m4 12 5 5L20 6" />,
    download: (
      <>
        <path d="M12 4v12" />
        <path d="m7 11 5 5 5-5" />
        <path d="M5 20h14" />
      </>
    ),
    edit: (
      <>
        <path d="M4 20h4l10.5-10.5-4-4L4 16v4Z" />
        <path d="m13.5 6.5 4 4" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 16 5-5 4 4 2-2 7 6" />
        <circle cx="16" cy="9" r="1.5" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" />
        <path d="M4 4v4h4" />
        <path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" />
        <path d="M20 20v-4h-4" />
      </>
    ),
    reset: (
      <>
        <path d="M4 7v5h5" />
        <path d="M5 12a7 7 0 1 0 2-5" />
      </>
    ),
    save: (
      <>
        <path d="M5 3h12l2 2v16H5V3Z" />
        <path d="M8 3v6h8V3" />
        <path d="M8 21v-7h8v7" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 20h14" />
      </>
    ),
    x: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      style={styles.buttonIcon}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function ParticipantCartAndOrders({
  participant,
  cartItems,
  giftItems,
  orders,
  orderItems,
  cartTotal,
  formatDate,
}: {
  participant: Participant;
  cartItems: CartItem[];
  giftItems: GiftItem[];
  orders: Order[];
  orderItems: OrderItem[];
  cartTotal: number;
  formatDate: (value?: string | null) => string;
}) {
  const startingPoints = participant.startingPoints ?? 0;
  const remainingPoints = startingPoints - cartTotal;

  return (
    <div>
      <div style={styles.detailGrid}>
        <div>
          <p style={styles.detailLabel}>Submitted</p>
          <p style={styles.detailValue}>
            {participant.hasSubmittedOrder ? "Yes" : "No"}
          </p>
        </div>

        <div>
          <p style={styles.detailLabel}>Starting Points</p>
          <p style={styles.detailValue}>{startingPoints}</p>
        </div>

        <div>
          <p style={styles.detailLabel}>Cart Total</p>
          <p style={styles.detailValue}>{cartTotal}</p>
        </div>

        <div>
          <p style={styles.detailLabel}>Remaining</p>
          <p style={styles.detailValue}>{remainingPoints}</p>
        </div>
      </div>

      <h4 style={styles.orderItemsTitle}>Current Cart</h4>

      {cartItems.length === 0 ? (
        <p style={styles.muted}>No cart items found for this participant.</p>
      ) : (
        <div style={styles.orderItemsList}>
          {cartItems.map((cartItem) => {
            const gift = giftItems.find((item) => item.id === cartItem.giftItemId);
            const lineTotal =
              (cartItem.quantity ?? 0) * (cartItem.pointCostAtTime ?? 0);

            return (
              <div key={cartItem.id} style={styles.orderItemRow}>
                <div>
                  <p style={styles.orderItemTitle}>
                    {gift?.title || "Gift Item"}
                  </p>
                  <p style={styles.muted}>
                    Qty: {cartItem.quantity} x {cartItem.pointCostAtTime} pts
                  </p>
                  {cartItem.selectedOption && (
                    <p style={styles.muted}>
                      {formatGiftOption(
                        cartItem.selectedOptionLabel || gift?.optionLabel,
                        cartItem.selectedOption
                      )}
                    </p>
                  )}
                  {cartItem.selectedColorName && (
                    <p style={styles.muted}>
                      {formatGiftColor(cartItem.selectedColorName)}
                    </p>
                  )}
                </div>

                <strong>{lineTotal} pts</strong>
              </div>
            );
          })}
        </div>
      )}

      <h4 style={styles.orderItemsTitle}>Submitted Orders</h4>

      {orders.length === 0 ? (
        <p style={styles.muted}>No submitted orders found for this participant.</p>
      ) : (
        <div style={styles.orderItemsList}>
          {orders.map((order) => {
            const items = orderItems.filter((item) => item.orderId === order.id);

            return (
              <div key={order.id} style={styles.participantOrderBlock}>
                <div style={styles.orderItemRow}>
                  <div>
                    <p style={styles.orderItemTitle}>
                      Submitted {formatDate(order.submittedAt)}
                    </p>
                    <p style={styles.muted}>Status: {order.status}</p>
                  </div>

                  <strong>{order.totalPointsUsed} pts</strong>
                </div>

                {items.length > 0 && (
                  <div style={styles.participantOrderItems}>
                    {items.map((item) => {
                      const lineTotal =
                        (item.quantity ?? 0) * (item.pointCostAtTime ?? 0);

                      return (
                        <div key={item.id} style={styles.participantOrderItem}>
                          <span>
                            {item.titleAtTime}
                            {item.selectedOptionAtTime
                              ? ` (${formatGiftOption(item.selectedOptionLabelAtTime, item.selectedOptionAtTime)})`
                              : ""}
                            {item.selectedColorNameAtTime
                              ? ` (${formatGiftColor(item.selectedColorNameAtTime)})`
                              : ""}
                          </span>
                          <span>
                            {item.quantity} x {item.pointCostAtTime} ={" "}
                            {lineTotal} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrderDetail({
  order,
  participant,
  tournament,
  orderItems,
}: {
  order: Order;
  participant?: Participant;
  tournament?: Tournament;
  orderItems: OrderItem[];
}) {
  const totalQuantity = orderItems.reduce(
    (total, item) => total + (item.quantity ?? 0),
    0
  );

  return (
    <div>
      <div style={styles.detailGrid}>
        <div>
          <p style={styles.detailLabel}>Member</p>
          <p style={styles.detailValue}>
            {participant
              ? `${participant.firstName} ${participant.lastName}`
              : "Unknown"}
          </p>
        </div>

        <div>
          <p style={styles.detailLabel}>Email</p>
          <p style={styles.detailValue}>{participant?.email ?? ""}</p>
        </div>

        <div>
          <p style={styles.detailLabel}>Member #</p>
          <p style={styles.detailValue}>{participant?.memberNumber ?? ""}</p>
        </div>

        <div>
          <p style={styles.detailLabel}>Tournament</p>
          <p style={styles.detailValue}>{tournament?.name ?? ""}</p>
        </div>

        <div>
          <p style={styles.detailLabel}>Total Items</p>
          <p style={styles.detailValue}>{totalQuantity}</p>
        </div>

        <div>
          <p style={styles.detailLabel}>Total Points</p>
          <p style={styles.detailValue}>{order.totalPointsUsed}</p>
        </div>
      </div>

      <h4 style={styles.orderItemsTitle}>Gift Selections</h4>

      {orderItems.length === 0 ? (
        <p style={styles.muted}>No order items found.</p>
      ) : (
        <div style={styles.orderItemsList}>
          {orderItems.map((item) => {
            const lineTotal =
              (item.quantity ?? 0) * (item.pointCostAtTime ?? 0);

            return (
              <div key={item.id} style={styles.orderItemRow}>
                <div>
                  <p style={styles.orderItemTitle}>{item.titleAtTime}</p>
                  {item.selectedOptionAtTime && (
                    <p style={styles.muted}>
                      {formatGiftOption(
                        item.selectedOptionLabelAtTime,
                        item.selectedOptionAtTime
                      )}
                    </p>
                  )}
                  {item.selectedColorNameAtTime && (
                    <p style={styles.muted}>
                      {formatGiftColor(item.selectedColorNameAtTime)}
                    </p>
                  )}
                  <p style={styles.muted}>
                    Qty: {item.quantity} × {item.pointCostAtTime} pts
                  </p>
                </div>

                <strong>{lineTotal} pts</strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #eef5f0 0%, #f8faf9 45%, #e7efe9 100%)",
    padding: "32px",
  },
  container: {
    maxWidth: "1280px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "24px",
    alignItems: "flex-start",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  headerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  title: {
    margin: 0,
    fontSize: "34px",
    color: "var(--tg-primary)",
  },
  subtitle: {
    color: "#5f6f68",
    fontSize: "16px",
    lineHeight: 1.5,
    marginTop: "8px",
  },
  message: {
    backgroundColor: "#f4f8f6",
    border: "1px solid #dce8e1",
    borderRadius: "12px",
    padding: "12px 16px",
    color: "var(--tg-primary)",
    fontWeight: 700,
  },
  tournamentSelectorCard: {
    backgroundColor: "#ffffff",
    borderRadius: "22px",
    border: "1px solid #dce8e1",
    boxShadow: "0 14px 40px rgba(0, 0, 0, 0.1)",
    padding: "22px",
    marginBottom: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  tournamentSelectorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    flexWrap: "wrap",
  },
  tournamentTitleGroup: {
    minWidth: "280px",
    flex: "1 1 420px",
  },
  tournamentSelectorLabel: {
    margin: 0,
    color: "#5f6f68",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  tournamentSelectorTitle: {
    margin: "6px 0 0",
    color: "var(--tg-primary)",
    fontSize: "26px",
  },
  tournamentTitleSelect: {
    width: "100%",
    maxWidth: "640px",
    border: "none",
    borderBottom: "2px solid #dce8e1",
    borderRadius: 0,
    padding: "4px 34px 8px 0",
    marginTop: "4px",
    fontSize: "28px",
    lineHeight: 1.15,
    backgroundColor: "transparent",
    color: "var(--tg-primary)",
    fontWeight: 900,
    cursor: "pointer",
    outline: "none",
  },
  tournamentMetaRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: 0,
  },
  tournamentMetaChip: {
    border: "1px solid #dce8e1",
    borderRadius: "12px",
    backgroundColor: "#f7f9f8",
    padding: "10px 12px",
    minWidth: "130px",
  },
  tournamentOpenChip: {
    backgroundColor: "#e8f4ed",
    borderColor: "#b9d8c6",
  },
  tournamentClosedChip: {
    backgroundColor: "#f7f4f2",
    borderColor: "#e1d7d0",
  },
  tournamentMetaLabel: {
    display: "block",
    color: "#5f6f68",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "4px",
  },
  tournamentMetaValue: {
    display: "block",
    color: "var(--tg-primary)",
    fontSize: "15px",
    lineHeight: 1.2,
  },
  tournamentSelect: {
    minWidth: "280px",
    maxWidth: "100%",
    height: "40px",
    border: "1px solid #ccd8d1",
    borderRadius: "12px",
    padding: "1px 14px",
    fontSize: "15px",
    backgroundColor: "#ffffff",
    color: "#263a32",
    fontWeight: 800,
  },
  tournamentSelectorActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
    paddingTop: "2px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  statCard: {
    backgroundColor: "#ffffff",
    borderRadius: "18px",
    border: "1px solid #dce8e1",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
    padding: "20px",
  },
  statLabel: {
    margin: 0,
    color: "#5f6f68",
    fontSize: "13px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  statValue: {
    margin: "8px 0 0",
    color: "var(--tg-primary)",
    fontSize: "34px",
    fontWeight: 900,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "22px",
    border: "1px solid #dce8e1",
    boxShadow: "0 14px 40px rgba(0, 0, 0, 0.1)",
    padding: "24px",
    marginBottom: "24px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    marginBottom: "18px",
    flexWrap: "wrap",
  },
  sectionActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    color: "var(--tg-primary)",
    fontSize: "24px",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #dce8e1",
    padding: "10px",
    color: "#5f6f68",
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },
  sortButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    color: "#5f6f68",
    fontSize: "13px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    cursor: "pointer",
  },
  td: {
    borderBottom: "1px solid #edf3ef",
    padding: "12px 10px",
    color: "#263a32",
    fontSize: "14px",
    verticalAlign: "top",
  },
  searchInput: {
    width: "260px",
    height: "40px",
    maxWidth: "100%",
    border: "1px solid #ccd8d1",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
  },
  input: {
    width: "100%",
    border: "1px solid #ccd8d1",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    backgroundColor: "#ffffff",
    color: "#263a32",
  },
  fieldLabel: {
    display: "block",
    color: "#263a32",
    fontWeight: 800,
    fontSize: "13px",
    marginBottom: "6px",
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#263a32",
    fontWeight: 700,
  },
  statusCheckboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    border: "1px solid #c8dbd0",
    borderRadius: "14px",
    backgroundColor: "#f4f8f6",
    padding: "14px",
    color: "#263a32",
    cursor: "pointer",
  },
  largeCheckbox: {
    width: "22px",
    height: "22px",
    accentColor: "var(--tg-primary)",
    flex: "0 0 auto",
  },
  statusCheckboxTitle: {
    display: "block",
    color: "var(--tg-primary)",
    fontSize: "15px",
    lineHeight: 1.2,
  },
  statusCheckboxHint: {
    display: "block",
    color: "#5f6f68",
    fontSize: "13px",
    lineHeight: 1.35,
    marginTop: "2px",
  },
  optionEditorBox: {
    border: "1px solid #dce8e1",
    borderRadius: "14px",
    backgroundColor: "#f7f9f8",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  optionRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "8px",
    alignItems: "center",
  },
  colorEditorRow: {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 1fr) 54px 92px 118px 110px",
    gap: "8px",
    alignItems: "center",
  },
  colorInput: {
    width: "54px",
    height: "46px",
    border: "1px solid #ccd8d1",
    borderRadius: "12px",
    padding: "4px",
    backgroundColor: "#ffffff",
    cursor: "pointer",
  },
  colorValuePill: {
    height: "46px",
    border: "1px solid #ccd8d1",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
    color: "#5f6f68",
    fontSize: "12px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    letterSpacing: "0.03em",
  },
  colorActionButton: {
    height: "46px",
    borderRadius: "12px",
    padding: "0 12px",
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    whiteSpace: "nowrap",
  },
  colorDefaultButton: {
    border: "1px solid var(--tg-primary)",
    color: "#ffffff",
    backgroundColor: "var(--tg-primary)",
  },
  colorSecondaryButton: {
    border: "1px solid #cbd5d1",
    color: "#37423d",
    backgroundColor: "#f7f9f8",
  },
  colorRemoveButton: {
    border: "1px solid #b42318",
    color: "#ffffff",
    backgroundColor: "#b42318",
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 18px",
    color: "#ffffff",
    backgroundColor: "var(--tg-primary)",
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  secondaryButton: {
    border: "1px solid #cbd5d1",
    borderRadius: "12px",
    padding: "12px 18px",
    color: "#37423d",
    backgroundColor: "#f7f9f8",
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  dangerButton: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 18px",
    color: "#ffffff",
    backgroundColor: "#b42318",
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  smallButton: {
    border: "none",
    borderRadius: "10px",
    padding: "8px 12px",
    color: "#ffffff",
    backgroundColor: "var(--tg-primary)",
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  },
  smallNeutralButton: {
    border: "1px solid #cbd5d1",
    borderRadius: "10px",
    padding: "8px 12px",
    color: "#37423d",
    backgroundColor: "#f7f9f8",
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  },
  smallDangerButton: {
    border: "none",
    borderRadius: "10px",
    padding: "8px 12px",
    color: "#ffffff",
    backgroundColor: "#b42318",
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  },
  buttonContent: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  buttonIcon: {
    width: "16px",
    height: "16px",
    flex: "0 0 auto",
  },
  actionRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  giftGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  giftCard: {
    border: "1px solid #dce8e1",
    borderRadius: "16px",
    padding: "16px",
  },
  giftImage: {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  display: "block",
  backgroundColor: "#edf3ef",
},
giftImageBox: {
  width: "100%",
  aspectRatio: "1 / 1",
  borderRadius: "12px",
  marginBottom: "12px",
  backgroundColor: "#edf3ef",
  overflow: "hidden",
  border: "1px solid #dce8e1",
},
giftImagePlaceholder: {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#5f6f68",
  fontWeight: 800,
  fontSize: "14px",
},
  giftTitle: {
    margin: 0,
    color: "var(--tg-primary)",
    fontSize: "18px",
  },
  giftPoints: {
    color: "var(--tg-primary)",
    fontWeight: 900,
  },
  muted: {
    color: "#5f6f68",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  orderDetailPanel: {
    marginTop: "24px",
    border: "1px solid #dce8e1",
    borderRadius: "18px",
    padding: "20px",
    backgroundColor: "#f4f8f6",
  },
  orderDetailTitle: {
    margin: 0,
    color: "var(--tg-primary)",
    fontSize: "21px",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "18px",
  },
  detailLabel: {
    margin: 0,
    color: "#5f6f68",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  detailValue: {
    margin: "4px 0 0",
    color: "var(--tg-primary)",
    fontSize: "15px",
    fontWeight: 800,
  },
  orderItemsTitle: {
    margin: "12px 0",
    color: "var(--tg-primary)",
    fontSize: "18px",
  },
  orderItemsList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  orderItemRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    border: "1px solid #dce8e1",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "12px",
  },
  orderItemTitle: {
    margin: 0,
    color: "var(--tg-primary)",
    fontWeight: 900,
  },
  participantOrderBlock: {
    border: "1px solid #dce8e1",
    borderRadius: "14px",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  participantOrderItems: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    backgroundColor: "#f4f8f6",
  },
  participantOrderItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    color: "#263a32",
    fontSize: "14px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 60, 44, 0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1000,
  },
  modalCard: {
    position: "relative",
    width: "100%",
    maxWidth: "680px",
    maxHeight: "90vh",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderRadius: "22px",
    boxShadow: "0 22px 70px rgba(0, 0, 0, 0.22)",
    border: "1px solid #dce8e1",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "24px 24px 18px",
    flex: "0 0 auto",
  },
  modalBody: {
    overflowY: "auto",
    padding: "0 24px 0",
  },
  modalTitle: {
    margin: 0,
    color: "var(--tg-primary)",
    fontSize: "24px",
  },
  modalSectionTitle: {
    margin: "0 0 6px",
    color: "var(--tg-primary)",
    fontSize: "18px",
  },
  formSectionDivider: {
    height: "1px",
    backgroundColor: "#dce8e1",
    margin: "4px 0",
  },
  modalCloseButton: {
    border: "none",
    borderRadius: "999px",
    width: "36px",
    height: "36px",
    backgroundColor: "#f4f8f6",
    color: "var(--tg-primary)",
    fontSize: "22px",
    lineHeight: 0,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    fontFamily: "Arial, sans-serif",
  },
  modalForm: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    paddingBottom: "78px",
  },
  modalActions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
    margin: 0,
    padding: "14px 24px",
    backgroundColor: "#ffffff",
    borderTop: "1px solid #dce8e1",
    boxShadow: "0 -10px 24px rgba(18, 60, 44, 0.08)",
  },
  csvExample: {
    backgroundColor: "#f4f8f6",
    border: "1px solid #dce8e1",
    borderRadius: "12px",
    padding: "12px",
    color: "var(--tg-primary)",
    fontFamily: "monospace",
    fontSize: "13px",
    lineHeight: 1.5,
    overflowX: "auto",
  },
  csvErrorBox: {
    backgroundColor: "#fff4f2",
    border: "1px solid #ffd6d1",
    borderRadius: "12px",
    padding: "12px",
    color: "#b42318",
  },
  csvPreviewBox: {
    border: "1px solid #dce8e1",
    borderRadius: "12px",
    padding: "12px",
  },
  csvList: {
    margin: "8px 0 0",
    paddingLeft: "20px",
  },
  imageManageGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "14px",
  marginTop: "14px",
},
imageManageCard: {
  border: "1px solid #dce8e1",
  borderRadius: "14px",
  padding: "12px",
},
imageManagePreview: {
  width: "100%",
  aspectRatio: "1 / 1",
  objectFit: "cover",
  borderRadius: "10px",
  backgroundColor: "#edf3ef",
},
  primaryImagePicker: {
    border: "1px solid #dce8e1",
    borderRadius: "14px",
    backgroundColor: "#f7f9f8",
    padding: "12px",
    display: "grid",
    gap: "10px",
  },
  primaryImageOption: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    borderWidth: "2px",
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: "14px",
    backgroundColor: "#ffffff",
    padding: "10px",
    color: "#263a32",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "none",
    transition: "transform 140ms ease, border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease",
  },
  primaryImageSelectedOption: {
    borderColor: "var(--tg-primary)",
    backgroundColor: "#eef5f0",
    boxShadow: "0 8px 20px rgba(18, 60, 44, 0.12)",
  },
  primaryImageDraggingOption: {
    opacity: 0.55,
    transform: "scale(0.98)",
  },
  primaryImageDropTargetOption: {
    transform: "translateY(6px)",
    backgroundColor: "#f4f8f6",
  },
  dragHandle: {
    color: "#8b9a93",
    fontWeight: 900,
    cursor: "grab",
    letterSpacing: "1px",
    userSelect: "none",
  },
  primaryImageLabel: {
    flex: "1 1 auto",
  },
  imageColorSelect: {
    minWidth: "150px",
    border: "1px solid #ccd8d1",
    borderRadius: "10px",
    padding: "9px 10px",
    color: "#263a32",
    backgroundColor: "#ffffff",
    fontWeight: 700,
  },
  primaryImagePreview: {
    width: "120px",
    height: "120px",
    objectFit: "cover",
    borderRadius: "8px",
    backgroundColor: "#edf3ef",
    border: "1px solid #dce8e1",
  },
  imagePreviewModalContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f8f6",
    border: "1px solid #dce8e1",
    borderRadius: "16px",
    padding: "16px",
  },
  imagePreviewLarge: {
    width: "100%",
    maxHeight: "72vh",
    objectFit: "contain",
    borderRadius: "12px",
    backgroundColor: "#edf3ef",
  },
};
