# Parametrix — Aiken Module

Parametrix is an on-chain implementation of **oracle-driven parametric risk pools** on Cardano.

It models real-world risk hedging using oracle price feeds as a proxy for external signals such as:

* rainfall
* temperature
* flight delays
* other measurable events

---

## Core Idea

* **Hedger** prepays premium
* **Subscribers** provide coverage liquidity
* **Oracle** determines event outcome
* **Contract settles deterministically on-chain**

---

## Pool Model (`PoolDatum`)

* `payment_asset` — settlement asset
* `coverage_target` — total coverage
* `premium_bps` — premium rate
* `event_type` — semantic trigger type
* `event_threshold` — trigger condition
* time bounds — subscription + settlement

---

## Flow

### 1. Pool Creation

* Hedger initializes pool
* Premium deposited upfront
* Pool NFT minted (registry)

### 2. Subscription

* Users deposit liquidity
* Receive proportional units
* Enforced time window

### 3. Settlement (Oracle-driven)

```
event_occured = price > event_threshold
```

* **Event occurs** → Hedger gets coverage, subscribers get premium
* **No event** → Subscribers get principal + premium

---

## Oracle Integration

* Oracle datum consumed via **reference input**
* Policy ID fixed (trusted source)
* Validity enforced (timestamp + expiry)
* Integer-based evaluation (no floats)

---

## Project Structure

```
validators/
  registry.ak
  parametrix.ak

lib/
  oracle_datum.ak
  utils.ak
  types.ak
```

---

## Build & Test

```sh
aiken build
```

```sh
aiken check
```

---

## Design Highlights

* Oracle-driven, real-world aligned logic
* Deterministic settlement (no ambiguity)
* Per-subscriber payout correctness
* Minimal state, composable design

---

## Summary

Parametrix is a reusable primitive for **parametric insurance and risk hedging**, demonstrating how real-world signals can be bridged into Cardano smart contracts via oracle feeds.
