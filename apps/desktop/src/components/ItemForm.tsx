import { useState, type FormEvent } from 'react';
import { LOCATIONS, type Item, type Location, type NewItem } from '@pantry/shared';

export interface ItemFormValues extends NewItem {
  snoozedUntil?: string | null;
}

interface Props {
  initial?: Partial<Item>;
  /** Show the starting-quantity field (new items only; existing stock is changed via adjust). */
  showQuantity?: boolean;
  submitLabel: string;
  onSubmit: (values: ItemFormValues) => Promise<void> | void;
  onCancel?: () => void;
}

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s));

export function ItemForm({ initial = {}, showQuantity, submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial.name ?? '');
  const [brand, setBrand] = useState(initial.brand ?? '');
  const [barcode, setBarcode] = useState(initial.barcode ?? '');
  const [location, setLocation] = useState<Location>(initial.location ?? 'pantry');
  const [unit, setUnit] = useState(initial.unit ?? 'count');
  const [quantity, setQuantity] = useState('1');
  const [minQuantity, setMin] = useState(initial.minQuantity?.toString() ?? '');
  const [targetQuantity, setTarget] = useState(initial.targetQuantity?.toString() ?? '');
  const [trackShopping, setTrack] = useState(initial.trackShopping ?? true);
  const [snoozedUntil, setSnooze] = useState(initial.snoozedUntil?.slice(0, 10) ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        name,
        brand: brand || null,
        barcode: barcode || null,
        location,
        unit,
        ...(showQuantity ? { quantity: Number(quantity) || 0 } : {}),
        minQuantity: numOrNull(minQuantity),
        targetQuantity: numOrNull(targetQuantity),
        trackShopping,
        ...(showQuantity ? {} : { snoozedUntil: snoozedUntil ? new Date(snoozedUntil).toISOString() : null }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="item-form" onSubmit={submit}>
      <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></label>
      <label>Brand<input value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
      <label>Barcode<input value={barcode} onChange={(e) => setBarcode(e.target.value)} /></label>
      <label>Location
        <select value={location} onChange={(e) => setLocation(e.target.value as Location)}>
          {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      <label>Unit<input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="count, can, litre…" /></label>
      {showQuantity && (
        <label>Starting quantity<input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
      )}
      <label>Minimum (add to list at or below)
        <input type="number" min="0" step="any" value={minQuantity} onChange={(e) => setMin(e.target.value)} placeholder="global default" />
      </label>
      <label>Target (restock up to)
        <input type="number" min="0" step="any" value={targetQuantity} onChange={(e) => setTarget(e.target.value)} placeholder="minimum + 1" />
      </label>
      {!showQuantity && (
        <label>Snooze shopping until<input type="date" value={snoozedUntil} onChange={(e) => setSnooze(e.target.value)} /></label>
      )}
      <label className="checkbox">
        <input type="checkbox" checked={trackShopping} onChange={(e) => setTrack(e.target.checked)} />
        Include on shopping list
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
