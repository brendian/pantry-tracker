import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import type { ShoppingList, ShoppingListEntry } from '@pantry/shared';
import { errorMessage, useApi } from '../connection';
import { useColors, useStyles } from '../theme';
import { Button } from '../components/Button';

function why(e: ShoppingListEntry): string {
  if (e.reason === 'below_min') return e.item.quantity === 0 ? 'Out of stock' : `Have ${e.item.quantity}, minimum ${e.effectiveMin}`;
  return `Have ${e.item.quantity}, runs low in ~${e.daysUntilMin} days`;
}

export function ShoppingScreen() {
  const api = useApi();
  const s = useStyles();
  const c = useColors();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [extra, setExtra] = useState('');

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

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.pad}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Text style={s.h1}>Shopping list</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {list?.entries.map((e) => (
        <View key={e.item.id} style={[s.card, { borderLeftWidth: 4, borderLeftColor: e.reason === 'below_min' ? c.danger : c.warn }]}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{e.suggestedBuy} × {e.item.name}</Text>
              <Text style={s.muted}>{why(e)}</Text>
            </View>
            <Button title="Bought" primary onPress={() => act(() => api.adjust(e.item.id, { delta: e.suggestedBuy, source: 'iphone' }))} style={{ paddingVertical: 8 }} />
          </View>
        </View>
      ))}
      {list && !list.entries.length ? <Text style={s.muted}>Nothing is running low.</Text> : null}

      <Text style={[s.h2, { marginTop: 16 }]}>Extras</Text>
      {list?.extras.map((x) => (
        <View key={x.id} style={[s.row, { justifyContent: 'space-between', paddingVertical: 6 }]}>
          <Text style={[s.text, x.checked && { textDecorationLine: 'line-through', color: c.muted }]}>{x.name}</Text>
          <Switch value={x.checked} onValueChange={(checked) => act(() => api.updateExtra(x.id, { checked }))} />
        </View>
      ))}
      <View style={[s.row, { marginTop: 8 }]}>
        <TextInput style={[s.input, { flex: 1 }]} value={extra} onChangeText={setExtra} placeholder="Add something else" placeholderTextColor={c.muted}
          onSubmitEditing={() => { if (extra.trim()) { act(() => api.addExtra({ name: extra })); setExtra(''); } }} returnKeyType="done" />
      </View>
      {list?.extras.some((x) => x.checked) ? (
        <Button title="Clear checked" onPress={() => act(() => api.clearCheckedExtras())} style={{ marginTop: 12 }} />
      ) : null}
    </ScrollView>
  );
}
