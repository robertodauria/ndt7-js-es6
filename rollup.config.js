export default {
    input: "src/ndt7.js",
    output: {
        file: "dist/ndt7.js",
        format: "umd",
        name: "ndt7",
        globals: {
            "ws": "WebSocket",
            "node-fetch": "fetch",
        }
    },
    external: [
        "ws",
        "node-fetch",
    ],
};