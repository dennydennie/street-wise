import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:streetwise_zw/core/config/env.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';
import 'package:streetwise_zw/data/app_state.dart';
import 'package:streetwise_zw/features/map/presentation/area_screen.dart';

/// 07 Map · plan a route. Mapbox tiles (from the API's /config/public, or a
/// MAPBOX_PUBLIC_TOKEN dart-define), OpenStreetMap when no token is configured.
class MapScreen extends StatefulWidget {
  const MapScreen({super.key});
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final map = MapController();
  bool camsOnly = false;
  bool tonight = false;
  String? selectedId; // area id or 'cam:<id>'
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  String _tiles(AppState app) {
    if (Env.mapboxPublicToken.isNotEmpty) {
      return 'https://api.mapbox.com/styles/v1/${Env.mapboxStyle}/tiles/256/{z}/{x}/{y}@2x?access_token=${Env.mapboxPublicToken}';
    }
    return app.config.tileUrlTemplate;
  }

  DateTime? get _at {
    if (!tonight) return null;
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day, 22);
  }

  void _onMoved(MapCamera cam) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), () {
      if (!mounted) return;
      App.read(context).refreshBriefing(lat: cam.center.latitude, lng: cam.center.longitude, at: _at);
    });
  }

  @override
  Widget build(BuildContext context) {
    final app = App.of(context);
    final areas = camsOnly ? const <AreaBriefing>[] : (app.briefing?.areas ?? const <AreaBriefing>[]);
    final selArea = areas.where((a) => a.areaId == selectedId).firstOrNull ?? (selectedId == null && areas.isNotEmpty ? areas.first : null);
    final selCam = selectedId != null && selectedId!.startsWith('cam:')
        ? app.cameras.where((c) => 'cam:${c.id}' == selectedId).firstOrNull
        : null;

    return Column(children: [
      SizedBox(
        height: 320,
        child: Stack(children: [
          FlutterMap(
            mapController: map,
            options: MapOptions(
              initialCenter: LatLng(app.here.lat, app.here.lng),
              initialZoom: 14.5,
              minZoom: 10,
              maxZoom: app.config.maxZoom,
              onPositionChanged: (cam, hasGesture) {
                if (hasGesture) _onMoved(cam);
              },
              interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
            ),
            children: [
              TileLayer(urlTemplate: _tiles(app), userAgentPackageName: 'zw.co.streetwise.streetwise_zw', maxZoom: app.config.maxZoom),
              MarkerLayer(markers: [
                for (final c in app.cameras)
                  Marker(
                    point: LatLng(c.lat, c.lng),
                    width: 28,
                    height: 28,
                    child: _CamMarker(selected: selectedId == 'cam:${c.id}', label: c.name, onTap: () => setState(() => selectedId = 'cam:${c.id}')),
                  ),
                for (final a in areas)
                  Marker(
                    point: LatLng(a.lat, a.lng),
                    width: 30,
                    height: 30,
                    child: _AreaMarker(area: a, selected: selArea?.areaId == a.areaId && selCam == null, onTap: () => setState(() => selectedId = a.areaId)),
                  ),
                if (app.here.real)
                  Marker(
                    point: LatLng(app.here.lat, app.here.lng),
                    width: 18,
                    height: 18,
                    child: Container(decoration: BoxDecoration(shape: BoxShape.circle, color: C.a700, border: Border.all(color: Colors.white, width: 3))),
                  ),
              ]),
              RichAttributionWidget(
                alignment: AttributionAlignment.bottomLeft,
                attributions: [TextSourceAttribution(app.config.attribution)],
              ),
            ],
          ),
          Positioned(
            left: 12,
            top: 12,
            child: _Toggle(
              options: const ['All', 'Cams'],
              index: camsOnly ? 1 : 0,
              onChanged: (i) => setState(() => camsOnly = i == 1),
            ),
          ),
          Positioned(
            right: 12,
            top: 12,
            child: _Toggle(
              options: const ['Now', 'Tonight'],
              index: tonight ? 1 : 0,
              onChanged: (i) {
                setState(() => tonight = i == 1);
                final c = map.camera.center;
                app.refreshBriefing(lat: c.latitude, lng: c.longitude, at: _at);
              },
            ),
          ),
          Positioned(
            right: 12,
            bottom: 12,
            child: Material(
              color: C.n100,
              shape: const RoundedRectangleBorder(side: BorderSide(color: C.divider)),
              child: InkWell(
                onTap: () async {
                  final f = await app.locate(request: true);
                  map.move(LatLng(f.lat, f.lng), 15);
                  app.refreshBriefing(at: _at);
                },
                child: const SizedBox(width: 36, height: 36, child: Icon(I.navigation, size: 17, semanticLabel: 'Centre on me')),
              ),
            ),
          ),
        ]),
      ),
      const Hairline(),
      Expanded(
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 16), children: [
          if (selCam != null) ...[
            Kicker('Selected · camera'),
            Blueprint(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('CAMERA ROBOT · ALL APPROACHES', style: T.kicker()),
                const SizedBox(height: 4),
                Text(selCam.name, style: T.heading(21)),
                const SizedBox(height: 4),
                Text(selCam.checkLabels.join(' · '), style: T.body(12.5, color: C.n800)),
                const SizedBox(height: 10),
                Row(children: [
                  Tag(selCam.source == 'official' ? 'Official' : 'Community'),
                  const SizedBox(width: 8),
                  Text('Never expires', style: T.body(11, color: C.n700)),
                ]),
              ]),
            ),
          ] else if (selArea != null) ...[
            Kicker('Selected · ${selArea.name}${tonight ? ' · tonight' : ''}'),
            InkWell(
              onTap: () => openArea(context, selArea),
              child: Blueprint(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text((selArea.lead?.label ?? 'Area').toUpperCase(), style: T.kicker()),
                  const SizedBox(height: 4),
                  Text(selArea.headline.isEmpty ? selArea.name : selArea.headline, style: T.heading(21)),
                  if (selArea.advice.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(selArea.advice, style: T.body(12.5, color: C.n800)),
                  ],
                  const SizedBox(height: 10),
                  Row(children: [
                    Tag(switch (selArea.priority) { Priority.high => 'High', Priority.medium => 'Medium', Priority.low => 'Low' },
                        outline: selArea.priority != Priority.high, neutral: selArea.priority == Priority.low),
                    const SizedBox(width: 8),
                    Expanded(child: Text(selArea.alert ? 'Alerting drivers now' : 'No alert at this time', style: T.body(11, color: C.n700))),
                    const Icon(I.chevronRight, size: 15, color: C.n600),
                  ]),
                ]),
              ),
            ),
          ] else
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text(
                app.briefingLoading ? 'Loading reports…' : (app.offline ? 'Offline — showing saved cameras only.' : 'No reports in this area. Pan the map to look around.'),
                style: T.body(12.5, color: C.n700),
              ),
            ),
          const SizedBox(height: 8),
          for (final a in areas.where((a) => a.areaId != selArea?.areaId).take(6))
            InkWell(
              onTap: () {
                setState(() => selectedId = a.areaId);
                map.move(LatLng(a.lat, a.lng), map.camera.zoom);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
                child: Row(children: [
                  Expanded(child: Text(a.headline.isEmpty ? a.name : '${a.name} · ${a.lead?.label ?? ''}', style: T.body(13.5), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  Text(a.alert ? 'alert' : '+${a.lead?.confirmations ?? 0}', style: T.body(11.5, color: a.alert ? C.a700 : C.n700, weight: a.alert ? FontWeight.w700 : FontWeight.w400)),
                ]),
              ),
            ),
        ]),
      ),
    ]);
  }
}

