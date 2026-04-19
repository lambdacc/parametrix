"use client";

import { useState } from "react";
import PoolDetailsModal from "./PoolDetailsModal";
import PoolFundingStatus from "./PoolFundingStatus";

function shortAddr(addr?: string) {
    if (!addr) return "—";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function PoolCard({ pool }: { pool: any }) {
    const [open, setOpen] = useState(false);

    /* ---------- CONFIG ---------- */
    const cfg = pool.config || {};

    const risk = cfg.risk || "RAINFALL_EXCEEDED";
    const coverageHuman = cfg.coverage || 100;
    const premiumPct = (cfg.premium || 500) / 100;
    const threshold = cfg.threshold || 100;

    const asset = pool.payment_asset_code || "DJED";
    const creator = pool.hedger_address || pool.creator;

    /* ---------- EVENT MAPPING ---------- */
    const isFlight = risk === "FLIGHT_DELAY";

    const riskLabel = isFlight
        ? `Flight delay > ${threshold}`
        : `Rainfall > ${threshold}`;

    const imageSrc = isFlight
        ? "/images/pexels-cltsan-2833379.jpg"
        : "/images/pexels-emreayata-32064405.jpg";

    const imageLabel = isFlight
        ? "Flight Delay Risk"
        : "Rainfall Risk";

    /* ---------- FALLBACK COVERAGE (onchain) ---------- */
    const coverage =
        pool.coverage || coverageHuman * 1_000_000;

    return (
        <>
            <div className="group relative w-full">

                <div
                    onClick={() => setOpen(true)}
                    className="relative h-full rounded-2xl border border-gray-200 bg-white
                     shadow-sm hover:shadow-xl
                     transition-all duration-300
                     hover:-translate-y-1 cursor-pointer flex flex-col"
                >

                    {/* IMAGE */}
                    <div className="relative w-full h-[160px] overflow-hidden rounded-t-2xl border-b border-gray-100">
                        <img
                            src={imageSrc}
                            alt={imageLabel}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />

                        <div className="absolute bottom-2 left-3 text-sm text-white font-medium">
                            {imageLabel}
                        </div>
                    </div>

                    {/* HEADER */}
                    <div className="px-5 pt-3 pb-2 border-b border-gray-100 flex justify-between items-start">
                        <div>
                            <div className="text-sm text-gray-600">Pool</div>
                            <div className="text-lg font-semibold text-gray-900">
                                #{pool.poolId}
                            </div>
                        </div>

                        <div className="text-sm text-gray-500">
                            {new Date(pool.createdAt).toLocaleDateString()}
                        </div>
                    </div>

                    {/* BODY */}
                    <div className="px-5 py-3 flex flex-col gap-3 flex-grow">

                        {/* CREATOR */}
                        <div>
                            <div className="text-sm text-gray-600 mb-0.5">
                                Creator
                            </div>
                            <div className="font-mono text-sm text-gray-900">
                                {shortAddr(creator)}
                            </div>
                        </div>

                        {/* CORE INFO (dynamic) */}
                        <div>
                            <div className="text-sm text-gray-600 uppercase tracking-wide">
                                {riskLabel}
                            </div>

                            <div className="flex items-end justify-between mt-1">

                                {/* COVERAGE */}
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">
                                        {coverageHuman} {asset}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        coverage
                                    </div>
                                </div>

                                {/* PREMIUM / YIELD */}
                                <div className="text-right">
                                    <div className="text-xl font-semibold text-emerald-600">
                                        {premiumPct}%
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        yield
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* FUNDING */}
                        <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-inner">
                            {pool.state ? (
                                <PoolFundingStatus
                                    premium={pool.state.premium}
                                    total={pool.state.totalContributions}
                                    contributors={pool.state.contributorCount}
                                    coverage={coverage}
                                />
                            ) : (
                                <div className="text-sm text-gray-500">
                                    Click to view funding
                                </div>
                            )}
                        </div>

                    </div>

                    {/* FOOTER */}
                    <div className="px-5 py-2 border-t border-gray-100 flex justify-between text-sm text-gray-600">

            <span className="font-mono">
              Tx {pool.txHash?.slice(0, 10)}...
            </span>

                        <span className="text-blue-600 opacity-90 group-hover:opacity-100 font-medium transition">
              View →
            </span>

                    </div>

                </div>
            </div>

            <PoolDetailsModal
                open={open}
                onClose={() => setOpen(false)}
                pool={pool}
            />
        </>
    );
}