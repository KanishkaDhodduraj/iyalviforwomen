export function validateClearProductsCommand(nodeEnv: string | undefined, args: string[]): void {
  if (nodeEnv === "production") {
    throw new Error("Product clearing is disabled in production");
  }
  if (args.length !== 1 || args[0] !== "DELETE PRODUCTS") {
    throw new Error('Pass the exact confirmation argument "DELETE PRODUCTS"');
  }
}
