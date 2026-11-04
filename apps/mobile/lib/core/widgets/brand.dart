import 'package:flutter/material.dart';

import 'package:streetwise_zw/core/theme/tokens.dart';

/// STREETWISE zw wordmark: "STREET" ink, "WISE" steel, small "ZW".
class Wordmark extends StatelessWidget {
  const Wordmark({super.key, this.size = 19, this.dark = false});
  final double size;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final base = T.heading(size, color: dark ? C.dText : C.text).copyWith(letterSpacing: 1.2);
    return Semantics(
      label: 'StreetWise ZW',
      child: ExcludeSemantics(
        child: Text.rich(TextSpan(children: [
          TextSpan(text: 'STREET', style: base),
          TextSpan(text: 'WISE', style: base.copyWith(color: dark ? C.a400 : C.accent)),
          TextSpan(text: '  ZW', style: base.copyWith(fontSize: size * 0.55, letterSpacing: 0.5)),
        ])),
      ),
    );
  }
}
