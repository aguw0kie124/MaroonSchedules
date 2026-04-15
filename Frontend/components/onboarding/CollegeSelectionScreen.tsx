import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useTheme } from '../SharedUI';

type CampusCode = 'TAMU' | 'UTD';

const TAMU_LOGO = require('../../../assets/logos/tamu.png');
const UTD_LOGO = require('../../../assets/logos/utd.png');

interface CollegeOption {
  key: CampusCode;
  label: string;
  logo: any;
}

const COLLEGES: CollegeOption[] = [
  { key: 'TAMU', label: 'Texas A&M', logo: TAMU_LOGO },
  { key: 'UTD', label: 'UT Dallas', logo: UTD_LOGO },
];

function CollegeButton({
  label,
  logo,
  onPress,
  shadowColor,
}: {
  label: string;
  logo: any;
  onPress: () => void;
  shadowColor: string;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const animateTo = (next: number) => {
    Animated.spring(scale, {
      toValue: next,
      useNativeDriver: true,
      speed: 22,
      bounciness: 8,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={() => animateTo(0.95)}
      onPressOut={() => animateTo(1)}
      style={styles.touchable}
    >
      <Animated.View
        style={[
          styles.logoButton,
          {
            transform: [{ scale }],
            shadowColor,
          },
        ]}
      >
        <Image source={logo} style={styles.logoImage} resizeMode="contain" />
      </Animated.View>
      <Text style={styles.collegeLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export function CollegeSelectionScreen() {
  const { COLORS } = useTheme();
  const navigation = useNavigation<NavigationProp<Record<string, object | undefined>>>();
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSelect = React.useCallback(
    async (campus: CampusCode) => {
      if (isSaving) return;
      setIsSaving(true);
      try {
        await AsyncStorage.setItem('selected_campus', campus);
        console.log(`Selected campus: ${campus}`);
      } catch (error) {
        console.warn('Failed to save selected campus', error);
      } finally {
        navigation.navigate('AuthLanding');
        setIsSaving(false);
      }
    },
    [isSaving, navigation],
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: COLORS.textPrimary }]}>Select Your College</Text>

        <View style={styles.grid}>
          {COLLEGES.map((college) => (
            <CollegeButton
              key={college.key}
              label={college.label}
              logo={college.logo}
              onPress={() => handleSelect(college.key)}
              shadowColor={COLORS.primary}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 42,
    textAlign: 'center',
  },
  grid: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 18,
  },
  touchable: {
    alignItems: 'center',
    width: 150,
  },
  logoButton: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  logoImage: {
    width: 84,
    height: 84,
  },
  collegeLabel: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
});
