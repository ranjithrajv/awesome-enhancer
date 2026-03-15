// Node.js built-in shim — these are never called in the browser code path
// dotenv is imported as `import dotenv from 'dotenv'` and called as `dotenv.config()`,
// so the default export needs a no-op `config` method.
export default { config: () => ({}) };
export const readFile = undefined;
export const writeFile = undefined;
export const mkdir = undefined;
export const existsSync = undefined;
export const join = undefined;
export const resolve = undefined;
export const dirname = undefined;
export const createReadStream = undefined;
export const createWriteStream = undefined;
export const statSync = undefined;
export const promises = {};
