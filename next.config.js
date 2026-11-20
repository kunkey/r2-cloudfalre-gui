/** @type {import('next').NextConfig} */

module.exports = {
    poweredByHeader: false,
    experimental: {
        proxyClientMaxBodySize: '4096mb',
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
