// EAN-8 / EAN-13 / UPC-A check digit: starting from the digit immediately left of the
// check digit and moving left, weights alternate 3, 1, 3, 1, ... This is equivalent for
// both lengths (it's "distance from the check digit", not "distance from the start"), so
// one implementation covers both, and prepending a leading zero to a UPC-A never changes it.
function checkDigitFor(dataDigits: number[]): number {
  let sum = 0;
  let weight = 3;
  for (let i = dataDigits.length - 1; i >= 0; i--) {
    sum += dataDigits[i]! * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function normaliseBarcode(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  const code = digits.length === 12 ? `0${digits}` : digits; // UPC-A -> EAN-13
  if (code.length !== 8 && code.length !== 13) return null;
  const nums = code.split("").map(Number);
  const checkDigit = nums.pop()!;
  if (checkDigitFor(nums) !== checkDigit) return null;
  return code;
}
