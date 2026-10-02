import { useMemo, useState } from 'react';
import { ApiContext, clientFor, loadConnection, saveConnection, type Connection } from './connection';
import { ScanView } from './views/ScanView';
import { InventoryView } from './views/InventoryView';
import { ShoppingView } from './views/ShoppingView';
import { SettingsView } from './views/SettingsView';

const TABS = [
  { id: 'scan', label: 'Scan' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'shopping', label: 'Shopping list' },
  { id: 'settings', label: 'Settings' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function App() {
  const [tab, setTab] = useState<Tab>('scan');
  const [connection, setConnection] = useState<Connection>(loadConnection);
  const api = useMemo(() => clientFor(connection), [connection]);

  const updateConnection = (c: Connection) => {
    saveConnection(c);
    setConnection(c);
  };

  return (
    <ApiContext.Provider value={api}>
      <div className="app">
        <nav className="sidebar">
          <h1>Pantry Tracker</h1>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'nav active' : 'nav'} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
          <div className="server-hint">{connection.baseUrl}</div>
        </nav>
        <main className="content">
          {tab === 'scan' && <ScanView />}
          {tab === 'inventory' && <InventoryView />}
          {tab === 'shopping' && <ShoppingView />}
          {tab === 'settings' && <SettingsView connection={connection} onConnectionChange={updateConnection} />}
        </main>
      </div>
    </ApiContext.Provider>
  );
}
