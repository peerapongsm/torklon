// fixtures/poems.ts — public-domain classic Thai poem excerpts used to prove
// validate() end-to-end, plus deliberately-broken variants (one seeded
// violation each). Every GOOD excerpt below was (a) sourced from a real,
// independently-verifiable public-domain text and (b) checked
// syllable-by-syllable through the actual parseSyllables()/rhymes() engine
// (not just eyeballed) before being committed here — see
// .superpowers/sdd/task-6-report.md for the full provenance + verification
// notes, including a documented finding about forms.ts's khlong4
// tonePositions table for บาทที่ 2-4.

// --- กลอนแปด (กลอนสุภาพ) ----------------------------------------------------
// สุนทรภู่, "พระอภัยมณี" ตอนพระฤๅษีสอนสุดสาคร. สุนทรภู่ (พ.ศ. 2329-2398) — ต้น
// รัตนโกสินทร์, สาธารณสมบัติ. This exact excerpt is reproduced verbatim in the
// Ministry of Education's official ป.4 บทอาขยานหลัก (หน่วยเรียนรู้ที่ 2, สื่อ
// dltv.ac.th) for the same ตอน, alongside the more commonly quoted
// "แล้วสอนว่าอย่าไว้ใจมนุษย์..." lines that immediately precede it in the text.
// Syllable counts (checked live): 8,8,8,8 — all within [7,9]. All 3
// outerRhymes links verified: last of วรรคสดับ "ตอบ" (aw/กบ) <-> 3rd syllable
// of วรรครับ "คอบ" (aw/กบ); last of วรรครับ "หนา" (aa/) <-> last of วรรครอง
// "ชา" (aa/); last of วรรครอง "ชา" (aa/) <-> 3rd syllable of วรรคส่ง "ษา" (aa/).
export const KLON8_GOOD =
  "แม้นใครรักรักมั่งชังชังตอบ\nให้รอบคอบคิดอ่านนะหลานหนา\nรู้สิ่งใดไม่สู้รู้วิชา\nรู้รักษาตัวรอดเป็นยอดดี";

// Same excerpt with วรรคสดับ truncated to 3 syllables (กลอนแปด wants [7,9]) —
// seeds a count-mismatch diagnostic.
export const KLON8_BROKEN_COUNT =
  "แม้นใครรัก\nให้รอบคอบคิดอ่านนะหลานหนา\nรู้สิ่งใดไม่สู้รู้วิชา\nรู้รักษาตัวรอดเป็นยอดดี";

// Same excerpt with วรรครอง's rhyming word ("วิชา", rhymeKey aa/, rhymes with
// วรรครับ's "หนา") swapped for a non-rhyming word ("เพียร", rhymeKey ia/กน) —
// seeds an outer-rhyme-broken diagnostic (breaks both links that touch
// วรรครอง's last syllable).
export const KLON8_BROKEN_RHYME =
  "แม้นใครรักรักมั่งชังชังตอบ\nให้รอบคอบคิดอ่านนะหลานหนา\nรู้สิ่งใดไม่สู้รู้เพียร\nรู้รักษาตัวรอดเป็นยอดดี";

// --- กาพย์ยานี ๑๑ ------------------------------------------------------------
// สุนทรภู่, "กาพย์พระไชยสุริยา" — a spelling/phonics primer poem (early 19th c.,
// สาธารณสมบัติ) written in กาพย์ยานี ๑๑ / กาพย์ฉบัง ๑๖ / กาพย์สุรางคนางค์ ๒๘.
// Syllable counts (checked live): 5,6,5,6 exactly. All 3 outerRhymes links
// verified: last of วรรค1 "ยาก" (aa/กก) <-> 3rd syllable of วรรค2 "บาก"
// (aa/กก); last of วรรค2 "ไชย" (ai/) <-> last of วรรค3 "ไฟ" (ai/); last of
// วรรค3 "ไฟ" (ai/) <-> 3rd syllable of วรรค4 "ไม้" (ai/).
export const YANI_GOOD =
  "ขึ้นกกตกทุกข์ยาก\nแสนลำบากจากเวียงไชย\nมันเผือกเลือกเผาไฟ\nกินผลไม้ได้เป็นแรง";

// Same excerpt with บาทที่ 1's วรรคแรก truncated to 3 syllables (กาพย์ยานี ๑๑
// wants exactly 5) — seeds a count-mismatch diagnostic.
export const YANI_BROKEN_COUNT =
  "ขึ้นกกตก\nแสนลำบากจากเวียงไชย\nมันเผือกเลือกเผาไฟ\nกินผลไม้ได้เป็นแรง";

