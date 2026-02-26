/** @type {import('next').NextConfig} */

module.exports = {
    poweredByHeader: false,
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
