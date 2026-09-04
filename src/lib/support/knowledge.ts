// Curated product knowledge base for the support AI (spec 014, D6). Data only —
// no functions, no imports. This is what the AI is allowed to "know" about the
// product; anything not covered here is a signal to escalate, not to guess.
//
// Grounded in docs/PRODUCT.md and docs/ARCHITECTURE.md §4/§5 as of 2026-09-03.
// The app sells nothing (ADR-017, monetization off): no fact below may imply a
// price, a paid plan, a subscription, or an upgrade benefit. Every AI feature is
// described as free-but-rate-limited, never as a trial that runs out.

export interface KnowledgeEntry {
  /** Stable key, e.g. for logging or future retrieval — never shown to a user. */
  topic: string
  vi: string
  en: string
}

export const PRODUCT_KNOWLEDGE: KnowledgeEntry[] = [
  {
    topic: 'app_overview',
    vi: 'Đây là Notez (Sổ tài chính), một không gian cá nhân riêng tư để ghi chú, quản lý việc cần làm, mục tiêu, calo/bữa ăn, tài chính, tử vi và nhiều thứ khác trong một chỗ.',
    en: 'This is Notez (Sổ tài chính), a private personal dashboard for notes, todos, goals, calorie/meal tracking, finance, horoscope and more, all in one place.',
  },
  {
    topic: 'sign_in',
    vi: 'Đăng nhập bằng tài khoản Google, Facebook, hoặc email. Không cần mã PIN.',
    en: 'Sign in with Google, Facebook, or email. No PIN required.',
  },
  {
    topic: 'password_reset',
    vi: 'Để đặt lại mật khẩu, vào trang đăng nhập và chọn liên kết quên mật khẩu để tới trang /reset-password.',
    en: 'To reset a password, go to the login page and use the forgot-password link to reach /reset-password.',
  },
  {
    topic: 'notes_dashboard',
    vi: 'Trang chủ sau khi đăng nhập là /notes, với 8 tab: notes, việc cần làm, calo, theo dõi sức khoẻ, mục tiêu, lịch, đọc sức khoẻ, và thống kê.',
    en: 'The home page after signing in is /notes, with 8 tabs: notes, todos, calories, trackers, goals, calendar, health reading, and stats.',
  },
  {
    topic: 'notes_tab',
    vi: 'Tab notes là nhật ký hằng ngày (việc tốt/việc chưa tốt), có thể ghim thói quen và đặt giờ nhắc. Bấm đúp vào một mục để sửa nhanh.',
    en: 'The notes tab is a daily journal (good/bad-day entries); habits can be pinned with reminder times. Double-click an entry to edit it inline.',
  },
  {
    topic: 'add_note_or_todo',
    vi: 'Để thêm ghi chú hoặc việc cần làm, mở tab tương ứng trong /notes và dùng ô nhập ở đầu danh sách; bấm đúp vào một mục có sẵn để sửa.',
    en: 'To add a note or a todo, open the matching tab in /notes and use the input at the top of the list; double-click an existing item to edit it.',
  },
  {
    topic: 'todos_tab',
    vi: 'Tab việc cần làm gồm danh sách todo và một mục "buy picks" gợi ý cổ phiếu đáng chú ý.',
    en: 'The todos tab holds the todo list plus a "buy picks" section suggesting stocks worth a look.',
  },
  {
    topic: 'calo_tab',
    vi: 'Tab calo theo dõi calo ăn vào so với mục tiêu, hỗ trợ phân tích ảnh món ăn bằng AI, và có bảng "Lịch Ăn" với 5 bữa mỗi ngày.',
    en: 'The calo tab tracks calories eaten against a target, supports AI food-photo analysis, and includes a "Lịch Ăn" (meal plan) panel with 5 meals a day.',
  },
  {
    topic: 'tracker_tab',
    vi: 'Tab theo dõi gồm nhật ký tiêu hoá, cân nặng, và tập gym, cùng thư viện video hướng dẫn.',
    en: 'The tracker tab covers bowel, weight, and gym logs, plus a video library.',
  },
  {
    topic: 'goals_tab',
    vi: 'Tab mục tiêu quản lý các mục tiêu dài hạn với các mục con, kéo-thả để sắp xếp.',
    en: 'The goals tab tracks long-term goals with sub-items, reorderable by drag-and-drop.',
  },
  {
    topic: 'add_goal',
    vi: 'Để thêm mục tiêu mới, vào tab mục tiêu trong /notes và tạo mục tiêu, sau đó thêm các mục con bên trong nó.',
    en: 'To add a new goal, go to the goals tab in /notes and create a goal, then add sub-items inside it.',
  },
  {
    topic: 'calendar_tab',
    vi: 'Tab lịch hiển thị các ghi chú và sự kiện theo dạng lịch tháng.',
    en: 'The calendar tab shows notes and events in a month view.',
  },
  {
    topic: 'health_tab',
    vi: 'Tab đọc sức khoẻ liệt kê các bài viết blog được gắn thẻ "Sức Khỏe" như một danh sách để đọc.',
    en: 'The health tab lists blog posts tagged "Sức Khỏe" as a reading list.',
  },
  {
    topic: 'stats_tab',
    vi: 'Tab thống kê tổng hợp dữ liệu từ các tab khác và có mục AI Insights phân tích xu hướng.',
    en: 'The stats tab aggregates data from the other tabs and includes AI Insights that analyze trends.',
  },
  {
    topic: 'finance_page',
    vi: 'Trang /finance (Sổ tài chính / Quỹ Tương Lai) theo dõi tài sản (vàng, tiền mặt, ngân hàng, đầu tư khác), thu chi, quy đổi giữa các tài sản, khoản cho vay/phải thu, và giá vàng theo thời gian thực. Có thể mời một thành viên khác cùng quản lý một quỹ chung.',
    en: 'The /finance page (Sổ tài chính / Quỹ Tương Lai) tracks assets (gold, cash, bank, other investments), money in/out, conversions between assets, receivables/loans, and live gold price. One other member can be invited to co-manage a shared fund.',
  },
  {
    topic: 'stocks',
    vi: 'Phần cổ phiếu (trong /finance) gồm danh mục đầu tư, danh sách theo dõi, phân tích cổ phiếu bằng AI, và cảnh báo giá.',
    en: 'The stocks section (inside /finance) includes a portfolio, a watchlist, AI-assisted stock analysis, and price alerts.',
  },
  {
    // Corrected 2026-09-04. This entry used to say the blog is "không công khai
    // ra ngoài internet" / "not public on the internet", which is false: posts
    // carry `is_public`, and app/blog/[slug]/data.ts serves a public one through
    // the anon client to a signed-out reader. Rule 1 makes the assistant state
    // this KB confidently, so the wrong version was a confident, reassuring
    // answer to a privacy question — the worst shape a KB error can take. The
    // three facts below are each load-bearing and were each read out of the
    // code: default private, per-post opt-in, and a public post being reachable
    // by link but NOT listed unless the author is the admin account.
    topic: 'blog_visibility',
    vi: 'Blog tại /blog: mỗi tài khoản chỉ quản lý bài viết của chính mình. Bài viết mặc định là riêng tư; trong trang quản lý bài viết có thể bật công khai cho từng bài. Khi một bài đã công khai thì bất kỳ ai có đường dẫn /blog/<slug> đều đọc được, kể cả người chưa đăng nhập. Danh sách blog công khai chỉ hiển thị bài của tài khoản quản trị, nên bài công khai của tài khoản thường vẫn mở qua đường dẫn nhưng không xuất hiện trong danh sách đó. Dán nội dung Markdown vào trình soạn thảo sẽ tự chuyển thành định dạng khi lưu.',
    en: 'The blog at /blog: each account manages only its own posts. A post is private by default; it can be made public one post at a time from the post-management page. Once a post is public, anyone with the /blog/<slug> link can read it, including signed-out visitors. The public blog listing shows only the admin account\'s public posts, so a regular account\'s public post stays reachable by link without appearing in that listing. Pasting Markdown into the editor auto-converts to formatted content on save.',
  },
  {
    topic: 'tu_vi',
    vi: 'Xem tử vi (/tu-vi) là một khu vực riêng: sau khi nhập ngày giờ sinh và giới tính, hệ thống dựng lá số với 12 cung, 11 mục được chấm điểm, và AI giải nghĩa cho từng mục/cung. Số lần tạo bài đọc AI được giới hạn theo ngày âm lịch.',
    en: 'Xem tử vi (/tu-vi) is a separate area: after entering birth date/time and gender, the system builds a chart with 12 palaces, 11 scored sections, and an AI reading per section/palace. AI readings are capped per lunar day.',
  },
  {
    topic: 'games',
    vi: 'Trang /games là Games Hub, hiện có trò xếp khối gỗ với 100 màn chơi. Miễn phí cho mọi tài khoản.',
    en: 'The /games page is the Games Hub, currently featuring a wooden block puzzle with 100 levels. Free for every account.',
  },
  {
    topic: 'language_switch',
    vi: 'Ngôn ngữ giao diện (Tiếng Việt / English) có thể đổi từ menu trên header của trang.',
    en: 'The interface language (Vietnamese/English) can be switched from the header menu.',
  },
  {
    topic: 'ai_features_free',
    vi: 'Mọi tính năng AI trong app đều miễn phí cho tất cả mọi người, không có gói trả phí. Mỗi tính năng AI có giới hạn số lần dùng theo ngày/kỳ để tránh lạm dụng, không phải để bán gói nâng cấp.',
    en: 'Every AI feature in the app is free for everyone; there is no paid plan. Each AI feature has a per-day/per-period usage cap to prevent abuse, not to sell an upgrade.',
  },
  {
    topic: 'no_payment',
    vi: 'Hiện tại app không bán gì cả — không có gói trả phí, không có nâng cấp. Nút ủng hộ tác giả (donate) chỉ là một lời cảm ơn, không đổi lấy bất kỳ quyền lợi nào.',
    en: 'The app currently sells nothing — no paid plan, no upgrade. The donate button is a thank-you gesture only and grants no benefit in return.',
  },
  {
    topic: 'data_privacy',
    vi: 'Dữ liệu của mỗi người là riêng tư, chỉ chính tài khoản đó đọc được (trừ quỹ chung mà bạn chủ động mời người khác tham gia).',
    en: "Each person's data is private and readable only by that account (except a shared fund you have deliberately invited someone else into).",
  },
]

/**
 * Topics this knowledge base deliberately does not cover, as a note to whoever
 * edits the list above — a reminder of which gaps are intentional, so a future
 * entry is not added by accident to a topic that was left out on purpose.
 *
 * **Nothing reads this.** The comment here used to claim that `triage.ts`
 * matched questions against it and that it was "a contract other modules read";
 * neither was ever true, and a comment asserting behaviour that does not exist
 * is worse than the unused constant it describes, because a reader believes it.
 *
 * Do not wire it into the prompt to "make it real". Rule 1 already escalates any
 * product question the knowledge base does not answer, so this would add
 * nothing — and a list of topic labels handed to the model reads as a list of
 * things to refuse, which collides with FR-023a: an off-topic question the
 * assistant can genuinely answer must be answered, not escalated.
 */
export const KNOWLEDGE_TOPICS_NOT_COVERED: string[] = [
  'billing_and_payment',
  'account_deletion',
  'data_export',
  'other_users_accounts',
  'backend_infrastructure',
  'legal_and_privacy_policy_details',
]
