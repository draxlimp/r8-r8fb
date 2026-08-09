"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.R8Error = void 0;
exports.errorMessage = errorMessage;
const ids_1 = require("./ids");
class R8Error extends Error {
    causeValue;
    code;
    constructor(message, code = (0, ids_1.randomId)(4), causeValue) {
        super(message);
        this.causeValue = causeValue;
        this.name = 'R8Error';
        this.code = code;
    }
}
exports.R8Error = R8Error;
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
//# sourceMappingURL=errors.js.map