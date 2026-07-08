import { describe, expect, it } from "vitest";
import {
  formatAnswer,
  isAnswered,
  isSkipped,
  parseConfig,
  SKIPPED_VALUE,
} from "./questions";

describe("formatAnswer", () => {
  it("labels RAG values", () => {
    expect(formatAnswer("rag", "amber")).toBe("Amber");
    expect(formatAnswer("rag", "green")).toBe("Green");
  });
  it("joins multi-choice and handles empty", () => {
    expect(formatAnswer("multi_choice", ["Hiring", "Budget"])).toBe(
      "Hiring, Budget",
    );
    expect(formatAnswer("multi_choice", [])).toBe("—");
  });
  it("appends the unit for numbers", () => {
    expect(formatAnswer("number", 7, { unit: "customers" })).toBe(
      "7 customers",
    );
    expect(formatAnswer("number", 7)).toBe("7");
  });
  it("renders file/link values", () => {
    expect(formatAnswer("file_link", { link: "https://x" })).toBe(
      "https://x",
    );
    expect(formatAnswer("file_link", "raw-link")).toBe("raw-link");
  });
  it("renders text and blanks", () => {
    expect(formatAnswer("short_text", "hello")).toBe("hello");
    expect(formatAnswer("long_text", "")).toBe("—");
    expect(formatAnswer("rag", null)).toBe("—");
  });
});

describe("parseConfig", () => {
  it("passes through objects", () => {
    expect(parseConfig({ unit: "x", options: ["a"] })).toEqual({
      unit: "x",
      options: ["a"],
    });
  });
  it("defaults non-objects to empty", () => {
    expect(parseConfig(null)).toEqual({});
    expect(parseConfig(["a"])).toEqual({});
    expect(parseConfig("nope")).toEqual({});
  });
});

describe("isAnswered", () => {
  it("treats blanks as unanswered", () => {
    expect(isAnswered("short_text", "")).toBe(false);
    expect(isAnswered("rag", null)).toBe(false);
    expect(isAnswered("multi_choice", [])).toBe(false);
    expect(isAnswered("file_link", { link: "" })).toBe(false);
  });
  it("treats content as answered", () => {
    expect(isAnswered("short_text", "x")).toBe(true);
    expect(isAnswered("multi_choice", ["a"])).toBe(true);
    expect(isAnswered("file_link", { link: "x" })).toBe(true);
    expect(isAnswered("number", 0)).toBe(true);
  });
  it("treats a deliberate skip as answered", () => {
    expect(isAnswered("long_text", SKIPPED_VALUE)).toBe(true);
  });
});

describe("skipped answers", () => {
  it("recognises only the sentinel shape", () => {
    expect(isSkipped(SKIPPED_VALUE)).toBe(true);
    expect(isSkipped({ skipped: true })).toBe(true);
    expect(isSkipped({ skipped: false })).toBe(false);
    expect(isSkipped("skipped")).toBe(false);
    expect(isSkipped(null)).toBe(false);
    expect(isSkipped(["skipped"])).toBe(false);
  });
  it("formats as Skipped regardless of type", () => {
    expect(formatAnswer("long_text", SKIPPED_VALUE)).toBe("Skipped");
    expect(formatAnswer("rag", SKIPPED_VALUE)).toBe("Skipped");
    expect(formatAnswer("number", SKIPPED_VALUE, { unit: "x" })).toBe(
      "Skipped",
    );
  });
});
