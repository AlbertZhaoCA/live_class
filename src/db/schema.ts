import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  int,
  mysqlEnum,
  boolean,
  json,
  decimal,
  unique,
  foreignKey,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// =========================
// 用户表
// =========================
export const users = mysqlTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: mysqlEnum('role', ['student', 'teacher', 'observer', 'administrator']).notNull(),
  avatar: text('avatar'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

// =========================
// 课堂表
// =========================
export const classrooms = mysqlTable('classrooms', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  teacherId: varchar('teacher_id', { length: 255 }).notNull(),
  coverImage: text('cover_image'),
  isActive: boolean('is_active').notNull().default(true),
  isPublic: boolean('is_public').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  teacherFk: foreignKey({
    columns: [table.teacherId],
    foreignColumns: [users.id],
    name: 'fk_classrooms_teacher_id',
  }),
}));

// =========================
// 课堂成员表
// =========================
export const classroomMembers = mysqlTable('classroom_members', {
  id: varchar('id', { length: 255 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  role: mysqlEnum('role', ['student', 'teacher', 'observer', 'administrator']).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (table) => ({
  uniqueClassroomUser: unique().on(table.classroomId, table.userId),
  classroomFk: foreignKey({
    columns: [table.classroomId],
    foreignColumns: [classrooms.id],
    name: 'fk_classroom_members_classroom_id',
  }),
  userFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'fk_classroom_members_user_id',
  }),
}));

// =========================
// 会话表（课程/直播）
// =========================
export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  scheduledAt: timestamp('scheduled_at').notNull(),
  duration: int('duration').notNull().default(90),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  status: mysqlEnum('status', ['scheduled', 'live', 'ended']).notNull().default('scheduled'),
  isPublic: boolean('is_public').notNull().default(true),
  recordingUrl: text('recording_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  classroomFk: foreignKey({
    columns: [table.classroomId],
    foreignColumns: [classrooms.id],
    name: 'fk_sessions_classroom_id',
  }),
}));

// =========================
// 聊天消息表
// =========================
export const chatMessages = mysqlTable('chat_messages', {
  id: varchar('id', { length: 255 }).primaryKey(),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: mysqlEnum('type', ['text', 'system', 'announcement', 'whiteboard', 'youtube', 'file']).notNull().default('text'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  sessionFk: foreignKey({
    columns: [table.sessionId],
    foreignColumns: [sessions.id],
    name: 'fk_chat_messages_session_id',
  }),
  userFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'fk_chat_messages_user_id',
  }),
}));

// =========================
// 白板表
// =========================
export const whiteboards = mysqlTable('whiteboards', {
  id: varchar('id', { length: 255 }).primaryKey(),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  chatMessageId: varchar('chat_message_id', { length: 255 }),
  createdById: varchar('created_by_id', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull().default('Whiteboard'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  closedAt: timestamp('closed_at'),
}, (table) => ({
  sessionFk: foreignKey({
    columns: [table.sessionId],
    foreignColumns: [sessions.id],
    name: 'fk_whiteboards_session_id',
  }),
  createdByFk: foreignKey({
    columns: [table.createdById],
    foreignColumns: [users.id],
    name: 'fk_whiteboards_created_by_id',
  }),
  chatMsgFk: foreignKey({
    columns: [table.chatMessageId],
    foreignColumns: [chatMessages.id],
    name: 'fk_whiteboards_chat_message_id',
  }),
}));

// =========================
// Canvas 白板数据
// =========================
export const canvasData = mysqlTable('canvas_data', {
  id: varchar('id', { length: 255 }).primaryKey(),
  whiteboardId: varchar('whiteboard_id', { length: 255 }).notNull(),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  data: json('data').notNull(),
  pageNumber: int('page_number').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  whiteboardFk: foreignKey({
    columns: [table.whiteboardId],
    foreignColumns: [whiteboards.id],
    name: 'fk_canvas_data_whiteboard_id',
  }),
  sessionFk: foreignKey({
    columns: [table.sessionId],
    foreignColumns: [sessions.id],
    name: 'fk_canvas_data_session_id',
  }),
  userFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'fk_canvas_data_user_id',
  }),
}));

// =========================
// 材料分类
// =========================
export const materialCategories = mysqlTable('material_categories', {
  id: varchar('id', { length: 255 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  order: int('order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  classroomFk: foreignKey({
    columns: [table.classroomId],
    foreignColumns: [classrooms.id],
    name: 'fk_material_categories_classroom_id',
  }),
}));

