/**
 * TypeScript module declaration for JSON file imports.
 */

declare module "*.json" {
  const value: Record<string, unknown>;
  export default value;
}
