import { useTheme } from '@/contexts/ThemeContext';

export function useColorScheme(): 'light' | 'dark' {
    const { isDark } = useTheme();
    return isDark ? 'dark' : 'light';
}
