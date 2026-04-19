"use client";

import { useState } from "react";
import { CardanoWallet, useWallet } from "@meshsdk/react";

import dynamic from "next/dynamic";

const CreatePoolModal = dynamic(
    () => import("./CreatePoolModal"),
    { ssr: false }
);

export default function Hero() {
    const { connected } = useWallet();
    const [open, setOpen] = useState(false);

    return (
        <>
            <section className="pt-0 pb-0">
                <div className="w-[90%] max-w-[1800px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-10">

                    {/* LEFT: CONTENT (2/3) */}
                    <div className="lg:col-span-2 relative bg-[#0F172A]/90 backdrop-blur text-white rounded-2xl p-10 border border-gray-800 shadow-[0_20px_80px_rgba(0,0,0,0.6)] overflow-hidden">

                        {/* 🔥 warm accent glow INSIDE left only */}
                        <div className="absolute -top-24 -left-24 w-[400px] h-[400px] bg-orange-500/15 blur-[120px]" />
                        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-yellow-400/10 blur-[120px]" />

                        <div className="relative">

                            {/* headline */}
                            <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">
                                Parametrix
                            </h1>

                            {/* 🔥 highlight line */}
                            <p className="text-lg mb-6 max-w-2xl">
      <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent font-semibold">
        Oracle-native risk markets
      </span>{" "}
                                where payouts trigger automatically from real-world data — no claims, no disputes.
                            </p>

                            <p className="text-gray-400 mb-8 max-w-2xl">
                                Transform events like rainfall or delays into{" "}
                                <span className="text-gray-200">
        programmable on-chain financial agreements
      </span>
                                , powered by trusted oracle feeds.
                            </p>

                            {/* improved cards */}
                            <div className="grid sm:grid-cols-2 gap-6 text-sm">

                                <div className="bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 rounded-xl p-5">
                                    <h3 className="text-orange-300 font-semibold mb-3">How it works</h3>
                                    <ul className="space-y-2 text-gray-300">
                                        <li>• Event-based risk pools</li>
                                        <li>• Hedgers pay premium</li>
                                        <li>• Liquidity earns yield</li>
                                        <li>• Oracle auto-settlement</li>
                                    </ul>
                                </div>

                                <div className="bg-gradient-to-br from-yellow-400/10 to-transparent border border-yellow-400/20 rounded-xl p-5">
                                    <h3 className="text-yellow-300 font-semibold mb-3">Why it matters</h3>
                                    <ul className="space-y-2 text-gray-300">
                                        <li>• No claims or disputes</li>
                                        <li>• Fully transparent</li>
                                        <li>• Composable risk primitive</li>
                                        <li>• Real-world impact</li>
                                    </ul>
                                </div>

                            </div>

                            {/* tagline */}
                            <div className="mt-8 text-normal text-gray-50 italic">
                                Trustless, oracle-driven insurance — powered by Charli3.
                            </div>

                        </div>
                    </div>

                    {/* RIGHT: ACTION PANEL (1/3) */}
                    <div className="bg-white rounded-2xl p-8 flex flex-col justify-center items-center gap-6
                border border-gray-200 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">

                        {/* HEADER */}
                        <div className="text-center">
                            <p className="text-sm text-gray-500 mb-1">Get Started</p>
                            <p className="text-lg font-semibold text-gray-900">
                                Connect your wallet
                            </p>
                        </div>

                        {/* WALLET */}
                        <div className="scale-150 origin-center">
                            <CardanoWallet isDark={false} />
                        </div>

                        {/* DIVIDER */}
                        <div className="w-full h-px bg-gray-200" />

                        {/* CTA */}
                        <button
                            onClick={() => setOpen(true)}
                            disabled={!connected}
                            className="w-full py-4 text-lg font-semibold rounded-xl
               bg-gradient-to-r from-blue-600 to-blue-500 text-white
               shadow-[0_8px_25px_rgba(59,130,246,0.35)]
               hover:from-blue-500 hover:to-blue-400
               hover:scale-[1.02]
               hover:shadow-[0_12px_35px_rgba(59,130,246,0.5)]
               transition-all duration-200
               disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Create Hedge Pool
                        </button>

                        {/* HELP TEXT */}
                        {!connected && (
                            <p className="text-xs text-gray-500 text-center max-w-[220px]">
                                Connect wallet to create and interact with pools
                            </p>
                        )}
                    </div>

                </div>
            </section>

            <CreatePoolModal open={open} onClose={() => setOpen(false)} />
        </>
    );
}