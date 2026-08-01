/**
 * TypeScript module declaration for JSON file imports.
 */

/** Ambient module for importing `.json` files as a default export. */
declare module "*.json" {
  /** Parsed JSON object from a static `.json` import. */
  const value: Record<string, unknown>;
  export default value;
}
