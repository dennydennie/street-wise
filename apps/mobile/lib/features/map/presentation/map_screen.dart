import 'package:flutter/material.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/data/map_data.dart';
import 'package:streetwise_zw/features/map/presentation/report_detail_screen.dart';

/// 07 Map · plan a route. Drawn placeholder; production swaps in OSM tiles via flutter_map.
class MapScreen extends StatefulWidget {
  const MapScreen({super.key});
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  bool camsOnly = false;
  String selectedId = 'cam-smjn';

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final visible = mapPoints
        .where((p) => !camsOnly || p.camera)
        .where((p) => p.by == null || !app.blocked.contains(p.by))
        .toList();
    final sel = mapPoints.firstWhere((p) => p.id == selectedId);
    final nearby = visible.where((p) => !p.camera && p.id != selectedId).take(3).toList();

    return Column(children: [
      SizedBox(
        height: 300,
        child: LayoutBuilder(builder: (context, c) {
          return Stack(children: [
            Positioned.fill(child: CustomPaint(painter: _StreetPainter())),
            for (final (name, pos, horizontal) in mapStreets)
              Positioned(
                left: horizontal ? 8 : c.maxWidth * pos + 6,
                top: horizontal ? c.maxHeight * pos - 16 : c.maxHeight - 26,
                child: Text(name.toUpperCase(), style: T.body(9.5, color: C.n700, weight: FontWeight.w500).copyWith(letterSpacing: 0.6)),
              ),
            for (final p in visible)
              Positioned(
                left: c.maxWidth * p.x - 13,
                top: c.maxHeight * p.y - 13,
                child: _Marker(point: p, selected: p.id == selectedId, onTap: () => setState(() => selectedId = p.id)),
              ),
            Positioned(
              left: 12,
              top: 12,
              child: Container(
                decoration: BoxDecoration(color: C.n100, border: Border.all(color: C.divider)),
                child: Row(children: [
                  for (final (i, label) in [(0, 'All'), (1, 'Cams')])
                    InkWell(
                      onTap: () => setState(() => camsOnly = i == 1),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                        color: camsOnly == (i == 1) ? C.accent : Colors.transparent,
                        child: Text(label,
                            style: T.body(12, color: camsOnly == (i == 1) ? C.n100 : C.text, weight: FontWeight.w500)),
                      ),
                    ),
                ]),
              ),
            ),
            Positioned(
              right: 10,
              bottom: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(color: C.n100, border: Border.all(color: C.divider)),
                child: Row(children: [
                  Container(width: 9, height: 9, color: C.accent),
                  const SizedBox(width: 5),
                  Text('Camera', style: T.body(10.5)),
                  const SizedBox(width: 8),
                  Transform.rotate(
                      angle: 0.785,
                      child: Container(width: 8, height: 8, decoration: BoxDecoration(border: Border.all(color: C.text)))),
                  const SizedBox(width: 5),
                  Text('Report', style: T.body(10.5)),
                ]),
              ),
            ),
          ]);
        }),
      ),
      const Hairline(),
      Expanded(
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 16), children: [
          Kicker('Selected · ${sel.detail.split(',').first}'),
          InkWell(
            onTap: () => openReportDetail(context, sel),
            child: Blueprint(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(sel.kicker.toUpperCase(), style: T.kicker()),
                const SizedBox(height: 4),
                Text(sel.title, style: T.heading(21)),
                const SizedBox(height: 4),
                Text(sel.camera ? sel.detail : '${sel.detail} · ${sel.age}', style: T.body(12.5, color: C.n800)),
                const SizedBox(height: 10),
                Row(children: [
                  Tag(sel.source),
                  const SizedBox(width: 8),
                  Text(sel.expiry, style: T.body(11, color: C.n700)),
                ]),
              ]),
            ),
          ),
          const SizedBox(height: 8),
          for (final p in nearby)
            InkWell(
              onTap: () => setState(() => selectedId = p.id),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
                child: Row(children: [
                  Expanded(child: Text(p.title, style: T.body(13.5))),
                  Text('+${p.confirms}', style: T.body(11.5, color: C.n700)),
                ]),
              ),
            ),
        ]),
      ),
    ]);
  }
}

class _Marker extends StatelessWidget {
  const _Marker({required this.point, required this.selected, required this.onTap});
  final MapPoint point;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fill = selected ? C.a900 : C.accent;
    return Semantics(
      button: true,
      selected: selected,
      label: point.title,
      child: GestureDetector(
        onTap: onTap,
        child: SizedBox(
          width: 26,
          height: 26,
          child: Center(
            child: point.camera
                ? Container(
                    width: 20,
                    height: 20,
                    color: fill,
                    alignment: Alignment.center,
                    child: Text('C', style: T.heading(12, color: C.n100)),
                  )
                : Transform.rotate(
                    angle: 0.785,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: selected ? C.a900 : C.bg,
                        border: Border.all(color: selected ? C.a900 : C.text, width: 1.2),
                      ),
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class _StreetPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = C.surface);
    final block = Paint()..color = C.n200;
    // City blocks.
    for (var x = 0.0; x < size.width; x += 58) {
      for (var y = 0.0; y < size.height; y += 52) {
        canvas.drawRect(Rect.fromLTWH(x + 6, y + 6, 46, 40), block);
      }
    }
    final road = Paint()
      ..color = C.n100
      ..strokeWidth = 9;
    for (final (_, pos, horizontal) in mapStreets) {
      if (horizontal) {
        canvas.drawLine(Offset(0, size.height * pos), Offset(size.width, size.height * pos), road);
      } else {
        canvas.drawLine(Offset(size.width * pos, 0), Offset(size.width * pos, size.height), road);
      }
    }
    final minor = Paint()
      ..color = C.n100
      ..strokeWidth = 4;
    for (final f in [0.78, 0.9]) {
      canvas.drawLine(Offset(size.width * f, 0), Offset(size.width * f, size.height), minor);
    }
    canvas.drawLine(Offset(0, size.height * 0.86), Offset(size.width, size.height * 0.86), minor);
  }

  @override
  bool shouldRepaint(_StreetPainter oldDelegate) => false;
}
