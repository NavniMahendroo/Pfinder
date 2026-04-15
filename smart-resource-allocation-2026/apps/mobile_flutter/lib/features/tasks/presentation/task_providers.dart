import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive/hive.dart';

import '../domain/task_item.dart';

final taskQueueProvider = StateNotifierProvider<TaskQueueNotifier, List<TaskItem>>((ref) {
  return TaskQueueNotifier()..loadSeed();
});

class TaskQueueNotifier extends StateNotifier<List<TaskItem>> {
  TaskQueueNotifier() : super([]);

  final Box box = Hive.box('offline_cache');

  void loadSeed() {
    final raw = box.get('task_cache') as String?;
    if (raw != null) {
      final decoded = (jsonDecode(raw) as List)
          .map((item) => TaskItem(
                id: item['id'],
                summary: item['summary'],
                category: item['category'],
                urgencyScore: item['urgencyScore'],
                location: item['location'],
                etaMinutes: item['etaMinutes'],
              ))
          .toList();
      state = decoded;
      return;
    }

    state = [
      TaskItem(
        id: '1',
        summary: 'Flood relief: drinking water packets needed for 40 families.',
        category: 'flood relief logistics',
        urgencyScore: 9,
        location: 'Sector 62, Noida',
        etaMinutes: 14,
      ),
      TaskItem(
        id: '2',
        summary: 'Immediate medical supply delivery to temporary shelter.',
        category: 'medical support',
        urgencyScore: 7,
        location: 'Ghatkopar East, Mumbai',
        etaMinutes: 21,
      ),
    ];

    box.put(
      'task_cache',
      jsonEncode(
        state
            .map((task) => {
                  'id': task.id,
                  'summary': task.summary,
                  'category': task.category,
                  'urgencyScore': task.urgencyScore,
                  'location': task.location,
                  'etaMinutes': task.etaMinutes,
                })
            .toList(),
      ),
    );
  }

  void acceptTopTask() {
    if (state.isEmpty) return;
    state = [...state]..removeAt(0);
  }

  void skipTopTask() {
    if (state.isEmpty) return;
    final queue = [...state];
    final first = queue.removeAt(0);
    queue.add(first);
    state = queue;
  }
}
