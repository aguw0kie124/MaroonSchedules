import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, Bot, SquarePen, UtensilsCrossed } from 'lucide-react-native';

import { useTheme } from './SharedUI';
import { ScalePressable } from './common/Motion';
import {
  askAssistant,
  streamAssistant,
  GREETING,
  SUGGESTION_CHIPS,
  type AssistantHistoryTurn,
  type AssistantReply,
} from '../services/assistantService';

// Maroon tint used for AI-bubble accents (the light theme's primaryLight is white).
const MAROON_TINT = '#FFE5E5';
const SUCCESS = '#34C759';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text?: string;
  reply?: AssistantReply;
}

/** Renders text with lightweight **bold** markers in maroon. */
function RichText({
  text,
  baseStyle,
  boldColor,
}: {
  text: string;
  baseStyle: any;
  boldColor: string;
}) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={baseStyle}>
      {segments.map((seg, i) =>
        seg.startsWith('**') && seg.endsWith('**') ? (
          <Text key={i} style={{ fontWeight: '700', color: boldColor }}>
            {seg.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{seg}</Text>
        ),
      )}
    </Text>
  );
}

function TypingDots({ color }: { color: string }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = dots.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(value, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={styles.typingRow}>
      {dots.map((value, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              backgroundColor: color,
              opacity: value,
              transform: [
                { translateY: value.interpolate({ inputRange: [0.3, 1], outputRange: [0, -3] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function AssistantScreen() {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const idRef = useRef(1);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'greeting', role: 'ai', reply: GREETING },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  // Which AI message is currently receiving stream events (drives the inline
  // typing indicator inside that specific bubble).
  const [streamingId, setStreamingId] = useState<string | null>(null);

  const nextId = () => `m${idRef.current++}`;

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, sending, scrollToEnd]);

  const submit = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || sending) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Last ~8 turns, text only (cards/course lists aren't useful as context).
      const history: AssistantHistoryTurn[] = messages
        .filter((m) => (m.role === 'user' ? !!m.text : !!m.reply?.text))
        .slice(-8)
        .map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: (m.role === 'user' ? m.text : m.reply?.text) || '',
        }));

      setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);
      setInput('');
      setSending(true);

      const aiId = nextId();
      setStreamingId(aiId);
      setMessages((prev) => [...prev, { id: aiId, role: 'ai' }]);

      let deltaStarted = false;
      try {
        await streamAssistant(text, history, (event) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== aiId) return m;
              if (event.type === 'status') {
                // Once real content starts arriving, ignore any further status text.
                return deltaStarted ? m : { ...m, reply: { text: event.text } };
              }
              if (event.type === 'delta') {
                const prevText = deltaStarted ? m.reply?.text || '' : '';
                deltaStarted = true;
                return { ...m, reply: { text: prevText + event.text } };
              }
              // done — replaces whatever partial text/status was showing
              return { ...m, reply: { text: event.text, card: event.card, courses: event.courses } };
            }),
          );
        });
      } catch (err) {
        console.error('RevAI stream failed, falling back:', err);
        try {
          const reply = await askAssistant(text, history);
          setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, reply } : m)));
        } catch (err2) {
          console.error('RevAI request failed:', err2);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, reply: { text: "Sorry — I couldn't reach campus data just now. Try again in a moment." } }
                : m,
            ),
          );
        }
      } finally {
        setSending(false);
        setStreamingId(null);
      }
    },
    [input, sending, messages],
  );

  const startNewChat = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Keyboard.dismiss();
    setMessages([{ id: 'greeting', role: 'ai', reply: GREETING }]);
    setInput('');
    setSending(false);
  }, []);

  const canSend = input.trim().length > 0 && !sending;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: COLORS.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header — matches Campus Pulse */}
      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top + 8, 18) }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleRow}>
            <View style={[styles.heroBrandBadge, { backgroundColor: COLORS.surfaceElevated, borderColor: COLORS.border }]}>
              <Bot size={14} color={COLORS.textPrimary} />
            </View>
            <Text style={[styles.heroTitle, { color: COLORS.textPrimary }]}>RevAI</Text>
          </View>
          <Pressable
            style={[styles.composeFab, { backgroundColor: COLORS.surfaceElevated, borderColor: COLORS.border }]}
            onPress={startNewChat}
            accessibilityLabel="New chat"
          >
            <SquarePen size={18} color={COLORS.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Thread */}
      <ScrollView
        ref={scrollRef}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.daystamp, { color: COLORS.textTertiary }]}>Today</Text>

        {messages.map((msg) =>
          msg.role === 'user' ? (
            <View key={msg.id} style={[styles.row, styles.rowMe]}>
              <View style={[styles.bubble, styles.bubbleMe, { backgroundColor: COLORS.primary }]}>
                <Text style={[styles.bubbleText, { color: '#FFFFFF' }]}>{msg.text}</Text>
              </View>
            </View>
          ) : (
            <View key={msg.id} style={[styles.row, styles.rowAi]}>
              <View
                style={[
                  styles.bubble,
                  styles.bubbleAi,
                  { backgroundColor: COLORS.surface, borderColor: COLORS.border },
                ]}
              >
                {!!msg.reply?.text ? (
                  <RichText
                    text={msg.reply.text}
                    baseStyle={[styles.bubbleText, { color: COLORS.textPrimary }]}
                    boldColor={COLORS.primary}
                  />
                ) : (
                  msg.id === streamingId && <TypingDots color={COLORS.textTertiary} />
                )}

                {/* Inline status card (e.g. dining hours) */}
                {!!msg.reply?.card && (
                  <View style={[styles.infoCard, { backgroundColor: COLORS.background, borderColor: COLORS.border }]}>
                    <View style={styles.infoTop}>
                      <View style={[styles.infoIcon, { backgroundColor: MAROON_TINT }]}>
                        <UtensilsCrossed size={18} color={COLORS.primary} />
                      </View>
                      <Text style={[styles.infoName, { color: COLORS.textPrimary }]} numberOfLines={1}>
                        {msg.reply.card.name}
                      </Text>
                    </View>
                    <View style={styles.infoHrs}>
                      <Text style={[styles.infoDetail, { color: COLORS.textSecondary }]} numberOfLines={1}>
                        {msg.reply.card.detail}
                      </Text>
                      {!!msg.reply.card.status && (
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor:
                                msg.reply.card.status.tone === 'open'
                                  ? 'rgba(52,199,89,0.14)'
                                  : 'rgba(142,142,147,0.16)',
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              { backgroundColor: msg.reply.card.status.tone === 'open' ? SUCCESS : COLORS.textTertiary },
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusText,
                              { color: msg.reply.card.status.tone === 'open' ? '#1C7D3E' : COLORS.textSecondary },
                            ]}
                          >
                            {msg.reply.card.status.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Inline course / professor list */}
                {!!msg.reply?.courses?.length && (
                  <View style={styles.courseList}>
                    {msg.reply.courses.map((course, i) => (
                      <View key={i} style={[styles.courseRow, { backgroundColor: COLORS.background }]}>
                        <Text style={[styles.courseCode, { color: COLORS.primary, backgroundColor: MAROON_TINT }]}>
                          {course.code}
                        </Text>
                        <Text style={[styles.courseName, { color: COLORS.textPrimary }]} numberOfLines={1}>
                          {course.name}
                        </Text>
                        <Text style={[styles.courseMeta, { color: COLORS.textSecondary }]}>{course.meta}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ),
        )}
      </ScrollView>

      {/* Composer */}
      <View style={[styles.composer, { backgroundColor: COLORS.surface, borderTopColor: COLORS.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {SUGGESTION_CHIPS.map((chip) => (
            <ScalePressable
              key={chip}
              style={[styles.chip, { borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated }]}
              onPress={() => submit(chip)}
            >
              <Text style={[styles.chipText, { color: COLORS.textPrimary }]}>{chip}</Text>
            </ScalePressable>
          ))}
        </ScrollView>

        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={[styles.field, { backgroundColor: COLORS.background, borderColor: COLORS.border }]}>
            <TextInput
              style={[styles.input, { color: COLORS.textPrimary }]}
              placeholder="Ask anything…"
              placeholderTextColor={COLORS.textTertiary}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => submit()}
              returnKeyType="send"
              autoCapitalize="sentences"
              autoCorrect
            />
          </View>
          <Pressable
            onPress={() => submit()}
            disabled={!canSend}
            style={[styles.send, { backgroundColor: canSend ? COLORS.primary : '#C9B7B7' }]}
            accessibilityLabel="Send message"
          >
            <ArrowUp size={22} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header — mirrors Campus Pulse (heroTopRow / heroBrandBadge / composeFab)
  headerWrap: { paddingHorizontal: 14, paddingBottom: 12 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroBrandBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8 },
  composeFab: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  thread: { flex: 1 },
  threadContent: { padding: 16, paddingBottom: 8, gap: 12 },
  daystamp: { alignSelf: 'center', fontSize: 12, fontWeight: '600', marginBottom: 2 },

  row: { flexDirection: 'row', width: '100%' },
  rowAi: { justifyContent: 'flex-start' },
  rowMe: { justifyContent: 'flex-end' },

  bubble: { maxWidth: '82%', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 20 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleAi: {
    borderWidth: 1,
    borderBottomLeftRadius: 7,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bubbleMe: {
    borderBottomRightRadius: 7,
    shadowColor: '#500000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typingDot: { width: 8, height: 8, borderRadius: 4 },

  // Info card
  infoCard: { marginTop: 10, borderWidth: 1, borderRadius: 14, padding: 11, gap: 8 },
  infoTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  infoIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  infoName: { flex: 1, fontSize: 14, fontWeight: '700' },
  infoHrs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingLeft: 47, marginTop: -2 },
  infoDetail: { flex: 1, fontSize: 12.5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11.5, fontWeight: '700' },

  // Course list
  courseList: { marginTop: 9, gap: 7 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 11 },
  courseCode: { fontSize: 13, fontWeight: '800', borderRadius: 7, paddingVertical: 3, paddingHorizontal: 7, overflow: 'hidden' },
  courseName: { flex: 1, fontSize: 13.5, fontWeight: '500' },
  courseMeta: { fontSize: 12.5, fontWeight: '700' },

  // Composer
  composer: { borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 10 },
  chips: { gap: 8, paddingBottom: 11, paddingRight: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 12 },
  chipText: { fontSize: 13, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 23, paddingLeft: 16, paddingRight: 6, minHeight: 46 },
  input: { flex: 1, fontSize: 15.5, paddingVertical: 12 },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#500000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
