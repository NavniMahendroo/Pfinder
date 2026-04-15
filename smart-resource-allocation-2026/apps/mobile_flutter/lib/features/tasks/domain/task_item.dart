class TaskItem {
  TaskItem({
    required this.id,
    required this.summary,
    required this.category,
    required this.urgencyScore,
    required this.location,
    required this.etaMinutes,
  });

  final String id;
  final String summary;
  final String category;
  final int urgencyScore;
  final String location;
  final int etaMinutes;
}
