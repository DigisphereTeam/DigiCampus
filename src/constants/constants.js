export const EVENT_STATUSES = [
  "PENDING",
  "APPROVED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED"
];

export const allowedTransitions = {
  PENDING: ["APPROVED", "CANCELLED"],
  APPROVED: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};

export const allowedRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "TEACHER",
  "ACCOUNTANT",
  "STAFF",
  "STUDENT",
  "PARENT",
];

export const USER_ROLES = {
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  TEACHER: "TEACHER",
  ACCOUNTANT: "ACCOUNTANT",
  STAFF: "STAFF",
  STUDENT: "STUDENT",
  PARENT: "PARENT"
};

export const GENDERS = ["MALE", "FEMALE", "OTHER"];

export const STUDENT_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "TRANSFERRED",
  "GRADUATED",
  "DROPPED"
];

export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-"
];

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "FOLLOW_UP",
  "APPLICATION",
  "CONVERTED",
  "LOST",
];


export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
];


export const meetingTypes = [
  "ADMIN_TEACHER",
  "ADMIN_STAFF",
  "TEACHER_PARENT",
  "PARENT_TEACHER",
  "TEACHER_STAFF",
  "STAFF_TEACHER",
];

export const meetingModes = [
  "ONLINE",
  "OFFLINE",
  "HYBRID",
];

export const meetingStatuses = [
  "PENDING",
  "APPROVED",
  "SCHEDULED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
];

export const participantResponseStatuses = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
];