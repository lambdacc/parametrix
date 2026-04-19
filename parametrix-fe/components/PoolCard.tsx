"use client";

import { useState } from "react";
import PoolDetailsModal from "./PoolDetailsModal";
import PoolFundingStatus from "./PoolFundingStatus";

function shortAddr(addr?: string) {
    if (!addr) return "—";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatEvent(pool: any) {
    const event = pool.eventType || "RAINFALL_EXCEEDED";

    if (event === "RAINFALL_EXCEEDED") {
        return `Rainfall > ${pool.threshold || 100}`;
    }

    if (event === "FLIGHT_DELAY") {
        return `Flight delay > ${pool.threshold || 6000000}`;
    }

    return event;
}

export default function PoolCard({ pool }: { pool: any }) {
    const [open, setOpen] = useState(false);

    const coverage = pool.coverage || 100 * 1_000_000;
    const coverageHuman = Math.floor(coverage / 1_000_000);

    const creator = pool.hedger_address || pool.creator;

    return (
        <>
            <div
                onClick={() => setOpen(true)}
                className="group bg-white border border-gray-200 rounded-2xl p-5
                   shadow-sm hover:shadow-lg hover:border-gray-300
                   transition-all duration-200 cursor-pointer"
            >

                {/* TOP: ID + DATE */}
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <div className="text-xs text-gray-500">Pool</div>
                        <div className="text-lg font-semibold text-gray-900">
                            #{pool.poolId}
                        </div>
                    </div>

                    <div className="text-xs text-gray-400 text-right">
                        {new Date(pool.createdAt).toLocaleDateString()}
                    </div>
                </div>

                {/* CREATOR */}
                <div className="mb-4">
                    <div className="text-xs text-gray-500 mb-1">
                        Created by
                    </div>
                    <div className="font-mono text-sm text-gray-800">
                        {shortAddr(creator)}
                    </div>
                </div>

                {/* EVENT + COVERAGE */}
                <div className="mb-4">
                    <div className="text-sm text-gray-600">
                        {formatEvent(pool)}
                    </div>

                    <div className="text-lg font-semibold text-gray-900 mt-1">
                        {coverageHuman} DJED coverage
                    </div>
                </div>

                {/* FUNDING */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    {pool.state ? (
                        <PoolFundingStatus
                            premium={pool.state.premium}
                            total={pool.state.totalContributions}
                            contributors={pool.state.contributorCount}
                            coverage={coverage}
                        />
                    ) : (
                        <div className="text-sm text-gray-400">
                            Click to view funding
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="mt-4 flex justify-between text-xs text-gray-400">

          <span className="font-mono">
            Tx {pool.txHash?.slice(0, 10)}...
          </span>

                    <span className="opacity-0 group-hover:opacity-100 transition">
            View →
          </span>

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