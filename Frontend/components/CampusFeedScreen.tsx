import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, Pressable, 
    Image, TextInput, ActivityIndicator, Alert,
    Modal, TouchableWithoutFeedback, KeyboardAvoidingView, Platform
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { Camera, Image as ImageIcon, Video, Heart, MapPin, X, MoreHorizontal, MessageCircle, Calendar, Send, Film } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from './SharedUI';
import {
    connectFeedsUser,
    getCampusFeed,
    addPost,
    toggleLike,
    addComment,
    getComments,
    uploadStreamFile,
    uploadStreamImage,
    deletePost
} from '../services/streamFeeds';
import { Trash2 } from 'lucide-react-native';

interface Post {
    id: string;
    user_id: string;
    user_name: string;
    user_image: string | null;
    caption: string | null;
    media_url: string | null;
    media_type: 'image' | 'video' | null;
    location_tag: string | null;
    likes: number;
    liked_by: string[];
    reply_count: number;
    created_at: string;
    reaction_counts?: any;
    own_reactions?: any;
}

function mapActivityToPost(activity: any): Post {
    const custom = activity.custom || {};
    const attachments = activity.attachments || [];
    const media = attachments[0] || {};
    const actor = activity.actor || {};
    
    return {
        id: activity.id || Date.now().toString(),
        user_id: actor.id || activity.actor || '',
        user_name: custom.user_name || actor.data?.name || actor.id || 'Aggie',
        user_image: custom.user_image || actor.data?.image || null,
        caption: activity.text || null,
        media_url: media.image_url || media.asset_url || null,
        media_type: media.type === 'video' ? 'video' : (media.type === 'image' ? 'image' : null),
        location_tag: custom.location_tag || null,
        likes: activity.reaction_counts?.like || activity.reaction_count || 0,
        liked_by: (activity.own_reactions?.like || []).length > 0 ? [activity.own_reactions.like[0].user?.id || 'own'] : [],
        reply_count: activity.reaction_counts?.comment || 0,
        created_at: activity.time || activity.created_at || new Date().toISOString(),
        reaction_counts: activity.reaction_counts,
        own_reactions: activity.own_reactions,
    };
}

