/** Fixed Product addresses must carry their recorded, finalized CDM version. */
export function cdmSnapshotVersion(snapshot, library, address) {
  const entry = snapshot?.contracts?.[library];
  if (
    !entry ||
    typeof entry.address !== 'string' ||
    entry.address.toLowerCase() !== address.toLowerCase() ||
    !Number.isSafeInteger(entry.version) ||
    entry.version < 0 ||
    entry.version > 0xffffffff
  ) {
    throw new Error(`Refresh the finalized contracts/evm/cdm.json snapshot for ${library} before generating Product bindings.`);
  }
  return entry.version;
}
