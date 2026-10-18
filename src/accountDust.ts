import Decimal from 'decimal.js';
import type {Holding} from './types';

// Account snapshots only: manually entered holdings retain their existing behavior.
export function keepAccountHolding(h:Holding):boolean {
  return !h.connection_id || !new Decimal(h.original_investment_krw).lt(1);
}
