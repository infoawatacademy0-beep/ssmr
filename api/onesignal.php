<?php
/**
 * OneSignal Backend Notification Controller (PHP)
 * App ID: b93b7d97-85fb-4b90-9639-94800375ba63
 *
 * Implements:
 * - Rule 1: Room Entry Broadcast to ALL members (action = "room_entry")
 * - Rule 2: Direct/Private Chat Message to ONLY recipient Member B (action = "private_message")
 * - Profile Visit Notification to ONLY profile owner (action = "profile_visit")
 * - Rule 3: Notification Dismissal / Clearance when Member B reads chat (action = "dismiss_chat")
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

define('ONESIGNAL_APP_ID', 'b93b7d97-85fb-4b90-9639-94800375ba63');
define('ONESIGNAL_REST_API_KEY', getenv('ONESIGNAL_REST_API_KEY') ?: '');
define('ONESIGNAL_PUBLIC_KEY_PEM', "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEIAePpAesCmbZIJ1i7b505etLNN+q\nm575890tN1jcPTPCXRVrmBwXhaesv5BrGqPd1UsGir7mgpuM4ZBLJ1JPjA==\n-----END PUBLIC KEY-----");

$rawBody = file_get_contents('php://input');
$input = json_decode($rawBody, true) ?: [];
$action = $input['action'] ?? ($_GET['action'] ?? '');

function callOneSignalApi(string $endpoint, string $method = 'POST', ?array $payload = null): array {
    $ch = curl_init("https://api.onesignal.com" . $endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json; charset=utf-8',
        'Authorization: Key ' . ONESIGNAL_REST_API_KEY
    ]);

    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }

    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'status' => $status,
        'body' => json_decode($response, true) ?: $response
    ];
}

function sendOneSignalToSingleUser(string $targetUid, array $basePayload): array {
    $tagPayload = array_merge($basePayload, [
        'app_id' => ONESIGNAL_APP_ID,
        'target_channel' => 'push',
        'filters' => [
            ['field' => 'tag', 'key' => 'uid', 'relation' => '=', 'value' => $targetUid]
        ]
    ]);
    $res = callOneSignalApi('/notifications', 'POST', $tagPayload);
    if (empty($res['body']['id'])) {
        $aliasPayload = array_merge($basePayload, [
            'app_id' => ONESIGNAL_APP_ID,
            'target_channel' => 'push',
            'include_aliases' => [
                'external_id' => [$targetUid]
            ]
        ]);
        return callOneSignalApi('/notifications', 'POST', $aliasPayload);
    }
    return $res;
}

// ============================================================================
// RULE 1: ROOM ENTRY NOTIFICATION (Broadcast to ALL subscribed members)
// ============================================================================
if ($action === 'room_entry') {
    $username = trim($input['username'] ?? 'ئەندامێک');
    $roomName = trim($input['roomName'] ?? 'ژووری دەنگی');
    $roomId   = trim($input['roomId'] ?? '');
    $userId   = trim($input['userId'] ?? '');
    $siteUrl  = trim($input['siteUrl'] ?? '');

    $payload = [
        'app_id' => ONESIGNAL_APP_ID,
        'target_channel' => 'push',
        'included_segments' => ['Total Subscriptions'],
        'headings' => [
            'en' => "🎙️ {$username} entered {$roomName}",
            'ckb' => "🎙️ {$username} چووە ناو ژووری {$roomName}"
        ],
        'contents' => [
            'en' => "{$username} just joined the room \"{$roomName}\". Tap to join the voice chat!",
            'ckb' => "{$username} چووە ناو ژووری «{$roomName}». کلیک بکە بۆ چوونە ژوورەوە!"
        ],
        'web_push_topic' => "room_entry_{$roomId}_" . time(),
        'url' => $siteUrl ? rtrim($siteUrl, '/') . "/room/{$roomId}" : null,
        'data' => [
            'type' => 'room_entry',
            'roomId' => $roomId,
            'roomName' => $roomName,
            'userId' => $userId,
            'username' => $username
        ]
    ];

    $result = callOneSignalApi('/notifications', 'POST', $payload);
    echo json_encode(['success' => true, 'rule' => 'room_entry', 'onesignal' => $result['body']]);
    exit;
}

// ============================================================================
// RULE 2: DIRECT / PRIVATE CHAT MESSAGE (Sent ONLY to Member B)
// ============================================================================
if ($action === 'private_message') {
    $senderUid      = trim($input['senderUid'] ?? '');
    $senderName     = trim($input['senderName'] ?? 'Member');
    $senderAvatar   = trim($input['senderAvatar'] ?? '');
    $recipientUid   = trim($input['recipientUid'] ?? '');
    $messagePreview = trim($input['messagePreview'] ?? 'نامەیەکی نوێت بۆ هات');
    $threadId       = trim($input['threadId'] ?? "{$senderUid}_{$recipientUid}");
    $siteUrl        = trim($input['siteUrl'] ?? '');

    if (empty($recipientUid)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'recipientUid is required']);
        exit;
    }

    $topicTag = "dm_{$threadId}";
    $result = sendOneSignalToSingleUser($recipientUid, [
        'headings' => [
            'en' => "💬 {$senderName}",
            'ckb' => "💬 نامەی نوێ لەلایەن {$senderName}"
        ],
        'contents' => [
            'en' => "{$senderName}: {$messagePreview}",
            'ckb' => "{$senderName}: {$messagePreview}"
        ],
        'collapse_id' => $topicTag,
        'web_push_topic' => $topicTag,
        'chrome_web_icon' => !empty($senderAvatar) ? $senderAvatar : null,
        'url' => $siteUrl ?: null,
        'data' => [
            'type' => 'private_message',
            'threadId' => $threadId,
            'senderUid' => $senderUid,
            'senderName' => $senderName,
            'recipientUid' => $recipientUid
        ]
    ]);

    echo json_encode([
        'success' => true,
        'rule' => 'private_message',
        'notificationId' => $result['body']['id'] ?? null,
        'onesignal' => $result['body']
    ]);
    exit;
}

// ============================================================================
// PROFILE VISIT NOTIFICATION (Sent ONLY to Profile Owner)
// ============================================================================
if ($action === 'profile_visit') {
    $visitorUid    = trim($input['visitorUid'] ?? '');
    $visitorName   = trim($input['visitorName'] ?? 'ئەندامێک');
    $visitorAvatar = trim($input['visitorAvatar'] ?? '');
    $targetUid     = trim($input['targetUid'] ?? '');
    $siteUrl       = trim($input['siteUrl'] ?? '');

    if (empty($targetUid)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'targetUid is required']);
        exit;
    }

    $topicTag = "visit_{$targetUid}_{$visitorUid}";
    $result = sendOneSignalToSingleUser($targetUid, [
        'headings' => [
            'en' => "👁️ Profile Visitor: {$visitorName}",
            'ckb' => "👁️ سەردانی پڕۆفایل لەلایەن {$visitorName}"
        ],
        'contents' => [
            'en' => "{$visitorName} just visited your profile!",
            'ckb' => "{$visitorName} سەردانی پڕۆفایلەکەتی کرد!"
        ],
        'collapse_id' => $topicTag,
        'web_push_topic' => $topicTag,
        'chrome_web_icon' => !empty($visitorAvatar) ? $visitorAvatar : null,
        'url' => $siteUrl ?: null,
        'data' => [
            'type' => 'profile_visit',
            'visitorUid' => $visitorUid,
            'visitorName' => $visitorName,
            'targetUid' => $targetUid
        ]
    ]);

    echo json_encode([
        'success' => true,
        'rule' => 'profile_visit',
        'notificationId' => $result['body']['id'] ?? null,
        'onesignal' => $result['body']
    ]);
    exit;
}

// ============================================================================
// RULE 3: NOTIFICATION DISMISSAL / CLEARANCE WHEN MEMBER B READS THE CHAT
// ============================================================================
if ($action === 'dismiss_chat') {
    $notificationIds = $input['notificationIds'] ?? [];
    $recipientUid    = trim($input['recipientUid'] ?? '');
    $threadId        = trim($input['threadId'] ?? '');

    $cancelled = [];
    if (is_array($notificationIds)) {
        foreach ($notificationIds as $notifId) {
            $cleanId = trim((string)$notifId);
            if (!empty($cleanId)) {
                $del = callOneSignalApi(
                    "/notifications/" . urlencode($cleanId) . "?app_id=" . urlencode(ONESIGNAL_APP_ID),
                    'DELETE'
                );
                $cancelled[$cleanId] = $del['status'];
            }
        }
    }

    echo json_encode([
        'success' => true,
        'rule' => 'dismiss_chat',
        'recipientUid' => $recipientUid,
        'threadId' => $threadId,
        'cancelledNotifications' => $cancelled
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Invalid action']);
