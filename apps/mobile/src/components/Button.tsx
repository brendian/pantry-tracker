import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useStyles } from '../theme';

interface Props {
  title: string;
  onPress: () => void;
  primary?: boolean;
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, primary, color, disabled, style }: Props) {
  const s = useStyles();
  const filled = primary || color;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        primary && s.primary,
        color ? { backgroundColor: color, borderColor: color } : null,
        { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Text style={[s.buttonText, filled && s.primaryText]}>{title}</Text>
    </Pressable>
  );
}
