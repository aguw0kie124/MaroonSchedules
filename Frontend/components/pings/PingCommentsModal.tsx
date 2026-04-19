import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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
import { MessageCircle, Send, X, ArrowUp, ArrowDown, CornerDownRight } from 'lucide-react-native';
import { addComment, getComments, toggleVote } from '../../services/socialFeedService';
import { useTheme } from '../SharedUI';
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../../config';
import { resolveDisplayName } from '../../utils/userUtils';

type PingComment = {
  id: string;
  text: string;
  createdAt: string;
  userName: string;
  parentId?: string | null;
  score: number;
  ownVote?: 'upvote' | 'downvote' | null;
  replies?: PingComment[];
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

function mapRawComment(comment: any, currentUser: any, userMap: Map<string, string>): PingComment {
  const userId = String(comment?.user_id ?? comment?.user?.id ?? '').replace('SU:', '');
  const rawName = String(comment?.user?.name ?? comment?.data?.name ?? 'Aggie User');

  const ownReactions = comment?.own_reactions || {};
  let ownVote: 'upvote' | 'downvote' | null = null;
  if (ownReactions.upvote) ownVote = 'upvote';
  else if (ownReactions.downvote) ownVote = 'downvote';

  const counts = comment?.reaction_counts || {};
  const score = (counts.upvote || 0) - (counts.downvote || 0);

  return {
    id: String(comment?.id ?? `${comment?.created_at ?? Date.now()}`),
    text: String(comment?.data?.text ?? comment?.data?.comment ?? comment?.text ?? comment?.data?.body ?? ''),
    createdAt: String(comment?.created_at ?? new Date().toISOString()),
    userName: resolveDisplayName(userId, rawName, currentUser, userMap),
    parentId: comment?.parent_id,
    score,
    ownVote,
    replies: [],
  };
}

export function PingCommentsModal({
  visible,
  target,
  onClose,
  onCommentPosted,
}: PingCommentsModalProps) {
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.86);
  const SHEET_TOP_SNAP = 0;
  const SHEET_MID_SNAP = SHEET_TOP_SNAP; // No mid snap, show full height to see composer
  const SHEET_HIDDEN_SNAP = SHEET_HEIGHT + 32;
  const { COLORS } = useTheme();
  const { user } = useUser();

  const [comments, setComments] = React.useState<PingComment[]>([]);
  const [draft, setDraft] = React.useState('');
  const [replyingTo, setReplyingTo] = React.useState<PingComment | null>(null);
  const [expandedThreads, setExpandedThreads] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(visible);
  const isClosingRef = React.useRef(false);
  const sheetY = React.useRef(new Animated.Value(SHEET_HIDDEN_SNAP)).current;
  const sheetSnap = React.useRef<number>(SHEET_HIDDEN_SNAP);
  const panStartY = React.useRef<number>(SHEET_HIDDEN_SNAP);
  const scrollOffsetY = React.useRef(0);
  const [sheetMode, setSheetMode] = React.useState<'hidden' | 'mid' | 'top'>('hidden');
  const inputRef = React.useRef<TextInput>(null);

  const { data: userProfiles = [] } = useQuery({
    queryKey: ['campus-chat-directory', API_URL],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_URL}/chat/users`);
        if (!res.ok) return [];
        return await res.json();
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 30, // 30 mins
  });

  const userMap = React.useMemo(() => {
    const m = new Map<string, string>();
    userProfiles.forEach((u: any) => {
      if (u.id && u.name) m.set(u.id, u.name);
    });
    return m;
  }, [userProfiles]);

  const loadComments = React.useCallback(async () => {
    const activityId = target?.activityId;
    if (!activityId) return;

    setLoading(true);
    try {
      const resp = await getComments(activityId);
      if (!Array.isArray(resp)) {
        setComments([]);
        return;
      }

      const all: PingComment[] = resp.map(c => mapRawComment(c, user, userMap));
      
      // Grouping: strictly one level deep for now (parent -> reply)
      const roots = all.filter(c => !c.parentId);
      const children = all.filter(c => !!c.parentId);
      
      const thread = roots.map(root => ({
        ...root,
        replies: children.filter(child => child.parentId === root.id).reverse() // Sort replies chronologically
      }));

      setComments(thread);
    } catch (error) {
      console.warn('[Comments] load failed', error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [target?.activityId, user, userMap]);

  React.useEffect(() => {
    if (!visible || !target?.activityId) return;
    loadComments();
  }, [loadComments, target?.activityId, visible]);

  React.useEffect(() => {
    if (visible) {
      setIsMounted(true);
      isClosingRef.current = false;
      scrollOffsetY.current = 0;
      sheetSnap.current = SHEET_HIDDEN_SNAP;
      setSheetMode('hidden');
      sheetY.setValue(SHEET_HIDDEN_SNAP);
      Animated.spring(sheetY, {
        toValue: SHEET_TOP_SNAP,
        useNativeDriver: true,
        damping: 30,
        stiffness: 260,
        mass: 0.92,
      }).start(() => {
        sheetSnap.current = SHEET_TOP_SNAP;
        setSheetMode('top');
      });
      return;
    }
    if (!visible) {
      setDraft('');
      // Delayed unmounting to allow closing animation to complete
      const timer = setTimeout(() => {
        setIsMounted(false);
        setReplyingTo(null);
        setExpandedThreads(new Set());
        setComments([]);
        setLoading(false);
        setSubmitting(false);
        setSheetMode('hidden');
        sheetSnap.current = SHEET_HIDDEN_SNAP;
        sheetY.setValue(SHEET_HIDDEN_SNAP);
      }, 300); // Matches animation duration
      
      return () => clearTimeout(timer);
    }
  }, [SHEET_HIDDEN_SNAP, SHEET_MID_SNAP, sheetY, visible]);

  const backdropOpacity = sheetY.interpolate({
    inputRange: [SHEET_TOP_SNAP, SHEET_MID_SNAP, SHEET_HIDDEN_SNAP],
    outputRange: [1, 0.88, 0],
    extrapolate: 'clamp',
  });

  const animateSheet = React.useCallback((toValue: number, onDone?: () => void) => {
    sheetSnap.current = toValue;
    setSheetMode(
      toValue === SHEET_TOP_SNAP ? 'top' : toValue === SHEET_MID_SNAP ? 'mid' : 'hidden',
    );
    Animated.spring(sheetY, {
      toValue,
      useNativeDriver: true,
      damping: 30,
      stiffness: 260,
      mass: 0.92,
    }).start(() => {
      if (onDone) onDone();
    });
  }, [SHEET_HIDDEN_SNAP, SHEET_MID_SNAP, SHEET_TOP_SNAP, sheetY]);

  const closeSheet = React.useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    animateSheet(SHEET_HIDDEN_SNAP, onClose);
  }, [SHEET_HIDDEN_SNAP, animateSheet, onClose]);

  const beginGesture = React.useCallback(() => {
    panStartY.current = sheetSnap.current;
    sheetY.stopAnimation();
  }, [sheetY]);

  const moveGesture = React.useCallback((dy: number) => {
    const next = Math.max(
      SHEET_TOP_SNAP,
      Math.min(SHEET_HIDDEN_SNAP, panStartY.current + dy),
    );
    sheetY.setValue(next);
  }, [SHEET_HIDDEN_SNAP, SHEET_TOP_SNAP, sheetY]);

  const settleGesture = React.useCallback((dy: number, vy: number) => {
    const liveY = panStartY.current + dy;
    if (vy < -1.0) {
      animateSheet(SHEET_TOP_SNAP);
      return;
    }
    if (vy > 1.0) {
      if (liveY > SHEET_MID_SNAP + 80) {
        closeSheet();
      } else {
        animateSheet(SHEET_MID_SNAP);
      }
      return;
    }

    const topMidThreshold = (SHEET_TOP_SNAP + SHEET_MID_SNAP) / 2;
    const midHiddenThreshold = (SHEET_MID_SNAP + SHEET_HIDDEN_SNAP) / 2;

    if (liveY <= topMidThreshold) {
      animateSheet(SHEET_TOP_SNAP);
    } else if (liveY >= midHiddenThreshold) {
      closeSheet();
    } else {
      animateSheet(SHEET_MID_SNAP);
    }
  }, [SHEET_HIDDEN_SNAP, SHEET_MID_SNAP, SHEET_TOP_SNAP, animateSheet, closeSheet]);

  const bodyPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          gestureState.dy > 6 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
          scrollOffsetY.current <= 0,
        onPanResponderGrant: beginGesture,
        onPanResponderMove: (_, gestureState) => moveGesture(Math.max(0, gestureState.dy)),
        onPanResponderRelease: (_, gestureState) =>
          settleGesture(Math.max(0, gestureState.dy), gestureState.vy),
        onPanResponderTerminate: () => animateSheet(sheetSnap.current),
      }),
    [animateSheet, beginGesture, moveGesture, settleGesture],
  );

  const headerPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 6 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: beginGesture,
        onPanResponderMove: (_, gestureState) => moveGesture(gestureState.dy),
        onPanResponderRelease: (_, gestureState) =>
          settleGesture(gestureState.dy, gestureState.vy),
        onPanResponderTerminate: () => animateSheet(sheetSnap.current),
      }),
    [animateSheet, beginGesture, moveGesture, settleGesture],
  );

  const handleSubmit = React.useCallback(async () => {
    if (!target?.activityId || !draft.trim() || !user) return;

    setSubmitting(true);
    try {
      await addComment(target.activityId, user, draft.trim(), replyingTo?.id);
      setDraft('');
      setReplyingTo(null);
      await loadComments();
      onCommentPosted?.();
    } catch (error) {
      console.warn('[Comments] submit failed', error);
    } finally {
      setSubmitting(false);
    }
  }, [draft, loadComments, onCommentPosted, replyingTo?.id, target?.activityId, user]);

  const handleReply = React.useCallback((comment: PingComment) => {
    // If replying to a reply, use the root parent ID to keep it in the same thread (one-level deep)
    const target = {
      ...comment,
      id: comment.parentId || comment.id
    };
    setReplyingTo(target);
    inputRef.current?.focus();
  }, []);

  const handleVoteAction = React.useCallback(async (commentId: string, type: 'upvote' | 'downvote') => {
    if (!target?.activityId || !user) return;
    try {
      await toggleVote(target.activityId, type, commentId);
      await loadComments();
    } catch (error) {
      console.warn('[Comments] vote failed', error);
    }
  }, [loadComments, target?.activityId, user]);

  const toggleThread = React.useCallback((commentId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }, []);

  const renderComment = (comment: PingComment, isReply = false) => {
    const isMe = comment.userName === resolveDisplayName(user?.id || '', '', user, userMap); // Rough check
    
    return (
      <View
        key={comment.id}
        style={[
          styles.commentRow,
          { 
            flexDirection: isMe ? 'row-reverse' : 'row',
            marginLeft: isReply && !isMe ? 42 : (isReply && isMe ? 0 : 0),
            marginRight: isReply && isMe ? 42 : 0,
          }
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: isMe ? '#F7533E20' : '#34C75915' }]}>
          <Text style={{ fontSize: 10, fontWeight: '900', color: isMe ? '#F7533E' : '#34C759' }}>
            {comment.userName.charAt(0)}
          </Text>
        </View>
        <View style={[styles.commentBubble, isMe ? styles.userBubble : styles.othersBubble]}>
          {!isMe && (
            <Text style={[styles.commentAuthor, { color: COLORS.textPrimary, marginBottom: 2 }]}>
              {comment.userName}
            </Text>
          )}
          <Text style={[styles.commentText, { color: isMe ? COLORS.textPrimary : COLORS.textPrimary }]}>
            {comment.text || 'No text'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 10 }}>
             <Text style={[styles.commentTime, { color: COLORS.textTertiary, fontSize: 10 }]}>
               {formatCommentTime(comment.createdAt)}
             </Text>
             <Pressable onPress={() => handleReply(comment)}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: COLORS.primary }}>Reply</Text>
             </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={isMounted} animationType="none" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet}>
          <Animated.View pointerEvents="none" style={[styles.backdropScrim, { opacity: backdropOpacity }]} />
        </Pressable>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardWrap}
          pointerEvents="box-none"
        >
          <Animated.View
            {...bodyPanResponder.panHandlers}
            style={[
              styles.card,
              {
                backgroundColor: COLORS.surface,
                height: SHEET_HEIGHT,
                transform: [{ translateY: sheetY }],
              },
            ]}
          >
            <View style={styles.sheetTopZone} {...headerPanResponder.panHandlers}>
                  <View style={styles.handleWrap}>
                    <View style={[styles.handle, { backgroundColor: COLORS.border }]} />
                  </View>
                  <View style={styles.header}>
                    <View style={styles.headerCopy}>
                      <Text style={[styles.title, { color: COLORS.textPrimary }]} numberOfLines={2}>
                        {target?.title || 'Comments'}
                      </Text>
                      <Text style={[styles.subtitle, { color: COLORS.textSecondary }]} numberOfLines={2}>
                        {target?.commentCount === 1 ? '1 comment' : `${target?.commentCount || 0} comments`} • {target?.subtitle}
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
                  scrollEnabled={sheetMode === 'top'}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={(event) => {
                    scrollOffsetY.current = event.nativeEvent.contentOffset.y;
                  }}
                >
                  {comments.map((root) => {
                    const isExpanded = expandedThreads.has(root.id);
                    const allReplies = root.replies || [];
                    const visibleReplies = isExpanded ? allReplies : allReplies.slice(0, 3);
                    const hasMore = allReplies.length > 3;

                    return (
                      <View key={root.id}>
                        {renderComment(root)}
                        {visibleReplies.map(child => renderComment(child, true))}
                        
                        {hasMore && (
                          <Pressable 
                            onPress={() => toggleThread(root.id)}
                            style={styles.viewMoreReplies}
                          >
                            <CornerDownRight size={14} color={COLORS.primary} />
                            <Text style={[styles.viewMoreText, { color: COLORS.primary }]}>
                              {isExpanded 
                                ? 'Show fewer replies' 
                                : `View ${allReplies.length - 3} more replies...`
                              }
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
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

            <View style={[styles.composerWrap, { borderColor: COLORS.border }]}>
              {replyingTo && (
                <View style={[styles.replyHeader, { borderBottomColor: COLORS.border }]}>
                  <CornerDownRight size={12} color={COLORS.textTertiary} />
                  <Text style={[styles.replyToText, { color: COLORS.textTertiary }]}>
                    Replying to <Text style={{ fontWeight: '700' }}>{replyingTo.userName}</Text>
                  </Text>
                  <Pressable onPress={() => setReplyingTo(null)} style={styles.replyCancel}>
                    <X size={14} color={COLORS.textTertiary} />
                  </Pressable>
                </View>
              )}
              <View style={styles.composer}>
                <TextInput
                  ref={inputRef}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
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
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
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
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  commentBubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
  },
  othersBubble: {
    backgroundColor: '#E0F2F1', // Light teal/mint
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#FFFFFF', // Pure white bubble
    borderTopRightRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
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
  composerWrap: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  replyToText: {
    flex: 1,
    fontSize: 12,
  },
  replyCancel: {
    padding: 2,
  },
  composer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    marginBottom: 2,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  voteGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  voteBtn: {
    padding: 6,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  actionLink: {
    paddingVertical: 4,
  },
  actionLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  viewMoreReplies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 46,
    paddingVertical: 10,
    marginBottom: 8,
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
