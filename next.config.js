/** @type {import('next').NextConfig} */

module.exports = {
    poweredByHeader: false,
    // Mặc định Next chỉ buffer ~10MB → FormData parse lỗi với video/file lớn.
    // Tăng để /api/uploads/direct nhận được đủ body (multipart).
    experimental: {
        proxyClientMaxBodySize: '512mb',
    },
    headers: async () => [
        {
            source: "/(.*)",
            headers: [
                {
                    key: "Cache-Control",
                    value: "no-store",
                },
            ],
        },
    ],
};
