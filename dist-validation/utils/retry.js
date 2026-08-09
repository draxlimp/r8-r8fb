"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = retry;
async function retry(fn, attempts, delayMs) {
    let last;
    for (let i = 0; i < Math.max(1, attempts); i++) {
        try {
            return await fn();
        }
        catch (error) {
            last = error;
            if (i + 1 < attempts)
                await new Promise(r => setTimeout(r, delayMs));
        }
    }
    throw last;
}
//# sourceMappingURL=retry.js.map