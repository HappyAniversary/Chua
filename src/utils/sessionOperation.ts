/** Apply an asynchronous result only to the player who started the operation. */
export async function completeSessionOperation<T>(
  uid: string,
  currentUid: () => string | null | undefined,
  request: () => Promise<T>,
  apply: (result: T) => void
): Promise<boolean> {
  const result = await request();
  if (currentUid() !== uid) return false;
  apply(result);
  return true;
}
