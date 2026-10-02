import { useState } from 'react';
import { ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { LOCATIONS, type Item, type Location, type NewItem } from '@pantry/shared';
import { useColors, useStyles } from '../theme';
import { Button } from './Button';

interface Props {
  initial?: Partial<Item>;
  showQuantity?: boolean;
  submitLabel: string;
  onSubmit: (values: NewItem) => Promise<void>;
  onCancel: () => void;
}

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export function ItemForm({ initial = {}, showQuantity, submitLabel, onSubmit, onCancel }: Props) {
  const s = useStyles();
  const c = useColors();
  const [name, setName] = useState(initial.name ?? '');
  const [brand, setBrand] = useState(initial.brand ?? '');
  const [location, setLocation] = useState<Location>(initial.location ?? 'pantry');
  const [unit, setUnit] = useState(initial.unit ?? 'count');
  const [quantity, setQuantity] = useState('1');
  const [minQuantity, setMin] = useState(initial.minQuantity?.toString() ?? '');
  const [targetQuantity, setTarget] = useState(initial.targetQuantity?.toString() ?? '');
  const [trackShopping, setTrack] = useState(initial.trackShopping ?? true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        barcode: initial.barcode ?? null,
        name,
        brand: brand || null,
        location,
        unit: unit || 'count',
        ...(showQuantity ? { quantity: numOrNull(quantity) ?? 0 } : {}),
        minQuantity: numOrNull(minQuantity),
        targetQuantity: numOrNull(targetQuantity),
        trackShopping,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.pad}>
      {initial.barcode ? <Text style={s.muted}>Barcode {initial.barcode}</Text> : null}
      <Text style={s.label}>Name</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Chopped tomatoes" placeholderTextColor={c.muted} />
      <Text style={s.label}>Brand</Text>
      <TextInput style={s.input} value={brand} onChangeText={setBrand} placeholderTextColor={c.muted} />
      <Text style={s.label}>Location</Text>
      <View style={[s.row, { flexWrap: 'wrap' }]}>
        {LOCATIONS.map((l) => (
          <Button key={l} title={l} primary={l === location} onPress={() => setLocation(l)} style={{ paddingVertical: 8 }} />
        ))}
      </View>
      <Text style={s.label}>Unit</Text>
      <TextInput style={s.input} value={unit} onChangeText={setUnit} placeholder="count, can, litre…" placeholderTextColor={c.muted} />
      {showQuantity ? (
        <>
          <Text style={s.label}>Starting quantity</Text>
          <TextInput style={s.input} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
        </>
      ) : null}
      <Text style={s.label}>Minimum (add to shopping list at or below)</Text>
      <TextInput style={s.input} value={minQuantity} onChangeText={setMin} keyboardType="decimal-pad" placeholder="global default" placeholderTextColor={c.muted} />
      <Text style={s.label}>Target (restock up to)</Text>
      <TextInput style={s.input} value={targetQuantity} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="minimum + 1" placeholderTextColor={c.muted} />
      <View style={[s.row, { marginTop: 14, justifyContent: 'space-between' }]}>
        <Text style={s.text}>Include on shopping list</Text>
        <Switch value={trackShopping} onValueChange={setTrack} />
      </View>
      <View style={[s.row, { marginTop: 20 }]}>
        <Button title={submitLabel} primary onPress={submit} disabled={busy || !name.trim()} style={{ flex: 1 }} />
        <Button title="Cancel" onPress={onCancel} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}
