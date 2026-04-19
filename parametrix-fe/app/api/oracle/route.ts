export async function POST() {
    const res = await fetch("http://localhost:8000/oracle/aggregate", {
        method: "POST",
    });

    if (!res.ok) {
        return Response.json({ error: "Oracle call failed" }, { status: 500 });
    }

    const data = await res.json();
    return Response.json(data);
}