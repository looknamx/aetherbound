/** Integration contract for a future finite, room-scoped unit supply.
 * The MVP rolls independently. This contract is not an active shared pool.
 * A finite implementation must reserve shop offers, return released offers,
 * and return 3 ** (star - 1) copies when a recruit is sold or eliminated.
 */
export interface UnitPool {
  available(defId: string): number;
  reserve(defId: string, copies: number): boolean;
  release(defId: string, copies: number): void;
  snapshot(): Record<string, number>;
}
