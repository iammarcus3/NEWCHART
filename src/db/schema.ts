import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define the 'users' table using the Firebase Auth uid as unique identifier
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define user custom charts & preferences
export const customCharts = pgTable('custom_charts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  chartType: text('chart_type').notNull(),
  settingsJson: text('settings_json').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define relationships for the 'users' table
export const usersRelations = relations(users, ({ many }) => ({
  customCharts: many(customCharts),
}));

// Define relationships for the 'custom_charts' table
export const customChartsRelations = relations(customCharts, ({ one }) => ({
  user: one(users, {
    fields: [customCharts.userId],
    references: [users.id],
  }),
}));
