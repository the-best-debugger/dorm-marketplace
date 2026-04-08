const CLAIM_WINDOW_MS = 20 * 1000;
const STORAGE_KEY = "dorm-marketplace-items-v1";

const State = Object.freeze({
  AVAILABLE: "available",
  CLAIMED: "claimed",
  SOLD: "sold",
  REMOVED: "removed",
});

const itemsContainer = document.getElementById("items");
const messageEl = document.getElementById("message");
const itemTemplate = document.getElementById("item-template");
const listingForm = document.getElementById("listing-form");
const seedButton = document.getElementById("seed-btn");

let items = loadItems();
let claimInFlight = new Set();

render();
setInterval(processClaimExpirations, 1000);

listingForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(listingForm);
  const title = normalize(formData.get("title"));
  const sellerName = normalize(formData.get("sellerName"));
  const category = normalize(formData.get("category"));
  const location = normalize(formData.get("location"));
  const notes = normalize(formData.get("notes"));

  if (!title || !sellerName || !category || !location) {
    setMessage("Please fill all required fields.", true);
    return;
  }

  const item = {
    id: crypto.randomUUID(),
    title,
    sellerName,
    category,
    location,
    notes,
    state: State.AVAILABLE,
    claimedBy: null,
    claimedAt: null,
    claimExpiresAt: null,
  };

  items.unshift(item);
  saveItems();
  listingForm.reset();
  setMessage(`Listing added: ${item.title}`);
  render();
});

seedButton.addEventListener("click", () => {
  if (items.length > 0) {
    setMessage("Sample data skipped because listings already exist.", true);
    return;
  }

  items = [
    {
      id: crypto.randomUUID(),
      title: "Calculus Textbook (Used)",
      sellerName: "Aarav",
      category: "Textbook",
      location: "Dorm A Lobby",
      notes: "Few highlights, good condition.",
      state: State.AVAILABLE,
      claimedBy: null,
      claimedAt: null,
      claimExpiresAt: null,
    },
    {
      id: crypto.randomUUID(),
      title: "Mini Fridge 90L",
      sellerName: "Mia",
      category: "Mini Fridge",
      location: "Dorm C Gate",
      notes: "Pickup after 6 PM.",
      state: State.AVAILABLE,
      claimedBy: null,
      claimedAt: null,
      claimExpiresAt: null,
    },
  ];

  saveItems();
  setMessage("Sample listings loaded.");
  render();
});

itemsContainer.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const card = target.closest(".item-card");
  if (!card) return;
  const itemId = card.dataset.itemId;
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return;

  if (target.classList.contains("claim-btn")) {
    const buyerInput = card.querySelector(".buyer-input");
    if (!(buyerInput instanceof HTMLInputElement)) return;
    const buyerName = normalize(buyerInput.value);
    await claimItem(item.id, buyerName);
    buyerInput.value = "";
  }

  if (target.classList.contains("confirm-btn")) {
    confirmHandoff(item.id);
  }

  if (target.classList.contains("release-btn")) {
    releaseClaim(item.id);
  }

  if (target.classList.contains("sold-btn")) {
    markAsSold(item.id);
  }

  if (target.classList.contains("remove-btn")) {
    forceRemove(item.id);
  }
});

async function claimItem(itemId, buyerName) {
  if (!buyerName) {
    setMessage("Enter buyer name before claiming.", true);
    return;
  }

  if (claimInFlight.has(itemId)) {
    setMessage("Another claim is being processed. Try again.", true);
    return;
  }

  claimInFlight.add(itemId);

  // Simulate network/processing delay while preserving atomicity.
  await delay(300 + Math.random() * 400);

  try {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) {
      setMessage("Item not found.", true);
      return;
    }

    if (item.state !== State.AVAILABLE) {
      setMessage(`"${item.title}" is no longer available.`, true);
      return;
    }

    item.state = State.CLAIMED;
    item.claimedBy = buyerName;
    item.claimedAt = Date.now();
    item.claimExpiresAt = Date.now() + CLAIM_WINDOW_MS;
    saveItems();
    setMessage(`Claim succeeded for "${item.title}" by ${buyerName}.`);
  } finally {
    claimInFlight.delete(itemId);
    render();
  }
}

