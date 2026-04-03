import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Pressable,
    Dimensions, ActivityIndicator, Alert, Modal,
    TextInput, KeyboardAvoidingView, Platform, Image, StatusBar, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useUser } from '@clerk/clerk-expo';
import { Heart, MessageCircle, Share2, Plus, ChevronLeft, X, Music, MoreHorizontal } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from './SharedUI';
import { useShareStore } from '../store/shareStore';
import {
    connectFeedsUser,
    getReelsFeed,
    addReel,
    deleteReel,
    toggleLike,
    uploadStreamFile,
    addComment,
    getComments,
    blockUser,
    reportContent
} from '../services/streamFeeds';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FRAME_WIDTH = SCREEN_WIDTH - 32;

interface Reel {
    id: string;
    user_id: string;
    user_name: string;
    user_image: string;
    caption: string;
    video_url: string;
    likes: number;
    liked_by: string[];
    reply_count: number;
    created_at: string;
}

function mapActivityToReel(activity: any): Reel {
    const custom = activity.custom || {};
    const attachments = activity.attachments || [];
    const media = attachments[0] || {};
    const actor = activity.actor || {};

    return {
        id: activity.id || Date.now().toString(),
        user_id: actor.id || activity.actor || '',
        user_name: actor.data?.name || custom.user_name || actor.id || 'Aggie',
        user_image: actor.data?.image || custom.user_image || '',
        caption: activity.text || '',
        video_url: media.asset_url || media.video_url || '',
        likes: activity.reaction_counts?.like || activity.reaction_count || 0,
        liked_by: (activity.own_reactions?.like || []).length > 0 ? [activity.own_reactions.like[0].user?.id || 'own'] : [],
        reply_count: activity.reaction_counts?.comment || 0,
        created_at: activity.time || activity.created_at || new Date().toISOString(),
    };
}

// Demo reels for when Stream Feed is missing
const DEMO_REELS: Reel[] = [
    {
        id: 'demo_1', user_id: 'demo', user_name: 'Aggie Life', user_image: '',
        caption: '🏟 Game day vibes at Kyle Field! #GigEm',
        video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        likes: 142, liked_by: [], reply_count: 5, created_at: new Date().toISOString(),
    },
    {
        id: 'demo_2', user_id: 'demo', user_name: 'TAMU Campus', user_image: '',
        caption: '📚 Late night study session at the Annex',
        video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        likes: 89, liked_by: [], reply_count: 2, created_at: new Date().toISOString(),
    },
];

function safelyPausePlayer(player: any) {
    if (!player?.pause) return;
    try {
        player.pause();
    } catch (error) {
        console.warn('[Reels] Ignoring pause failure on disposed player');
    }
}

function safelyPlayPlayer(player: any) {
    if (!player?.play) return;
    try {
        player.play();
    } catch (error) {
        console.warn('[Reels] Ignoring play failure on disposed player');
    }
}

