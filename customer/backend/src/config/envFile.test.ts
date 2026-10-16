import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readEnvFile } from "./envFile.js";
import { environmentSchema } from "./envSchema.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("environment file parsing", () => {
  it("decodes a UTF-8 BOM, CRLF lines, quoted values, and ignored comment fences", () => {
    const path = temporaryEnvFile(
      Buffer.from(
        "\uFEFF# ignored comment\r\n```dotenv\r\nCLIENT_URL=\" https://shop.example/ \"\r\nJWT_SECRET='secret value 12345678901234567890'\r\nPORT=5000\r\n```\r\n",
        "utf8",
      ),
    );

    const result = readEnvFile(path);
    expect(result.exists).toBe(true);
    expect(result.values).toEqual({
      CLIENT_URL: "https://shop.example/",
      JWT_SECRET: "secret value 12345678901234567890",
      PORT: "5000",
    });
  });

  it("decodes UTF-16 little-endian and big-endian files", () => {
    const source = "PORT=5000\r\nCLIENT_URL=https://shop.example\r\n";
    const littleEndian = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(source, "utf16le"),
    ]);
    const bigEndianBody = Buffer.from(source, "utf16le");
    for (let index = 0; index + 1 < bigEndianBody.length; index += 2) {
      const byte = bigEndianBody[index];
      bigEndianBody[index] = bigEndianBody[index + 1];
      bigEndianBody[index + 1] = byte;
    }
    const bigEndian = Buffer.concat([Buffer.from([0xfe, 0xff]), bigEndianBody]);

    expect(readEnvFile(temporaryEnvFile(littleEndian)).values.PORT).toBe(
      "5000",
    );
    expect(readEnvFile(temporaryEnvFile(bigEndian)).values.CLIENT_URL).toBe(
      "https://shop.example",
    );
  });

  it("reports a missing temporary file without attempting to read it", () => {
    const directory = temporaryDirectory();
    const path = join(directory, "absent-env.txt");
    expect(readEnvFile(path)).toEqual({ path, exists: false, values: {} });
  });
});

describe("environment validation", () => {
  const validEnvironment = {
    PORT: "5000",
    DATABASE_URL: "https://database.example",
    JWT_SECRET: "01234567890123456789012345678901",
    CLIENT_URL: "https://shop.example",
    NODE_ENV: "test",
    TRUST_PROXY: "false",
  };

  it("normalizes one trailing slash on CLIENT_URL", () => {
    const result = environmentSchema.safeParse({
      ...validEnvironment,
      CLIENT_URL: "https://shop.example/",
    });

    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.CLIENT_URL).toBe("https://shop.example");
  });

  it("reports missing required variables without including values", () => {
    const missingSecret: Record<string, string> = { ...validEnvironment };
    delete missingSecret.JWT_SECRET;
    const result = environmentSchema.safeParse(missingSecret);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["JWT_SECRET"], message: "missing" }),
      );
    }
  });
});

function temporaryEnvFile(contents: Buffer): string {
  const path = join(temporaryDirectory(), "sample-env.txt");
  writeFileSync(path, contents);
  return path;
}

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "iyalvi-env-test-"));
  temporaryDirectories.push(directory);
  return directory;
}
