import {
    deserializeAddress,
    KoiosProvider,
    mAssetClass,
    mConStr0,
    MeshTxBuilder,
    MeshWallet,
    mPubKeyAddress,
    pubKeyAddress,
    resolvePaymentKeyHash,
    resolveScriptHash,
    scriptHash,
    serializeAddressObj,SLOT_CONFIG_NETWORK,
    serializePlutusScript,
    stringToHex,unixTimeToEnclosingSlot,
    UTxO
} from "@meshsdk/core";
import {applyParamsToScript, parseInlineDatum} from "@meshsdk/core-csl";
import {builtinByteString, hexToString} from "@meshsdk/common";

import {assetClass} from "@meshsdk/common";
import blueprint from "../aiken/parametrix/plutus.json" with {type: "json"};
import {C3_CONFIG} from "./oracle/charli3Oracle.ts";


// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const NETWORK = 'preprod';
const NETWORK_ID = 0;
const MICRO_UNITS = 1000000
const FEE_ADDRESS = "addr_test1qrxyezc0h7pzg3uv83v30ttmec4navpw8u5q5ft3w72ysvae7m8kn49reh566kzdzjtt0rwxfdj39gvm54z5z7tn4lrsqneynj"
const COVERAGE = 100 * MICRO_UNITS;
const PREMIUM_BPS = 500;


function getScriptAddress(compiled: string): string {
  const { address } = serializePlutusScript(
      { code: compiled, version: "V3" },
      undefined,
      NETWORK_ID
  );
  return address;
}

