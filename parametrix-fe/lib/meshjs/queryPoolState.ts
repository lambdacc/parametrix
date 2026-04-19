import { blockchainProvider } from "@/lib/common";
import { loadScripts, assetMap } from "./parametrix-offchain";
import { parseContributionDatumFromUtxo } from "./parametrix-offchain";
import { stringToHex } from "@meshsdk/core";
import { FEE_ADDRESS } from "./parametrix-offchain";
export async function queryPoolState(
    poolId: string,
    paymentAssetCode: string,
    feeAddress: string = FEE_ADDRESS
) {
    const asset = assetMap[paymentAssetCode];
    if (!asset) throw new Error("Unsupported asset");

    const { pool } = loadScripts(asset, feeAddress, poolId);

    const utxos = await blockchainProvider.fetchAddressUTxOs(pool.address);

    if (!utxos.length) {
        return {
            poolId,
            premium: 0,
            totalContributions: 0,
            contributorCount: 0,
            contributions: [],
        };
    }

    const parsed = utxos
        .map(parseContributionDatumFromUtxo)
        .filter((x): x is any => x !== null);

    let premium = 0;
    let totalContributions = 0;
    const contributors = new Map<string, number>();

    for (const p of parsed) {
        for (const c of p.contributions) {
            if (c.amount_type === "PREMIUM") {
                premium += c.amount;
            }

            if (c.amount_type === "SUBSCRIPTION") {
                totalContributions += c.amount;

                contributors.set(
                    c.owner,
                    (contributors.get(c.owner) || 0) + c.amount
                );
            }
        }
    }

    return {
        poolId,

        // raw values (on-chain units)
        premium,
        totalContributions,

        // derived
        contributorCount: contributors.size,

        // useful for UI drilldown
        contributions: Array.from(contributors.entries()).map(
            ([owner, amount]) => ({
                owner,
                amount,
            })
        ),
    };
}