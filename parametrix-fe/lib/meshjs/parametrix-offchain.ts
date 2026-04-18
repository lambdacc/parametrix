import {
    deserializeAddress,
    KoiosProvider,
    mAssetClass,
    mConStr0, mConStr1,
    MeshTxBuilder,
    mPubKeyAddress,
    pubKeyAddress,
    resolvePaymentKeyHash,
    resolveScriptHash,
    scriptHash,
    serializeAddressObj, SLOT_CONFIG_NETWORK,
    serializePlutusScript,
    stringToHex, unixTimeToEnclosingSlot,
    UTxO, BlockfrostProvider,applyParamsToScript,deserializeDatum
} from "@meshsdk/core";

import {builtinByteString, hexToString} from "@meshsdk/common";
import {assetClass} from "@meshsdk/common";

import blueprint from "../plutus.json" with {type: "json"};
import {C3_CONFIG, getC3OracleData} from "../oracle/charli3Oracle";
import {getWalletInfoForTx} from "@/lib/meshjs/wallet-util";
import {blockchainProvider, getTxBuilder} from "@/lib/common";

const NETWORK = 'preprod';
const NETWORK_ID = 0;
const MICRO_UNITS = 1000000
const FEE_ADDRESS = "addr_test1qrxyezc0h7pzg3uv83v30ttmec4navpw8u5q5ft3w72ysvae7m8kn49reh566kzdzjtt0rwxfdj39gvm54z5z7tn4lrsqneynj"
const COVERAGE = 100 * MICRO_UNITS;
const PREMIUM_BPS = 500;

function getScriptAddress(compiled: string): string {
    const {address} = serializePlutusScript(
        {code: compiled, version: "V3"},
        undefined,
        NETWORK_ID
    );
    return address;
}

function getValidator(name: string) {
    const v = blueprint.validators.find(v =>
        v.title.startsWith(name)
    );
    if (!v) {
        throw new Error(`Validator not found: ${name}`);
    }
    return v.compiledCode;
}

type Asset = {
    policyId: string;
    assetNameHex: string;
    unit: string;
};

export const assetMap: Record<string, Asset> = {
    ADA: {
        policyId: "",
        assetNameHex: "",
        unit: "lovelace",
    },

    DJED: {
        policyId: "c3a654d54ddc60c669665a8fc415ba67402c63b58fe65c821d63ba07",
        assetNameHex: "446a65644d6963726f555344",// ("DjedMicroUSD"),
        unit: "c3a654d54ddc60c669665a8fc415ba67402c63b58fe65c821d63ba07446a65644d6963726f555344",
    },

    USDM: {
        policyId: "a1b2c3d4e5f6...", // TODO replace
        assetNameHex: stringToHex("USDM"),
        unit: "xxx",

    },
};

function buildPubKeyAddress(feeAddrBech32: string) {
    return pubKeyAddress(deserializeAddress(feeAddrBech32).pubKeyHash, deserializeAddress(feeAddrBech32).stakeCredentialHash);
}

function buildMPubKeyAddress(bech32Address: string) {
    return mPubKeyAddress(deserializeAddress(bech32Address).pubKeyHash, deserializeAddress(bech32Address).stakeCredentialHash)
}

function loadScripts(asset: any, feeAddrBech32: string, poolId: string) {
    const registryCompiled = getValidator("registry.");

    const paymentAsset = assetClass(
        asset.policyId,
        asset.assetNameHex
    );

    const feeAddr = buildPubKeyAddress(feeAddrBech32);

    const registryScript = applyParamsToScript(
        registryCompiled,
        [
            feeAddr,        // v_fee_addr
            paymentAsset,   // v_payment_asset
        ],
        "JSON"
    );

    let registryPolicyId = resolveScriptHash(registryScript, 'V3');


    // ---------------- PARAMETRIX (pool validator) ----------------
    const poolCompiled = getValidator("parametrix.");
    const poolIdHex = stringToHex(poolId)

    const poolScript = applyParamsToScript(
        poolCompiled,
        [
            scriptHash(registryPolicyId),          // reg_policy_id
            scriptHash(C3_CONFIG.policyId),    // oracle_policy_id
            builtinByteString(poolIdHex),                 // v_pool_id
        ],
        "JSON"
    );

    return {
        registry: {
            script: registryScript,
            address: getScriptAddress(registryScript),
            policyId: registryPolicyId
        },

        pool: {
            script: poolScript,
            address: getScriptAddress(poolScript),
            policyId: resolveScriptHash(poolScript, 'V3')
        },
    };
}

