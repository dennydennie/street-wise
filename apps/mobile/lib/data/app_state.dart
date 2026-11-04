import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:streetwise_zw/core/api/api_client.dart';
import 'package:streetwise_zw/core/config/env.dart';
import 'package:streetwise_zw/core/services/location_service.dart';
import 'package:streetwise_zw/core/services/passkey_service.dart';
import 'package:streetwise_zw/core/services/voice_service.dart';
import 'package:streetwise_zw/core/storage/local_store.dart';
import 'package:streetwise_zw/data/api/streetwise_api.dart';
import 'package:streetwise_zw/data/models.dart';

export 'package:streetwise_zw/data/models.dart';

String money(double v) => 'US\$${v.toStringAsFixed(2)}';
const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String dayMonth(DateTime d) => '${d.day} ${_months[d.month - 1]}';
String hm(DateTime d) => '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

String ago(DateTime? t, {DateTime? now}) {
  if (t == null) return '';
  final d = (now ?? DateTime.now()).difference(t);
  if (d.inMinutes < 1) return 'just now';
  if (d.inMinutes < 60) return '${d.inMinutes} min ago';
  if (d.inHours < 24) return '${d.inHours} h ago';
  if (d.inDays < 7) return '${d.inDays} d ago';
  if (d.inDays < 30) return '${d.inDays ~/ 7} wk ago';
  return '${d.inDays ~/ 30} mo ago';
}

/// A pin dropped without an account or connection; posted as a draft once possible.
class PendingPin {
  PendingPin({required this.type, required this.lat, required this.lng, required this.capturedAt, this.transcript});
  factory PendingPin.fromJson(Map<String, dynamic> j) => PendingPin(
        type: ReportType.parse(j['type']) ?? ReportType.pothole,
        lat: (j['lat'] as num).toDouble(),
        lng: (j['lng'] as num).toDouble(),
        capturedAt: DateTime.parse(j['capturedAt'] as String),
        transcript: j['transcript'] as String?,
      );
  Map<String, dynamic> toJson() =>
      {'type': type.wire, 'lat': lat, 'lng': lng, 'capturedAt': capturedAt.toIso8601String(), 'transcript': transcript};

  final ReportType type;
  final double lat;
  final double lng;
  final DateTime capturedAt;
  final String? transcript;
}

/// App-wide state backed by the StreetWise API. Screens read it through `App.of(context)`.
class AppState extends ChangeNotifier {
  AppState({StreetWiseApi? api, LocalStore? store, this.location, this.voice, this.passkeyDevice})
      : api = api ?? StreetWiseApi(ApiClient(baseUrl: Env.apiBaseUrl)),
        _store = store {
    this.api.client.onUnauthorized = _onUnauthorized;
  }

  final StreetWiseApi api;
  LocalStore? _store;
  final LocationService? location;
  final VoiceService? voice;
  final PasskeyService? passkeyDevice;

  ApiClient get client => api.client;

  // ── Lifecycle ──
  bool ready = false;
  bool offline = false;
  PublicConfig config = PublicConfig();

  // ── Session ──
  UserProfile? user;
  bool get signedIn => user != null;
  bool onboarded = false;
  bool tourSeen = false;

  String get displayName => user?.displayName ?? 'Driver';
  String get phone => user?.phone ?? '';
  String get phoneMasked {
    final p = phone;
    if (p.length < 8) return p;
    return '${p.substring(0, 4)} ${p.substring(4, 6)} ••• ${p.substring(p.length - 4)}';
  }

  String get initials {
    final parts = displayName.split(' ').where((s) => s.isNotEmpty).toList();
    return parts.map((s) => s[0]).take(2).join().toUpperCase();
  }

  bool get agreedToRules => user?.agreedToRules ?? false;

  // ── Public data ──
  List<Camera> cameras = [];
  DateTime? camerasSyncedAt;
  Briefing? briefing;
  bool briefingLoading = false;
  List<PassOption> catalogue = PassOption.fallback;
  Fix here = Fix.harare;

