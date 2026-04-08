import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import { WebView } from 'react-native-webview';
import {
    ArrowLeft,
    BriefcaseBusiness,
    GraduationCap,
    RefreshCw,
    ShieldCheck,
    Unplug,
    Wallet,
} from 'lucide-react-native';

import { useTheme } from './SharedUI';
import {
    captureCampusConnector,
    deleteCampusConnector,
    fetchCampusConnectors,
} from '../api/client';
import { useCampusHubStore } from '../store/campusHubStore';

type RouteParams = {
    systemId?: string;
    label?: string;
    loginUrl?: string;
    dataScope?: string;
    sourceUrl?: string | null;
};

const CONNECTOR_META: Record<string, {
    label: string;
    loginUrl: string;
    description: string;
    accent: string;
    Icon: any;
}> = {
    howdy: {
        label: 'Howdy Portal',
        loginUrl: 'https://howdy.tamu.edu/main/home/card-view',
        description: 'Capture schedule, GPA, holds, and registration data from your signed-in Howdy page.',
        accent: '#800000',
        Icon: GraduationCap,
    },
    transact: {
        label: 'Transact eAccounts',
        loginUrl: 'https://eacct-tamu-sp.transactcampus.com/eAccounts/BoardTransaction.aspx',
        description: 'Capture meal-plan balances and recent transactions from your dining account.',
        accent: '#A15C00',
        Icon: Wallet,
    },
    symplicity: {
        label: 'Hire Aggies',
        loginUrl: 'https://tamu-csm.symplicity.com/students/index.php?signin_tab=0',
        description: 'Capture job, employer, and career-event context from your Symplicity dashboard.',
        accent: '#236B54',
        Icon: BriefcaseBusiness,
    },
};

const CAPTURE_SCRIPT = `
    (function() {
        try {
            var payload = {
                type: 'snapshot',
                url: window.location.href || '',
                title: document.title || '',
                text: (document.body && document.body.innerText ? document.body.innerText : '').slice(0, 50000),
                html: (document.documentElement && document.documentElement.outerHTML ? document.documentElement.outerHTML : '').slice(0, 150000),
                cookieNames: (document.cookie || '')
                    .split(';')
                    .map(function(entry) { return entry.trim().split('=')[0]; })
                    .filter(Boolean)
            };
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'snapshot-error',
                message: String(error)
            }));
        }
        true;
    })();
`;

function looksAuthenticated(systemId: string, url?: string, title?: string, text?: string) {
    const haystack = `${url || ''} ${title || ''} ${text || ''}`.toLowerCase();
    const positiveSignals: Record<string, string[]> = {
        howdy: ['gpa', 'gpr', 'registration', 'holds', 'schedule', 'class', 'course'],
        transact: ['dining dollars', 'meal plan', 'board plan', 'transaction', 'balance'],
        symplicity: ['jobs', 'applications', 'employers', 'career fair', 'recommended jobs', 'interviews'],
    };
    const negativeSignals = ['sign in', 'signin', 'log in', 'login', 'password', 'netid', 'username'];
    const hasPositiveSignal = (positiveSignals[systemId] || []).some(term => haystack.includes(term));
    const looksLikeLogin = negativeSignals.some(term => haystack.includes(term));

    if (hasPositiveSignal) return true;
    if (looksLikeLogin) return false;
    return Boolean(url && text && text.length > 500);
}

