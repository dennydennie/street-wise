import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons_300.dart';

import 'package:streetwise_zw/core/theme/tokens.dart';

/// Lucide at the lighter stroke the design system asks for.
typedef I = LucideIcons300;

// ───────────────────────────── Blueprint frame ─────────────────────────────

/// Hairline square frame with "+" registration marks at the four corners.
class Blueprint extends StatelessWidget {
  const Blueprint({
    super.key,
    required this.child,
    this.border = true,
    this.borderColor,
    this.markColor,
    this.padding = EdgeInsets.zero,
  });

  final Widget child;
  final bool border;
  final Color? borderColor;
  final Color? markColor;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      foregroundPainter: _MarksPainter(markColor ?? C.text.withValues(alpha: 0.55)),
      child: Container(
        padding: padding,
        decoration: border ? BoxDecoration(border: Border.all(color: borderColor ?? C.divider)) : null,
        child: child,
      ),
    );
  }
}

class _MarksPainter extends CustomPainter {
  _MarksPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = 1;
    for (final o in [Offset.zero, Offset(size.width, 0), Offset(0, size.height), Offset(size.width, size.height)]) {
      canvas.drawLine(o.translate(-5.5, 0), o.translate(5.5, 0), p);
      canvas.drawLine(o.translate(0, -5.5), o.translate(0, 5.5), p);
    }
  }

  @override
  bool shouldRepaint(_MarksPainter old) => old.color != color;
}

// ───────────────────────────── Buttons ─────────────────────────────

enum BtnKind { primary, secondary, ghost, dark, darkOutline }

class Btn extends StatelessWidget {
  const Btn(this.label, {super.key, this.onTap, this.icon, this.kind = BtnKind.primary, this.height = 46});
  const Btn.secondary(this.label, {super.key, this.onTap, this.icon, this.height = 44}) : kind = BtnKind.secondary;
  const Btn.ghost(this.label, {super.key, this.onTap, this.icon, this.height = 40}) : kind = BtnKind.ghost;

  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final BtnKind kind;
  final double height;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border, marks) = switch (kind) {
      BtnKind.primary => (C.accent, C.n100, null, true),
      BtnKind.secondary => (C.n100, C.text, C.divider, false),
      BtnKind.ghost => (Colors.transparent, C.a700, null, false),
      BtnKind.dark => (C.a900, C.n100, null, true),
      BtnKind.darkOutline => (Colors.transparent, C.dText, C.dLine, false),
    };
    final disabled = onTap == null;
    Widget content = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (icon != null) ...[Icon(icon, size: 16, color: fg), const SizedBox(width: 8)],
        Flexible(
          child: Text(label,
              textAlign: TextAlign.center,
              style: T.body(13, color: fg, weight: kind == BtnKind.ghost ? FontWeight.w700 : FontWeight.w500)),
        ),
      ],
    );
    Widget btn = Material(
      color: bg,
      shape: border == null ? const RoundedRectangleBorder() : RoundedRectangleBorder(side: BorderSide(color: border)),
      child: InkWell(
        onTap: onTap,
        splashColor: (kind == BtnKind.primary ? C.a700 : C.accent).withValues(alpha: 0.25),
        highlightColor: (kind == BtnKind.primary ? C.a600 : C.a200).withValues(alpha: 0.5),
        child: SizedBox(height: height, width: double.infinity, child: Center(child: content)),
      ),
    );
    if (marks) btn = Blueprint(border: false, child: btn);
    return Opacity(opacity: disabled ? 0.45 : 1, child: btn);
  }
}

// ───────────────────────────── Chrome ─────────────────────────────

/// Back arrow + uppercase condensed title, hairline below.
class TopBar extends StatelessWidget implements PreferredSizeWidget {
  const TopBar(this.title, {super.key, this.back = true, this.trailing, this.dark = false, this.onBack});
  final String title;
  final bool back;
  final Widget? trailing;
  final bool dark;
  final VoidCallback? onBack;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    final fg = dark ? C.dText : C.text;
    return Container(
      height: 56,
      padding: EdgeInsets.only(left: back ? 4 : 20, right: 12),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: dark ? C.dLine : C.divider))),
      child: Row(children: [
        if (back)
          IconButton(
            onPressed: onBack ?? () => Navigator.of(context).maybePop(),
            icon: Icon(I.arrowLeft, color: fg, size: 20),
            tooltip: 'Back',
          ),
        if (back) const SizedBox(width: 4),
        Expanded(child: Text(title.toUpperCase(), style: T.heading(21, color: fg))),
        ?trailing,
      ]),
    );
  }
}

/// Paper scaffold with optional TopBar and a safe area.
class SwPage extends StatelessWidget {
  const SwPage({super.key, this.title, required this.body, this.back = true, this.bottom, this.trailing});
  final String? title;
  final Widget body;
  final bool back;
  final Widget? bottom;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(children: [
          if (title != null) TopBar(title!, back: back, trailing: trailing),
          Expanded(child: body),
        ]),
      ),
      bottomNavigationBar: bottom,
    );
  }
}

class Kicker extends StatelessWidget {
  const Kicker(this.text, {super.key, this.color, this.padding = const EdgeInsets.only(top: 16, bottom: 6)});
  final String text;
  final Color? color;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) =>
      Padding(padding: padding, child: Text(text.toUpperCase(), style: T.kicker(color: color)));
}

