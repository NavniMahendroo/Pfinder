import enum


class UserRole(str, enum.Enum):
    NGO = "ngo"
    VOLUNTEER = "volunteer"


class TaskStatus(str, enum.Enum):
    NEW = "new"
    MATCHING = "matching"
    DISPATCHED = "dispatched"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MatchStatus(str, enum.Enum):
    PENDING = "pending"
    INVITED = "invited"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
