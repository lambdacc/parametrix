"use client";

import { useState } from "react";
import { useWallet } from "@meshsdk/react";
import { createPoolContract } from "@/lib/client/parametrix-actions";

/* ---------- TYPES ---------- */
type RiskType = "RAINFALL_EXCEEDED" | "FLIGHT_DELAY";

type Props = {
    open: boolean;
    onClose: () => void;
};

/* ---------- CONFIG ---------- */
const CONFIG: {
    riskEvents: { label: string; value: RiskType }[];
    coverage: number[];
    premiumBps: { label: string; value: number }[];
    locations: Record<RiskType, { label: string; value: string }[]>;
} = {
    riskEvents: [
        { label: "Rainfall Exceeds Threshold", value: "RAINFALL_EXCEEDED" },
        { label: "Flight Delay", value: "FLIGHT_DELAY" },
    ],
    coverage: [250, 500, 1000],
    premiumBps: [
        { label: "5%", value: 500 },
        { label: "10%", value: 1000 },
    ],
    locations: {
        RAINFALL_EXCEEDED: [
            { label: "Mumbai, India", value: "MUMBAI_IN" },
            { label: "Chennai, India", value: "CHENNAI_IN" },
            { label: "Jakarta, Indonesia", value: "JAKARTA_ID" },
        ],
        FLIGHT_DELAY: [
            { label: "London, UK (Heathrow)", value: "LONDON_UK" },
            { label: "New York, USA (JFK)", value: "NYC_US" },
            { label: "Dubai, UAE", value: "DUBAI_UAE" },
        ],
    },
};

/* ---------- STORIES ---------- */
const STORIES: Record<RiskType, string> = {
    RAINFALL_EXCEEDED:
        "I am a crop farmer and my harvest season is approaching. Excess rainfall can damage yield and impact income. I am seeking protection against heavy rainfall during this period.",
    FLIGHT_DELAY:
        "I frequently travel for work and delays can disrupt schedules and cause financial loss. I want protection in case my flight is delayed beyond a certain threshold.",
};

export default function CreatePoolModal({ open, onClose }: Props) {
    const { wallet, connected } = useWallet();

    /* ---------- STATE ---------- */
    const [loading, setLoading] = useState(false);
    const [risk, setRisk] = useState<RiskType>("RAINFALL_EXCEEDED");
    const [coverage, setCoverage] = useState(250);
    const [premium, setPremium] = useState(500);
    const [asset] = useState("DJED");

    const [location, setLocation] = useState(
        CONFIG.locations["RAINFALL_EXCEEDED"][0].value
    );

    if (!open) return null;

    const threshold = risk === "RAINFALL_EXCEEDED" ? 100 : 6000000;
    const story = STORIES[risk];

    const locationLabel =
        CONFIG.locations[risk].find((l) => l.value === location)?.label;

    /* ---------- TIME ---------- */
    const now = new Date();

    let subscriptionEnd: Date;
    let eventTime: Date;
    let settlementTime: Date;

    if (risk === "RAINFALL_EXCEEDED") {
        subscriptionEnd = new Date(now);
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

        eventTime = new Date(now);
        eventTime.setMonth(eventTime.getMonth() + 3);

        settlementTime = new Date(eventTime.getTime() + 6 * 60 * 60 * 1000);
    } else {
        subscriptionEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        eventTime = new Date(now);
        eventTime.setDate(eventTime.getDate() + 7);

        settlementTime = new Date(eventTime.getTime() + 15 * 60 * 1000);
    }

    const fmt = (d: Date) =>
        d.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    /* ---------- CREATE ---------- */
    async function handleCreate() {
        if (!connected || !wallet) return;

        try {
            setLoading(true);

            const res = await createPoolContract(wallet, {
                eventType: risk,
                paymentAssetCode: asset,
                coverage,
                premiumBps: premium,
                threshold,
            });

            await fetch("/api/pools", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...res,
                    createdAt: Date.now(),
                    config: {
                        risk,
                        coverage,
                        premium,
                        threshold,
                        location,
                        story,
                        startTime: now.getTime(),
                        subscriptionEnd: subscriptionEnd.getTime(),
                        eventTime: eventTime.getTime(),
                        settlementTime: settlementTime.getTime(),
                    },
                }),
            });

            onClose();
            window.location.reload();
        } finally {
            setLoading(false);
        }
    }

    const preview = `${risk.replace("_", " ")} @ ${locationLabel}, ${coverage} ${asset}, Premium ${
        premium / 100
    }%`;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="min-h-full flex items-start justify-center p-4">
                <div
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={onClose}
                />

                <div className="relative w-[92%] max-w-4xl bg-white rounded-2xl p-6 border border-gray-300 shadow-2xl">

                    {/* header */}
                    <h2 className="text-xl font-semibold mb-4">Create Pool</h2>

                    {/* minimal UI just to confirm fix */}
                    <button
                        onClick={handleCreate}
                        disabled={!connected || loading}
                        className="w-full py-3 bg-blue-600 text-white rounded-lg"
                    >
                        {loading ? "Creating..." : "Create"}
                    </button>

                    <button
                        onClick={onClose}
                        className="mt-3 w-full py-3 border rounded-lg"
                    >
                        Cancel
                    </button>

                </div>
            </div>
        </div>
    );
}