class Hairline extends StatelessWidget {
  const Hairline({super.key, this.dark = false});
  final bool dark;
  @override
  Widget build(BuildContext context) => Container(height: 1, color: dark ? C.dLine : C.divider);
}

/// A settings-style row: icon · title/subtitle · trailing.
class RowTile extends StatelessWidget {
  const RowTile({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.trailing,
    this.onTap,
    this.chevron = true,
    this.external = false,
    this.titleColor,
    this.divider = true,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool chevron;
  final bool external;
  final Color? titleColor;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      highlightColor: C.a100,
      splashColor: C.a200,
      child: Container(
        constraints: const BoxConstraints(minHeight: 50),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: divider ? const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))) : null,
        child: Row(children: [
          if (icon != null) ...[Icon(icon, size: 18, color: C.n800), const SizedBox(width: 14)],
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(title, style: T.body(14, weight: FontWeight.w500, color: titleColor)),
              if (subtitle != null) Text(subtitle!, style: T.body(11.5, color: C.n700)),
            ]),
          ),
          ?trailing,
          if (trailing == null && external) const Icon(I.externalLink, size: 15, color: C.n600),
          if (trailing == null && !external && chevron) const Icon(I.chevronRight, size: 16, color: C.n600),
        ]),
      ),
    );
  }
}

/// Label left, value right, hairline below.
class KV extends StatelessWidget {
  const KV(this.k, this.v, {super.key, this.bold = false});
  final String k;
  final String v;
  final bool bold;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.divider))),
        child: Row(children: [
          Text(k, style: T.body(13, color: bold ? C.text : C.n700, weight: bold ? FontWeight.w700 : FontWeight.w400)),
          const Spacer(),
          Text(v, style: T.body(13, weight: bold ? FontWeight.w700 : FontWeight.w400)),
        ]),
      );
}

class Tag extends StatelessWidget {
  const Tag(this.text, {super.key, this.outline = false, this.neutral = false, this.dark = false});
  final String text;
  final bool outline;
  final bool neutral;
  final bool dark;
  @override
  Widget build(BuildContext context) {
    final bg = outline ? Colors.transparent : (neutral ? C.n200 : (dark ? C.a800 : C.a100));
    final fg = dark ? C.dText : (neutral ? C.n800 : C.a700);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        border: outline ? Border.all(color: dark ? C.dLine : C.a400) : null,
        borderRadius: BorderRadius.circular(2),
      ),
      child: Text(text, style: T.body(10.5, color: fg, weight: FontWeight.w500)),
    );
  }
}

/// The design's square switch: accent track, paper knob.
class SqSwitch extends StatelessWidget {
  const SqSwitch({super.key, required this.value, required this.onChanged});
  final bool value;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) {
    return Semantics(
      toggled: value,
      child: GestureDetector(
        onTap: () => onChanged(!value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          width: 32,
          height: 18,
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: value ? C.accent : C.n100,
            border: Border.all(color: value ? C.accent : C.n400),
            borderRadius: BorderRadius.circular(2),
          ),
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(width: 13, height: 13, color: value ? C.n100 : C.n400),
        ),
      ),
    );
  }
}

/// Circle radio as drawn in the design.
class Dot extends StatelessWidget {
  const Dot({super.key, required this.selected});
  final bool selected;
  @override
  Widget build(BuildContext context) => Container(
        width: 16,
        height: 16,
        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: selected ? C.a700 : C.n500)),
        alignment: Alignment.center,
        child: selected ? Container(width: 8, height: 8, decoration: const BoxDecoration(shape: BoxShape.circle, color: C.a700)) : null,
      );
}

class SqCheck extends StatelessWidget {
  const SqCheck({super.key, required this.value, this.size = 18});
  final bool value;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: value ? C.accent : Colors.transparent, border: Border.all(color: value ? C.accent : C.n500)),
        child: value ? Icon(I.check, size: size - 4, color: C.n100) : null,
      );
}

/// Segmented control (Early / Standard / Late, My reports / Pins / Flags).
class Seg extends StatelessWidget {
  const Seg({super.key, required this.options, required this.index, required this.onChanged, this.height = 34});
  final List<String> options;
  final int index;
  final ValueChanged<int> onChanged;
  final double height;
  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(border: Border.all(color: C.divider), color: C.n100),
      child: Row(children: [
        for (var i = 0; i < options.length; i++)
          Expanded(
            child: InkWell(
              onTap: () => onChanged(i),
              child: Container(
                color: i == index ? C.accent : Colors.transparent,
                alignment: Alignment.center,
                child: Text(options[i], style: T.body(12.5, color: i == index ? C.n100 : C.text, weight: FontWeight.w500)),
              ),
            ),
          ),
      ]),
    );
  }
}

/// Square icon badge (✓ / ✕ result marks, phone icon on EcoCash wait).
class IconBox extends StatelessWidget {
  const IconBox(this.icon, {super.key, this.size = 44, this.marks = false, this.color});
  final IconData icon;
  final double size;
  final bool marks;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    final box = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(border: Border.all(color: C.n500)),
      child: Icon(icon, size: size * 0.45, color: color ?? C.text),
    );
    return marks ? Blueprint(border: false, child: box) : box;
  }
}

void toast(BuildContext context, String msg) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg), duration: const Duration(seconds: 2)));
}
