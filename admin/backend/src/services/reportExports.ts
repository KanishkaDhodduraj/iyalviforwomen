import ExcelJS from "exceljs";
import type { Response } from "express";
import PDFDocument from "pdfkit";
import { once } from "node:events";

export type ReportValue = string | number | boolean | Date | null | undefined;
export type ReportRow = Record<string, ReportValue>;
export type ReportFormat = "csv" | "xlsx" | "pdf";

export function protectSpreadsheetValue(value: ReportValue): string | number | boolean | Date {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return value;
  if (/^[\u0000-\u0020\uFEFF]*[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

function csvCell(value: ReportValue): string {
  const safeValue = String(protectSpreadsheetValue(value));
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function sendCsv(
  response: Response,
  headers: string[],
  rows: AsyncIterable<ReportRow>,
): Promise<void> {
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  return (async () => {
    const write = async (chunk: string) => {
      if (!response.write(chunk)) await once(response, "drain");
    };
    await write(`${headers.map(csvCell).join(",")}\r\n`);
    for await (const row of rows) {
      if (response.destroyed) return;
      await write(`${headers.map((header) => csvCell(row[header])).join(",")}\r\n`);
    }
    response.end();
  })();
}

export async function sendXlsx(
  response: Response,
  headers: string[],
  rows: AsyncIterable<ReportRow>,
): Promise<void> {
  response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: response,
    useStyles: false,
    useSharedStrings: false,
  });
  const worksheet = workbook.addWorksheet("Report");
  worksheet.addRow(headers).commit();
  for await (const row of rows) {
    if (response.destroyed) return;
    worksheet.addRow(headers.map((header) => protectSpreadsheetValue(row[header]))).commit();
  }
  await workbook.commit();
}

export async function sendPdf(
  response: Response,
  title: string,
  dateRange: string,
  headers: string[],
  rows: AsyncIterable<ReportRow>,
): Promise<void> {
  response.type("application/pdf");
  const document = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: false });
  document.pipe(response);
  document.fontSize(16).text(title);
  document.moveDown(0.3).fontSize(9).text(`Date range: ${dateRange}`);
  document.moveDown(0.7).fontSize(8).text(headers.join("  |  "), { continued: false });
  document.moveDown(0.35);
  for await (const row of rows) {
    if (response.destroyed) {
      document.destroy();
      return;
    }
    const text = headers
      .map((header) => String(row[header] ?? "").replace(/[\r\n]+/g, " "))
      .join("  |  ");
    if (document.y > 540) document.addPage();
    document.fontSize(7).text(text, { width: 770 });
  }
  document.end();
}
