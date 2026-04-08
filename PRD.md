# Dorm Marketplace PRD (Day 1 MVP)

## 1. Scope Cut

1. **In-app payments** - Payment workflows add major legal, security, and dispute complexity that is unnecessary for a handoff-based MVP.
2. **Live chat between buyer and seller** - Real-time messaging requires additional infrastructure and moderation concerns that are beyond Day 1 scope.
3. **Advanced search and filters** - Rich search is useful but not required to validate the core list-and-claim marketplace loop.

## 2. MVP Features

1. **Create listing** - A student can post an item with title, category, pickup location, and optional notes.
2. **Browse available listings** - Students can view active listings and each item’s real-time state (available, claimed, sold, removed).
3. **Claim and resolve listing state** - A student can claim an available item, confirm handoff, or let the claim expire back to available.

## 3. Acceptance Criteria (Claim Item Flow)

1. **Given** an item is marked Available, **when** one student successfully claims it, **then** the item state changes to Claimed and no other student can claim it.
2. **Given** an item is in Claimed state with an active pickup timer, **when** the timer expires without handoff confirmation, **then** the claim is canceled and the item returns to Available.
3. **Given** an item is Claimed, **when** another student attempts to claim it, **then** the action is rejected and the UI shows that the item is no longer available.