function loadWallet(walletFile: string): MeshWallet {
  const mnemonic = JSON.parse(Deno.readTextFileSync(walletFile));
  const provider = new KoiosProvider(NETWORK);

  return new MeshWallet({
    networkId: NETWORK_ID,
    fetcher: provider,
    submitter: provider,
    key: { type: 'mnemonic', words: mnemonic }
  });
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


export const assetMap: Record<
    string,
    { policyId: string; assetNameHex: string; unit: string }
> = {
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


// --------------------------------------------------
// FIXED REGISTRY LOADER
// --------------------------------------------------

function buildPubKeyAddress(feeAddrBech32: string) {
  return pubKeyAddress(deserializeAddress(feeAddrBech32).pubKeyHash, deserializeAddress(feeAddrBech32).stakeCredentialHash);
}
function buildMPubKeyAddress(bech32Address: string) {
  return mPubKeyAddress(deserializeAddress(bech32Address).pubKeyHash, deserializeAddress(bech32Address).stakeCredentialHash)
}

function loadScripts(
    asset: { policyId: string; assetNameHex: string },
    feeAddrBech32: string
) {
  // ---------------- REGISTRY (mint policy) ----------------
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

    const poolIdHex = stringToHex("TEMP_POOL_ID"); // ⚠️ must match real poolId

    const poolScript = applyParamsToScript(
        poolCompiled,
        [
            scriptHash(registryPolicyId),          // reg_policy_id
            scriptHash(C3_CONFIG.policyId),    // oracle_policy_id
            builtinByteString(poolIdHex),                 // v_pool_id
        ],
        "JSON"
    );

    const poolAddress = getScriptAddress(poolScript);
    return {
    registry: {
      script: registryScript,
      address: getScriptAddress(registryScript),
      policyId:registryPolicyId
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
    asset: { policyId: string; assetNameHex: string },
    hedgerAddr: string,
    feeAddr: string,
) {

  return mConStr0([
    poolId,                              // pool_id (ByteArray)
    mAssetClass(asset.policyId, asset.assetNameHex), // payment_asset
    buildMPubKeyAddress(hedgerAddr),           // hedger

    "RAINFALL_EXCEEDED",                 // event_type
    100,                                 // event_threshold
    COVERAGE,                  // coverage_target
    500,                                 // premium_bps

    Date.now(),                          // subscription_start
    Date.now() + 60*60*24*1000,                 // subscription_end
    Date.now() + 100,                // event_time -FOR TESTING
    Date.now() + 100,                // settlement_time - FOR TESTING

    buildMPubKeyAddress(feeAddr),              // fee_addr
    500,                                 // fee__bps
  ]);
}

function buildContributionDatum(
    ownerAddr: string,
    amount: number,
    amount_type: string
) {
  return mConStr0([
    buildMPubKeyAddress(ownerAddr),   // owner
    amount,                     // amount
    amount_type,           // amount_type (ByteArray)
  ]);
}


// --------------------------------------------------
// CREATE POOL (MINT)
// --------------------------------------------------

export async function createPool(
    walletFile: string,
    paymentAssetCode: string,
    feeAddress: string = FEE_ADDRESS
) {


  const wallet = loadWallet(walletFile);
  const changeAddress = await wallet.getChangeAddress();
  const hedgerPkh = resolvePaymentKeyHash(changeAddress);
  const poolId = `${hedgerPkh.slice(0, 3)}-${Date.now()}`; //fine for demo


  const provider = new KoiosProvider(NETWORK);
  const utxos = await provider.fetchAddressUTxOs(changeAddress);
  if (!utxos.length) throw new Error('No wallet UTxOs');

  console.dir(utxos, { depth: null });
  const asset = assetMap[paymentAssetCode];
  if (!asset) throw new Error("Unsupported asset");

  const { registry, pool } = loadScripts(asset, feeAddress);
  const collateral = (await wallet.getCollateral())[0];

  // ---------------- DATUM ----------------
  const datum = buildPoolDatum(
    poolId,
    asset,
    changeAddress,
    feeAddress,
  );

  // ---------------- PREMIUM ----------------

  const premium_micro_units =
      (COVERAGE * PREMIUM_BPS) / 10_000;

  console.log("premium:", premium_micro_units)

  // ---------------- TX ----------------
  const tx = new MeshTxBuilder({}).setNetwork(NETWORK);

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
      .txOutInlineDatumValue(
          buildContributionDatum(
              changeAddress,
              premium_micro_units,
              "PREMIUM"
          ))

      .requiredSignerHash(hedgerPkh)

      .txInCollateral(
          collateral.input.txHash,
          collateral.input.outputIndex,
          collateral.output.amount,
          collateral.output.address
      )

      .changeAddress(changeAddress)
      .selectUtxosFrom(utxos)
      .complete();

  const signed = await wallet.signTx(tx.txHex, true);
  const txHash = await wallet.submitTx(signed);

  console.log("\n=== POOL CREATED ===");

  console.log("Tx Hash:", txHash);
  console.log("Pool ID:", poolId);

  console.log("Pool Address:", pool.address);
  console.log("Payment Asset:", paymentAssetCode);

  console.log("Coverage:", COVERAGE);
  console.log("Premium (bps):", PREMIUM_BPS);
  console.log("Premium Amount:", premium_micro_units);

  console.log("====================\n");
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
    const datum = parseInlineDatum<any, any>({
        inline_datum: utxo.output.plutusData!,
    });
    console.dir(datum, { depth: null });
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
    walletFile: string,
    poolId: string,
    amount: number,
    paymentAssetCode: string,
    feeAddress: string = FEE_ADDRESS
) {
  const wallet = loadWallet(walletFile);
  const subscriberAddr = await wallet.getChangeAddress();
  const subscriberPkh = resolvePaymentKeyHash(subscriberAddr);

  const provider = new KoiosProvider(NETWORK);
  const subscriberUtxos = await provider.fetchAddressUTxOs(subscriberAddr);
  if (!subscriberUtxos.length) throw new Error("No wallet UTxOs");

  const asset = assetMap[paymentAssetCode];
  if (!asset) throw new Error("Unsupported asset");

  const { registry, pool } = loadScripts(asset, feeAddress);

  // ---------------- FIND REGISTRY REF INPUT ----------------
  const poolUtxo =  await provider.fetchAddressUTxOs(pool.address);

  const nftUnit = registry.policyId + stringToHex(poolId);

  const refUtxo = poolUtxo.find((u: any) =>
      u.output.amount.some((a: any) => a.unit === nftUnit)
  );

  if (!refUtxo) throw new Error("Registry ref UTxO not found");

    const poolDatum = parsePoolDatumFromUtxo(refUtxo);

    console.log("Parsed Pool Datum:", poolDatum);



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
  const collateral = (await wallet.getCollateral())[0];

  const tx = new MeshTxBuilder({}).setNetwork(NETWORK);

  await tx
      // -------- mint (parametrix policy, NOT registry) --------
      .mintPlutusScriptV3()
      .mint(
          subscribed_units.toString(),
          pool.policyId,
          stringToHex("sPMX")
      )
      .mintingScript(pool.script)
      .mintRedeemerValue(mConStr0([]))

      // -------- pool output --------
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

  const signed = await wallet.signTx(tx.txHex, true);
  const txHash = await wallet.submitTx(signed);

  console.log("\n=== SUBSCRIBED ===");
  console.log("Tx Hash:", txHash);
  console.log("Pool ID:", poolId);
  console.log("Deposited:", deposited);
  console.log("Minted sPMX:", subscribed_units);
  console.log("==================\n");
}

// --------------------------------------------------
// CLI
// --------------------------------------------------

if (import.meta.main) {
  const [cmd, wallet, arg1, arg2, arg3] = Deno.args;

  const run = async () => {
    switch (cmd) {
      case "create":
        // arg1 = asset
        await createPool(wallet, arg1);
        break;

      case "subscribe":
        // arg1 = poolId
        // arg2 = amount
        // arg3 = asset
        await subscribe(
            wallet,
            arg1,
            Number(arg2),
            arg3
        );
        break;

      default:
        console.log(`
Usage:
  deno run -A parametrix.ts create <wallet.json> DJED
  deno run -A parametrix.ts subscribe <wallet.json> <poolId> <amount> DJED
`);
    }
  };

  run();
}