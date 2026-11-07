<?php
/**
 * OneSignal Backend Notification Controller (PHP)
 * App ID: b93b7d97-85fb-4b90-9639-94800375ba63
 *
 * Implements:
 * - Rule 1: Room Entry Broadcast to ALL members (action = "room_entry")
 * - Rule 2: Direct/Private Chat Message to ONLY recipient Member B (action = "private_message")
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
define('ONESIGNAL_REST_API_KEY', getenv('ONESIGNAL_REST_API_KEY') ?: 'YOUR_ONESIGNAL_REST_API_KEY');

$rawBody = file_get_contents('php://input');
$input = json_decode($rawBody, true) ?: [];
$action = $input['action'] ?? ($_GET['action'] ?? '');

/**
 * Helper to call OneSignal REST API
 */
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
        'web_push_topic' => "room_entry_{$roomId}",
        'collapse_id' => "room_entry_{$roomId}",
        'url' => $siteUrl ? rtrim($siteUrl, '/') . "/room/{$roomId}" : null,
        'data' => [
            'type' => 'room_entry',
            'roomId' => $roomId,
            'roomName' => $roomName,
            'userId' => $userId,
            'username' => $username
        ]
    ];

    // Exclude the user who entered so they don't receive their own entry push
    if (!empty($userId)) {
        $payload['filters'] = [
            ['field' => 'tag', 'key' => 'uid', 'relation' => '!=', 'value' => $userId]
        ];
    }

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

    $payload = [
        'app_id' => ONESIGNAL_APP_ID,
        'target_channel' => 'push',
        // Target ONLY Member B by external_id alias
        'include_aliases' => [
            'external_id' => [$recipientUid]
        ],
        'headings' => [
            'en' => "💬 {$senderName}",
            'ckb' => "💬 نامەی نوێ لەلایەن {$senderName}"
        ],
        'contents' => [
            'en' => "{$senderName}: {$messagePreview}",
            'ckb' => "{$senderName}: {$messagePreview}"
        ],
        // collapse_id & web_push_topic group/replace notifications per chat thread
        // so Rule 3 can overwrite or dismiss them immediately on the device tray
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
    ];

    $result = callOneSignalApi('/notifications', 'POST', $payload);
    echo json_encode([
        'success' => true,
        'rule' => 'private_message',
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
echo json_encode(['success' => false, 'error' => 'Invalid action. Use room_entry, private_message, or dismiss_chat.']);
