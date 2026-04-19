import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { ScalePressable } from '../common/Motion';
import { useTheme } from '../SharedUI';

const { width } = Dimensions.get('window');

interface StoryUser {
  id: string;
  name: string;
  image: string | null;
  pings: any[];
  hasMedia: boolean;
  allSeen: boolean;
}

interface StoriesBarProps {
  stories: StoryUser[];
  myStory?: {
    hasActiveStory: boolean;
    allSeen: boolean;
    pings: any[];
  };
  onPressStory: (user: StoryUser) => void;
  onPressAdd?: () => void;
  userImage?: string | null;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({ 
  stories, 
  myStory,
  onPressStory, 
  onPressAdd,
  userImage 
}) => {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <View style={[styles.container, { borderBottomColor: COLORS.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Your Story / Create */}
        <View style={styles.storyItem}>
          <ScalePressable 
            style={styles.avatarWrapper} 
            onPress={() => {
              if (myStory?.hasActiveStory) {
                onPressStory({
                  id: 'me',
                  name: 'You',
                  image: userImage || null,
                  pings: myStory.pings,
                  hasMedia: myStory.pings.some(p => p.imageUrl),
                  allSeen: myStory.allSeen
                });
              } else {
                onPressAdd?.();
              }
            }}
          >
            {myStory?.hasActiveStory ? (
              <LinearGradient
                colors={myStory.allSeen ? [COLORS.border, COLORS.border] : ['#833ab4', '#fd1d1d', '#fcb045']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.gradientBorder}
              >
                <View style={[styles.avatarInner, { backgroundColor: COLORS.background }]}>
                  {userImage ? (
                    <Image source={{ uri: userImage }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: COLORS.surfaceElevated }]}>
                      <Text style={[styles.placeholderText, { color: COLORS.textSecondary }]}>+</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            ) : (
              <View style={[styles.emptyCreateCircle, { borderColor: COLORS.border }]}>
                <Plus size={24} color={COLORS.primary} />
              </View>
            )}
            
            {!myStory?.hasActiveStory && (
              <View style={[styles.addBadge, { backgroundColor: COLORS.primary, borderColor: COLORS.background }]}>
                <Text style={styles.addIcon}>+</Text>
              </View>
            )}
          </ScalePressable>
          <Text style={[styles.userName, { color: COLORS.textSecondary }]} numberOfLines={1}>Create</Text>
        </View>

        {/* Friends Stories */}
        {stories.map((user) => (
          <View key={user.id} style={styles.storyItem}>
            <ScalePressable
              onPress={() => onPressStory(user)}
              style={styles.avatarWrapper}
            >
              <LinearGradient
                colors={user.allSeen ? [COLORS.border, COLORS.border] : ['#833ab4', '#fd1d1d', '#fcb045']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.gradientBorder}
              >
                <View style={[styles.avatarInner, { backgroundColor: COLORS.background }]}>
                  {user.image ? (
                    <Image source={{ uri: user.image }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: COLORS.surfaceElevated }]}>
                      <Text style={[styles.placeholderText, { color: COLORS.textSecondary }]}>
                        {user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </ScalePressable>
            <Text style={[styles.userName, { color: COLORS.textPrimary }]} numberOfLines={1}>
              {user.name.split(' ')[0]}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 72,
  },
  avatarWrapper: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  gradientBorder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 63,
    height: 63,
    borderRadius: 31.5,
    padding: 2,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 2,
  },
  emptyCreateCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '600',
  },
  userName: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  addBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: -1,
  },
});
