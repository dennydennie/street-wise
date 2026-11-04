/// Typed views of the StreetWise API contracts (`packages/shared/src/schemas.ts`).
/// Parsing is tolerant: unknown fields are ignored and missing optional ones become null,
/// so the app keeps working while the API grows.
library;

typedef Json = Map<String, dynamic>;

DateTime? _date(Object? v) => v is String ? DateTime.tryParse(v)?.toLocal() : null;
double _num(Object? v, [double fallback = 0]) => v is num ? v.toDouble() : (double.tryParse('$v') ?? fallback);
int _int(Object? v, [int fallback = 0]) => v is num ? v.toInt() : (int.tryParse('$v') ?? fallback);
String? _str(Object? v) => v is String && v.isNotEmpty ? v : null;
List<String> _strings(Object? v) => v is List ? v.map((e) => '$e').toList() : const [];
List<Json> _list(Object? v) => v is List ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList() : const [];

// ───────────────────────────── Report types ─────────────────────────────

enum ReportType {
  pothole('pothole', 'Pothole', 2),
  robotOut('robot_out', 'Robot out', 3),
  kombiStop('kombi_stop', 'Kombi stop', 2),
  flooding('flooding', 'Flooding', 4),
  crimeHotspot('crime_hotspot', 'Crime hotspot', 5),
  camera('camera', 'Camera', 2);

  const ReportType(this.wire, this.label, this.weight);
  final String wire;
  final String label;
  final int weight;

  static ReportType? parse(Object? v) {
    for (final t in values) {
      if (t.wire == v) return t;
    }
    return null;
  }
}

// ───────────────────────────── Users & auth ─────────────────────────────

class UserProfile {
  UserProfile({required this.id, this.phone, this.displayName, this.agreedToRulesAt, this.createdAt});
  factory UserProfile.fromJson(Json j) => UserProfile(
        id: '${j['id']}',
        phone: _str(j['phone']),
        displayName: _str(j['displayName']),
        agreedToRulesAt: _date(j['agreedToRulesAt']),
        createdAt: _date(j['createdAt']),
      );

  final String id;
  final String? phone;
  final String? displayName;
  final DateTime? agreedToRulesAt;
  final DateTime? createdAt;

  bool get agreedToRules => agreedToRulesAt != null;
}

class AuthResult {
  AuthResult(this.accessToken, this.isNewUser, this.user);
  factory AuthResult.fromJson(Json j) =>
      AuthResult('${j['accessToken']}', j['isNewUser'] == true, UserProfile.fromJson((j['user'] as Map).cast()));
  final String accessToken;
  final bool isNewUser;
  final UserProfile user;
}

class OtpRequestResult {
  OtpRequestResult({required this.resendAfterSeconds, this.devCode});
  factory OtpRequestResult.fromJson(Json j) =>
      OtpRequestResult(resendAfterSeconds: _int(j['resendAfterSeconds'], 60), devCode: _str(j['devCode']));
  final int resendAfterSeconds;

  /// Only present when the API runs with OTP_DEV_ECHO (local development).
  final String? devCode;
}

class PasskeyInfo {
  PasskeyInfo({required this.id, this.label, this.createdAt, this.lastUsedAt});
  factory PasskeyInfo.fromJson(Json j) => PasskeyInfo(
        id: '${j['id']}',
        label: _str(j['label']),
        createdAt: _date(j['createdAt']),
        lastUsedAt: _date(j['lastUsedAt']),
      );
  final String id;
  final String? label;
  final DateTime? createdAt;
  final DateTime? lastUsedAt;
}

class SessionInfo {
  SessionInfo({required this.id, this.deviceLabel, this.lastSeenAt, this.current = false});
  factory SessionInfo.fromJson(Json j) => SessionInfo(
        id: '${j['id']}',
        deviceLabel: _str(j['deviceLabel']),
        lastSeenAt: _date(j['lastSeenAt']),
        current: j['current'] == true,
      );
  final String id;
  final String? deviceLabel;
  final DateTime? lastSeenAt;
  final bool current;
}

