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

        let contentType = res.headers.get("content-type") || "application/octet-stream";
        const buffer = Buffer.from(await res.arrayBuffer());

        // Check magic bytes to guarantee accurate Content-Type (especially GIF)
        if (buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
            contentType = "image/gif";
        } else if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
            contentType = "image/png";
        } else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
            contentType = "image/jpeg";
        }

        // Extract filename from URL or Content-Disposition
        let originalName = "";
        const cd = res.headers.get("content-disposition");
        if (cd) {
            const match = cd.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
            if (match && match[1]) originalName = match[1].trim();
        }
        if (!originalName) {
            try {
                const u = new URL(res.url || url);
                const seg = u.pathname.split("/").filter(Boolean).pop() || "";
                if (seg) originalName = seg;
            } catch {}
        }

        const headers = new Headers();
        headers.set("Content-Type", contentType);
        headers.set("Content-Length", buffer.length.toString());
        headers.set("Cache-Control", "no-cache");
        if (originalName) {
            headers.set("X-Original-Filename", encodeURIComponent(originalName));
        }

        return new NextResponse(buffer, {
            status: 200,
            headers,
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