// --- โคลงสี่สุภาพ ------------------------------------------------------------
// "โคลงโลกนิติ" — proverbs compiled/ทรงชำระ into โคลงสี่สุภาพ by สมเด็จพระเจ้า
// บรมวงศ์เธอ กรมพระยาเดชาดิศร under รัชกาลที่ 3, จารึกไว้ที่วัดพระเชตุพนฯ
// พ.ศ. 2374 — สาธารณสมบัติ. 8 wak: [core(5), tail(2/[2,4])] x 4 บาท, no
// คำสร้อย present in this particular excerpt. Syllable counts (checked live):
// 5,2,5,2,5,2,5,4 — matches forms.ts's [5,[2,4],5,2,5,[2,4],5,4] exactly. All
// 3 outerRhymes links (anchored on the Task-5-corrected tail positions)
// verified: last of บาทที่1 tail "ธาร" (aa/กน) <-> 5th syllable of บาทที่2
// core "ดาน" (aa/กน); same "ธาร" <-> 5th syllable of บาทที่3 core "ขาน"
// (aa/กน); last of บาทที่2 tail "เชื้อ" (uea/) <-> 5th syllable of บาทที่4
// core "เรื้อ" (uea/).
//
// UPDATE (task-6 addendum, see task-6-report.md): the บาทที่2-4
// tonePositions encoding bug noted here previously has been fixed in
// forms.ts (the 2nd เอก and the โท for these บาท live in the TAIL wak, not
// the core — the old table anchored them in the core, which is why it never
// matched real verses). With the fix, this verse now cleanly satisfies every
// tonePositions check except one: บาทที่ 4's core syllable 2 ("หญ้า") carries
// ไม้โท at an เอก position — a single, isolated real-text anomaly (possibly
// เอกโทษ/โทโทษ classical license, unconfirmed for this specific word) left
// as a known, documented edge case rather than papered over with an
// unverified substitution rule. ลิลิตพระลอ's opening บท ("เสียงฦๅเสียงเล่า
// อ้าง...") was independently re-checked against the corrected table and
// produces ZERO tone-position-violations across all 4 บาท.
export const KHLONG_GOOD =
  "ก้านบัวบอกลึกตื้น\nชลธาร\nมารยาทส่อสันดาน\nชาติเชื้อ\nโฉดฉลาดเพราะคำขาน\nควรทราบ\nหย่อมหญ้าเหี่ยวแห้งเรื้อ\nบอกร้ายแสลงดิน";

// Same excerpt with บาทที่ 1's core truncated to 3 syllables (core wants
// exactly 5) — seeds a count-mismatch diagnostic.
export const KHLONG_BROKEN_COUNT =
  "ก้านบัวบอก\nชลธาร\nมารยาทส่อสันดาน\nชาติเชื้อ\nโฉดฉลาดเพราะคำขาน\nควรทราบ\nหย่อมหญ้าเหี่ยวแห้งเรื้อ\nบอกร้ายแสลงดิน";

// Same excerpt with บาทที่ 2's core last syllable ("ดาน", rhymeKey aa/กน,
// rhymes with บาทที่ 1's tail "ธาร") swapped for a non-rhyming word ("ดี",
// rhymeKey i/) — seeds an outer-rhyme-broken diagnostic.
export const KHLONG_BROKEN_RHYME =
  "ก้านบัวบอกลึกตื้น\nชลธาร\nมารยาทส่อสันดี\nชาติเชื้อ\nโฉดฉลาดเพราะคำขาน\nควรทราบ\nหย่อมหญ้าเหี่ยวแห้งเรื้อ\nบอกร้ายแสลงดิน";

// Same excerpt with บาทที่ 1's mandatory โท syllable ("ตื้น", carries ไม้โท)
// swapped for a live, unmarked syllable ("ตน") — seeds a tone-position-
// violation at a position that's reliably enforced (unlike บาทที่ 2-4 above,
// บาทที่ 1's positions passed in every real verse checked), and specifically
// one that no substitution rescues: unlike เอก, โท has no dead-syllable
// substitute in classical practice, so this is an unambiguous violation.
export const KHLONG_BROKEN_TONE =
  "ก้านบัวบอกลึกตน\nชลธาร\nมารยาทส่อสันดาน\nชาติเชื้อ\nโฉดฉลาดเพราะคำขาน\nควรทราบ\nหย่อมหญ้าเหี่ยวแห้งเรื้อ\nบอกร้ายแสลงดิน";
