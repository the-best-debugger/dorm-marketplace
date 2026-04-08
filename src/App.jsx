import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  CLAIM_WINDOW_MS,
  delay,
  loadItems,
  normalize,
  persistItems,
  State,
} from "./marketplace.js";

function createItem(payload) {
  return {
    id: crypto.randomUUID(),
    title: payload.title,
    sellerName: payload.sellerName,
    category: payload.category,
    location: payload.location,
    notes: payload.notes,
    state: State.AVAILABLE,
    claimedBy: null,
    claimedAt: null,
    claimExpiresAt: null,
  };
}

export default function App() {
  const [items, setItems] = useState(loadItems);
  const [message, setMessageState] = useState({ text: "", warning: false });
  const [buyerDrafts, setBuyerDrafts] = useState({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  const claimInFlight = useRef(new Set());
  const [, bumpClaimUi] = useReducer((x) => x + 1, 0);

  const setMessage = useCallback((text, warning = false) => {
    setMessageState({ text, warning });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const time = Date.now();
    let expiredTitle = null;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (
          item.state === State.CLAIMED &&
          typeof item.claimExpiresAt === "number" &&
          item.claimExpiresAt <= time
        ) {
          changed = true;
          if (!expiredTitle) expiredTitle = item.title;
          return {
            ...item,
            state: State.AVAILABLE,
            claimedBy: null,
            claimedAt: null,
            claimExpiresAt: null,
          };
        }
        return item;
      });
      if (!changed) return prev;
      persistItems(next);
      return next;
    });
    if (expiredTitle) {
      setMessage(`Claim expired: "${expiredTitle}" is available again.`, true);
    }
  }, [nowTick, setMessage]);

  const handleSubmitListing = (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const title = normalize(fd.get("title"));
    const sellerName = normalize(fd.get("sellerName"));
    const category = normalize(fd.get("category"));
    const location = normalize(fd.get("location"));
    const notes = normalize(fd.get("notes"));

    if (!title || !sellerName || !category || !location) {
      setMessage("Please fill all required fields.", true);
      return;
    }

    const item = createItem({ title, sellerName, category, location, notes });
    setItems((prev) => {
      const next = [item, ...prev];
      persistItems(next);
      return next;
    });
    form.reset();
    setMessage(`Listing added: ${item.title}`);
  };

  const seedSample = () => {
    if (items.length > 0) {
      setMessage("Sample data skipped because listings already exist.", true);
      return;
    }
    const next = [
      createItem({
        title: "Calculus Textbook (Used)",
        sellerName: "Aarav",
        category: "Textbook",
        location: "Dorm A Lobby",
        notes: "Few highlights, good condition.",
      }),
      createItem({
        title: "Mini Fridge 90L",
        sellerName: "Mia",
        category: "Mini Fridge",
        location: "Dorm C Gate",
        notes: "Pickup after 6 PM.",
      }),
    ];
    persistItems(next);
    setItems(next);
    setMessage("Sample listings loaded.");
  };

  const claimItem = async (itemId, buyerName) => {
    const name = normalize(buyerName);
    if (!name) {
      setMessage("Enter buyer name before claiming.", true);
      return;
    }

    if (claimInFlight.current.has(itemId)) {
      setMessage("Another claim is being processed. Try again.", true);
      return;
    }

    claimInFlight.current.add(itemId);
    bumpClaimUi();

    await delay(300 + Math.random() * 400);

    let notFound = false;
    let unavailableTitle = null;
    let successTitle = null;

    setItems((prev) => {
      const item = prev.find((c) => c.id === itemId);
      if (!item) {
        notFound = true;
        return prev;
      }
      if (item.state !== State.AVAILABLE) {
        unavailableTitle = item.title;
        return prev;
      }
      successTitle = item.title;
      const next = prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              state: State.CLAIMED,
              claimedBy: name,
              claimedAt: Date.now(),
              claimExpiresAt: Date.now() + CLAIM_WINDOW_MS,
            }
          : i,
      );
      persistItems(next);
      return next;
    });

    claimInFlight.current.delete(itemId);
    bumpClaimUi();

    if (notFound) setMessage("Item not found.", true);
    else if (unavailableTitle)
      setMessage(`"${unavailableTitle}" is no longer available.`, true);
    else if (successTitle)
      setMessage(`Claim succeeded for "${successTitle}" by ${name}.`);
  };

  const confirmHandoff = (itemId) => {
    let title = null;
    setItems((prev) => {
      const item = prev.find((c) => c.id === itemId);
      if (!item || item.state !== State.CLAIMED) return prev;
      title = item.title;
      const next = prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              state: State.SOLD,
              claimedAt: null,
              claimExpiresAt: null,
            }
          : i,
      );
      persistItems(next);
      return next;
    });
    if (title) setMessage(`Handoff confirmed for "${title}".`);
  };

  const releaseClaim = (itemId) => {
    let title = null;
    setItems((prev) => {
      const item = prev.find((c) => c.id === itemId);
      if (!item || item.state !== State.CLAIMED) return prev;
      title = item.title;
      const next = prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              state: State.AVAILABLE,
              claimedBy: null,
              claimedAt: null,
              claimExpiresAt: null,
            }
          : i,
      );
      persistItems(next);
      return next;
    });
    if (title) setMessage(`Claim released for "${title}".`);
  };

  const markAsSold = (itemId) => {
    let title = null;
    setItems((prev) => {
      const item = prev.find((c) => c.id === itemId);
      if (!item) return prev;
      title = item.title;
      const next = prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              state: State.SOLD,
              claimedBy: null,
              claimedAt: null,
              claimExpiresAt: null,
            }
          : i,
      );
      persistItems(next);
      return next;
    });
    if (title) setMessage(`Seller marked "${title}" as sold.`);
  };

  const forceRemove = (itemId) => {
    let title = null;
    setItems((prev) => {
      const item = prev.find((c) => c.id === itemId);
      if (!item) return prev;
      title = item.title;
      const next = prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              state: State.REMOVED,
              claimedBy: null,
              claimedAt: null,
              claimExpiresAt: null,
            }
          : i,
      );
      persistItems(next);
      return next;
    });
    if (title) setMessage(`Seller removed "${title}" from listings.`);
  };

  const setBuyerDraft = (itemId, value) => {
    setBuyerDrafts((d) => ({ ...d, [itemId]: value }));
  };

  return (
    <main className="container">
      <header className="header">
        <h1>Dorm Marketplace</h1>
        <p>Claim used campus items for in-person handoff.</p>
      </header>

      <section className="panel">
        <h2>Create Listing</h2>
        <form className="form-grid" onSubmit={handleSubmitListing}>
          <label>
            Seller Name
            <input name="sellerName" required maxLength={40} />
          </label>
          <label>
            Item Title
            <input name="title" required maxLength={80} />
          </label>
          <label>
            Category
            <select name="category" required>
              <option value="Textbook">Textbook</option>
              <option value="Mini Fridge">Mini Fridge</option>
              <option value="Chair">Chair</option>
              <option value="Bike">Bike</option>
              <option value="Calculator">Calculator</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>
            Pickup Spot
            <input name="location" required maxLength={60} />
          </label>
          <label className="full-width">
            Notes (optional)
            <textarea name="notes" rows={2} maxLength={160} />
          </label>
          <button type="submit">Add Listing</button>
        </form>
      </section>

      <section className="panel">
        <div className="list-header">
          <h2>Marketplace Items</h2>
          <button type="button" className="secondary" onClick={seedSample}>
            Load Sample Data
          </button>
        </div>
        <p className="hint">
          Claim holds expire in <strong>20 seconds</strong> unless buyer confirms handoff.
        </p>
        <div
          className={`message${message.warning ? " warning" : ""}`}
          aria-live="polite"
        >
          {message.text}
        </div>
        <div className="items">
          {items.length === 0 ? (
            <p>No listings yet. Create one above.</p>
          ) : (
            items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                nowTick={nowTick}
                buyerDraft={buyerDrafts[item.id] ?? ""}
                onBuyerChange={(v) => setBuyerDraft(item.id, v)}
                claimBusy={claimInFlight.current.has(item.id)}
                onClaim={() => claimItem(item.id, buyerDrafts[item.id] ?? "")}
                onConfirmHandoff={() => confirmHandoff(item.id)}
                onRelease={() => releaseClaim(item.id)}
                onMarkSold={() => markAsSold(item.id)}
                onForceRemove={() => forceRemove(item.id)}
              />
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function ItemCard({
  item,
  nowTick,
  buyerDraft,
  onBuyerChange,
  claimBusy,
  onClaim,
  onConfirmHandoff,
  onRelease,
  onMarkSold,
  onForceRemove,
}) {
  const isClaimable = item.state === State.AVAILABLE;
  let claimInfo = "";
  if (
    item.state === State.CLAIMED &&
    typeof item.claimExpiresAt === "number"
  ) {
    const remaining = Math.max(
      0,
      Math.ceil((item.claimExpiresAt - nowTick) / 1000),
    );
    claimInfo = `Claimed by ${item.claimedBy}. ${remaining}s left to confirm handoff.`;
  }

  return (
    <article className="item-card">
      <div className="item-top">
        <h3 className="item-title">{item.title}</h3>
        <span className={`status ${item.state}`}>{item.state}</span>
      </div>
      <p className="meta">
        {item.category} | Seller: {item.sellerName} | Pickup: {item.location}
      </p>
      <p className="notes">{item.notes || "No notes."}</p>
      <div className="claim-row">
        <input
          className="buyer-input"
          placeholder="Buyer name"
          maxLength={40}
          value={buyerDraft}
          disabled={!isClaimable || claimBusy}
          onChange={(e) => onBuyerChange(e.target.value)}
        />
        <button
          type="button"
          className="claim-btn"
          disabled={!isClaimable || claimBusy}
          onClick={onClaim}
        >
          Claim Item
        </button>
      </div>
      {claimInfo ? <p className="claim-info">{claimInfo}</p> : null}
      <div className="actions">
        {item.state === State.CLAIMED ? (
          <>
            <button type="button" className="confirm-btn" onClick={onConfirmHandoff}>
              Confirm Handoff
            </button>
            <button type="button" className="release-btn" onClick={onRelease}>
              Release Claim
            </button>
          </>
        ) : null}
        {item.state === State.AVAILABLE || item.state === State.CLAIMED ? (
          <>
            <button type="button" className="sold-btn" onClick={onMarkSold}>
              Mark as Sold
            </button>
            <button type="button" className="remove-btn" onClick={onForceRemove}>
              Force Remove
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