export function CampusConnectorScreen() {
    const { COLORS } = useTheme();
    const styles = useMemo(() => getStyles(COLORS), [COLORS]);
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { user } = useUser();
    const hydrateCampusHub = useCampusHubStore(state => state.hydrate);
    const params = (route.params || {}) as RouteParams;
    const systemId = params.systemId || 'howdy';
    const connectorMeta = CONNECTOR_META[systemId] || CONNECTOR_META.howdy;
    const label = params.label || connectorMeta.label;
    const loginUrl = params.loginUrl || connectorMeta.loginUrl;
    const webViewRef = useRef<WebView>(null);
    const manualCaptureRef = useRef(false);
    const lastSavedSignatureRef = useRef('');
    const queryClient = useQueryClient();
    const {
        data: connectors = [],
        isLoading: loadingConnectors,
        refetch: refetchConnectors,
    } = useQuery({
        queryKey: ['campus-connectors', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            return await fetchCampusConnectors(user.id);
        },
        enabled: !!user?.id,
    });

    const connector = useMemo(() => {
        return Array.isArray(connectors)
            ? connectors.find((entry: any) => entry.system_id === systemId)
            : null;
    }, [connectors, systemId]);

    const [currentUrl, setCurrentUrl] = useState(params.sourceUrl || loginUrl);
    const [webViewKey, setWebViewKey] = useState(0);
    const [webBusy, setWebBusy] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusText, setStatusText] = useState('Sign in below. Once your campus data page opens, the app will capture and reuse that state.');

    const loadingConnector = loadingConnectors;

    useEffect(() => {
        if (connector?.source_url) {
            setCurrentUrl(connector.source_url);
        }
    }, [connector?.source_url]);

    const requestCapture = useCallback((manual: boolean) => {
        manualCaptureRef.current = manual;
        webViewRef.current?.injectJavaScript(CAPTURE_SCRIPT);
    }, []);

    const handleConnectorMessage = useCallback(async (event: any) => {
        if (!user?.id) return;

        let payload: any;
        try {
            payload = JSON.parse(event.nativeEvent.data);
        } catch (error) {
            console.warn('Unable to parse connector payload', error);
            return;
        }

        if (payload?.type === 'snapshot-error') {
            setStatusText('The page could not be captured yet. Try again after the page fully loads.');
            manualCaptureRef.current = false;
            return;
        }

        if (payload?.type !== 'snapshot') {
            return;
        }

        const isConnectedPage = looksAuthenticated(systemId, payload.url, payload.title, payload.text);
        if (!isConnectedPage) {
            setStatusText('Still on a sign-in page. Finish logging in, then we will capture the current campus dashboard automatically.');
            manualCaptureRef.current = false;
            return;
        }

        const signature = `${payload.url}|${payload.title}|${(payload.text || '').slice(0, 200)}`;
        if (!manualCaptureRef.current && signature === lastSavedSignatureRef.current) {
            return;
        }

        setSaving(true);
        setStatusText('Saving this campus session snapshot...');

        try {
            const savedConnector = await captureCampusConnector({
                clerk_id: user.id,
                system_id: systemId,
                source_url: payload.url || currentUrl,
                page_title: payload.title || null,
                page_html: payload.html || null,
                page_text: payload.text || null,
                cookie_names: Array.isArray(payload.cookieNames) ? payload.cookieNames : [],
            });

            lastSavedSignatureRef.current = signature;
            manualCaptureRef.current = false;
            queryClient.invalidateQueries({ queryKey: ['campus-connectors', user.id] });
            setCurrentUrl(payload.url || currentUrl);
            setStatusText('Campus data captured. The dashboard can now refresh from this saved session state.');
            await hydrateCampusHub(user.id).catch(() => {});
        } catch (error) {
            console.warn('Connector capture failed:', error);
            setStatusText('We could not save this page. Refresh the page and try again.');
        } finally {
            setSaving(false);
        }
    }, [currentUrl, hydrateCampusHub, loginUrl, systemId, user?.id]);

    const handleForgetSnapshot = useCallback(() => {
        if (!user?.id) return;

        Alert.alert(
            `Forget ${label} data?`,
            'This removes the saved campus snapshot from the app, but the website may still stay signed in inside the embedded browser.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Forget Snapshot',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setSaving(true);
                            await deleteCampusConnector(user.id, systemId);
                            queryClient.invalidateQueries({ queryKey: ['campus-connectors', user.id] });
                            setCurrentUrl(loginUrl);
                            setWebViewKey(value => value + 1);
                            setStatusText('Saved campus data removed. You can reconnect at any time from this screen.');
                            await hydrateCampusHub(user.id).catch(() => {});
                        } catch (error) {
                            console.warn('Failed to delete connector snapshot:', error);
                            setStatusText('Unable to remove the saved snapshot right now.');
                        } finally {
                            setSaving(false);
                        }
                    },
                },
            ]
        );
    }, [hydrateCampusHub, label, loginUrl, systemId, user?.id]);

    const connectionStatusLabel =
        connector?.status === 'connected'
            ? 'Connected'
            : connector?.status === 'awaiting_login'
                ? 'Finish Login'
                : 'Not Connected';
    const connectionStatusStyle =
        connector?.status === 'connected'
            ? styles.statusConnected
            : connector?.status === 'awaiting_login'
                ? styles.statusPending
                : styles.statusDisconnected;
    const connectionStatusTextStyle =
        connector?.status === 'connected'
            ? styles.statusTextConnected
            : connector?.status === 'awaiting_login'
                ? styles.statusTextPending
                : styles.statusTextDisconnected;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                    <ArrowLeft size={20} color={COLORS.textPrimary} />
                </Pressable>

                <View style={styles.headerCopy}>
                    <View style={styles.headerTitleRow}>
                        <View style={[styles.iconBadge, { backgroundColor: `${connectorMeta.accent}18` }]}>
                            <connectorMeta.Icon size={18} color={connectorMeta.accent} />
                        </View>
                        <Text style={styles.title}>{label}</Text>
                    </View>
                    <Text style={styles.subtitle}>{connectorMeta.description}</Text>
                </View>
            </View>

            <View style={styles.summaryCard}>
                <View style={styles.summaryTopRow}>
                    <View style={[styles.statusChip, connectionStatusStyle]}>
                        <Text style={[styles.statusChipText, connectionStatusTextStyle]}>{connectionStatusLabel}</Text>
                    </View>
                    {(saving || loadingConnector) && <ActivityIndicator size="small" color={COLORS.primary} />}
                </View>

                <Text style={styles.statusBody}>{statusText}</Text>

                <View style={styles.metaRow}>
                    <ShieldCheck size={15} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>
                        Passwords and cookie values stay on-device. The app only stores the current page snapshot plus cookie names.
                    </Text>
                </View>
            </View>

            <View style={styles.actionsRow}>
                <Pressable
                    style={[styles.actionButton, styles.actionButtonPrimary]}
                    onPress={() => requestCapture(true)}
                    disabled={saving}
                >
                    <RefreshCw size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonPrimaryText}>Capture Current Page</Text>
                </Pressable>

                <Pressable
                    style={[styles.actionButton, styles.actionButtonSecondary]}
                    onPress={handleForgetSnapshot}
                    disabled={saving}
                >
                    <Unplug size={16} color={COLORS.textPrimary} />
                    <Text style={styles.actionButtonSecondaryText}>Forget Snapshot</Text>
                </Pressable>
            </View>

            <View style={styles.browserShell}>
                {(loadingConnector || webBusy) && (
                    <View style={styles.browserLoader}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={styles.browserLoaderText}>Loading secure campus page...</Text>
                    </View>
                )}

                <WebView
                    key={`${systemId}-${webViewKey}`}
                    ref={webViewRef}
                    source={{ uri: currentUrl || loginUrl }}
                    style={styles.webview}
                    sharedCookiesEnabled
                    thirdPartyCookiesEnabled
                    javaScriptEnabled
                    domStorageEnabled
                    setSupportMultipleWindows={false}
                    onLoadStart={() => setWebBusy(true)}
                    onLoadEnd={() => {
                        setWebBusy(false);
                        requestCapture(false);
                    }}
                    onNavigationStateChange={(navState) => {
                        setCurrentUrl(navState.url || loginUrl);
                    }}
                    onMessage={handleConnectorMessage}
                />
            </View>
        </SafeAreaView>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingHorizontal: 18,
        paddingTop: 8,
        paddingBottom: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    headerCopy: {
        flex: 1,
        gap: 8,
        paddingTop: 2,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconBadge: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: COLORS.textSecondary,
    },
    summaryCard: {
        marginHorizontal: 18,
        marginBottom: 12,
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 16,
        gap: 12,
    },
    summaryTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusChip: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    statusConnected: {
        backgroundColor: '#1C7C5420',
    },
    statusPending: {
        backgroundColor: '#C9780020',
    },
    statusDisconnected: {
        backgroundColor: COLORS.border,
    },
    statusChipText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    statusTextConnected: {
        color: '#1C7C54',
    },
    statusTextPending: {
        color: '#A45F00',
    },
    statusTextDisconnected: {
        color: COLORS.textSecondary,
    },
    statusBody: {
        fontSize: 14,
        lineHeight: 20,
        color: COLORS.textPrimary,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    metaText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
        color: COLORS.textSecondary,
    },
    actionsRow: {
        flexDirection: 'row',
        paddingHorizontal: 18,
        gap: 10,
        marginBottom: 12,
    },
    actionButton: {
        flex: 1,
        minHeight: 46,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
    },
    actionButtonPrimary: {
        backgroundColor: COLORS.primary,
    },
    actionButtonSecondary: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    actionButtonPrimaryText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    actionButtonSecondaryText: {
        color: COLORS.textPrimary,
        fontSize: 14,
        fontWeight: '700',
    },
    browserShell: {
        flex: 1,
        marginHorizontal: 18,
        marginBottom: 18,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    browserLoader: {
        position: 'absolute',
        top: 14,
        left: 14,
        right: 14,
        zIndex: 5,
        backgroundColor: COLORS.background,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    browserLoaderText: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    webview: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
});