class _Toggle extends StatelessWidget {
  const _Toggle({required this.options, required this.index, required this.onChanged});
  final List<String> options;
  final int index;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(color: C.n100, border: Border.all(color: C.divider)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < options.length; i++)
            InkWell(
              onTap: () => onChanged(i),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                color: index == i ? C.accent : Colors.transparent,
                child: Text(options[i], style: T.body(12, color: index == i ? C.n100 : C.text, weight: FontWeight.w500)),
              ),
            ),
        ]),
      );
}

class _CamMarker extends StatelessWidget {
  const _CamMarker({required this.selected, required this.label, required this.onTap});
  final bool selected;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        selected: selected,
        label: 'Camera, $label',
        child: GestureDetector(
          onTap: onTap,
          child: Center(
            child: Container(
              width: 20,
              height: 20,
              color: selected ? C.a900 : C.accent,
              alignment: Alignment.center,
              child: Text('C', style: T.heading(12, color: C.n100)),
            ),
          ),
        ),
      );
}

class _AreaMarker extends StatelessWidget {
  const _AreaMarker({required this.area, required this.selected, required this.onTap});
  final AreaBriefing area;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final fill = selected
        ? C.a900
        : switch (area.priority) {
            Priority.high => C.a700,
            Priority.medium => C.a400,
            Priority.low => C.bg,
          };
    return Semantics(
      button: true,
      selected: selected,
      label: '${area.name}: ${area.headline}',
      child: GestureDetector(
        onTap: onTap,
        child: Center(
          child: Transform.rotate(
            angle: 0.785,
            child: Container(
              width: area.alert ? 17 : 14,
              height: area.alert ? 17 : 14,
              decoration: BoxDecoration(color: fill, border: Border.all(color: selected ? C.a900 : C.text, width: 1.2)),
            ),
          ),
        ),
      ),
    );
  }
}