  // ── Account data ──
  List<PasskeyInfo> passkeys = [];
  List<SessionInfo> sessions = [];
  List<Report> myReports = [];
  List<BlockInfo> blocks = [];
  MyPass pass = MyPass();
  List<Payment> payments = [];
  final List<PendingPin> pendingPins = [];
  final List<String> flagsSent = [];

  List<Report> get drafts => myReports.where((r) => r.status == 'draft').toList();
  List<Report> get posted => myReports.where((r) => r.status != 'draft').toList();
  int get postedCount => posted.length;

  bool get plusActive => pass.active && (pass.endsAt?.isAfter(DateTime.now()) ?? false);
  int get plusDaysLeft => plusActive ? pass.endsAt!.difference(DateTime.now()).inDays : 0;
  PassOption? get currentPass => catalogue.where((p) => p.id == pass.passId).firstOrNull;
  String get plusPassName => currentPass?.label ?? 'Plus';

  /// Extend stacks on the current end date; a fresh pass starts now (mirrors the API rule).
  DateTime passEnd(PassOption p) => (plusActive ? pass.endsAt! : DateTime.now()).add(Duration(days: p.durationDays));

  // ── Alerts & voice settings (device-local) ──
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
  bool locationAlways = true;
  bool physicalActivity = true;
  bool crashReports = true;

  /// Alert distance for cameras by timing setting (≈15–20 s at city speeds for Standard).
  double get alertDistanceM => const [500.0, 300.0, 150.0][alertTiming];

  bool speaks(ReportType t) => switch (t) {
        ReportType.robotOut => spoken['Robot out'] ?? true,
        ReportType.pothole => spoken['Pothole'] ?? true,
        ReportType.kombiStop => spoken['Kombi stop'] ?? true,
        ReportType.flooding => spoken['Flooding'] ?? true,
        ReportType.crimeHotspot => spoken['Crime hotspot'] ?? true,
        ReportType.camera => true,
      };

  // ───────────────────────────── Startup ─────────────────────────────

  Future<void> init() async {
    _store ??= await LocalStore.open();
    final s = _store!;
    onboarded = s.flag('onboarded');
    tourSeen = s.flag('tourSeen');
    _loadSettings(s);
    _loadCameraCache(s);
    final pins = s.json('pendingPins');
    if (pins is List) pendingPins.addAll(pins.whereType<Map>().map((m) => PendingPin.fromJson(m.cast())));

    await voice?.init();
    voice?.language = _langCode;

    client.token = await s.readToken();
    ready = true;
    notifyListeners();

    // Network work after first paint.
    unawaited(_bootstrap());
  }

  Future<void> _bootstrap() async {
    await Future.wait([refreshPublic(), if (client.token != null) refreshAccount()]);
    final fix = await location?.current();
    if (fix != null) here = fix;
    await refreshBriefing();
  }

  Future<void> refreshPublic() async {
    try {
      final results = await Future.wait([api.config(), api.cameras(), api.passCatalogue()]);
      config = results[0] as PublicConfig;
      cameras = results[1] as List<Camera>;
      final cat = results[2] as List<PassOption>;
      if (cat.isNotEmpty) catalogue = cat;
      camerasSyncedAt = DateTime.now();
      offline = false;
      await _store?.setJson('cameraCache', {'at': camerasSyncedAt!.toIso8601String(), 'cameras': cameras.map((c) => c.toJson()).toList()});
    } on ApiException catch (e) {
      if (e.isNetwork) offline = true;
    }
    notifyListeners();
  }

  Future<void> refreshAccount() async {
    if (client.token == null) return;
    try {
      user = await api.me();
      final r = await Future.wait([api.myPass(), api.myPayments(), api.myReports(), api.passkeys(), api.blocks()]);
      pass = r[0] as MyPass;
      payments = r[1] as List<Payment>;
      myReports = r[2] as List<Report>;
      passkeys = r[3] as List<PasskeyInfo>;
      blocks = r[4] as List<BlockInfo>;
      offline = false;
      unawaited(_flushPendingPins());
    } on ApiException catch (e) {
      if (e.isNetwork) offline = true;
    }
    notifyListeners();
  }