export function CampusFeedScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const { user } = useUser();
    const navigation = useNavigation<any>();
    
    const [posts, setPosts] = useState<Post[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [feedConnected, setFeedConnected] = useState(false);
    const [streamError, setStreamError] = useState<string | null>(null);
    
    // Create Post Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [caption, setCaption] = useState('');
    const [locationTag, setLocationTag] = useState('');
    const [mediaUri, setMediaUri] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [isPosting, setIsPosting] = useState(false);

    // Comment Modal State
    const [commentModalVisible, setCommentModalVisible] = useState(false);
    const [commentPostId, setCommentPostId] = useState<string | null>(null);
    const [commentPostCaption, setCommentPostCaption] = useState('');
    const [comments, setComments] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);
    const [sendingComment, setSendingComment] = useState(false);

    useEffect(() => {
        if (user) {
            connectFeedsUser(user.id, user.fullName || 'Aggie', user.imageUrl)
                .then(() => {
                    setFeedConnected(true);
                    setStreamError(null);
                    fetchPosts();
                })
                .catch((e) => {
                    console.warn('[CampusFeed] Stream connection failed:', e);
                    setStreamError('Could not connect to Stream Feeds.');
                    setLoading(false);
                });
        }
    }, [user]);

    const fetchPosts = async () => {
        try {
            const activities = await getCampusFeed(50);
            setPosts(activities.map(mapActivityToPost));
            setStreamError(null);
        } catch (e: any) {
            console.warn('[CampusFeed] Stream fetch failed:', e);
            if (e.message?.includes('Feed group with ID "flat" not found')) {
                 setStreamError('The "flat" feed group needs to be created in the Stream Dashboard online first.');
            } else {
                 setStreamError('Failed to load posts from Stream.');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        if (feedConnected) fetchPosts();
        else {
            setRefreshing(false);
        }
    };

    const pickMedia = async (type: 'Images' | 'Videos') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: type === 'Images' ? ['images'] : ['videos'],
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setMediaUri(result.assets[0].uri);
            setMediaType(type === 'Images' ? 'image' : 'video');
        }
    };

    const handlePost = async () => {
        if (!user || !feedConnected) return;
        const _captionTrimmed = caption.trim();
        if (!_captionTrimmed && !mediaUri) {
            Alert.alert("Empty Post", "Add a photo, video, or caption to post.");
            return;
        }

        setIsPosting(true);
        try {
            let uploadedMediaUrl = null;
            if (mediaUri && mediaType) {
                uploadedMediaUrl = await uploadStreamImage(mediaUri); // use Stream File Upload
            }

            await addPost({
                userId: user.id,
                userName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Aggie',
                userImage: user.imageUrl,
                caption: caption.trim() || undefined,
                mediaUrl: uploadedMediaUrl || undefined,
                mediaType: uploadedMediaUrl ? mediaType || undefined : undefined,
                locationTag: locationTag.trim() || undefined,
            });

            setModalVisible(false);
            setCaption('');
            setMediaUri(null);
            setMediaType(null);
            setLocationTag('');
            handleRefresh();
        } catch (e: any) {
            console.error(e);
            Alert.alert("Error", e.message || "Something went wrong posting to Stream.");
        } finally {
            setIsPosting(false);
        }
    };

    const handleToggleLike = async (postId: string) => {
        if (!user || !feedConnected) return;
        
        // Optimistic update
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                const isLiked = p.liked_by.includes(user.id);
                return {
                    ...p,
                    likes: isLiked ? p.likes - 1 : p.likes + 1,
                    liked_by: isLiked ? p.liked_by.filter(id => id !== user.id) : [...p.liked_by, user.id]
                };
            }
            return p;
        }));

        await toggleLike(postId, user.id).catch(() => handleRefresh());
    };

    const openComments = async (postId: string, postCaption: string) => {
        if (!feedConnected) return;
        setCommentPostId(postId);
        setCommentPostCaption(postCaption);
        setCommentModalVisible(true);
        setLoadingComments(true);
        
        const result = await getComments(postId);
        setComments(result);
        setLoadingComments(false);
    };

    const handleSendComment = async () => {
        if (!commentText.trim() || !commentPostId || !user || !feedConnected) return;
        setSendingComment(true);
        try {
            await addComment(commentPostId, commentText.trim());
            const updated = await getComments(commentPostId);
            setComments(updated);
            setCommentText('');
            // Optimistically update comment count
            setPosts(prev => prev.map(p => 
                p.id === commentPostId ? { ...p, reply_count: p.reply_count + 1 } : p
            ));
        } catch (e) {
            console.warn('[Comments] Failed:', e);
            Alert.alert('Error', 'Could not post comment.');
        } finally {
            setSendingComment(false);
        }
    };

    const handleDeletePost = (postId: string) => {
        Alert.alert(
            "Delete Post",
            "Are you sure you want to permanently delete this post?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setPosts(prev => prev.filter(p => p.id !== postId)); 
                            await deletePost(postId);
                        } catch (e) {
                            Alert.alert('Error', 'Could not delete the post.');
                            handleRefresh();
                        }
                    } 
                }
            ]
        );
    };

    const renderPost = ({ item }: { item: Post }) => {
        const isLiked = user ? item.liked_by.includes(user.id) : false;
        const date = new Date(item.created_at);
        const hoursAgo = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60));
        const timeStr = hoursAgo < 1 ? 'Just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo/24)}d ago`;

        return (
            <View style={styles.postCard}>
                <View style={styles.postHeader}>
                    <Image source={{ uri: item.user_image || 'https://via.placeholder.com/40' }} style={styles.avatar} />
                    <View style={styles.postHeaderText}>
                        <Text style={styles.postAuthor}>{item.user_name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.postTime}>{timeStr}</Text>
                            {item.location_tag && (
                                <>
                                    <Text style={styles.postTime}>•</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                        <MapPin color={COLORS.accent || COLORS.primary} size={10} />
                                        <Text style={styles.postLocation}>{item.location_tag}</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                    {item.user_id === user?.id ? (
                        <Pressable style={styles.moreBtn} onPress={() => handleDeletePost(item.id)}>
                            <Trash2 color="#FF453A" size={20} />
                        </Pressable>
                    ) : (
                        <Pressable style={styles.moreBtn}>
                            <MoreHorizontal color={COLORS.textSecondary} size={20} />
                        </Pressable>
                    )}
                </View>

                {item.caption && <Text style={styles.postCaption}>{item.caption}</Text>}

                {item.media_url && item.media_type === 'image' && (
                    <Image source={{ uri: item.media_url }} style={styles.postImage} />
                )}
                
                {item.media_url && item.media_type === 'video' && (
                    <View style={[styles.postImage, { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }]}>
                        <Video color="rgba(255,255,255,0.5)" size={48} />
                    </View>
                )}

                <View style={styles.postFooter}>
                    <Pressable style={styles.actionBtn} onPress={() => handleToggleLike(item.id)}>
                        <Heart color={isLiked ? '#FF453A' : COLORS.textSecondary} fill={isLiked ? '#FF453A' : 'transparent'} size={22} />
                        <Text style={[styles.actionText, isLiked && { color: '#FF453A' }]}>{item.likes}</Text>
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => openComments(item.id, item.caption || '')}>
                        <MessageCircle color={COLORS.textSecondary} size={22} />
                        <Text style={styles.actionText}>{item.reply_count} Replies</Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ width: 44 }} />
                <Text style={styles.headerTitle}>Campus Life</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => navigation.navigate('Reels')} style={styles.headerBtn}>
                        <Film color={COLORS.textPrimary} size={24} />
                    </Pressable>
                    <Pressable onPress={() => navigation.navigate('EventsCalendar')} style={styles.headerBtn}>
                        <Calendar color={COLORS.textPrimary} size={24} />
                    </Pressable>
                </View>
            </View>

            {loading ? (
                <View style={styles.centerFull}>
                    <ActivityIndicator color={COLORS.primary} size="large" />
                </View>
            ) : streamError ? (
                <View style={styles.centerFull}>
                    <Text style={[styles.emptySubtitle, { color: '#FF453A', marginBottom: 16 }]}>❗ Stream API Error</Text>
                    <Text style={[styles.emptySubtitle, { marginHorizontal: 30, marginBottom: 24 }]}>{streamError}</Text>
                    
                    <Pressable 
                        style={{ backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 }}
                        onPress={() => {
                            if (user) {
                                setLoading(true);
                                connectFeedsUser(user.id, true).then(() => {
                                    setFeedConnected(true);
                                    fetchPosts();
                                }).catch(() => setLoading(false));
                            }
                        }}
                    >
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Reconnect to Stream</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={item => item.id}
                    renderItem={renderPost}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Camera color={COLORS.border} size={48} strokeWidth={1.5} />
                            <Text style={styles.emptyTitle}>No posts yet</Text>
                            <Text style={styles.emptySubtitle}>Be the first to share what's happening on campus!</Text>
                        </View>
                    }
                />
            )}

            <Pressable style={styles.fab} onPress={() => setModalVisible(true)} disabled={!feedConnected || !!streamError}>
                <Camera color="#FFF" size={24} />
            </Pressable>

            {/* Create Post Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalBg}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Pressable onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </Pressable>
                            <Text style={styles.modalTitle}>New Post</Text>
                            <Pressable 
                                onPress={handlePost} 
                                disabled={Boolean(isPosting || (!caption.trim() && !mediaUri))}
                            >
                                {isPosting ? (
                                    <ActivityIndicator color={COLORS.primary} size="small" />
                                ) : (
                                    <Text style={[styles.modalPostText, (!caption.trim() && !mediaUri) ? { opacity: 0.5 } : {}]}>Post</Text>
                                )}
                            </Pressable>
                        </View>

                        <TextInput
                            style={styles.captionInput}
                            placeholder="What's happening on campus?"
                            placeholderTextColor={COLORS.textTertiary}
                            multiline maxLength={500}
                            value={caption}
                            onChangeText={setCaption}
                            autoFocus
                        />

                        {mediaUri && (
                            <View style={styles.mediaPreviewContainer}>
                                <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
                                <Pressable style={styles.removeMediaBtn} onPress={() => { setMediaUri(null); setMediaType(null); }}>
                                    <X color="#FFF" size={16} />
                                </Pressable>
                            </View>
                        )}

                        <View style={styles.actionBar}>
                            <View style={styles.mediaBtns}>
                                <Pressable style={styles.mediaBtn} onPress={() => pickMedia('Images')}>
                                    <ImageIcon color={COLORS.primary} size={22} />
                                </Pressable>
                                <Pressable style={styles.mediaBtn} onPress={() => pickMedia('Videos')}>
                                    <Video color={COLORS.primary} size={22} />
                                </Pressable>
                            </View>
                            
                            <View style={styles.locationInputWrapper}>
                                <MapPin color={COLORS.textSecondary} size={16} />
                                <TextInput
                                    style={styles.locationInput}
                                    placeholder="Add location (e.g. MSC)"
                                    placeholderTextColor={COLORS.textTertiary}
                                    value={locationTag}
                                    onChangeText={setLocationTag}
                                    maxLength={30}
                                />
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Comments Modal */}
            <Modal visible={commentModalVisible} animationType="slide" transparent>
                <View style={styles.modalBg}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.commentsModal}>
                        <View style={styles.commentsHeader}>
                            <Text style={styles.commentsTitle}>Comments</Text>
                            <Pressable onPress={() => { setCommentModalVisible(false); setComments([]); }}>
                                <X color={COLORS.textSecondary} size={24} />
                            </Pressable>
                        </View>

                        {commentPostCaption ? (
                            <View style={styles.commentOriginalPost}>
                                <Text style={styles.commentOriginalText} numberOfLines={2}>{commentPostCaption}</Text>
                            </View>
                        ) : null}

                        {loadingComments ? (
                            <View style={styles.centerFull}>
                                <ActivityIndicator color={COLORS.primary} />
                            </View>
                        ) : (
                            <FlatList
                                data={comments}
                                keyExtractor={(item, i) => item.id || String(i)}
                                style={{ flex: 1 }}
                                contentContainerStyle={{ paddingBottom: 16 }}
                                renderItem={({ item }) => (
                                    <View style={styles.commentRow}>
                                        <View style={styles.commentAvatar}>
                                            <Text style={styles.commentAvatarText}>{(item.user?.id || 'A').slice(0, 2).toUpperCase()}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.commentUser}>{item.user?.id || 'Aggie'}</Text>
                                            <Text style={styles.commentBody}>{item.comment || item.text || ''}</Text>
                                        </View>
                                    </View>
                                )}
                                ListEmptyComponent={
                                    <View style={styles.emptyState}>
                                        <Text style={styles.emptySubtitle}>No comments yet. Be the first!</Text>
                                    </View>
                                }
                            />
                        )}

                        <View style={styles.commentInputRow}>
                            <TextInput
                                style={styles.commentInput}
                                placeholder="Write a comment..."
                                placeholderTextColor={COLORS.textTertiary}
                                value={commentText}
                                onChangeText={setCommentText}
                                maxLength={300}
                            />
                            <Pressable 
                                style={[styles.commentSendBtn, !commentText.trim() && { opacity: 0.5 }]} 
                                onPress={handleSendComment}
                                disabled={!commentText.trim() || sendingComment}
                            >
                                {sendingComment ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <Send color="#FFF" size={18} />
                                )}
                            </Pressable>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.background, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
    headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
    centerFull: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingBottom: 100 },
    
    postCard: { backgroundColor: COLORS.background, paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceElevated || COLORS.surface, marginRight: 12 },
    postHeaderText: { flex: 1 },
    postAuthor: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
    postTime: { fontSize: 13, color: COLORS.textSecondary },
    postLocation: { fontSize: 12, fontWeight: '600', color: COLORS.accent || COLORS.primary },
    moreBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    
    postCaption: { fontSize: 15, color: '#FFFFFF', lineHeight: 22, marginBottom: 12 },
    postImage: { width: '100%', height: 250, borderRadius: 16, marginBottom: 16, backgroundColor: COLORS.surfaceElevated || COLORS.surface },
    
    postFooter: { flexDirection: 'row', gap: 24, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
    
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 16, marginBottom: 8 },
    emptySubtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
    
    fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 8 },
    
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, minHeight: '80%', padding: 20 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 16 },
    modalCancelText: { fontSize: 16, color: COLORS.textSecondary },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
    modalPostText: { fontSize: 16, fontWeight: '700', color: COLORS.accent || COLORS.primary },
    modalCloseBtn: { paddingVertical: 4 },
    captionInput: { fontSize: 17, color: '#FFFFFF', minHeight: 120, textAlignVertical: 'top', marginBottom: 20 },
    mediaPreviewContainer: { position: 'relative', marginBottom: 20 },
    mediaPreview: { width: '100%', height: 200, borderRadius: 16, backgroundColor: COLORS.surfaceElevated || COLORS.surface },
    removeMediaBtn: { position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
    mediaBtns: { flexDirection: 'row', gap: 16 },
    mediaBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(80,0,0,0.15)', alignItems: 'center', justifyContent: 'center' },
    locationInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, paddingHorizontal: 12, height: 40, borderRadius: 20, gap: 8, flex: 1, marginLeft: 16 },
    locationInput: { flex: 1, color: '#FFFFFF', fontSize: 14 },

    commentsModal: { backgroundColor: COLORS.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '75%', minHeight: '50%' },
    commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    commentsTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
    commentOriginalPost: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: 'rgba(80,0,0,0.1)' },
    commentOriginalText: { fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic' },
    commentRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
    commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    commentAvatarText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    commentUser: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
    commentBody: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
    commentInputRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 10, alignItems: 'center' },
    commentInput: { flex: 1, backgroundColor: COLORS.background, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#FFFFFF', fontSize: 14 },
    commentSendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }
});