const ReelItem = ({ 
    item, index, currentIndex, user, 
    handleLike, openComments, openEditReel, handleDeleteReel, 
    styles,
    mediaActive,
    layout,
    embedded = false,
    openShare,
    loadReels,
}: any) => {
    const isLiked = user ? item.liked_by.includes(user.id) : false;
    const isActive = index === currentIndex && mediaActive;
    const [playbackError, setPlaybackError] = useState<string | null>(null);

    const player = useVideoPlayer(item.video_url, p => {
        p.loop = true;
    });

    useEffect(() => {
        const subscription = player.addListener?.('statusChange', (event: any) => {
            if (event?.status === 'error') {
                setPlaybackError(event?.error?.message || 'Playback error');
            } else if (event?.status === 'readyToPlay') {
                setPlaybackError(null);
            }
        });

        return () => {
            subscription?.remove?.();
        };
    }, [player]);

    useEffect(() => {
        if (isActive) {
            safelyPlayPlayer(player);
        } else {
            safelyPausePlayer(player);
        }
    }, [isActive, player]);

    return (
        <View style={styles.reelContainer}>
            <View style={[styles.reelFrame, embedded && styles.reelFrameEmbedded]}>
                <VideoView
                    player={player}
                    style={styles.video}
                    contentFit="cover"
                    nativeControls={false}
                />

                {playbackError ? (
                    <View style={styles.videoErrorOverlay}>
                        <Text style={styles.videoErrorText}>This reel could not be played right now.</Text>
                    </View>
                ) : null}

                <View style={styles.rightActions}>
                    <View style={styles.rightActionItem}>
                        <Image
                            source={{ uri: item.user_image || 'https://via.placeholder.com/40' }}
                            style={styles.reelAvatar}
                        />
                    </View>

                    <Pressable style={styles.rightActionItem} onPress={() => handleLike(item.id)}>
                        <Heart color="#FFF" fill={isLiked ? '#FF453A' : 'transparent'} size={30} />
                        <Text style={styles.rightActionText}>{item.likes}</Text>
                    </Pressable>

                    <Pressable style={styles.rightActionItem} onPress={() => openComments(item)}>
                        <MessageCircle color="#FFF" size={28} />
                        <Text style={styles.rightActionText}>{item.reply_count}</Text>
                    </Pressable>

                    <Pressable 
                        style={styles.rightActionItem} 
                        onPress={() => openShare({
                            title: `Reel by @${item.user_name}`,
                            message: item.caption,
                            url: item.video_url
                        })}
                    >
                        <Share2 color="#FFF" size={26} />
                        <Text style={styles.rightActionText}>Share</Text>
                    </Pressable>

                    <Pressable 
                        style={styles.rightActionItem} 
                        onPress={() => {
                            Alert.alert('Moderation', 'What would you like to do?', [
                                { 
                                    text: 'Report Reel', 
                                    onPress: () => {
                                        Alert.alert('Report', 'Why are you reporting this?', [
                                            { 
                                              text: 'Inappropriate', 
                                              onPress: async () => {
                                                try {
                                                  await reportContent({
                                                    reporteeId: item.user_id,
                                                    postType: 'reel',
                                                    postId: item.id,
                                                    reason: 'inappropriate'
                                                  });
                                                  Alert.alert('Thank you', 'We will review this reel.');
                                                } catch (err) {
                                                  Alert.alert('Thank you', 'Report received.');
                                                }
                                              } 
                                            },
                                            { 
                                              text: 'Spam', 
                                              onPress: async () => {
                                                try {
                                                  await reportContent({
                                                    reporteeId: item.user_id,
                                                    postType: 'reel',
                                                    postId: item.id,
                                                    reason: 'spam'
                                                  });
                                                  Alert.alert('Thank you', 'We will review this reel.');
                                                } catch (err) {
                                                  Alert.alert('Thank you', 'Report received.');
                                                }
                                              } 
                                            },
                                            { text: 'Cancel', style: 'cancel' }
                                        ]);
                                    } 
                                },
                                { 
                                    text: 'Block User', 
                                    style: 'destructive', 
                                    onPress: async () => {
                                        try {
                                            await blockUser(item.user_id);
                                            loadReels?.(false);
                                            Alert.alert('User Blocked', 'You will no longer see content from this user.');
                                        } catch (err) {
                                            Alert.alert('Blocked', 'This user has been blocked.');
                                        }
                                    } 
                                },
                                { text: 'Cancel', style: 'cancel' }
                            ]);
                        }}
                    >
                        <MoreHorizontal color="#FFF" size={26} />
                        <Text style={styles.rightActionText}>More</Text>
                    </Pressable>

                    <View style={styles.musicDisc}>
                        <Music color="#FFF" size={16} />
                    </View>
                </View>

                <View style={styles.bottomInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={styles.reelUsername}>@{item.user_name}</Text>
                        {user?.id === item.user_id && (
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <Pressable onPress={() => openEditReel(item)}>
                                    <Plus color="#FFF" size={20} style={{ transform: [{ rotate: '45deg' }] }} />
                                </Pressable>
                                <Pressable onPress={() => handleDeleteReel(item.id)}>
                                    <X color="#FF453A" size={20} />
                                </Pressable>
                            </View>
                        )}
                    </View>
                    <Text style={styles.reelCaption} numberOfLines={3}>{item.caption}</Text>
                </View>
            </View>
        </View>
    );
};

export function ReelsScreen({ mediaActive = true, embedded = false, immersive = false }: { mediaActive?: boolean; embedded?: boolean; immersive?: boolean }) {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const { user } = useUser();
    const navigation = useNavigation<any>();
    const openShare = useShareStore(state => state.openShare);

    const [reels, setReels] = useState<Reel[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
    
    // Upload modal
    const [uploadModalVisible, setUploadModalVisible] = useState(false);
    const [uploadCaption, setUploadCaption] = useState('');
    const [uploadVideoUri, setUploadVideoUri] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [editingReelId, setEditingReelId] = useState<string | null>(null);
    const [streamError, setStreamError] = useState<string | null>(null);

    const uploadPlayer = useVideoPlayer(uploadVideoUri || '', p => {
        p.loop = true;
        p.muted = true;
    });

    // Comment Modal State
    const [commentModalVisible, setCommentModalVisible] = useState(false);
    const [commentPostId, setCommentPostId] = useState<string | null>(null);
    const [commentPostCaption, setCommentPostCaption] = useState('');
    const [comments, setComments] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);
    const [sendingComment, setSendingComment] = useState(false);

    useEffect(() => { 
        loadReels(true); 
        
        // Background poll — don't show loading spinner or reset scroll
        const interval = setInterval(() => {
            loadReels(false);
        }, 15000);
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        if (uploadVideoUri && uploadModalVisible && mediaActive) {
            safelyPlayPlayer(uploadPlayer);
        } else {
            safelyPausePlayer(uploadPlayer);
        }
    }, [mediaActive, uploadModalVisible, uploadPlayer, uploadVideoUri]);

    const loadReels = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        if (!user) {
            setReels(DEMO_REELS);
            setLoading(false);
            return;
        }

        try {
            connectFeedsUser(user);

            const activities = await getReelsFeed(30);
            const mapped = activities.map(mapActivityToReel).filter(r => r.video_url);
            setReels(mapped.length > 0 ? mapped : DEMO_REELS);
            setStreamError(null);
        } catch (e: any) {
            console.warn('[Reels] Stream fetch failed:', e);
            if (e.message?.includes('Feed group with ID "flat" not found')) {
                 setStreamError('The "flat" feed group needs to be created in the Stream Dashboard online first.');
            } else {
                 setStreamError('Failed to load Reels from Stream.');
            }
            setReels(DEMO_REELS); // Fallback to demos so page isn't empty 
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }, []);

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

    const handleLike = (reelId: string) => {
        if (!user || reelId.startsWith('demo_')) return;
        setReels(prev => prev.map(r => {
            if (r.id === reelId) {
                const isLiked = r.liked_by.includes(user.id);
                return { 
                    ...r, 
                    likes: isLiked ? r.likes - 1 : r.likes + 1,
                    liked_by: isLiked ? r.liked_by.filter(id => id !== user.id) : [...r.liked_by, user.id]
                };
            }
            return r;
        }));
        if (!streamError) toggleLike(reelId, user.id).catch(() => {});
    };

    const openComments = async (reel: Reel) => {
        setCommentPostId(reel.id);
        setCommentPostCaption(reel.caption);
        setCommentModalVisible(true);
        setLoadingComments(true);
        
        const result = await getComments(reel.id);
        setComments(result);
        setLoadingComments(false);
    };

    const openEditReel = (reel: Reel) => {
        setEditingReelId(reel.id);
        setUploadCaption(reel.caption);
        setUploadVideoUri(reel.video_url); // Preview existing
        setUploadModalVisible(true);
    };

    const handleDeleteReel = (reelId: string) => {
        Alert.alert("Delete Reel", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    setReels(prev => prev.filter(r => r.id !== reelId));
                    await deleteReel(reelId);
                } catch (e) {
                    Alert.alert('Error', 'Failed to delete');
                }
            }}
        ]);
    };

    const handleSendComment = async () => {
        if (!commentText.trim() || !commentPostId || !user) return;
        Keyboard.dismiss();
        setSendingComment(true);
        try {
            await addComment(commentPostId, user, commentText.trim());
            const updated = await getComments(commentPostId);
            setComments(updated);
            setCommentText('');
            // Update local state count
            setReels(prev => prev.map(r => r.id === commentPostId ? { ...r, reply_count: r.reply_count + 1 } : r));
        } catch (e) {
            console.warn('[Comments] Failed:', e);
            Alert.alert('Error', 'Could not post comment.');
        } finally {
            setSendingComment(false);
        }
    };

    const pickVideo = async () => {
        if (streamError) {
            Alert.alert("Stream Setup Required", streamError);
            return;
        }
        
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'],
            allowsEditing: true,
            quality: 0.7,
            videoMaxDuration: 60,
        });

        if (!result.canceled && result.assets[0]) {
            setUploadVideoUri(result.assets[0].uri);
            setUploadModalVisible(true);
        }
    };

    const handleUploadReel = async () => {
        if (!user || !uploadVideoUri) return;
        Keyboard.dismiss();
        setIsUploading(true);
        try {
            if (editingReelId && reels.find(r => r.id === editingReelId)) {
                // UPDATE
                setEditingReelId(null);
            } else {
                // CREATE
                const videoUrl = await uploadStreamFile(uploadVideoUri);
                await addReel({
                    userId: user.id,
                    userName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Aggie',
                    userImage: user.imageUrl,
                    caption: uploadCaption.trim() || undefined,
                    videoUrl: videoUrl,
                });
            }

            setUploadModalVisible(false);
            setUploadCaption('');
            setUploadVideoUri(null);
            // Larger delay for Stream distributed indexing
            setTimeout(() => {
                loadReels();
            }, 1500);
            
            Alert.alert('Success! 🎬', 'Your reel is now live!');
        } catch (e: any) {
            console.error('[Reels] Upload error:', e);
            Alert.alert('Upload Failed', e.message || 'Something went wrong.');
        } finally {
            setIsUploading(false);
        }
    };

    const renderReel = ({ item, index }: { item: Reel; index: number }) => (
        <ReelItem 
            item={item} 
            index={index} 
            currentIndex={currentIndex} 
            user={user} 
            handleLike={handleLike} 
            openComments={openComments} 
            openEditReel={openEditReel}
            handleDeleteReel={handleDeleteReel}
            styles={styles}
            mediaActive={mediaActive && !commentModalVisible && !uploadModalVisible}
            embedded={embedded}
            openShare={openShare}
            loadReels={loadReels}
        />
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator color="#FFF" size="large" />
                <Text style={styles.loadingText}>Loading Reels...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            {!embedded && !immersive ? <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft color="#FFF" size={28} />
                </Pressable>
                <Text style={styles.headerTitle}>Reels</Text>
                <Pressable onPress={pickVideo} style={[styles.cameraBtn, streamError && { opacity: 0.5 }]}>
                    <Plus color="#FFF" size={28} />
                </Pressable>
            </View> : null}

            {streamError && (
                <View style={{ position: 'absolute', top: 110, left: 20, right: 20, zIndex: 10, backgroundColor: 'rgba(255,59,48,0.9)', padding: 12, borderRadius: 12 }}>
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Stream API Error:</Text>
                    <Text style={{ color: '#FFF', fontSize: 13, marginTop: 4 }}>{streamError}</Text>
                </View>
            )}

            <FlatList
                data={reels}
                keyExtractor={item => item.id}
                renderItem={renderReel}
                pagingEnabled
                snapToInterval={SCREEN_HEIGHT}
                snapToAlignment="start"
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                getItemLayout={(_, index) => ({
                    length: SCREEN_HEIGHT,
                    offset: SCREEN_HEIGHT * index,
                    index,
                })}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews
            />

            <Modal visible={uploadModalVisible} animationType="slide" transparent>
                <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setUploadModalVisible(false); setUploadVideoUri(null); setEditingReelId(null); setUploadCaption(''); }}>
                    <View style={styles.uploadModalBg}>
                        <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                style={styles.uploadModalContent}
                            >
                        <View style={styles.uploadModalHeader}>
                            <Pressable onPress={() => { setUploadModalVisible(false); setUploadVideoUri(null); setEditingReelId(null); setUploadCaption(''); }}>
                                <Text style={styles.uploadCancelText}>Cancel</Text>
                            </Pressable>
                            <Text style={styles.uploadTitle}>{editingReelId ? 'Edit Reel' : 'New Reel'}</Text>
                            <Pressable onPress={handleUploadReel} disabled={isUploading}>
                                {isUploading ? (
                                    <ActivityIndicator color={COLORS.accent || COLORS.primary} size="small" />
                                ) : (
                                    <Text style={styles.uploadPostText}>Post</Text>
                                )}
                            </Pressable>
                        </View>

                        {uploadVideoUri && (
                            <VideoView
                                player={uploadPlayer}
                                style={styles.uploadPreview}
                                contentFit="contain"
                            />
                        )}

                        <TextInput
                            style={styles.uploadCaptionInput}
                            placeholder="Add a caption..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            multiline maxLength={200}
                            value={uploadCaption}
                            onChangeText={setUploadCaption}
                        />
                            </KeyboardAvoidingView>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Comment Modal */}
            <Modal visible={commentModalVisible} animationType="slide" transparent>
                <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setCommentModalVisible(false); }}>
                    <View style={[styles.uploadModalBg, { justifyContent: 'flex-end' }]}>
                        <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
                            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.uploadModalContent, { minHeight: '60%', padding: 0 }]}>
                        <View style={[styles.uploadModalHeader, { paddingHorizontal: 20, paddingTop: 20 }]}>
                            <Pressable onPress={() => setCommentModalVisible(false)}>
                                <X color="#FFF" size={24} />
                            </Pressable>
                            <Text style={styles.uploadTitle}>Comments</Text>
                            <View style={{ width: 24 }} />
                        </View>
                        
                        <FlatList
                            data={comments}
                            keyExtractor={(c: any) => c.id}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                            ListEmptyComponent={() => (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: '#DDD' }}>{loadingComments ? 'Loading...' : 'No comments yet. Be the first!'}</Text>
                                </View>
                            )}
                            renderItem={({ item }: { item: any }) => {
                                // Stream enriched user data is in item.user.data
                                const commenterName = item.user?.data?.name || item.data?.name || item.user?.name || item.user_id || item.user?.id || 'Aggie';
                                const commenterImage = item.user?.data?.image || item.data?.image || item.user?.image || null;
                                
                                return (
                                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
                                        <Image 
                                            source={{ uri: commenterImage || 'https://via.placeholder.com/40' }} 
                                            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} 
                                        />
                                        <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' }}>
                                            <Text style={{ color: '#E8922A', fontWeight: '900', fontSize: 13, marginBottom: 4 }}>{commenterName}</Text>
                                            <Text style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 18 }}>{item.data?.text || item.data?.comment || item.comment || item.text || ''}</Text>
                                        </View>
                                    </View>
                                );
                            }}
                        />

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#333', backgroundColor: '#1A1A1A' }}>
                            <Image source={{ uri: user?.imageUrl || 'https://via.placeholder.com/40' }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                            <TextInput
                                style={{ flex: 1, color: '#FFF', minHeight: 40, backgroundColor: '#2A2A2A', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 }}
                                placeholder="Add a comment..."
                                placeholderTextColor="#888"
                                multiline
                                value={commentText}
                                onChangeText={setCommentText}
                            />
                            <Pressable onPress={handleSendComment} disabled={sendingComment || !commentText.trim()}>
                                {sendingComment ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={{ color: '#FF453A', fontWeight: 'bold', fontSize: 16, opacity: !commentText.trim() ? 0.5 : 1 }}>Post</Text>}
                            </Pressable>
                        </View>
                            </KeyboardAvoidingView>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: 16 },
    loadingText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

    header: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 54, paddingBottom: 12, paddingHorizontal: 16,
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
    cameraBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

    reelContainer: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#000' },
    reelFrame: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        position: 'relative',
    },
    reelFrameEmbedded: {
        width: FRAME_WIDTH,
        alignSelf: 'center',
        borderRadius: 32,
        overflow: 'hidden',
    },
    video: { width: '100%', height: '100%' },
    videoErrorOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        paddingHorizontal: 32,
    },
    videoErrorText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },

    rightActions: { position: 'absolute', right: 12, bottom: 140, alignItems: 'center', gap: 20 },
    rightActionItem: { alignItems: 'center', gap: 4 },
    rightActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    reelAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFF', marginBottom: 8 },
    musicDisc: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    },

    bottomInfo: { position: 'absolute', bottom: 100, left: 16, right: 80 },
    reelUsername: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 6, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
    reelCaption: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

    uploadModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end' },
    uploadModalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 32, borderTopRightRadius: 32, minHeight: '70%', padding: 20 },
    uploadModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    uploadCancelText: { fontSize: 16, color: '#AAA' },
    uploadTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
    uploadPostText: { fontSize: 16, fontWeight: '700', color: COLORS.accent || '#FF453A' },
    uploadPreview: { width: '100%', height: 300, borderRadius: 16, marginBottom: 20, backgroundColor: '#000' },
    uploadCaptionInput: { fontSize: 16, color: '#FFFFFF', minHeight: 80, textAlignVertical: 'top' },
});
