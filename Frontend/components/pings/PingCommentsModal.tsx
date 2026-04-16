import React from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { MessageCircle, Send, X } from 'lucide-react-native';

import { addComment, getComments } from '../../services/socialFeedService';
import { useTheme } from '../SharedUI';

type PingComment = {
  id: string;
  text: string;
  createdAt: string;
  userName: string;
};

export type PingCommentTarget = {
  activityId: string;
  title: string;
  subtitle?: string | null;
  commentCount?: number;
};

interface PingCommentsModalProps {
  visible: boolean;
  target: PingCommentTarget | null;
  onClose: () => void;
  onCommentPosted?: () => void;
}

function formatCommentTime(isoValue: string) {
  const date = new Date(isoValue);
  if (!Number.isFinite(date.getTime())) return 'Just now';

  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function mapRawComment(comment: any): PingComment {
  return {
    id: String(comment?.id ?? `${comment?.created_at ?? Date.now()}`),
    text: String(comment?.data?.text ?? comment?.text ?? ''),
    createdAt: String(comment?.created_at ?? new Date().toISOString()),
    userName: String(comment?.user?.name ?? 'Aggie User'),
  };
}

export function PingCommentsModal({
  visible,
  target,
  onClose,
  onCommentPosted,
}: PingCommentsModalProps) {
  const { COLORS } = useTheme();
  const { user } = useUser();

  const [comments, setComments] = React.useState<PingComment[]>([]);
  const [draft, setDraft] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const translateY = React.useRef(new Animated.Value(0)).current;

  const loadComments = React.useCallback(async () => {
    if (!target?.activityId) return;
    setLoading(true);
    try {
      const nextComments = await getComments(target.activityId);
      setComments(nextComments.map(mapRawComment));
    } catch (error) {
      console.warn('[Comments] load failed', error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [target?.activityId]);

  React.useEffect(() => {
    if (!visible || !target?.activityId) return;
    loadComments();
  }, [loadComments, target?.activityId, visible]);

  React.useEffect(() => {
    if (!visible) {
      setDraft('');
      setComments([]);
      setLoading(false);
      setSubmitting(false);
      translateY.setValue(0);
    }
  }, [translateY, visible]);

  const closeSheet = React.useCallback(() => {
    Animated.spring(translateY, {
      toValue: 560,
      useNativeDriver: true,
      damping: 20,
      stiffness: 210,
      mass: 0.95,
      overshootClamping: true,
    }).start(({ finished }) => {
      if (finished) {
        translateY.setValue(0);
        onClose();
      }
    });
  }, [onClose, translateY]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 6,
        onPanResponderGrant: () => {
          translateY.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          translateY.setValue(Math.max(0, gestureState.dy));
        },
        onPanResponderRelease: (_, gestureState) => {
          const shouldClose = gestureState.dy > 120 || gestureState.vy > 1.2;
          if (shouldClose) {
            closeSheet();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 220,
            mass: 0.9,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 220,
            mass: 0.9,
          }).start();
        },
      }),
    [closeSheet, translateY],
  );

  const handleSubmit = React.useCallback(async () => {
    if (!target?.activityId || !draft.trim() || !user) return;

    setSubmitting(true);
    try {
      await addComment(target.activityId, user, draft.trim());
      setDraft('');
      await loadComments();
      onCommentPosted?.();
    } catch (error) {
      console.warn('[Comments] submit failed', error);
    } finally {
      setSubmitting(false);
    }
  }, [draft, loadComments, onCommentPosted, target?.activityId, user]);

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <TouchableWithoutFeedback onPress={closeSheet}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardWrap}
          >
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.card,
                  { backgroundColor: COLORS.surface, transform: [{ translateY }] },
                ]}
              >
                <View style={styles.sheetTopZone} {...panResponder.panHandlers}>
                  <View style={styles.handleWrap}>
                    <View style={[styles.handle, { backgroundColor: COLORS.border }]} />
                  </View>
                  <View style={styles.header}>
                    <View style={styles.headerCopy}>
                      <Text style={[styles.title, { color: COLORS.textPrimary }]} numberOfLines={2}>
                        {target?.title || 'Comments'}
                      </Text>
                      <Text style={[styles.subtitle, { color: COLORS.textSecondary }]} numberOfLines={2}>
                        {target?.subtitle || `${target?.commentCount || 0} comments`}
                      </Text>
                    </View>
                    <Pressable onPress={closeSheet} style={styles.closeButton}>
                      <X size={18} color={COLORS.textPrimary} />
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.threadCard, { borderColor: COLORS.border }]}>
                  {loading ? (
                    <View style={styles.loadingWrap}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    </View>
                  ) : comments.length ? (
                    <ScrollView
                      style={styles.threadScroll}
                      contentContainerStyle={styles.threadContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {comments.map((comment) => (
                        <View
                          key={comment.id}
                          style={[styles.commentRow, { borderBottomColor: COLORS.border }]}
                        >
                          <View style={[styles.avatar, { backgroundColor: `${COLORS.primary}14` }]}>
                            <MessageCircle size={14} color={COLORS.primary} />
                          </View>
                          <View style={styles.commentCopy}>
                            <View style={styles.commentMetaRow}>
                              <Text style={[styles.commentAuthor, { color: COLORS.textPrimary }]}>
                                {comment.userName}
                              </Text>
                              <Text style={[styles.commentTime, { color: COLORS.textTertiary }]}>
                                {formatCommentTime(comment.createdAt)}
                              </Text>
                            </View>
                            <Text style={[styles.commentText, { color: COLORS.textSecondary }]}>
                              {comment.text || 'No text'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.emptyWrap}>
                      <Text style={[styles.emptyTitle, { color: COLORS.textPrimary }]}>
                        No comments yet
                      </Text>
                      <Text style={[styles.emptySubtitle, { color: COLORS.textSecondary }]}>
                        Start the conversation for this ping.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[styles.composer, { borderColor: COLORS.border }]}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Add a comment..."
                    placeholderTextColor={COLORS.textTertiary}
                    style={[styles.input, { color: COLORS.textPrimary }]}
                    multiline
                  />
                  <Pressable
                    style={[
                      styles.sendButton,
                      { backgroundColor: draft.trim() ? COLORS.primary : COLORS.border },
                    ]}
                    disabled={!draft.trim() || submitting || !user}
                    onPress={handleSubmit}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Send size={15} color="#FFFFFF" />
                    )}
                  </Pressable>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.36)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
    height: '86%',
  },
  sheetTopZone: {
    flexShrink: 0,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 10,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadCard: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadScroll: {
    flex: 1,
  },
  threadContent: {
    padding: 14,
    paddingBottom: 20,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentCopy: {
    flex: 1,
  },
  commentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  commentAuthor: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  commentTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  composer: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 110,
    fontSize: 15,
    paddingVertical: 4,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