// =========================
// 材料表
// =========================
export const materials = mysqlTable('materials', {
  id: varchar('id', { length: 255 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 255 }).notNull(),
  sessionId: varchar('session_id', { length: 255 }),
  categoryId: varchar('category_id', { length: 255 }),
  chatMessageId: varchar('chat_message_id', { length: 255 }),
  uploadedById: varchar('uploaded_by_id', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  fileType: mysqlEnum('file_type', ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'image', 'video', 'youtube', 'other']).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileSize: int('file_size').notNull().default(0),
  fileUrl: text('file_url').notNull(),
  downloadCount: int('download_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  classroomFk: foreignKey({ columns: [table.classroomId], foreignColumns: [classrooms.id], name: 'fk_materials_classroom_id' }),
  sessionFk: foreignKey({ columns: [table.sessionId], foreignColumns: [sessions.id], name: 'fk_materials_session_id' }),
  categoryFk: foreignKey({ columns: [table.categoryId], foreignColumns: [materialCategories.id], name: 'fk_materials_category_id' }),
  uploaderFk: foreignKey({ columns: [table.uploadedById], foreignColumns: [users.id], name: 'fk_materials_uploaded_by_id' }),
}));

// =========================
// 测试 / 考试表
// =========================
export const tests = mysqlTable('tests', {
  id: varchar('id', { length: 255 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 255 }).notNull(),
  sessionId: varchar('session_id', { length: 255 }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  duration: int('duration').notNull(),
  totalPoints: int('total_points').notNull(),
  passingScore: int('passing_score').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  publishedInChat: boolean('published_in_chat').notNull().default(false),
  chatMessageId: varchar('chat_message_id', { length: 255 }),
  createdById: varchar('created_by_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  classroomFk: foreignKey({ columns: [table.classroomId], foreignColumns: [classrooms.id], name: 'fk_tests_classroom_id' }),
  sessionFk: foreignKey({ columns: [table.sessionId], foreignColumns: [sessions.id], name: 'fk_tests_session_id' }),
  creatorFk: foreignKey({ columns: [table.createdById], foreignColumns: [users.id], name: 'fk_tests_created_by_id' }),
}));

// =========================
// 测试题目
// =========================
export const testQuestions = mysqlTable('test_questions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  testId: varchar('test_id', { length: 255 }).notNull(),
  question: text('question').notNull(),
  type: mysqlEnum('type', ['multiple_choice', 'true_false', 'short_answer', 'essay']).notNull(),
  options: json('options'),
  correctAnswer: text('correct_answer'),
  points: int('points').notNull(),
  order: int('order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  testFk: foreignKey({ columns: [table.testId], foreignColumns: [tests.id], name: 'fk_test_questions_test_id' }),
}));

// =========================
// 测试提交表
// =========================
export const testSubmissions = mysqlTable('test_submissions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  testId: varchar('test_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  answers: json('answers').notNull(),
  score: decimal('score', { precision: 5, scale: 2 }),
  feedback: text('feedback'),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
  gradedAt: timestamp('graded_at'),
  gradedBy: varchar('graded_by', { length: 255 }),
}, (table) => ({
  testFk: foreignKey({ columns: [table.testId], foreignColumns: [tests.id], name: 'fk_test_submissions_test_id' }),
  userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: 'fk_test_submissions_user_id' }),
}));

// =========================
// 成绩表
// =========================
export const grades = mysqlTable('grades', {
  id: varchar('id', { length: 255 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  testId: varchar('test_id', { length: 255 }),
  score: decimal('score', { precision: 5, scale: 2 }).notNull(),
  maxScore: decimal('max_score', { precision: 5, scale: 2 }).notNull(),
  percentage: decimal('percentage', { precision: 5, scale: 2 }).notNull(),
  feedback: text('feedback'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  classroomFk: foreignKey({ columns: [table.classroomId], foreignColumns: [classrooms.id], name: 'fk_grades_classroom_id' }),
  userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: 'fk_grades_user_id' }),
  testFk: foreignKey({ columns: [table.testId], foreignColumns: [tests.id], name: 'fk_grades_test_id' }),
}));

// =========================
// 邀请表
// =========================
export const invitations = mysqlTable('invitations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 255 }).notNull(),
  inviterId: varchar('inviter_id', { length: 255 }).notNull(),
  inviteeEmail: varchar('invitee_email', { length: 255 }).notNull(),
  inviteeId: varchar('invitee_id', { length: 255 }),
  role: mysqlEnum('role', ['student', 'teacher', 'observer']).notNull().default('student'),
  status: mysqlEnum('status', ['pending', 'accepted', 'declined', 'expired']).notNull().default('pending'),
  message: text('message'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  respondedAt: timestamp('responded_at'),
}, (table) => ({
  classroomFk: foreignKey({ columns: [table.classroomId], foreignColumns: [classrooms.id], name: 'fk_invitations_classroom_id' }),
  inviterFk: foreignKey({ columns: [table.inviterId], foreignColumns: [users.id], name: 'fk_invitations_inviter_id' }),
  inviteeFk: foreignKey({ columns: [table.inviteeId], foreignColumns: [users.id], name: 'fk_invitations_invitee_id' }),
}));

