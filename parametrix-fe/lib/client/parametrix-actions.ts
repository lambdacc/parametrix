"use client";

import {createPool, subscribe} from "@/lib/meshjs/parametrix-offchain";

export async function createPoolContract(
    wallet: any,
    params: {
        eventType: string;
        paymentAssetCode: string;
        coverage: number;
        premiumBps: number;
        threshold: number;
        feeAddress?: string;
    }
) {
    const {unsignedTx, poolId} = await createPool(
        wallet,
        params.paymentAssetCode,
        params.eventType,
        params.coverage,
        params.premiumBps,
        params.threshold,
    );

    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    console.log("txHash:",txHash)
    return {txHash, poolId};
}

export async function subscribeContract(
    wallet: any,
    params: {
        poolId: string;
        amount: number;
        paymentAssetCode: string;
        feeAddress?: string;
    }
) {
    const  unsignedTx  = await subscribe(
        wallet,
        params.poolId,
        params.amount,
        params.paymentAssetCode,
        params.feeAddress
    );

    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    console.log("txHash:", txHash);

    return { txHash };
}