  Future<void> refreshSessions() async {
    try {
      sessions = await api.sessions();
      notifyListeners();
    } on ApiException catch (_) {}
  }

  Future<void> refreshBriefing({DateTime? at, double? lat, double? lng}) async {
    briefingLoading = true;
    notifyListeners();
    try {
      briefing = await api.briefings(lat: lat ?? here.lat, lng: lng ?? here.lng, at: at, radiusM: 3000, limit: 20);
      offline = false;
    } on ApiException catch (e) {
      if (e.isNetwork) offline = true;
    } finally {
      briefingLoading = false;
      notifyListeners();
    }
  }

  Future<Fix> locate({bool request = false}) async {
    final f = await location?.current(request: request);
    if (f != null) here = f;
    notifyListeners();
    return here;
  }

  // ───────────────────────────── Auth ─────────────────────────────

  Future<OtpRequestResult> requestOtp(String phone) => api.requestOtp(phone);

  Future<AuthResult> verifyOtp(String phone, String code) async {
    final r = await api.verifyOtp(phone, code, deviceLabel: _deviceLabel);
    await _adopt(r);
    return r;
  }

  /// Discoverable-credential sign-in: the OS lists this app's passkeys.
  Future<AuthResult?> signInWithPasskey({String? phone}) async {
    final device = passkeyDevice ?? PasskeyService();
    final (challengeId, options) = await api.passkeyAuthenticationOptions(phone: phone);
    final response = await device.get(options);
    final r = await api.passkeyAuthenticationVerify(challengeId, response, deviceLabel: _deviceLabel);
    await _adopt(r);
    return r;
  }

  Future<void> createPasskey({String? label}) async {
    final device = passkeyDevice ?? PasskeyService();
    final (challengeId, options) = await api.passkeyRegistrationOptions(label: label ?? _deviceLabel);
    final response = await device.create(options);
    final pk = await api.passkeyRegistrationVerify(challengeId, response, label: label ?? _deviceLabel);
    passkeys = [pk, ...passkeys.where((p) => p.id != pk.id)];
    notifyListeners();
  }

  Future<void> deletePasskey(PasskeyInfo pk) async {
    await api.deletePasskey(pk.id);
    passkeys.removeWhere((p) => p.id == pk.id);
    notifyListeners();
  }

  Future<void> completeProfile({required String displayName, required bool agreed}) async {
    user = await api.updateMe(displayName: displayName, agreedToRulesAt: agreed && !agreedToRules ? DateTime.now() : null);
    notifyListeners();
  }

  Future<void> rename(String name) async {
    user = await api.updateMe(displayName: name);
    notifyListeners();
  }

  Future<void> _adopt(AuthResult r) async {
    client.token = r.accessToken;
    await _store?.writeToken(r.accessToken);
    user = r.user;
    notifyListeners();
    unawaited(refreshAccount());
  }

  Future<void> signOut() async {
    // Revoke this session server-side when we can; local sign-out always succeeds.
    try {
      final current = (await api.sessions()).where((s) => s.current).firstOrNull;
      if (current != null) await api.revokeSession(current.id);
    } catch (_) {}
    await _clearAccount();
  }

  Future<void> deleteAccount() async {
    await api.deleteMe();
    await _store?.clearAccountData();
    await _clearAccount();
  }

  Future<void> signOutOtherDevices() async {
    await api.signOutOtherDevices();
    await refreshSessions();
  }

  void _onUnauthorized() {
    unawaited(_clearAccount());
  }

  Future<void> _clearAccount() async {
    client.token = null;
    await _store?.writeToken(null);
    user = null;
    passkeys = [];
    sessions = [];
    myReports = [];
    blocks = [];
    pass = MyPass();
    payments = [];
    flagsSent.clear();
    notifyListeners();
  }

  // ───────────────────────────── Reports ─────────────────────────────

