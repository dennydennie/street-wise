import 'package:flutter/widgets.dart';

/// Mock data + app-wide state for the Phase 1A prototype.
/// Everything here is local; swap for real services (sync, Paynow, auth) later.

enum ReportStatus { live, review, expired }

class MyReport {
  MyReport(this.title, this.place, this.age, this.status, {this.confirms = 0, this.pin = false});
  String title;
  final String place;
  final String age;
  ReportStatus status;
  final int confirms;
  final bool pin;
}

class Pass {
  const Pass(this.id, this.name, this.duration, this.days, this.price, {this.badge});
  final String id;
  final String name;
  final String duration;
  final int days;
  final double price;
  final String? badge;
}

const passes = [
  Pass('day', 'Day pass', '24 hours', 1, 0.50),
  Pass('week', 'Week pass', '7 days', 7, 1.50, badge: 'Most used'),
  Pass('month', 'Month pass', '30 days', 30, 4.00, badge: 'Save 30%'),
];

class Payment {
  const Payment(this.pass, this.date, this.method, this.amount);
  final String pass;
  final String date;
  final String method;
  final double amount;
}

class Passkey {
  Passkey(this.provider, this.detail, {this.thisPhone = false});
  final String provider;
  final String detail;
  final bool thisPhone;
}

const reportTypes = ['Pothole', 'Robot out', 'Kombi stop', 'Flooding', 'Crime hotspot', 'Camera'];

String money(double v) => 'US\$${v.toStringAsFixed(2)}';

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String dayMonth(DateTime d) => '${d.day} ${_months[d.month - 1]}';
String hm(DateTime d) => '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

class AppState extends ChangeNotifier {
  // ── Session ──
  bool signedIn = false;
  bool onboarded = false;
  bool tourSeen = false;
  bool agreedToRules = false;
  String displayName = 'Tendai M.';
  String phone = '+263 77 123 4821';
  String get phoneMasked => '+263 77 ••• 4821';
  String get initials =>
      displayName.split(' ').where((s) => s.isNotEmpty).map((s) => s[0]).take(2).join().toUpperCase();

  final passkeys = <Passkey>[
    Passkey('Google Password Manager', 'Created 4 Nov 2026 · used today', thisPhone: true),
    Passkey('Samsung Pass · Galaxy A15', 'Created 12 Oct 2026 · last used 3 weeks ago'),
  ];

  // ── Plus ──
  DateTime? plusUntil;
  String plusPassName = 'Week pass';
  bool remindBeforeEnd = true;
  final payments = <Payment>[];
  bool _accountLoaded = false;

  /// Stand-in for fetching the signed-in account from the API (pass + receipts).
  void _loadDemoAccount() {
    if (_accountLoaded) return;
    _accountLoaded = true;
    plusUntil ??= DateTime.now().add(const Duration(days: 6, hours: 23));
    if (payments.isEmpty) {
      payments.addAll(const [
        Payment('Week pass', '4 Nov', 'EcoCash', 1.50),
        Payment('Day pass', '28 Oct', 'Paynow · Visa', 0.50),
        Payment('Month pass', '1 Sep', 'EcoCash', 4.00),
      ]);
    }
  }

  bool get plusActive => plusUntil != null && plusUntil!.isAfter(DateTime.now());
  int get plusDaysLeft => plusActive ? plusUntil!.difference(DateTime.now()).inDays.clamp(0, 999) : 0;

  /// Extend stacks on the current end date; a fresh pass starts now.
  DateTime passEnd(Pass p) {
    final start = plusActive ? plusUntil! : DateTime.now();
    return start.add(Duration(days: p.days));
  }

  void activatePass(Pass p, String method) {
    plusUntil = passEnd(p);
    plusPassName = p.name;
    payments.insert(0, Payment(p.name, dayMonth(DateTime.now()), method, p.price));
    notifyListeners();
  }

  // ── Alerts & voice ──
  int alertTiming = 1; // 0 early, 1 standard, 2 late
  String voiceLanguage = 'English';
  final spoken = <String, bool>{
    'Robot out': true,
    'Pothole': true,
    'Kombi stop': true,
    'Flooding': true,
    'Crime hotspot': true,
    'Unconfirmed': false,
  };
  bool chime50 = true;
  bool passengerMode = false;
  bool dataSaver = true;
  bool quietHours = false;

  // ── Privacy ──
  bool locationAlways = true;
  bool physicalActivity = true;
  bool crashReports = true;

  // ── Community ──
  final blocked = <String>{'Musa D.'};
  final myReports = <MyReport>[
    MyReport('Robot not working', 'Seke × Cripps', '22 min ago', ReportStatus.live, confirms: 2),
    MyReport('Pothole, left lane', 'Rotten Row', '3 days ago', ReportStatus.live, confirms: 9),
    MyReport('Kombis stop mid-road', 'Samora Machel E', '1 wk', ReportStatus.live, confirms: 14),
    MyReport('New camera?', 'Kwame Nkrumah × 2nd St', '2 wk', ReportStatus.review),
    MyReport('Flooding', 'Mbare Rd', '1 mo', ReportStatus.expired),
  ];
  final pinsToFinish = <MyReport>[];
  final flagsSent = <String>[];
  int postedCount = 38;

  void dropPin(String type) {
    pinsToFinish.insert(0, MyReport(type, 'Samora Machel Ave · pin', 'just now', ReportStatus.review, pin: true));
    notifyListeners();
  }

  void finishPin(MyReport r) {
    pinsToFinish.remove(r);
    myReports.insert(0, MyReport(r.title, r.place.replaceAll(' · pin', ''), 'just now', ReportStatus.live));
    postedCount++;
    notifyListeners();
  }

  void deleteReport(MyReport r) {
    myReports.remove(r);
    pinsToFinish.remove(r);
    postedCount = (postedCount - 1).clamp(0, 9999);
    notifyListeners();
  }

  void eraseMyReports() {
    myReports.clear();
    pinsToFinish.clear();
    postedCount = 0;
    notifyListeners();
  }

  // ── Auth lifecycle ──
  void signIn() {
    signedIn = true;
    _loadDemoAccount();
    notifyListeners();
  }

  void signOut() {
    signedIn = false;
    notifyListeners();
  }

  void deleteAccount() {
    signedIn = false;
    _accountLoaded = true; // deleted: nothing to load back
    agreedToRules = false;
    plusUntil = null;
    payments.clear();
    myReports.clear();
    pinsToFinish.clear();
    blocked.clear();
    postedCount = 0;
    notifyListeners();
  }

  void finishOnboarding() {
    onboarded = true;
    notifyListeners();
  }

  void markTourSeen() {
    tourSeen = true;
    notifyListeners();
  }

  void touch() => notifyListeners();
}

/// Inherited access: `App.of(context)` rebuilds on change, `App.read(context)` doesn't.
class App extends InheritedNotifier<AppState> {
  const App({super.key, required AppState state, required super.child}) : super(notifier: state);

  static AppState of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<App>()!.notifier!;
  static AppState read(BuildContext context) => context.getInheritedWidgetOfExactType<App>()!.notifier!;
}
