export type GateLang = "en" | "ar";

const en = {
  home: "Home", scan: "Scan", checkin: "Check-in", search: "Search",
  approved: "Approved", incidents: "Incidents", emergency: "Emergency",
  gate_portal: "Security Portal", today_expected: "Expected today",
  quick_actions: "Quick actions", scan_qr: "Scan QR", walk_in: "Walk-in entry",
  search_placeholder: "Search name, phone, plate, or villa…",
  visitor_name: "Visitor name", phone: "Phone", plate: "Vehicle plate",
  purpose: "Purpose", unit: "Villa / Unit", type: "Visitor type",
  guest: "Guest", delivery: "Delivery", contractor: "Contractor",
  register_entry: "Register entry", check_in: "Check in", check_out: "Check out",
  blocked_alert: "This visitor is BLOCKED. Do not allow entry.",
  expired_alert: "Access has expired.",
  unknown_alert: "Unknown QR code.",
  report_incident: "Report incident", title: "Title", description: "Description",
  severity: "Severity", low: "Low", medium: "Medium", high: "High",
  photos: "Photos", submit: "Submit", cancel: "Cancel",
  no_results: "No results", loading: "Loading…",
  sign_out: "Sign out", language: "العربية",
  call: "Call", staff: "Staff", session: "Session",
  status: "Status", checked_in: "Checked in", checked_out: "Checked out",
  pending: "Pending", cancelled: "Cancelled",
  gate_notes: "Gate notes", company: "Company (optional)",
  no_visitors: "No visitors expected today.",
  manual_code: "Enter code manually",
  start_camera: "Start camera", stop_camera: "Stop camera",
  saved: "Saved", error: "Error",
};

const ar: typeof en = {
  home: "الرئيسية", scan: "مسح", checkin: "تسجيل دخول", search: "بحث",
  approved: "المعتمدون", incidents: "الحوادث", emergency: "الطوارئ",
  gate_portal: "بوابة الأمن", today_expected: "المتوقع اليوم",
  quick_actions: "إجراءات سريعة", scan_qr: "مسح رمز QR", walk_in: "دخول مباشر",
  search_placeholder: "ابحث بالاسم أو الهاتف أو اللوحة أو الفيلا…",
  visitor_name: "اسم الزائر", phone: "الهاتف", plate: "لوحة السيارة",
  purpose: "الغرض", unit: "الفيلا / الوحدة", type: "نوع الزائر",
  guest: "ضيف", delivery: "توصيل", contractor: "مقاول",
  register_entry: "تسجيل الدخول", check_in: "تسجيل دخول", check_out: "تسجيل خروج",
  blocked_alert: "هذا الزائر محظور. لا تسمح بالدخول.",
  expired_alert: "انتهت صلاحية الوصول.",
  unknown_alert: "رمز QR غير معروف.",
  report_incident: "الإبلاغ عن حادث", title: "العنوان", description: "الوصف",
  severity: "الخطورة", low: "منخفض", medium: "متوسط", high: "مرتفع",
  photos: "الصور", submit: "إرسال", cancel: "إلغاء",
  no_results: "لا توجد نتائج", loading: "جارٍ التحميل…",
  sign_out: "تسجيل خروج", language: "English",
  call: "اتصال", staff: "الموظف", session: "الجلسة",
  status: "الحالة", checked_in: "تم الدخول", checked_out: "تم الخروج",
  pending: "قيد الانتظار", cancelled: "ملغى",
  gate_notes: "ملاحظات البوابة", company: "الشركة (اختياري)",
  no_visitors: "لا يوجد زوار متوقعون اليوم.",
  manual_code: "أدخل الرمز يدويًا",
  start_camera: "بدء الكاميرا", stop_camera: "إيقاف الكاميرا",
  saved: "تم الحفظ", error: "خطأ",
};

const DICTS = { en, ar };
export type GateKey = keyof typeof en;

export function getLang(): GateLang {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem("gate_lang");
  return v === "ar" ? "ar" : "en";
}
export function setLang(l: GateLang) {
  if (typeof window !== "undefined") window.localStorage.setItem("gate_lang", l);
}
export function t(key: GateKey, lang: GateLang = getLang()): string {
  return DICTS[lang][key] ?? key;
}
