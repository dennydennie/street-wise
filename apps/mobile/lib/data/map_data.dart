/// Harare CBD sample data for the map placeholder and community reports.
/// Positions are fractions of the map canvas (0–1); real build uses OSM tiles via flutter_map.
library;

class MapPoint {
  const MapPoint({
    required this.id,
    required this.x,
    required this.y,
    required this.camera,
    required this.title,
    required this.kicker,
    this.detail = '',
    this.source = 'Community',
    this.expiry = 'Expires in 2 h',
    this.confirms = 0,
    this.by,
    this.age,
  });

  final String id;
  final double x;
  final double y;
  final bool camera;
  final String title;
  final String kicker;
  final String detail;
  final String source;
  final String expiry;
  final int confirms;
  final String? by;
  final String? age;
}

const mapStreets = <(String, double, bool)>[
  // (name, position 0–1, horizontal?)
  ('Jason Moyo Ave', 0.12, true),
  ('Samora Machel Ave', 0.38, true),
  ('Robert Mugabe Rd', 0.64, true),
  ('Julius Nyerere', 0.48, false),
  ('Simon Muzenda', 0.22, false),
];

const mapPoints = <MapPoint>[
  MapPoint(
    id: 'cam-smjn',
    x: 0.48,
    y: 0.38,
    camera: true,
    kicker: 'Camera robot · all approaches',
    title: 'Samora Machel × Julius Nyerere',
    detail: 'Red light · stop line · phone · seatbelt',
    source: 'Official',
    expiry: 'Never expires',
  ),
  MapPoint(
    id: 'cam-jmsm',
    x: 0.22,
    y: 0.12,
    camera: true,
    kicker: 'Camera robot · northbound',
    title: 'Jason Moyo × Simon Muzenda',
    detail: 'Red light · stop line',
    source: 'Official',
    expiry: 'Never expires',
  ),
  MapPoint(
    id: 'cam-rmjn',
    x: 0.78,
    y: 0.64,
    camera: true,
    kicker: 'Camera robot · eastbound',
    title: 'Robert Mugabe × 4th St',
    detail: 'Red light · phone · seatbelt',
    source: 'Official',
    expiry: 'Never expires',
  ),
  MapPoint(
    id: 'rep-kombi',
    x: 0.68,
    y: 0.25,
    camera: false,
    kicker: 'Kombi stop · eastbound',
    title: 'Kombis stop mid-road',
    detail: 'Samora Machel Ave, near 3rd St',
    confirms: 9,
    by: 'Rudo C.',
    age: '1 h ago',
  ),
  MapPoint(
    id: 'rep-robot',
    x: 0.3,
    y: 0.64,
    camera: false,
    kicker: 'Robot out · 2 confirmations',
    title: 'Robot not working at Seke / Cripps',
    detail: 'Seke Rd × Cripps Rd',
    confirms: 2,
    by: 'Tendai M.',
    age: '22 min ago',
  ),
  MapPoint(
    id: 'rep-pothole',
    x: 0.6,
    y: 0.82,
    camera: false,
    kicker: 'Pothole · 9 confirmations',
    title: 'Pothole on Rotten Row, left lane',
    detail: 'Rotten Row, southbound',
    confirms: 9,
    by: 'Tafadzwa N.',
    age: '3 h ago',
  ),
  MapPoint(
    id: 'rep-crime',
    x: 0.12,
    y: 0.86,
    camera: false,
    kicker: 'Crime hotspot · 6 confirmations',
    title: 'Smash-and-grab at the Rotten Row lights',
    detail: 'Rotten Row × Samora Machel',
    confirms: 6,
    by: 'Farai K.',
    age: '2 days ago',
  ),
];

/// [0] crime hotspot (flag demo), [1] robot out, [2] pothole.
final sampleReports = [
  mapPoints.firstWhere((p) => p.id == 'rep-crime'),
  mapPoints.firstWhere((p) => p.id == 'rep-robot'),
  mapPoints.firstWhere((p) => p.id == 'rep-pothole'),
];