// ───────────────────────────── Map data ─────────────────────────────

class Camera {
  Camera({required this.id, required this.name, required this.lat, required this.lng, this.checks = const [], this.source = 'official', this.confidence = 1});
  factory Camera.fromJson(Json j) => Camera(
        id: '${j['id']}',
        name: '${j['name']}',
        lat: _num(j['lat']),
        lng: _num(j['lng']),
        checks: _strings(j['checks']),
        source: _str(j['source']) ?? 'official',
        confidence: _num(j['confidence'], 1),
      );
  Json toJson() => {'id': id, 'name': name, 'lat': lat, 'lng': lng, 'checks': checks, 'source': source, 'confidence': confidence};

  final String id;
  final String name;
  final double lat;
  final double lng;
  final List<String> checks;
  final String source;
  final double confidence;

  static const _checkLabels = {'red_light': 'Red light', 'stop_line': 'Stop line', 'phone_use': 'Phone use', 'seatbelt': 'Seatbelt'};
  List<String> get checkLabels => checks.map((c) => _checkLabels[c] ?? c).toList();
}

class Report {
  Report({
    required this.id,
    required this.type,
    required this.lat,
    required this.lng,
    this.note,
    this.status = 'live',
    this.stillThereCount = 0,
    this.goneCount = 0,
    this.expiresAt,
    this.createdAt,
    this.capturedAt,
    this.isMine = false,
    this.areaId,
    this.locationName,
    this.summary,
    this.severity,
    this.tags = const [],
    this.transcript,
  });

  factory Report.fromJson(Json j) => Report(
        id: '${j['id']}',
        type: ReportType.parse(j['type']) ?? ReportType.pothole,
        lat: _num(j['lat']),
        lng: _num(j['lng']),
        note: _str(j['note']),
        status: _str(j['status']) ?? 'live',
        stillThereCount: _int(j['stillThereCount']),
        goneCount: _int(j['goneCount']),
        expiresAt: _date(j['expiresAt']),
        createdAt: _date(j['createdAt']),
        capturedAt: _date(j['capturedAt']),
        isMine: j['isMine'] == true,
        areaId: _str(j['areaId']),
        locationName: _str(j['locationName']),
        summary: _str(j['summary']),
        severity: j['severity'] == null ? null : _int(j['severity']),
        tags: _strings(j['tags']),
        transcript: _str(j['transcript']),
      );

  final String id;
  final ReportType type;
  final double lat;
  final double lng;
  final String? note;

  /// API: draft | live | review | gone | removed; on "My reports": draft | live | review | expired.
  final String status;
  final int stillThereCount;
  final int goneCount;
  final DateTime? expiresAt;
  final DateTime? createdAt;
  final DateTime? capturedAt;
  final bool isMine;
  final String? areaId;
  final String? locationName;
  final String? summary;
  final int? severity;
  final List<String> tags;
  final String? transcript;

  String get title => summary ?? note ?? type.label;
  String get place => locationName ?? '${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}';
}

// ───────────────────────────── Analysis & briefings ─────────────────────────────

class ReportAnalysis {
  ReportAnalysis({this.type, this.confidence = 0, this.summary = '', this.severity = 1, this.tags = const [], this.redacted = false});
  factory ReportAnalysis.fromJson(Json j) => ReportAnalysis(
        type: ReportType.parse(j['type']),
        confidence: _num(j['confidence']),
        summary: _str(j['summary']) ?? '',
        severity: _int(j['severity'], 1),
        tags: _strings(j['tags']),
        redacted: j['redacted'] == true,
      );
  final ReportType? type;
  final double confidence;
  final String summary;
  final int severity;
  final List<String> tags;
  final bool redacted;
}