// --------------------------------------------------
// DATUM (STRICT ORDER)
// --------------------------------------------------
function buildPoolDatum(
    poolId: string,
    asset: any,
    hedgerAddr: string,
    eventType: string,
    threshold: number,
    coverage: number,
    premiumBps: number,
    feeAddr: string
) {
    // --- Time configuration (hackathon presets) ---
    const now = Date.now();

    const startTime = now;                          // pool opens immediately
    const endTime = now + 24 * 60 * 60 * 1000;      // subscriptions close in 24h
    const eventTime = endTime + 5 * 60 * 1000;      // oracle evaluation shortly after
    const settlementTime = now;                     // simplified (for demo)

    return mConStr0([
        poolId,                                       // unique pool identifier

        mAssetClass(asset.policyId, asset.assetNameHex), // asset used (DJED)

        buildMPubKeyAddress(hedgerAddr),              // hedger (protection buyer)

        eventType,                                    // oracle event type (rainfall / flight)

        threshold,                                    // value required to trigger payout

        coverage,                                     // payout amount to hedger if event occurs

        premiumBps,                                   // premium rate (in basis points)

        startTime,                                    // subscription start
        endTime,                                      // subscription end

        eventTime,                                    // oracle check time
        settlementTime,                               // settlement execution time

        buildMPubKeyAddress(feeAddr),                 // protocol / fee address

        premiumBps,                                   // ⚠️ duplicate field (confirm purpose: fee or reuse)
    ]);
}

function buildContributionDatum(ownerAddr: string, amount: number, amount_type: string) {
    const contributionDatum = mConStr0([
        buildMPubKeyAddress(ownerAddr),
        amount,
        amount_type,
    ]);

    return mConStr0([
        [contributionDatum]
    ]);
}


// --------------------------------------------------
// CREATE POOL (MINT)
// --------------------------------------------------

export async function createPool(
    wallet: any,
    paymentAssetCode: string,
    eventType: string,
    coverage: number,
    premiumBps: number,
    threshold: number,
    feeAddress: string = FEE_ADDRESS
) {
    console.log("createPool params:", {
        paymentAssetCode,
        eventType,
        coverage,
        premiumBps,
        threshold,
        feeAddress,
    });
    const {collateral, walletAddress} = await getWalletInfoForTx(wallet);
    console.log("walletAddress", walletAddress)
    const hedgerPkh = resolvePaymentKeyHash(walletAddress);
    const poolId = `${hedgerPkh.slice(0, 3)}-${Date.now()}`;


    const provider = blockchainProvider;
    const utxos = await provider.fetchAddressUTxOs(walletAddress);
    if (!utxos.length) throw new Error('No wallet UTxOs');

    // @ts-ignore
    const asset = assetMap[paymentAssetCode];
    if (!asset) throw new Error("Unsupported asset");

    const {registry, pool} = loadScripts(asset, feeAddress, poolId);

    const coverageAmount = coverage * MICRO_UNITS; // human → onchain

    // ---------------- DATUM ----------------
    const datum = buildPoolDatum(
        poolId,
        asset,
        walletAddress,
        eventType,
        threshold,
        coverageAmount,
        premiumBps,
        feeAddress
    );

    const premium_micro_units = (coverageAmount * premiumBps) / 10_000;

    const tx = getTxBuilder()

    try {
        await tx
            .mintPlutusScriptV3()
            .mint("1", registry.policyId, stringToHex(poolId))
            .mintingScript(registry.script)
            .mintRedeemerValue(stringToHex(poolId))

        // ---------------- POOL UTXO ----------------
        .txOut(pool.address, [
            {
                unit: registry.policyId + stringToHex(poolId),
                quantity: "1",
            },
        ])
            .txOutInlineDatumValue(datum)

        // ---------------- Premium UTXO ----------------
        .txOut(pool.address, [
            {
                unit: asset.unit,
                quantity: premium_micro_units.toString(),
            },
        ])
            .txOutInlineDatumValue(buildContributionDatum(walletAddress, premium_micro_units, "PREMIUM"))

            .requiredSignerHash(hedgerPkh)

        .txInCollateral(
            collateral!.input.txHash,
            collateral!.input.outputIndex,
            collateral!.output.amount,
            collateral!.output.address
        )

            .changeAddress(walletAddress)
            .selectUtxosFrom(utxos)
            .complete();
    } catch (e) {
        console.error(e)
    }

    return {
        unsignedTx: tx.txHex,
        poolId,

        // for reference
        poolAddress: pool.address,
        paymentAssetCode,
        feeAddress,

        // script / NFT identity
        registryPolicyId: registry.policyId,
        tokenNameHex: stringToHex(poolId),

        // useful context
        hedgerAddress: walletAddress,
        coverage,
        premiumBps,
        threshold,
    };
}


export interface PoolDatumObject {
    pool_id: string;                 // hex (ByteArray)
    payment_asset: any;              // AssetClass (keep raw or type if you have one)
    hedger: string;                 // bech32

    event_type: string;             // decoded string
    event_threshold: number;

    coverage_target: number;
    premium_bps: number;

    subscription_start: number;
    subscription_end: number;

    event_time: number;
    settlement_time: number;

    fee_addr: string;               // bech32

    fee_bps: number;
}


