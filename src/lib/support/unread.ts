// Admin-unread derivation for "Chat with Us" (spec 014 WP-6, admin notification bell).
// Pure only — no Supabase, no fetch, no internal Date.now() read.
//
// There is no `unread` column: a conversation is unread for admins purely as a function
// of two existing timestamps on support_conversations (sql/31.support_chat.sql) —
// `last_message_at` and `admin_last_read_at`, the latter already stamped by
// adminGetThread (service.ts) whenever an admin opens a thread. Both the admin inbox
// list (InboxList.tsx) and the admin notifications endpoint apply this exact same rule
// so the list's unread dot and the bell's badge never disagree.

/**
 * `adminLastReadAt === null` means no admin has ever opened this conversation, which is
 * unread by definition. Otherwise unread iff the last message landed after that read.
 */
export function isUnreadForAdmin(lastMessageAt: string, adminLastReadAt: string | null): boolean {
  if (!adminLastReadAt) return true
  return new Date(lastMessageAt).getTime() > new Date(adminLastReadAt).getTime()
}