// =========================
// 教师邀请码表
// =========================
export const teacherInviteCodes = mysqlTable('teacher_invite_codes', {
  id: varchar('id', { length: 255 }).primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  createdById: varchar('created_by_id', { length: 255 }).notNull(),
  isUsed: boolean('is_used').notNull().default(false),
  usedById: varchar('used_by_id', { length: 255 }),
  usedAt: timestamp('used_at'),
  expiresAt: timestamp('expires_at'),
  isRevoked: boolean('is_revoked').notNull().default(false),
  revokedAt: timestamp('revoked_at'),
  revokedReason: text('revoked_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  createdByFk: foreignKey({ columns: [table.createdById], foreignColumns: [users.id], name: 'fk_teacher_invite_codes_created_by_id' }),
  usedByFk: foreignKey({ columns: [table.usedById], foreignColumns: [users.id], name: 'fk_teacher_invite_codes_used_by_id' }),
}));

// =========================
// Relations
// =========================

export const usersRelations = relations(users, ({ many }) => ({
  classroomMembers: many(classroomMembers),
  chatMessages: many(chatMessages),
  testSubmissions: many(testSubmissions),
  grades: many(grades),
  sentInvitations: many(invitations, { relationName: 'inviter' }),
  receivedInvitations: many(invitations, { relationName: 'invitee' }),
}));

export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  teacher: one(users, {
    fields: [classrooms.teacherId],
    references: [users.id],
  }),
  members: many(classroomMembers),
  sessions: many(sessions),
  invitations: many(invitations),
  materialCategories: many(materialCategories),
  materials: many(materials),
}));

export const classroomMembersRelations = relations(classroomMembers, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classroomMembers.classroomId],
    references: [classrooms.id],
  }),
  user: one(users, {
    fields: [classroomMembers.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [sessions.classroomId],
    references: [classrooms.id],
  }),
  chatMessages: many(chatMessages),
  canvasData: many(canvasData),
  whiteboards: many(whiteboards),
  tests: many(tests),
  materials: many(materials),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(sessions, {
    fields: [chatMessages.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

export const whiteboardsRelations = relations(whiteboards, ({ one, many }) => ({
  session: one(sessions, {
    fields: [whiteboards.sessionId],
    references: [sessions.id],
  }),
  creator: one(users, {
    fields: [whiteboards.createdById],
    references: [users.id],
  }),
  canvasData: many(canvasData),
}));

export const canvasDataRelations = relations(canvasData, ({ one }) => ({
  whiteboard: one(whiteboards, {
    fields: [canvasData.whiteboardId],
    references: [whiteboards.id],
  }),
  session: one(sessions, {
    fields: [canvasData.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [canvasData.userId],
    references: [users.id],
  }),
}));

export const materialCategoriesRelations = relations(materialCategories, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [materialCategories.classroomId],
    references: [classrooms.id],
  }),
  materials: many(materials),
}));

export const materialsRelations = relations(materials, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [materials.classroomId],
    references: [classrooms.id],
  }),
  session: one(sessions, {
    fields: [materials.sessionId],
    references: [sessions.id],
  }),
  category: one(materialCategories, {
    fields: [materials.categoryId],
    references: [materialCategories.id],
  }),
  uploader: one(users, {
    fields: [materials.uploadedById],
    references: [users.id],
  }),
}));

export const testsRelations = relations(tests, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [tests.classroomId],
    references: [classrooms.id],
  }),
  session: one(sessions, {
    fields: [tests.sessionId],
    references: [sessions.id],
  }),
  creator: one(users, {
    fields: [tests.createdById],
    references: [users.id],
  }),
  questions: many(testQuestions),
  submissions: many(testSubmissions),
}));

export const testQuestionsRelations = relations(testQuestions, ({ one }) => ({
  test: one(tests, {
    fields: [testQuestions.testId],
    references: [tests.id],
  }),
}));

export const testSubmissionsRelations = relations(testSubmissions, ({ one }) => ({
  test: one(tests, {
    fields: [testSubmissions.testId],
    references: [tests.id],
  }),
  user: one(users, {
    fields: [testSubmissions.userId],
    references: [users.id],
  }),
}));

export const gradesRelations = relations(grades, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [grades.classroomId],
    references: [classrooms.id],
  }),
  user: one(users, {
    fields: [grades.userId],
    references: [users.id],
  }),
  test: one(tests, {
    fields: [grades.testId],
    references: [tests.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [invitations.classroomId],
    references: [classrooms.id],
  }),
  inviter: one(users, {
    fields: [invitations.inviterId],
    references: [users.id],
    relationName: 'inviter',
  }),
  invitee: one(users, {
    fields: [invitations.inviteeId],
    references: [users.id],
    relationName: 'invitee',
  }),
}));

export const teacherInviteCodesRelations = relations(teacherInviteCodes, ({ one }) => ({
  createdBy: one(users, {
    fields: [teacherInviteCodes.createdById],
    references: [users.id],
  }),
  usedBy: one(users, {
    fields: [teacherInviteCodes.usedById],
    references: [users.id],
  }),
}));
