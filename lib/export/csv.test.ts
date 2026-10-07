import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

type Row = { a: unknown; b: unknown };
const cols = [{ key: "a", header: "A" }, { key: "b", header: "B" }] as const;

describe("toCsv", () => {
  it("writes a header row then one line per row, CRLF-separated", () => {
    expect(toCsv<Row>([{ a: 1, b: "x" }, { a: 2, b: "y" }], cols)).toBe("A,B\r\n1,x\r\n2,y\r\n");
  });

  it("writes just the header for no rows", () => {
    expect(toCsv<Row>([], cols)).toBe("A,B\r\n");
  });

  it("quotes commas, quotes and newlines, doubling inner quotes", () => {
    expect(toCsv<Row>([{ a: "dal, tadka", b: 'say "hi"' }], cols)).toBe('A,B\r\n"dal, tadka","say ""hi"""\r\n');
    expect(toCsv<Row>([{ a: "two\nlines", b: "cr\rhere" }], cols)).toBe('A,B\r\n"two\nlines","cr\rhere"\r\n');
  });

  it("defuses formula injection: a leading = + - @ (or tab / CR) gets a ' prefix", () => {
    for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
      const out = toCsv<Row>([{ a: `${lead}SUM(A1)`, b: "" }], cols).split("\r\n")[1]!;
      expect(out.startsWith(`'${lead}`) || out.startsWith(`"'${lead}`)).toBe(true);
    }
    expect(toCsv<Row>([{ a: "=1+2,3", b: "" }], cols)).toBe(`A,B\r\n"'=1+2,3",\r\n`);
  });

  it("leaves numbers alone, negatives included, and writes null, undefined as empty", () => {
    expect(toCsv<Row>([{ a: -12.5, b: null }, { a: 0, b: undefined }], cols)).toBe("A,B\r\n-12.5,\r\n0,\r\n");
  });

  it("writes dates as ISO and booleans as true/false", () => {
    expect(toCsv<Row>([{ a: new Date("2026-10-08T01:02:03Z"), b: true }], cols)).toBe("A,B\r\n2026-10-08T01:02:03.000Z,true\r\n");
  });

  it("escapes headers too", () => {
    expect(toCsv([{ x: 1 }], [{ key: "x", header: "kcal, total" }])).toBe('"kcal, total"\r\n1\r\n');
  });
});
