"use client";

import { Users, Coins } from "lucide-react";

export default function PoolFundingStatus({
                                              premium,
                                              total,
                                              contributors,
                                              coverage,
                                          }: {
    premium: number;
    total: number;
    contributors: number;
    coverage: number;
}) {
    const pct = Math.min((total / coverage) * 100, 100);

    const toHuman = (x: number) => Math.floor(x / 1_000_000);

    return (
        <div className="mt-4 space-y-3">

            {/* Progress */}
            <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Funding</span>
                    <span>{pct.toFixed(0)}%</span>
                </div>

                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="flex justify-between text-xs text-gray-400">

                <div className="flex items-center gap-1">
                    <Coins size={14} />
                    <span>{toHuman(total)}</span>
                </div>

                <div className="flex items-center gap-1">
                    <Users size={14} />
                    <span>{contributors}</span>
                </div>

            </div>
        </div>
    );
}