  Future<ReportAnalysis?> analyze(String transcript) async {
    if (!signedIn || transcript.trim().isEmpty) return null;
    try {
      return await api.analyze(transcript);
    } on ApiException catch (_) {
      return null;
    }
  }

  /// Posts a report (or a draft pin). Anonymous or offline → kept on the phone and
  /// posted as a draft after sign-in. Returns true when it reached the server.
  Future<bool> submitReport({required ReportType? type, required Fix at, String? transcript, String? note, bool draft = false}) async {
    final now = DateTime.now();
    if (!signedIn || !agreedToRules) {
      _queuePin(PendingPin(type: type ?? ReportType.pothole, lat: at.lat, lng: at.lng, capturedAt: now, transcript: transcript));
      return false;
    }
    try {
      final r = await api.createReport(
        type: type,
        lat: at.lat,
        lng: at.lng,
        note: note,
        transcript: transcript,
        heading: at.heading?.round(),
        capturedAt: now,
        draft: draft,
      );
      myReports = [r, ...myReports];
      notifyListeners();
      unawaited(refreshBriefing());
      return true;
    } on ApiException catch (e) {
      if (e.isNetwork) {
        _queuePin(PendingPin(type: type ?? ReportType.pothole, lat: at.lat, lng: at.lng, capturedAt: now, transcript: transcript));
        return false;
      }
      rethrow;
    }
  }

  void _queuePin(PendingPin p) {
    pendingPins.insert(0, p);
    unawaited(_store?.setJson('pendingPins', pendingPins.map((e) => e.toJson()).toList()));
    notifyListeners();
  }

  bool _flushing = false;

  Future<void> _flushPendingPins() async {
    // Single flight: overlapping account refreshes must not post a pin twice.
    if (_flushing || !signedIn || !agreedToRules || pendingPins.isEmpty) return;
    _flushing = true;
    try {
      await _flushPendingPinsOnce();
    } finally {
      _flushing = false;
    }
  }

  Future<void> _flushPendingPinsOnce() async {
    final week = DateTime.now().subtract(const Duration(days: 7));
    for (final p in pendingPins.toList()) {
      try {
        if (p.capturedAt.isAfter(week)) {
          final r = await api.createReport(
              type: p.type, lat: p.lat, lng: p.lng, transcript: p.transcript, capturedAt: p.capturedAt, draft: true);
          myReports = [r, ...myReports];
        }
        pendingPins.remove(p);
      } on ApiException catch (e) {
        if (e.isNetwork) break;
        pendingPins.remove(p); // rejected by the server: don't retry forever
      }
    }
    await _store?.setJson('pendingPins', pendingPins.map((e) => e.toJson()).toList());
    notifyListeners();
  }

  Future<void> publishDraft(Report r) async {
    final updated = await api.updateReport(r.id, publish: true);
    myReports = [for (final x in myReports) x.id == r.id ? updated : x];
    notifyListeners();
  }

  Future<void> retypeReport(Report r, ReportType type) async {
    final updated = await api.updateReport(r.id, type: type);
    myReports = [for (final x in myReports) x.id == r.id ? updated : x];
    notifyListeners();
  }

  Future<void> deleteReport(Report r) async {
    await api.deleteReport(r.id);
    myReports.removeWhere((x) => x.id == r.id);
    notifyListeners();
  }

  void discardPendingPin(PendingPin p) {
    pendingPins.remove(p);
    unawaited(_store?.setJson('pendingPins', pendingPins.map((e) => e.toJson()).toList()));
    notifyListeners();
  }

  Future<int> eraseMyReports() async {
    final n = await api.eraseMyReports();
    myReports = [];
    notifyListeners();
    return n;
  }

  Future<void> vote(Report r, {required bool stillThere}) async {
    if (!signedIn) return;
    try {
      await api.vote(r.id, stillThere: stillThere);
    } on ApiException catch (_) {}
  }

  Future<void> flag(Report r, {required String reason, required String reasonLabel, bool block = false}) async {
    await api.flag(r.id, reason: reason, blockReporter: block);
    flagsSent.insert(0, '$reasonLabel · ${r.type.label} at ${r.place}');
    if (block) blocks = await api.blocks();
    notifyListeners();
    unawaited(refreshBriefing());
  }

