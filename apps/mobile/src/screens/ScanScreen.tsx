import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import type { ProductSuggestion, ScanMode } from '@pantry/shared';
import { errorMessage, useApi } from '../connection';
import { useColors, useStyles } from '../theme';
import { Button } from '../components/Button';
import { ItemForm } from '../components/ItemForm';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] as const;
/** The camera reports the same code many times a second; ignore repeats for this long. */
const REPEAT_MS = 2500;

type Pending = { barcode: string; suggestion: ProductSuggestion | null };

export function ScanScreen() {
  const api = useApi();
  const s = useStyles();
  const c = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('in');
  const [amount, setAmount] = useState(1);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const busy = useRef(false);
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    const now = Date.now();
    if (busy.current || (data === last.current.code && now - last.current.at < REPEAT_MS)) return;
    busy.current = true;
    last.current = { code: data, at: now };
    try {
      const result = await api.scan({ barcode: data, mode, amount, source: 'iphone' });
      if (result.status === 'updated') {
        const { item, event } = result;
        setMessage({ text: `${event.delta >= 0 ? '+' : ''}${event.delta} ${item.name}: now ${item.quantity} ${item.unit}`, ok: true });
      } else if (mode === 'in') {
        setPending({ barcode: data, suggestion: result.suggestion });
      } else {
        setMessage({ text: `${data} isn't tracked yet. Switch to Add to set it up.`, ok: false });
      }
    } catch (err) {
      setMessage({ text: errorMessage(err), ok: false });
    } finally {
      busy.current = false;
    }
  };

  if (pending) {
    return (
      <View style={s.screen}>
        <View style={[s.pad, { paddingBottom: 0 }]}>
          <Text style={s.h1}>New item</Text>
          <Text style={s.muted}>
            {pending.suggestion ? 'Name suggested from Open Food Facts. Check it and save.' : 'No product details found. Enter a name to start tracking it.'}
          </Text>
        </View>
        <ItemForm
          initial={{ barcode: pending.barcode, name: pending.suggestion?.name ?? '', brand: pending.suggestion?.brand ?? null }}
          showQuantity
          submitLabel="Save item"
          onCancel={() => setPending(null)}
          onSubmit={async (values) => {
            try {
              const item = await api.createItem({ ...values, source: 'iphone' });
              setMessage({ text: `Added ${item.name} (${item.quantity} ${item.unit})`, ok: true });
              setPending(null);
            } catch (err) {
              setMessage({ text: errorMessage(err), ok: false });
            }
          }}
        />
        {message && !message.ok ? <Text style={[s.error, s.pad]}>{message.text}</Text> : null}
      </View>
    );
  }

  if (!permission) return <View style={s.screen} />;
  if (!permission.granted) {
    return (
      <View style={[s.screen, s.pad, { justifyContent: 'center' }]}>
        <Text style={[s.text, { marginBottom: 16 }]}>Pantry Tracker needs the camera to scan barcodes.</Text>
        <Button title="Allow camera" primary onPress={requestPermission} />
      </View>
    );
  }

  const modeColor = mode === 'in' ? c.accent : c.warn;

  return (
    <View style={s.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={onScanned}
      />
      <View style={styles.reticleWrap} pointerEvents="none">
        <View style={[styles.reticle, { borderColor: modeColor }]} />
      </View>
      <View style={styles.top}>
        <View style={[s.row, styles.pill]}>
          <Pressable onPress={() => setMode('in')} style={[styles.seg, mode === 'in' && { backgroundColor: c.accent }]}>
            <Text style={styles.segText}>Add</Text>
          </Pressable>
          <Pressable onPress={() => setMode('out')} style={[styles.seg, mode === 'out' && { backgroundColor: c.warn }]}>
            <Text style={styles.segText}>Use</Text>
          </Pressable>
        </View>
        <View style={[s.row, styles.pill]}>
          <Pressable onPress={() => setAmount((a) => Math.max(1, a - 1))} style={styles.seg}><Text style={styles.segText}>−</Text></Pressable>
          <Text style={[styles.segText, { minWidth: 28, textAlign: 'center' }]}>{amount}</Text>
          <Pressable onPress={() => setAmount((a) => a + 1)} style={styles.seg}><Text style={styles.segText}>+</Text></Pressable>
        </View>
      </View>
      {message ? (
        <View style={[styles.toast, { backgroundColor: message.ok ? c.accent : c.danger }]}>
          <Text style={styles.toastText}>{message.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
  pill: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 22, padding: 4 },
  seg: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 18 },
  segText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  reticleWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  reticle: { width: '75%', height: 160, borderWidth: 3, borderRadius: 16 },
  toast: { position: 'absolute', left: 12, right: 12, bottom: 16, borderRadius: 12, padding: 14 },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
