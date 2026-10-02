import { StyleSheet, useColorScheme } from 'react-native';

const light = { bg: '#f6f5f2', panel: '#ffffff', text: '#1f2328', muted: '#6b7280', border: '#e2e0db', accent: '#2f6f4f', accentSoft: '#e3f0e8', warn: '#b45309', danger: '#b42318' };
const dark = { bg: '#17191c', panel: '#212428', text: '#e7e7e4', muted: '#9aa0a6', border: '#33373c', accent: '#6fc597', accentSoft: '#1f3a2c', warn: '#f3b25c', danger: '#f07167' };

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useStyles() {
  const c = useColors();
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    pad: { padding: 16 },
    h1: { fontSize: 26, fontWeight: '700', color: c.text, marginBottom: 12 },
    h2: { fontSize: 18, fontWeight: '600', color: c.text, marginVertical: 8 },
    text: { fontSize: 16, color: c.text },
    muted: { fontSize: 13, color: c.muted },
    error: { fontSize: 14, color: c.danger, marginVertical: 8 },
    card: { backgroundColor: c.panel, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, padding: 14, marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, fontSize: 16, color: c.text, backgroundColor: c.panel },
    label: { fontSize: 13, color: c.muted, marginTop: 10, marginBottom: 4 },
    button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: c.border, backgroundColor: c.panel },
    buttonText: { fontSize: 16, color: c.text, fontWeight: '500' },
    primary: { backgroundColor: c.accent, borderColor: c.accent },
    primaryText: { color: '#fff', fontWeight: '600' },
  });
}
