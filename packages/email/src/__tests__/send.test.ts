import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailTransport } from "../client.js";

// Mock the client module so we can inject a fake transport
vi.mock("../client.js", () => ({
  getTransport: vi.fn(),
}));

import { getTransport } from "../client.js";
import { sendEmail } from "../send.js";

const mockSend = vi.fn();
const mockTransport: EmailTransport = { send: mockSend };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTransport).mockReturnValue(mockTransport);
});

describe("sendEmail", () => {
  const baseOptions = {
    to: "user@example.com",
    subject: "Test Subject",
    htmlBody: "<p>Hello</p>",
    textBody: "Hello",
    tag: "email-verification" as const,
  };

  it("calls transport.send with correct from, to, subject, html, text", async () => {
    mockSend.mockResolvedValue(undefined);
    await sendEmail(baseOptions);
    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      to: "user@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      text: "Hello",
    });
    expect(call.from).toContain("CeolX");
    expect(call.from).toContain("noreply@ceolx.ie");
  });

  it("re-throws transport errors", async () => {
    const err = new Error("SMTP connection refused");
    mockSend.mockRejectedValue(err);
    await expect(sendEmail(baseOptions)).rejects.toThrow(
      "SMTP connection refused",
    );
  });

  it("does not log subject or htmlBody on success", async () => {
    mockSend.mockResolvedValue(undefined);
    const consoleSpy = vi.spyOn(console, "log");
    await sendEmail(baseOptions);
    const loggedArgs = consoleSpy.mock.calls.flatMap((c) => JSON.stringify(c));
    expect(loggedArgs.join("")).not.toContain("Test Subject");
    expect(loggedArgs.join("")).not.toContain("<p>Hello</p>");
  });

  it("logs tag and to on success", async () => {
    mockSend.mockResolvedValue(undefined);
    const consoleSpy = vi.spyOn(console, "log");
    await sendEmail(baseOptions);
    const loggedArgs = consoleSpy.mock.calls.flatMap((c) => JSON.stringify(c));
    const combined = loggedArgs.join("");
    expect(combined).toContain("email-verification");
    expect(combined).toContain("user@example.com");
  });
});
