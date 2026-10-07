export const INDB_SODIUM_NOTE = "Sodium may not include salt added while cooking.";

export function IndbSodiumNote({ source }: { source: string }) {
  if (source !== "indb") return null;
  return <p className="text-sm text-subtle">{INDB_SODIUM_NOTE}</p>;
}
