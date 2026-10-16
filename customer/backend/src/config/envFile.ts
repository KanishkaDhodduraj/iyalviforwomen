import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const backendDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const backendEnvPath = resolve(backendDirectory, ".env");

export interface LoadedEnvFile {
  path: string;
  exists: boolean;
  values: Record<string, string>;
}

export function readEnvFile(filePath = backendEnvPath): LoadedEnvFile {
  const path = resolve(filePath);
  if (!existsSync(path)) return { path, exists: false, values: {} };

  const bytes = readFileSync(path);
  const content = decodeEnvFile(bytes);
  const parseableContent = content
    .split(/\n/)
    .filter((line) => {
      const normalizedLine = line.replace(/\r$/, "").trim();
      return (
        normalizedLine &&
        !normalizedLine.startsWith("#") &&
        !normalizedLine.startsWith("```")
      );
    })
    .join("\n");
  const parsedValues = dotenv.parse(parseableContent);
  const values = Object.fromEntries(
    Object.entries(parsedValues).map(([key, rawValue]) => {
      let value = rawValue.trim().replace(/\r$/, "");
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith("`") && value.endsWith("`")))
      ) {
        value = value.slice(1, -1).trim();
      }
      return [key, value];
    }),
  );

  return { path, exists: true, values };
}

function decodeEnvFile(bytes: Buffer): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes
      .subarray(2)
      .toString("utf16le")
      .replace(/^\uFEFF/, "");
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const littleEndianBytes = Buffer.from(bytes.subarray(2));
    for (let index = 0; index + 1 < littleEndianBytes.length; index += 2) {
      const current = littleEndianBytes[index];
      littleEndianBytes[index] = littleEndianBytes[index + 1];
      littleEndianBytes[index + 1] = current;
    }
    return littleEndianBytes.toString("utf16le").replace(/^\uFEFF/, "");
  }
  return bytes.toString("utf8").replace(/^\uFEFF/, "");
}
