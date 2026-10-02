import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput } from 'react-native';
import type { Settings } from '@pantry/shared';
import { createClient, errorMessage, useConnection } from '../connection';
import { useColors, useStyles } from '../theme';
import { Button } from '../components/Button';

export function SettingsScreen() {
  const s = useStyles();
  const c = useColors();
  const { connection, api, save } = useConnection();
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? 'http://');
  const [token, setToken] = useState(connection?.token ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    api?.getSettings().then(setSettings).catch(() => setSettings(null));
  }, [api]);

  const connect = async () => {
    setStatus('Checking…');
    const c = { baseUrl: baseUrl.trim(), token: token.trim() };
    try {
      const h = await createClient({ baseUrl: c.baseUrl, token: c.token || undefined }).health();
      if (!h.database) {
        setStatus('Server reachable, but it cannot reach Postgres.');
        return;
      }
      await save(c);
      setStatus('Connected and saved.');
    } catch (err) {
      setStatus(errorMessage(err));
    }
  };

  const num = (key: keyof Settings, label: string) => (
    <>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} keyboardType="decimal-pad" value={settings ? String(settings[key]) : ''}
        onChangeText={(v) => setSettings((cur) => (cur ? { ...cur, [key]: Number(v.replace(',', '.')) || 0 } : cur))} />
    </>
  );

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Settings</Text>
      <Text style={s.h2}>Server</Text>
      <Text style={s.label}>Server address</Text>
      <TextInput style={s.input} value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" autoCorrect={false}
        keyboardType="url" placeholder="http://192.168.1.20:8080" placeholderTextColor={c.muted} />
      <Text style={s.label}>API token (only if set on the server)</Text>
      <TextInput style={s.input} value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry />
      <Button title="Connect" primary onPress={connect} style={{ marginTop: 12 }} />
      {status ? <Text style={[s.muted, { marginTop: 8 }]}>{status}</Text> : null}

      {settings ? (
        <>
          <Text style={[s.h2, { marginTop: 24 }]}>Shopping list thresholds</Text>
          {num('defaultMinQuantity', 'Default minimum')}
          {num('lookaheadDays', 'Look-ahead days (0 turns forecasting off)')}
          {num('usageWindowDays', 'Usage history days')}
          <Button title="Save thresholds" primary style={{ marginTop: 12 }} onPress={async () => {
            try {
              setSettings(await api!.updateSettings(settings));
              setSaved('Saved.');
            } catch (err) {
              setSaved(errorMessage(err));
            }
          }} />
          {saved ? <Text style={[s.muted, { marginTop: 8 }]}>{saved}</Text> : null}
        </>
      ) : null}
    </ScrollView>
  );
}
