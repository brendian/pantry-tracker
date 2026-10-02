import { useCallback, useEffect, useState } from 'react';
import { LOCATIONS, type InventoryEvent, type Item, type Location } from '@pantry/shared';
import { errorMessage, useApi } from '../connection';
import { ItemForm } from '../components/ItemForm';

export function InventoryView() {
  const api = useApi();
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState('');
  const [location, setLocation] = useState<Location | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [history, setHistory] = useState<{ item: Item; events: InventoryEvent[] } | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.listItems({ q: q || undefined, location: location || undefined }));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [api, q, location]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const replace = (item: Item) => setItems((list) => list.map((i) => (i.id === item.id ? item : i)));

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const setCount = (item: Item) => {
    const value = prompt(`Exact count of ${item.name} (${item.unit})`, String(item.quantity));
    if (value === null || value.trim() === '' || isNaN(Number(value))) return;
    act(async () => replace(await api.adjust(item.id, { set: Number(value), source: 'desktop' })));
  };

  const remove = (item: Item) => {
    if (!confirm(`Delete ${item.name} and its history?`)) return;
    act(async () => {
      await api.deleteItem(item.id);
      setItems((list) => list.filter((i) => i.id !== item.id));
    });
  };

  if (editing) {
    const isNew = editing === 'new';
    return (
      <section>
        <h2>{isNew ? 'New item' : `Edit ${editing.name}`}</h2>
        {error && <p className="error">{error}</p>}
        <div className="card">
          <ItemForm
            initial={isNew ? {} : editing}
            showQuantity={isNew}
            submitLabel={isNew ? 'Create' : 'Save'}
            onCancel={() => setEditing(null)}
            onSubmit={(values) =>
              act(async () => {
                if (isNew) await api.createItem({ ...values, source: 'desktop' });
                else await api.updateItem(editing.id, values);
                setEditing(null);
                await load();
              })
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="toolbar">
        <h2>Inventory</h2>
        <input placeholder="Search name, brand or barcode" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={location} onChange={(e) => setLocation(e.target.value as Location | '')}>
          <option value="">All locations</option>
          {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button className="primary" onClick={() => setEditing('new')}>New item</button>
      </div>
      {error && <p className="error">{error}</p>}
      <table className="inventory">
        <thead>
          <tr><th>Item</th><th>Location</th><th className="num">Stock</th><th className="num">Min</th><th className="num">Target</th><th /></tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const low = item.minQuantity !== null && item.quantity <= item.minQuantity;
            return (
              <tr key={item.id} className={low ? 'low' : ''}>
                <td>
                  <div className="item-name">{item.name}</div>
                  <div className="muted small">{[item.brand, item.barcode].filter(Boolean).join(' · ')}</div>
                </td>
                <td>{item.location}</td>
                <td className="num stock">
                  <button className="step" onClick={() => act(async () => replace(await api.adjust(item.id, { delta: -1, source: 'desktop' })))}>−</button>
                  <button className="link" onClick={() => setCount(item)} title="Set exact count">{item.quantity} {item.unit}</button>
                  <button className="step" onClick={() => act(async () => replace(await api.adjust(item.id, { delta: 1, source: 'desktop' })))}>+</button>
                </td>
                <td className="num">{item.minQuantity ?? <span className="muted">default</span>}</td>
                <td className="num">{item.targetQuantity ?? <span className="muted">–</span>}</td>
                <td><div className="row-actions">
                  <button onClick={() => act(async () => setHistory({ item, events: await api.events(item.id) }))}>History</button>
                  <button onClick={() => setEditing(item)}>Edit</button>
                  <button className="danger" onClick={() => remove(item)}>Delete</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {!items.length && !error && (
            <tr><td colSpan={6} className="muted empty">No items yet. Scan something in, or add one with New item.</td></tr>
          )}
        </tbody>
      </table>

      {history && (
        <div className="overlay" onClick={() => setHistory(null)}>
          <div className="card dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{history.item.name}: history</h3>
            <table>
              <thead><tr><th>When</th><th>Change</th><th className="num">Δ</th><th className="num">After</th><th>From</th></tr></thead>
              <tbody>
                {history.events.map((ev) => (
                  <tr key={ev.id}>
                    <td>{new Date(ev.createdAt).toLocaleString()}</td>
                    <td>{ev.kind.replace('_', ' ')}</td>
                    <td className="num">{ev.delta > 0 ? `+${ev.delta}` : ev.delta}</td>
                    <td className="num">{ev.quantityAfter}</td>
                    <td>{ev.source ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="actions"><button onClick={() => setHistory(null)}>Close</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