  Future<void> unblock(BlockInfo b) async {
    await api.unblock(b.id);
    blocks.removeWhere((x) => x.id == b.id);
    notifyListeners();
  }

  // ───────────────────────────── Payments ─────────────────────────────

  Future<Payment> startPayment(PassOption p, {required String method, String? phone}) =>
      api.createPayment(passId: p.id, method: method, phone: phone);

  Future<Payment> pollPayment(String reference) => api.payment(reference);

  /// After a paid callback: pull the pass and history the server now holds.
  Future<void> refreshPass() async {
    try {
      final r = await Future.wait([api.myPass(), api.myPayments()]);
      pass = r[0] as MyPass;
      payments = r[1] as List<Payment>;
      notifyListeners();
    } on ApiException catch (_) {}
  }

  // ───────────────────────────── Local flags & settings ─────────────────────────────

  void finishOnboarding() {
    onboarded = true;
    unawaited(_store?.setFlag('onboarded', true));
    notifyListeners();
  }

  void markTourSeen() {
    tourSeen = true;
    unawaited(_store?.setFlag('tourSeen', true));
    notifyListeners();
  }

  /// Persist settings and rebuild listeners (call after mutating a setting field).
  void touch() {
    final s = _store;
    if (s != null) {
      unawaited(s.setJson('settings', {
        'alertTiming': alertTiming,
        'voiceLanguage': voiceLanguage,
        'spoken': spoken,
        'chime50': chime50,
        'passengerMode': passengerMode,
        'dataSaver': dataSaver,
        'quietHours': quietHours,
        'locationAlways': locationAlways,
        'physicalActivity': physicalActivity,
        'crashReports': crashReports,
      }));
    }
    voice?.language = _langCode;
    notifyListeners();
  }

  String get _langCode => switch (voiceLanguage) { 'Shona' => 'sn', 'Ndebele' => 'nd', _ => 'en' };

  void _loadSettings(LocalStore s) {
    final j = s.json('settings');
    if (j is! Map) return;
    alertTiming = (j['alertTiming'] as num?)?.toInt() ?? alertTiming;
    voiceLanguage = j['voiceLanguage'] as String? ?? voiceLanguage;
    final sp = j['spoken'];
    if (sp is Map) {
      for (final e in sp.entries) {
        if (e.value is bool) spoken['${e.key}'] = e.value as bool;
      }
    }
    chime50 = j['chime50'] as bool? ?? chime50;
    passengerMode = j['passengerMode'] as bool? ?? passengerMode;
    dataSaver = j['dataSaver'] as bool? ?? dataSaver;
    quietHours = j['quietHours'] as bool? ?? quietHours;
    locationAlways = j['locationAlways'] as bool? ?? locationAlways;
    physicalActivity = j['physicalActivity'] as bool? ?? physicalActivity;
    crashReports = j['crashReports'] as bool? ?? crashReports;
  }

  void _loadCameraCache(LocalStore s) {
    final j = s.json('cameraCache');
    if (j is! Map) return;
    final list = j['cameras'];
    if (list is List) cameras = list.whereType<Map>().map((m) => Camera.fromJson(m.cast())).toList();
    camerasSyncedAt = DateTime.tryParse('${j['at']}');
  }

  String get _deviceLabel => kIsWeb
      ? 'Web browser'
      : switch (defaultTargetPlatform) {
          TargetPlatform.android => 'Android phone',
          TargetPlatform.iOS => 'iPhone',
          _ => 'This device',
        };
}

/// Inherited access: `App.of(context)` rebuilds on change, `App.read(context)` doesn't.
class App extends InheritedNotifier<AppState> {
  const App({super.key, required AppState state, required super.child}) : super(notifier: state);

  static AppState of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<App>()!.notifier!;
  static AppState read(BuildContext context) => context.getInheritedWidgetOfExactType<App>()!.notifier!;
}
