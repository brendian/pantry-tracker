import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Item, ProductSuggestion, ScanMode } from '@pantry/shared';
import { errorMessage, useApi } from '../connection';
import { ItemForm } from '../components/ItemForm';

type Pending = { barcode: string; suggestion: ProductSuggestion | null };

/**
 * USB and Bluetooth barcode scanners act like keyboards: they type the code and press Enter.
 * Keeping the input focused means you can scan without touching the mouse.
 */
export function ScanView() {
  const api = useApi();
  const [mode, setMode] = useState<ScanMode>('in');
  const [amount, setAmount] = useState(1);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [log, setLog] = useState<{ text: string; ok: boolean }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pending) inputRef.current?.focus();
  }, [pending, mode]);

  const note = (text: string, ok = true) => setLog((l) => [{ text, ok }, ...l].slice(0, 20));

  const scan = async (e: FormEvent) => {
    e.preventDefault();
    const barcode = code.trim();
    if (!barcode) return;
    setCode('');
    try {
      const result = await api.scan({ barcode, mode, amount, source: 'desktop' });
      if (result.status === 'updated') {
        const { item, event } = result;
        note(`${event.delta >= 0 ? '+' : ''}${event.delta} ${item.name} → ${item.quantity} ${item.unit}`);
      } else if (mode === 'in') {
        setPending({ barcode, suggestion: result.suggestion });
      } else {
        note(`${barcode} isn't tracked yet. Switch to Add to set it up.`, false);
      }
    } catch (err) {
      note(errorMessage(err), false);
    }
  };

  const created = (item: Item) => {
    note(`Added ${item.name} (${item.quantity} ${item.unit})`);
    setPending(null);
  };

  return (
    <section>
      <h2>Scan</h2>
      <div className="mode-toggle">
        <button className={mode === 'in' ? 'active add' : ''} onClick={() => setMode('in')}>Add to stock</button>
        <button className={mode === 'out' ? 'active use' : ''} onClick={() => setMode('out')}>Use up</button>
        <label className="amount">Amount
          <input type="number" min="0.001" step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 1)} />
        </label>
      </div>

      {pending ? (
        <div className="card">
          <h3>New item: {pending.barcode}</h3>
          <p className="muted">
            {pending.suggestion ? 'Name suggested from Open Food Facts. Check it and save.' : 'No product details found. Enter a name to start tracking it.'}
          </p>
          <ItemForm
            initial={{ barcode: pending.barcode, name: pending.suggestion?.name ?? '', brand: pending.suggestion?.brand ?? null }}
            showQuantity
            submitLabel="Save item"
            onSubmit={async (values) => {
              try {
                created(await api.createItem({ ...values, quantity: values.quantity ?? amount, source: 'desktop' }));
              } catch (err) {
                note(errorMessage(err), false);
              }
            }}
            onCancel={() => setPending(null)}
          />
        </div>
      ) : (
        <form onSubmit={scan} className="scan-form">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Scan or type a barcode, then Enter"
            className="scan-input"
          />
          <button type="submit" className="primary">{mode === 'in' ? 'Add' : 'Use'}</button>
        </form>
      )}

      <ul className="scan-log">
        {log.map((l, i) => <li key={i} className={l.ok ? '' : 'error'}>{l.text}</li>)}
      </ul>
    </section>
  );
}
