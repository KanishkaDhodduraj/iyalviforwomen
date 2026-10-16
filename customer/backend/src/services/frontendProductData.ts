import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export interface FrontendProduct {
  id: string;
  name: string;
  fabric: string;
  price: number;
  occasion: string;
  colors: string[];
  sizes: string[];
  image: string;
  category: "Sarees" | "Kurtis";
  subcategory: string;
  originalPrice?: number;
}

export async function loadFrontendProducts(): Promise<FrontendProduct[]> {
  const sourcePath = fileURLToPath(
    new URL("../../../frontend/src/data/products.ts", import.meta.url),
  );
  const original = await readFile(resolve(sourcePath), "utf8");
  const source = original.replace(
    /^import (\w+) from "@\/assets\/([^"]+)";$/gm,
    (_match, name: string, asset: string) => `const ${name} = "/assets/${asset}";`,
  );
  if (/^import .+ from "@\/assets\//m.test(source)) {
    throw new Error("Could not resolve frontend product image imports");
  }

  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exportsObject: { products?: FrontendProduct[] } = {};
  runInNewContext(compiled, { exports: exportsObject, module: { exports: exportsObject } });
  if (!Array.isArray(exportsObject.products) || exportsObject.products.length === 0) {
    throw new Error("Frontend product data did not export a product collection");
  }
  return exportsObject.products;
}