function confirmHandoff(itemId) {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item || item.state !== State.CLAIMED) return;
  item.state = State.SOLD;
  item.claimedAt = null;
  item.claimExpiresAt = null;
  saveItems();
  setMessage(`Handoff confirmed for "${item.title}".`);
  render();
}

function releaseClaim(itemId) {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item || item.state !== State.CLAIMED) return;
  clearClaim(item);
  saveItems();
  setMessage(`Claim released for "${item.title}".`);
  render();
}

function markAsSold(itemId) {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return;
  item.state = State.SOLD;
  item.claimedBy = null;
  item.claimedAt = null;
  item.claimExpiresAt = null;
  saveItems();
  setMessage(`Seller marked "${item.title}" as sold.`);
  render();
}

function forceRemove(itemId) {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return;
  item.state = State.REMOVED;
  item.claimedBy = null;
  item.claimedAt = null;
  item.claimExpiresAt = null;
  saveItems();
  setMessage(`Seller removed "${item.title}" from listings.`);
  render();
}

function processClaimExpirations() {
  const now = Date.now();
  let changed = false;

  items.forEach((item) => {
    if (
      item.state === State.CLAIMED &&
      typeof item.claimExpiresAt === "number" &&
      item.claimExpiresAt <= now
    ) {
      clearClaim(item);
      changed = true;
      setMessage(`Claim expired: "${item.title}" is available again.`, true);
    }
  });

  if (changed) {
    saveItems();
  }
  render();
}

function clearClaim(item) {
  item.state = State.AVAILABLE;
  item.claimedBy = null;
  item.claimedAt = null;
  item.claimExpiresAt = null;
}

function render() {
  itemsContainer.innerHTML = "";
  if (items.length === 0) {
    itemsContainer.innerHTML = "<p>No listings yet. Create one above.</p>";
    return;
  }

  items.forEach((item) => {
    const node = itemTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.itemId = item.id;

    const titleEl = node.querySelector(".item-title");
    const statusEl = node.querySelector(".status");
    const metaEl = node.querySelector(".meta");
    const notesEl = node.querySelector(".notes");
    const claimInfoEl = node.querySelector(".claim-info");
    const claimBtn = node.querySelector(".claim-btn");
    const buyerInput = node.querySelector(".buyer-input");
    const actionsEl = node.querySelector(".actions");

    titleEl.textContent = item.title;
    statusEl.textContent = item.state.toUpperCase();
    statusEl.classList.add(item.state);
    metaEl.textContent = `${item.category} | Seller: ${item.sellerName} | Pickup: ${item.location}`;
    notesEl.textContent = item.notes || "No notes.";

    if (item.state === State.CLAIMED && item.claimExpiresAt) {
      const remaining = Math.max(0, Math.ceil((item.claimExpiresAt - Date.now()) / 1000));
      claimInfoEl.textContent = `Claimed by ${item.claimedBy}. ${remaining}s left to confirm handoff.`;
    } else {
      claimInfoEl.textContent = "";
    }

    const isClaimable = item.state === State.AVAILABLE;
    claimBtn.disabled = !isClaimable || claimInFlight.has(item.id);
    buyerInput.disabled = !isClaimable || claimInFlight.has(item.id);

    if (item.state === State.CLAIMED) {
      const confirmBtn = actionButton("Confirm Handoff", "confirm-btn");
      const releaseBtn = actionButton("Release Claim", "release-btn");
      actionsEl.append(confirmBtn, releaseBtn);
    }

    if (item.state === State.AVAILABLE || item.state === State.CLAIMED) {
      const soldBtn = actionButton("Mark as Sold", "sold-btn");
      const removeBtn = actionButton("Force Remove", "remove-btn");
      actionsEl.append(soldBtn, removeBtn);
    }

    itemsContainer.appendChild(node);
  });
}

function actionButton(label, className) {
  const button = document.createElement("button");
  button.textContent = label;
  button.className = className;
  button.type = "button";
  return button;
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function normalize(value) {
  return String(value ?? "").trim();
}

function setMessage(text, isWarning = false) {
  messageEl.textContent = text;
  messageEl.style.color = isWarning ? "#b91c1c" : "#0f766e";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