class BriefingItem {
  BriefingItem({
    required this.type,
    required this.label,
    this.liveCount = 0,
    this.reportsLast90d = 0,
    this.confirmations = 0,
    this.latestAt,
    this.peakBand,
    this.peakHours,
    this.shareInCurrentBand = 0,
    this.relevantNow = false,
    this.summary = '',
  });
  factory BriefingItem.fromJson(Json j) {
    final type = ReportType.parse(j['type']) ?? ReportType.pothole;
    return BriefingItem(
      type: type,
      label: _str(j['label']) ?? type.label,
      liveCount: _int(j['liveCount']),
      reportsLast90d: _int(j['reportsLast90d']),
      confirmations: _int(j['confirmations']),
      latestAt: _date(j['latestAt']),
      peakBand: _str(j['peakBand']),
      peakHours: _str(j['peakHours']),
      shareInCurrentBand: _num(j['shareInCurrentBand']),
      relevantNow: j['relevantNow'] == true,
      summary: _str(j['summary']) ?? '',
    );
  }
  final ReportType type;
  final String label;
  final int liveCount;
  final int reportsLast90d;
  final int confirmations;
  final DateTime? latestAt;
  final String? peakBand;
  final String? peakHours;
  final double shareInCurrentBand;
  final bool relevantNow;
  final String summary;
}

enum Priority { high, medium, low }

class AreaBriefing {
  AreaBriefing({
    required this.areaId,
    required this.name,
    required this.lat,
    required this.lng,
    this.distanceM = 0,
    this.priority = Priority.low,
    this.score = 0,
    this.alert = false,
    this.headline = '',
    this.advice = '',
    this.items = const [],
    this.hourly = const [],
    this.recent = const [],
  });
  factory AreaBriefing.fromJson(Json j) => AreaBriefing(
        areaId: '${j['areaId'] ?? j['id']}',
        name: _str(j['name']) ?? 'Unnamed area',
        lat: _num(j['lat']),
        lng: _num(j['lng']),
        distanceM: _num(j['distanceM']),
        priority: switch (j['priority']) { 'high' => Priority.high, 'medium' => Priority.medium, _ => Priority.low },
        score: _num(j['score']),
        alert: j['alert'] == true,
        headline: _str(j['headline']) ?? '',
        advice: _str(j['advice']) ?? '',
        items: _list(j['items']).map(BriefingItem.fromJson).toList(),
        hourly: j['hourly'] is List ? (j['hourly'] as List).map((e) => _int(e)).toList() : const [],
        recent: _list(j['recent']).map(Report.fromJson).toList(),
      );

  final String areaId;
  final String name;
  final double lat;
  final double lng;
  final double distanceM;
  final Priority priority;
  final double score;
  final bool alert;
  final String headline;
  final String advice;
  final List<BriefingItem> items;
  final List<int> hourly;
  final List<Report> recent;

  List<BriefingItem> get relevant => items.where((i) => i.relevantNow).toList();
  List<BriefingItem> get notNow => items.where((i) => !i.relevantNow).toList();
  int get liveCount => items.fold(0, (s, i) => s + i.liveCount);
  BriefingItem? get lead => relevant.isNotEmpty ? relevant.first : (items.isNotEmpty ? items.first : null);
}

class Briefing {
  Briefing({required this.timeBand, required this.areas, this.generatedAt});
  factory Briefing.fromJson(Json j) => Briefing(
        timeBand: _str(j['timeBand']) ?? 'midday',
        generatedAt: _date(j['generatedAt']),
        areas: _list(j['areas']).map(AreaBriefing.fromJson).toList(),
      );
  final String timeBand;
  final DateTime? generatedAt;
  final List<AreaBriefing> areas;

  String get timeBandLabel => switch (timeBand) {
        'morning' => 'Morning',
        'midday' => 'Midday',
        'evening' => 'Evening',
        'night' => 'Night',
        _ => timeBand,
      };
}

// ───────────────────────────── Passes & payments ─────────────────────────────

