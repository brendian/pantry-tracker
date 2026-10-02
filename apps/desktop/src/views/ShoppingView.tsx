import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ShoppingList, ShoppingListEntry } from '@pantry/shared';
import { errorMessage, useApi } from '../connection';

function why(e: ShoppingListEntry): string {
  if (e.reason === 'below_min') return e.item.quantity === 0 ? 'Out of stock' : `At or below minimum (${e.effectiveMin})`;
  return `Expected to hit minimum in ~${e.daysUntilMin} days (using ${e.dailyUsage}/day)`;
}

export function ShoppingView() {
  const api = useApi();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extraName, setExtraName] = useState('');

  const load = useCallback(async () => {
    try {
      setList(await api.shoppingList());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const addExtra = (e: FormEvent) => {
    e.preventDefault();
    if (!extraName.trim()) return;
    act(() => api.addExtra({ name: extraName }));
    setExtraName('');
  };

  const snoozeWeek = (e: ShoppingListEntry) =>
    act(() => api.updateItem(e.item.id, { snoozedUntil: new Date(Date.now() + 7 * 86_400_000).toISOString() }));

  return (
    <section>
      <div className="toolbar">
        <h2>Shopping list</h2>
        <button onClick={load}>Refresh</button>
        <button onClick={() => window.print()}>Print</button>
      </div>
      {error && <p className="error">{error}</p>}
      {list && (
        <>
          <table className="shopping">
            <thead><tr><th>Item</th><th className="num">Have</th><th className="num">Buy</th><th>Why</th><th className="no-print" /></tr></thead>
            <tbody>
              {list.entries.map((e) => (
                <tr key={e.item.id} className={e.reason}>
                  <td>{e.item.name}<div className="muted small">{e.item.brand ?? ''}</div></td>
                  <td className="num">{e.item.quantity} {e.item.unit}</td>
                  <td className="num"><strong>{e.suggestedBuy}</strong></td>
                  <td className="small">{why(e)}</td>
                  <td className="no-print"><div className="row-actions">
                    <button className="primary" title="Add the suggested amount to stock"
                      onClick={() => act(() => api.adjust(e.item.id, { delta: e.suggestedBuy, source: 'desktop' }))}>Bought</button>
                    <button onClick={() => snoozeWeek(e)}>Snooze 7d</button>
                  </div>
                  </td>
                </tr>
              ))}
              {!list.entries.length && <tr><td colSpan={5} className="muted empty">Nothing is running low.</td></tr>}
            </tbody>
          </table>

          <h3>Extras</h3>
          <ul className="extras">
            {list.extras.map((x) => (
              <li key={x.id} className={x.checked ? 'checked' : ''}>
                <label>
                  <input type="checkbox" checked={x.checked} onChange={() => act(() => api.updateExtra(x.id, { checked: !x.checked }))} />
                  {x.name}{x.quantity !== 1 ? ` × ${x.quantity}` : ''}
                </label>
                <button className="link danger no-print" onClick={() => act(() => api.deleteExtra(x.id))}>Remove</button>
              </li>
            ))}
          </ul>
          <form onSubmit={addExtra} className="inline-form no-print">
            <input placeholder="Add something else to buy" value={extraName} onChange={(e) => setExtraName(e.target.value)} />
            <button type="submit">Add</button>
            {list.extras.some((x) => x.checked) && (
              <button type="button" onClick={() => act(() => api.clearCheckedExtras())}>Clear checked</button>
            )}
          </form>
        </>
      )}
    </section>
  );
}
