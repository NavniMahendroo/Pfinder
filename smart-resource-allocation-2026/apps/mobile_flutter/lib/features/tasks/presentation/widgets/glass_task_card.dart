import 'dart:ui';

import 'package:flutter/material.dart';

import '../../domain/task_item.dart';

class GlassTaskCard extends StatelessWidget {
  const GlassTaskCard({super.key, required this.task});

  final TaskItem task;

  Color _urgencyColor(int score) {
    if (score >= 8) return const Color(0xFFEF4444);
    if (score >= 5) return const Color(0xFFF59E0B);
    return const Color(0xFF22C55E);
  }

  @override
  Widget build(BuildContext context) {
    final urgency = _urgencyColor(task.urgencyScore);

    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: LinearGradient(
              colors: [
                Colors.white.withValues(alpha: 0.35),
                Colors.white.withValues(alpha: 0.12),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border.all(color: Colors.white.withValues(alpha: 0.5), width: 1),
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: urgency,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Urgency ${task.urgencyScore}/10',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                  ),
                  const Spacer(),
                  const Icon(Icons.swipe_rounded),
                ],
              ),
              const SizedBox(height: 16),
              Text(task.summary, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              Text(task.category.toUpperCase(), style: Theme.of(context).textTheme.labelSmall?.copyWith(letterSpacing: 1.2)),
              const SizedBox(height: 18),
              Row(
                children: [
                  const Icon(Icons.location_on_outlined, size: 18),
                  const SizedBox(width: 6),
                  Expanded(child: Text(task.location)),
                  Text('${task.etaMinutes} min'),
                ],
              )
            ],
          ),
        ),
      ),
    );
  }
}
