import {BlockfrostProvider, MeshTxBuilder} from "@meshsdk/core";
import { FALLBACK_BLOCKFROST_KEY } from "./blockchainProvider";

const apiKey =
    process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY ||
    FALLBACK_BLOCKFROST_KEY;

export const blockchainProvider = new BlockfrostProvider(apiKey);

export function getTxBuilder() {
    return new MeshTxBuilder({
        fetcher: blockchainProvider,
        submitter: blockchainProvider,
        evaluator: blockchainProvider,
        verbose: true

    }).setNetwork("preprod");
}

export async function getAddressUtxos({
                                          scriptAddress,
                                          asset,
                                      }: {
    scriptAddress: string;
    asset: string;
}) {
    //const blockchainProvider = getProvider();
    const utxos = await blockchainProvider.fetchAddressUTxOs(
        scriptAddress,
        asset,
    );

    return utxos;
}
