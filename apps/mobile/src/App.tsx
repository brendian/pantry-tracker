import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ConnectionProvider, useConnection } from './connection';
import { useColors, useStyles } from './theme';
import { ScanScreen } from './screens/ScanScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { ShoppingScreen } from './screens/ShoppingScreen';
import { SettingsScreen } from './screens/SettingsScreen';

const TABS = ['Scan', 'Inventory', 'Shopping', 'Settings'] as const;
type Tab = (typeof TABS)[number];

function Shell() {
  const { api, loaded } = useConnection();
  const s = useStyles();
  const c = useColors();
  const [tab, setTab] = useState<Tab>('Scan');

  if (!loaded) return <View style={s.screen} />;
  // Until a server is configured, only Settings is usable.
  const current: Tab = api ? tab : 'Settings';

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>
        {current === 'Scan' && <ScanScreen />}
        {current === 'Inventory' && <InventoryScreen />}
        {current === 'Shopping' && <ShoppingScreen />}
        {current === 'Settings' && <SettingsScreen />}
      </View>
      <SafeAreaView edges={['bottom']} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.panel }}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} disabled={!api && t !== 'Settings'} style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: current === t ? '700' : '400', color: current === t ? c.accent : !api && t !== 'Settings' ? c.border : c.muted }}>
              {t}
            </Text>
          </Pressable>
        ))}
      </SafeAreaView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ConnectionProvider>
        <StatusBar style="auto" />
        <Shell />
      </ConnectionProvider>
    </SafeAreaProvider>
  );
}
