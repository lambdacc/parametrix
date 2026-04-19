### Parametrix — Offchain CLI Module

#### Overview

* Offchain execution layer for **Parametrix pools**
* Handles:

    * Pool creation (mint + initialize state)
    * Subscription (liquidity provision)
    * Settlement (oracle-triggered payouts)
* Uses:

    * Mesh SDK for tx building
    * Aiken validators (from `plutus.json`)
    * Charli3 oracle as proxy for real-world signals (rainfall, flight delay, etc.)
* Pattern:

    * Script UTxO = pool state + contributions
    * Oracle UTxO = external event input
    * Offchain = orchestration only

---

#### Core Flows

* **create**

    * Mints pool NFT (registry)
    * Initializes pool datum
    * Locks premium into script

* **subscribe**

    * Adds liquidity
    * Mints position token (`sPMX`)
    * Attaches contribution datum

* **settle**

    * Reads oracle data
    * Evaluates event condition
    * Distributes payouts:

        * Event → hedger gets principal
        * No event → LPs get principal + premium

---

#### Prerequisites

* Deno installed
* Wallet mnemonic file (JSON array)
* Preprod network access (Koios)
* Funded wallet (ADA + asset like DJED)

---

#### Run

```bash
deno run -A parametrix.ts <command> ...
```

---

#### Commands

* **Create Pool**

```bash
deno run -A parametrix.ts create <wallet.json> DJED RAINFALL_EXCEEDED
deno run -A parametrix.ts create <wallet.json> DJED FLIGHT_DELAY
```

* **Subscribe to Pool**

```bash
deno run -A parametrix.ts subscribe <wallet.json> <poolId> <amount> DJED
```

* **Settle Pool**

```bash
deno run -A parametrix.ts settle <wallet.json> <poolId> DJED
```

---

#### Key Config (inline)

* `COVERAGE = 100`
* `PREMIUM_BPS = 500`
* `NETWORK = preprod`
* Asset map supports: `ADA`, `DJED` (extensible)

---

#### Notes

* Oracle feed is treated as **generic event signal**

    * Price → rainfall / delay / arbitrary metric
* Datum structure is strict → order-sensitive
* Subscription validity enforced via slot conversion
* Designed for:

    * Hackathon demo
    * Clear validator correctness (not abstraction-heavy)

---

#### File Reference

* Source implementation: 
