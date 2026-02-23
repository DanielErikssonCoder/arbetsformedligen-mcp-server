import pino from "pino";

export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    transport: process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: {
                colorize: true,
                destination: 2, // 2 corresponds to process.stderr
            },
        }
        : undefined,
}, pino.destination(2)); // Default to stderr so we don't interfere with MCP over stdout
