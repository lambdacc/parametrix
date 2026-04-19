"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@meshsdk/react";
import { settleContract, subscribeContract } from "@/lib/client/parametrix-actions";
import { queryPoolState } from "@/lib/meshjs/queryPoolState";
import { Percent, Users } from "lucide-react";

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
} from "recharts";

function PoolStats({ pool, state, coverage }: any) {
    const toHuman = (x: number) => Math.floor(x / 1_000_000);

    if (!state) return null;

    const total = state.totalContributions;
    const remaining = Math.max(coverage - total, 0);

    const data = [
        { name: "Funded", value: total },
        { name: "Remaining", value: remaining },
    ];

    const fundingPct = Math.min((total / coverage) * 100, 100);

    const COLORS = ["#22c55e", "#e5e7eb"]; // green + gray

    return (
        <div className="mt-5 grid grid-cols-2 gap-5 items-center">

            {/* LEFT */}

            <div className="grid gap-4">

                {/* PREMIUM */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">

                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Percent className="w-5 h-5 text-blue-600" />
                    </div>

                    <div>
                        <div className="text-sm text-gray-500">Premium</div>
                        <div className="text-xl font-semibold">
                            {(pool.config.premium / 100)}%
                        </div>
                    </div>

                </div>

                {/* CONTRIBUTORS */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">

                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Users className="w-5 h-5 text-emerald-600" />
                    </div>

                    <div>
                        <div className="text-sm text-gray-500">Contributors</div>
                        <div className="text-xl font-semibold">
                            {state.contributorCount}
                        </div>
                    </div>

                </div>

            </div>

            {/* RIGHT: REAL DONUT */}
            <div className="flex items-center justify-center h-[200px]">

                <div className="relative w-full h-full max-w-[200px]">

                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                                stroke="none"
                            >
                                {data.map((_, index) => (
                                    <Cell key={index} fill={COLORS[index]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>

                    {/* CENTER TEXT */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <div className="text-xs text-gray-500">Coverage</div>
                        <div className="text-base font-semibold">
                            {toHuman(coverage)}
                        </div>
                        <div className="text-sm font-medium text-gray-700 mt-1">
                            {Math.round(fundingPct)}%
                        </div>
                    </div>

                </div>

            </div>

        </div>
    );
}

export default function PoolDetailsModal({
                                             open,
                                             onClose,
                                             pool,
                                         }: any) {
    const { wallet, connected } = useWallet();

    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);

    const [state, setState] = useState<any>(null);
    const [stateLoading, setStateLoading] = useState(false);

    /* ---------- fetch on open ---------- */
    useEffect(() => {
        if (!open) return;

        async function load() {
            try {
                setStateLoading(true);

                const res = await queryPoolState(
                    pool.poolId,
                    "DJED",
                );

                setState(res);
            } catch (e) {
                console.error(e);
            } finally {
                setStateLoading(false);
            }
        }

        load();
    }, [open, pool.poolId]);

    if (!open) return null;

    const coverage = (pool.coverage || 100) * 1_000_000;

    const handleSubscribe = async () => {
        if (!connected || !wallet) return;
        if (!amount || Number(amount) <= 0) return;

        try {
            setLoading(true);

            const { txHash } = await subscribeContract(wallet, {
                poolId: pool.poolId,
                amount: Number(amount),
                paymentAssetCode: pool.payment_asset_code || "DJED",
            });

            console.log("Subscribed:", txHash);
            setAmount("");
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSettle = async () => {
        try {
            if (!wallet) return;

            const { txHash } = await settleContract(wallet, {
                poolId: pool.poolId,
                paymentAssetCode: pool.payment_asset_code || "DJED",
            });

            console.log("Settled:", txHash);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="min-h-full flex items-start justify-center p-6">

                {/* overlay */}
                <div
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* modal */}
                <div className="relative w-full max-w-2xl bg-[#F8F9FB] text-gray-900 rounded-2xl p-6 border border-gray-200 shadow-xl">

                    {/* HEADER */}
                    <h2 className="text-xl font-semibold mb-2">
                        Pool {pool.poolId}
                    </h2>

                    <p className="text-sm text-gray-500 mb-4">
                        Interact with the pool and monitor funding status.
                    </p>

                    {/* STATS */}
                    {stateLoading ? (
                        <div className="text-sm text-gray-500 mb-4">
                            Loading funding stats...
                        </div>
                    ) : (
                        <PoolStats pool={pool} state={state} coverage={coverage} />
                    )}

                    {/* RAW DATA */}
                    <div className="mt-5">
                        <div className="text-xs text-gray-500 mb-2">Raw Pool Data</div>
                        <pre className="text-xs bg-white border border-gray-200 p-3 rounded max-h-[240px] overflow-auto">
              {JSON.stringify(pool, null, 2)}
            </pre>
                    </div>

                    {/* SUBSCRIBE */}
                    <div className="mt-5">
                        <label className="text-sm text-gray-600 flex items-center gap-2">
                            Enter subscription amount

                            {!connected && (
                                <span className="text-normal text-amber-600 font-medium">
                              (connect wallet to proceed)
                            </span>
                            )}
                        </label>

                        <div className="mt-2 flex gap-3">
                            <input
                                type="number"
                                placeholder="Amount"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="flex-1 border border-gray-300 px-3 py-2 rounded-lg bg-white"
                            />

                            <button
                                onClick={handleSubscribe}
                                disabled={loading || !connected}
                                className="px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                            >
                                {loading ? "Submitting..." : "Subscribe"}
                            </button>
                        </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="mt-6 flex gap-3">

                        <button
                            onClick={handleSettle}
                            disabled={loading || !connected}
                            className="flex-1 py-3 bg-green-600 text-white rounded-lg disabled:opacity-50"
                        >
                            Settle
                        </button>

                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg"
                        >
                            Close
                        </button>

                    </div>

                </div>
            </div>
        </div>
    );
}