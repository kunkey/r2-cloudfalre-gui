import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { url } = (await req.json()) as { url: string };
        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // Server fetch không bị CORS
        const res = await fetch(url);

        if (!res.ok) {
            return NextResponse.json(
                { error: `Failed to download file: ${res.status}` },
                { status: 400 }
            );
        }

        const contentType = res.headers.get("content-type") || "application/octet-stream";
        const buffer = Buffer.from(await res.arrayBuffer());

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": buffer.length.toString(),
                "Cache-Control": "no-cache",
            },
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