function parsePoolDatumFromUtxo(utxo: UTxO): PoolDatumObject {
    const datum = deserializeDatum(utxo.output.plutusData!)

    console.dir(datum, {depth: null});
    return {
        pool_id: datum.fields[0].bytes,
        payment_asset: datum.fields[1],
        hedger: serializeAddressObj(datum.fields[2]),

        event_type: hexToString(datum.fields[3].bytes),
        event_threshold: Number(datum.fields[4].int),

        coverage_target: Number(datum.fields[5].int),
        premium_bps: Number(datum.fields[6].int),

        subscription_start: Number(datum.fields[7].int),
        subscription_end: Number(datum.fields[8].int),

        event_time: Number(datum.fields[9].int),
        settlement_time: Number(datum.fields[10].int),

        fee_addr: serializeAddressObj(datum.fields[11]),

        fee_bps: Number(datum.fields[12].int),
    };
}

export function calculatePoolValidityLimit(subscriptionEnd: number) {
    const now = Date.now();

    if (now > subscriptionEnd) {
        throw new Error("Subscription ended");
    }

    const twelveHoursFromNow = now + 12 * 60 * 60 * 1000;
    const endWithBuffer = subscriptionEnd + 2 * 60 * 60 * 1000;

    const minTimestamp = Math.min(
        twelveHoursFromNow,
        endWithBuffer
    );

    return unixTimeToEnclosingSlot(
        minTimestamp,
        SLOT_CONFIG_NETWORK.preprod
    );
}

export async function subscribe(
    wallet: any, // ✅ changed
    poolId: string,
    amount: number,
    paymentAssetCode: string,
    feeAddress: string = FEE_ADDRESS
) {
    console.log("subscribe() inputs:", {
        hasWallet: !!wallet,
        walletKeys: wallet ? Object.keys(wallet) : null,
        poolId,
        amount,
        paymentAssetCode,
        feeAddress,
    });
    // const wallet = loadWallet(walletFile);
    const { collateral, walletAddress: subscriberAddr } = await getWalletInfoForTx(wallet); // ✅ changed
    const subscriberPkh = resolvePaymentKeyHash(subscriberAddr);

    const provider = blockchainProvider;
    const subscriberUtxos = await provider.fetchAddressUTxOs(subscriberAddr);
    if (!subscriberUtxos.length) throw new Error("No wallet UTxOs");

    const asset = assetMap[paymentAssetCode];
    if (!asset) throw new Error("Unsupported asset");

    const {registry, pool} = loadScripts(asset, feeAddress, poolId);
    console.log("---- SCRIPT DERIVATION ----");
    console.log("poolId:", poolId);
    console.log("feeAddress:", feeAddress);
    console.log("registry.policyId:", registry.policyId);
    console.log("pool.address:", pool.address);

    // ---------------- FIND REGISTRY REF INPUT ----------------
    const poolUtxos = await provider.fetchAddressUTxOs(pool.address);
    console.log("---- POOL UTXOS ----");
    console.log("poolUtxo count:", poolUtxos.length);

    const nftUnit = registry.policyId + stringToHex(poolId);
    // console.log("---- NFT EXPECTATION ----");
    // console.log("tokenNameHex:", stringToHex(poolId));
    // console.log("expected nftUnit:", nftUnit);

    const refUtxo = poolUtxos.find((u: any) =>
        u.output.amount.some((a: any) => a.unit === nftUnit)
    );

    if (!refUtxo) throw new Error("Registry ref UTxO not found");

    const poolDatum = parsePoolDatumFromUtxo(refUtxo);

    //console.log("Parsed Pool Datum:", poolDatum);

    const poolAddr = refUtxo.output.address;

    // ---------------- CALCULATIONS ----------------
    const deposited = amount * MICRO_UNITS;
    const subscribed_units = amount

    if (subscribed_units <= 0) {
        throw new Error("Deposit too small for subscription unit");
    }

    const invalidHereafter = calculatePoolValidityLimit(
        poolDatum.subscription_end
    );

    // ---------------- TX ----------------
    // const collateral = (await wallet.getCollateral())[0];

    const tx = new MeshTxBuilder({
        fetcher: provider,
        submitter: provider,
        evaluator: provider
    }).setNetwork(NETWORK);

    await tx
        .mintPlutusScriptV3()
        .mint(
            subscribed_units.toString(),
            pool.policyId,
            stringToHex("sPMX")
        )
        .mintingScript(pool.script)
        .mintRedeemerValue(mConStr0([]))

        .txOut(poolAddr, [
            {
                unit: asset.unit,
                quantity: deposited.toString(),
            },
        ])
        .txOutInlineDatumValue(
            buildContributionDatum(
                subscriberAddr,
                deposited,
                "SUBSCRIPTION"
            )
        )
        .invalidHereafter(invalidHereafter)
        .readOnlyTxInReference(
            refUtxo.input.txHash,
            refUtxo.input.outputIndex
        )

        .requiredSignerHash(subscriberPkh)

        .txInCollateral(
            collateral.input.txHash,
            collateral.input.outputIndex,
            collateral.output.amount,
            collateral.output.address
        )

        .changeAddress(subscriberAddr)
        .selectUtxosFrom(subscriberUtxos)
        .complete();

    console.log("Tx built")
    return { unsignedTx: tx.txHex }; // ✅ changed
}