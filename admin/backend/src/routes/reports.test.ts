import { describe, expect, it } from "vitest";
import type { AdminRole } from "../middleware/auth.js";
import {
  canAccessReport,
  maskCustomerEmail,
  maskCustomerName,
  maskCustomerPhone,
  reportDateRangeQuery,
} from "./reports.js";
import { protectSpreadsheetValue } from "../services/reportExports.js";

describe("report permissions", () => {
  it("allows managers and superadmins every report", () => {
    const reports = ["sales", "customers", "payments", "orders", "inventory", "discounts"] as const;
    for (const role of ["manager", "superadmin"] satisfies AdminRole[]) {
      for (const report of reports) expect(canAccessReport(role, report)).toBe(true);
    }
  });

  it("limits support to customer and order reports", () => {
    expect(canAccessReport("support", "customers")).toBe(true);
    expect(canAccessReport("support", "orders")).toBe(true);
    for (const report of ["sales", "payments", "inventory", "discounts"] as const) {
      expect(canAccessReport("support", report)).toBe(false);
    }
  });

  it("masks customer PII for support exports", () => {
    expect(maskCustomerName("Jane Smith")).toBe("J*** S***");
    expect(maskCustomerEmail("jane@example.com")).toBe("j***@example.com");
    expect(maskCustomerPhone("+1 (555) 234-5678")).toBe("*********78");
  });
});

describe("report date ranges", () => {
  it("requires valid ISO dates and a range of no more than 366 inclusive days", () => {
    expect(reportDateRangeQuery.safeParse({ from: "2026-01-01", to: "2026-12-31" }).success).toBe(true);
    expect(reportDateRangeQuery.safeParse({ from: "2026-01-01", to: "2027-01-02" }).success).toBe(false);
    expect(reportDateRangeQuery.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success).toBe(false);
    expect(reportDateRangeQuery.safeParse({ from: "2026-03-02", to: "2026-03-01" }).success).toBe(false);
  });
});

describe("spreadsheet formula protection", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@SUM(A1)", " \t=1+1", "\n@cmd"])(
    "neutralizes formula-like strings: %j",
    (value) => {
      expect(protectSpreadsheetValue(value)).toBe(`'${value}`);
    },
  );

  it("preserves ordinary text and typed values", () => {
    expect(protectSpreadsheetValue("Normal text")).toBe("Normal text");
    expect(protectSpreadsheetValue(42)).toBe(42);
    expect(protectSpreadsheetValue(null)).toBe("");
  });
});
