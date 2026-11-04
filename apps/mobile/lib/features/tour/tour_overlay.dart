import 'package:flutter/material.dart';
import 'package:streetwise_zw/core/theme/tokens.dart';
import 'package:streetwise_zw/core/widgets/widgets.dart';

class TourStep {
  const TourStep(this.target, this.title, this.body);
  final GlobalKey target;
  final String title;
  final String body;
}

/// Spotlight + popover (driver.js style): dims everything except the target,
/// outlines it, and anchors a card above or below it with an arrow.
class TourOverlay extends StatefulWidget {
  const TourOverlay({
    super.key,
    required this.step,
    required this.index,
    required this.count,
    required this.onNext,
    required this.onClose,
    this.onBack,
  });

  final TourStep step;
  final int index;
  final int count;
  final VoidCallback onNext;
  final VoidCallback onClose;
  final VoidCallback? onBack;

  @override
  State<TourOverlay> createState() => _TourOverlayState();
}

class _TourOverlayState extends State<TourOverlay> {
  Rect? target;

  @override
  void initState() {
    super.initState();
    _measure();
  }

  void _measure() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final box = widget.step.target.currentContext?.findRenderObject() as RenderBox?;
      final me = context.findRenderObject() as RenderBox?;
      if (box == null || me == null || !box.hasSize) {
        _measure();
        return;
      }
      final tl = box.localToGlobal(Offset.zero, ancestor: me);
      setState(() => target = (tl & box.size).inflate(4));
    });
  }

  @override
  Widget build(BuildContext context) {
    final last = widget.index == widget.count - 1;
    return LayoutBuilder(builder: (context, c) {
      final t = target;
      final below = t != null && t.center.dy < c.maxHeight * 0.45;
      const cardW = 312.0;
      final left = t == null ? 24.0 : (t.center.dx - cardW / 2).clamp(16.0, c.maxWidth - cardW - 16);
      final arrowX = t == null ? cardW / 2 : (t.center.dx - left).clamp(20.0, cardW - 20);

      final card = Material(
        color: C.n100,
        elevation: 8,
        shadowColor: C.n900.withValues(alpha: 0.4),
        child: Container(
          width: cardW,
          padding: const EdgeInsets.fromLTRB(16, 14, 12, 12),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(widget.step.title.toUpperCase(), style: T.heading(20))),
              InkResponse(
                onTap: widget.onClose,
                radius: 18,
                child: const Icon(I.x, size: 18, color: C.n700, semanticLabel: 'Close tour'),
              ),
            ]),
            const SizedBox(height: 6),
            Text(widget.step.body, style: T.body(13, color: C.n800)),
            const SizedBox(height: 14),
            Row(children: [
              Text('${widget.index + 1} of ${widget.count}', style: T.body(11.5, color: C.n700)),
              const Spacer(),
              if (widget.onBack != null) ...[
                SizedBox(width: 64, child: Btn.secondary('Back', onTap: widget.onBack, height: 36)),
                const SizedBox(width: 8),
              ],
              SizedBox(width: 64, child: Btn(last ? 'Done' : 'Next', onTap: widget.onNext, height: 36)),
            ]),
          ]),
        ),
      );

      final arrow = CustomPaint(size: const Size(16, 8), painter: _ArrowPainter(up: below));

      return Stack(children: [
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {}, // swallow taps: the tour is modal
            child: CustomPaint(painter: _ScrimPainter(t)),
          ),
        ),
        if (t != null)
          Positioned(
            left: left,
            top: below ? t.bottom + 10 : null,
            bottom: below ? null : c.maxHeight - t.top + 10,
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (below) Padding(padding: EdgeInsets.only(left: arrowX - 8), child: arrow),
              card,
              if (!below) Padding(padding: EdgeInsets.only(left: arrowX - 8), child: arrow),
            ]),
          ),
      ]);
    });
  }
}

class _ScrimPainter extends CustomPainter {
  _ScrimPainter(this.hole);
  final Rect? hole;

  @override
  void paint(Canvas canvas, Size size) {
    final scrim = Path()
      ..fillType = PathFillType.evenOdd
      ..addRect(Offset.zero & size);
    if (hole != null) scrim.addRect(hole!);
    canvas.drawPath(scrim, Paint()..color = const Color(0xFF1D1F20).withValues(alpha: 0.55));
    if (hole != null) {
      canvas.drawRect(
        hole!,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = C.a300,
      );
    }
  }

  @override
  bool shouldRepaint(_ScrimPainter old) => old.hole != hole;
}

class _ArrowPainter extends CustomPainter {
  _ArrowPainter({required this.up});
  final bool up;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Path();
    if (up) {
      p
        ..moveTo(0, size.height)
        ..lineTo(size.width / 2, 0)
        ..lineTo(size.width, size.height);
    } else {
      p
        ..moveTo(0, 0)
        ..lineTo(size.width / 2, size.height)
        ..lineTo(size.width, 0);
    }
    canvas.drawPath(p..close(), Paint()..color = C.n100);
  }

  @override
  bool shouldRepaint(_ArrowPainter old) => old.up != up;
}
