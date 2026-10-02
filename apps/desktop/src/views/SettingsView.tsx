import { useEffect, useState, type FormEvent } from 'react';
import type { Settings } from '@pantry/shared';
import { clientFor, errorMessage, useApi, type Connection } from '../connection';

interface Props {
  connection: Connection;
  onConnectionChange: (c: Connection) => void;
}

export function SettingsView({ connection, onConnectionChange }: Props) {
  const api = useApi();
  const [baseUrl, setBaseUrl] = useState(connection.baseUrl);
  const [token, setToken] = useState(connection.token);
  const [status, setStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => setSettings(null));
  }, [api]);

  const test = async () => {
    setStatus('Checking…');
    try {
      const h = await clientFor({ baseUrl, token }).health();
      setStatus(h.database ? 'Connected: server and database are reachable.' : 'Server reachable, but it cannot reach Postgres.');
    } catch (err) {
      setStatus(errorMessage(err));
    }
  };

  const saveConnection = (e: FormEvent) => {
    e.preventDefault();
    onConnectionChange({ baseUrl: baseUrl.trim(), token: token.trim() });
    setStatus('Saved.');
  };

  const saveThresholds = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      setSettings(await api.updateSettings(settings));
      setSaved('Saved.');
    } catch (err) {
      setSaved(errorMessage(err));
    }
  };

  const field = (key: keyof Settings, label: string, hint: string, min = 0) => (
    <label>{label}
      <input type="number" min={min} step="any" value={settings?.[key] ?? ''}
        onChange={(e) => setSettings((s) => (s ? { ...s, [key]: Number(e.target.value) } : s))} />
      <span className="muted small">{hint}</span>
    </label>
  );

  return (
    <section>
      <h2>Settings</h2>
      <form className="card item-form" onSubmit={saveConnection}>
        <h3>Server</h3>
        <label>Server address<input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://192.168.1.20:8080" /></label>
        <label>API token<input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="only if API_TOKEN is set on the server" /></label>
        <div className="actions">
          <button type="submit" className="primary">Save</button>
          <button type="button" onClick={test}>Test connection</button>
        </div>
        {status && <p className="muted">{status}</p>}
      </form>

      <form className="card item-form" onSubmit={saveThresholds}>
        <h3>Shopping list thresholds</h3>
        {settings ? (
          <>
            {field('defaultMinQuantity', 'Default minimum', 'Used for items without their own minimum.')}
            {field('lookaheadDays', 'Look-ahead (days)', 'Also list items expected to hit their minimum within this many days. 0 turns forecasting off.')}
            {field('usageWindowDays', 'Usage history (days)', 'How many days of scans the usage rate is averaged over.', 1)}
            <div className="actions"><button type="submit" className="primary">Save thresholds</button></div>
            {saved && <p className="muted">{saved}</p>}
          </>
        ) : (
          <p className="muted">Connect to the server to edit thresholds.</p>
        )}
      </form>
    </section>
  );
}
