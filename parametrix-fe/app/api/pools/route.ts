import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data/pools.json");

function read() {
    if (!fs.existsSync(filePath)) return [];

    const raw = fs.readFileSync(filePath, "utf-8").trim();

    if (!raw) return []; // ✅ empty file safe

    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error("Invalid JSON in pools file, resetting:", e);
        return []; // ✅ prevents crash
    }
}

function write(data: any[]) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export async function GET() {
    return NextResponse.json(read());
}

export async function POST(req: Request) {
    const body = await req.json();
    const data = read();

    data.push(body);

    write(data);
    return NextResponse.json({ ok: true });
}