class PassOption {
  const PassOption({required this.id, required this.label, required this.priceCents, required this.durationDays});
  factory PassOption.fromJson(Json j) => PassOption(
        id: '${j['id']}',
        label: _str(j['label']) ?? '${j['id']}',
        priceCents: _int(j['priceCents']),
        durationDays: _int(j['durationDays'], 1),
      );
  final String id;
  final String label;
  final int priceCents;
  final int durationDays;

  double get price => priceCents / 100;
  String get duration => durationDays == 1 ? '24 hours' : '$durationDays days';
  String? get badge => switch (id) { 'week' => 'Most used', 'month' => 'Save 30%', _ => null };

  static const fallback = [
    PassOption(id: 'day', label: 'Day pass', priceCents: 50, durationDays: 1),
    PassOption(id: 'week', label: 'Week pass', priceCents: 150, durationDays: 7),
    PassOption(id: 'month', label: 'Month pass', priceCents: 400, durationDays: 30),
  ];
}

class MyPass {
  MyPass({this.active = false, this.passId, this.endsAt});
  factory MyPass.fromJson(Json j) => MyPass(active: j['active'] == true, passId: _str(j['passId']), endsAt: _date(j['endsAt']));
  final bool active;
  final String? passId;
  final DateTime? endsAt;
}

class Payment {
  Payment({
    required this.reference,
    required this.passId,
    required this.method,
    required this.status,
    required this.amountCents,
    this.redirectUrl,
    this.instructions,
    this.failureReason,
    this.createdAt,
    this.paidAt,
  });
  factory Payment.fromJson(Json j) => Payment(
        reference: '${j['reference']}',
        passId: '${j['passId']}',
        method: '${j['method']}',
        status: '${j['status']}',
        amountCents: _int(j['amountCents']),
        redirectUrl: _str(j['redirectUrl']),
        instructions: _str(j['instructions']),
        failureReason: _str(j['failureReason']),
        createdAt: _date(j['createdAt']),
        paidAt: _date(j['paidAt']),
      );
  final String reference;
  final String passId;

  /// ecocash | paynow_web
  final String method;

  /// created | pending | paid | failed | cancelled
  final String status;
  final int amountCents;
  final String? redirectUrl;
  final String? instructions;
  final String? failureReason;
  final DateTime? createdAt;
  final DateTime? paidAt;

  bool get settled => status == 'paid' || status == 'failed' || status == 'cancelled';
  String get methodLabel => method == 'ecocash' ? 'EcoCash' : 'Paynow';
}

class BlockInfo {
  BlockInfo(this.id, this.createdAt);
  factory BlockInfo.fromJson(Json j) => BlockInfo('${j['id']}', _date(j['createdAt']));
  final String id;
  final DateTime? createdAt;
}

// ───────────────────────────── Public config ─────────────────────────────

class PublicConfig {
  PublicConfig({
    this.tileUrlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    this.attribution = '© OpenStreetMap contributors',
    this.provider = 'osm',
    this.maxZoom = 19,
    this.serverTranscription = false,
    this.passkeys = true,
    this.llmAnalysis = false,
  });
  factory PublicConfig.fromJson(Json j) {
    final map = (j['map'] as Map?)?.cast<String, dynamic>() ?? const {};
    final f = (j['features'] as Map?)?.cast<String, dynamic>() ?? const {};
    return PublicConfig(
      provider: _str(map['provider']) ?? 'osm',
      tileUrlTemplate: _str(map['tileUrlTemplate']) ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: _str(map['attribution']) ?? '© OpenStreetMap contributors',
      maxZoom: _num(map['maxZoom'], 19),
      serverTranscription: f['serverTranscription'] == true,
      passkeys: f['passkeys'] != false,
      llmAnalysis: f['llmAnalysis'] == true,
    );
  }
  final String provider;
  final String tileUrlTemplate;
  final String attribution;
  final double maxZoom;
  final bool serverTranscription;
  final bool passkeys;
  final bool llmAnalysis;
}
