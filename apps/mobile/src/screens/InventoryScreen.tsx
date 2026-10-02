import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import type { Item } from '@pantry/shared';
import { errorMessage, useApi } from '../connection';
import { useColors, useStyles } from '../theme';
import { Button } from '../components/Button';
import { ItemForm } from '../components/ItemForm';

export function InventoryScreen() {
  const api = useApi();
  const s = useStyles();
  const c = useColors();
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.listItems({ q: q || undefined }));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [api, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const adjust = async (item: Item, delta: number) => {
    try {
      const updated = await api.adjust(item.id, { delta, source: 'iphone' });
      setItems((list) => list.map((i) => (i.id === updated.id ? updated : i)));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (editing) {
    return (
      <View style={s.screen}>
        <Text style={[s.h1, s.pad, { paddingBottom: 0 }]}>Edit {editing.name}</Text>
        <ItemForm
          initial={editing}
          submitLabel="Save"
          onCancel={() => setEditing(null)}
          onSubmit={async (values) => {
            try {
              await api.updateItem(editing.id, values);
              setEditing(null);
              await load();
            } catch (err) {
              Alert.alert('Could not save', errorMessage(err));
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={[s.pad, { paddingBottom: 8 }]}>
        <Text style={s.h1}>Inventory</Text>
        <TextInput style={s.input} value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={c.muted} clearButtonMode="while-editing" />
        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={!error ? <Text style={[s.muted, { textAlign: 'center', marginTop: 32 }]}>No items yet. Scan something in to start.</Text> : null}
        renderItem={({ item }) => {
          const low = item.minQuantity !== null && item.quantity <= item.minQuantity;
          return (
            <Pressable onLongPress={() => setEditing(item)} style={[s.card, low && { borderLeftWidth: 4, borderLeftColor: c.danger }]}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.text}>{item.name}</Text>
                  <Text style={s.muted}>{[item.location, item.brand].filter(Boolean).join(' · ')}</Text>
                </View>
                <Button title="−" onPress={() => adjust(item, -1)} style={{ paddingVertical: 6, paddingHorizontal: 14 }} />
                <Text style={[s.text, { minWidth: 56, textAlign: 'center' }]}>{item.quantity} {item.unit === 'count' ? '' : item.unit}</Text>
                <Button title="+" onPress={() => adjust(item, 1)} style={{ paddingVertical: 6, paddingHorizontal: 14 }} />
              </View>
            </Pressable>
          );
        }}
      />
      <Text style={[s.muted, { textAlign: 'center', paddingBottom: 8 }]}>Long-press an item to edit it.</Text>
    </View>
  );
}
