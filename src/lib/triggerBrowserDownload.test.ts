import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  downloadJsPdfDocument,
  triggerBrowserDownload,
  triggerBrowserDownloadAsync,
} from "./triggerBrowserDownload";

describe("triggerBrowserDownload", () => {
  beforeEach(() => {
    const g = globalThis as any;
    g.document = {
      body: {
        appendChild: (node: any) => {
          node.click?.();
          return node;
        },
      },
      createElement: (tag: string) => {
        const el: any = {
          tagName: tag,
          style: {},
          click: vi.fn(),
          remove: vi.fn(),
        };
        return el;
      },
      hasFocus: () => true,
    };
    g.URL = {
      createObjectURL: vi.fn(() => "blob:mock-pdf"),
      revokeObjectURL: vi.fn(),
    };
    g.window = {
      setTimeout: (fn: () => void) => {
        /* do not run revoke in tests */
        return 1 as any;
      },
      open: vi.fn(),
      showSaveFilePicker: vi.fn(async () => {
        throw new Error("save picker should not run for default PDF downloads");
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clicks an anchor with download attribute and delays revoke", () => {
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const result = triggerBrowserDownload(blob, "Maria_Lopez_reporte.pdf");
    expect(result.ok).toBe(true);
    expect(result.method).toBe("anchor");
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("rejects empty blobs", () => {
    const result = triggerBrowserDownload(new Blob([]), "x.pdf");
    expect(result.ok).toBe(false);
  });

  it("downloadJsPdfDocument uses anchor (shows in Chrome download shelf), not save picker", async () => {
    const doc = {
      output: () => new Blob(["%PDF-1.4"], { type: "application/pdf" }),
    };
    const result = await downloadJsPdfDocument(doc, "Paciente_reporte.pdf");
    expect(result.ok).toBe(true);
    expect(result.method).toBe("anchor");
    expect((window as any).showSaveFilePicker).not.toHaveBeenCalled();
  });

  it("triggerBrowserDownloadAsync skips save picker unless preferSavePicker", async () => {
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const defaultResult = await triggerBrowserDownloadAsync(blob, "a.pdf");
    expect(defaultResult.method).toBe("anchor");
    expect((window as any).showSaveFilePicker).not.toHaveBeenCalled();
  });
});
