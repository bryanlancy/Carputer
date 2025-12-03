/**
 * TypeScript type definitions for event input schemas
 * These types correspond to the JSON Schemas stored in the database
 */

export interface ShowNotificationEventInput {
  message: string;
  title?: string;
  device?: {
    id: number;
    device_id: string;
    hostname?: string | null;
    [key: string]: any;
  };
}

export interface SendEmailEventInput {
  to: string;
  subject: string;
  body: string;
}

export interface ExecuteCommandEventInput {
  device: {
    id: number;
    device_id: string;
    [key: string]: any;
  };
  command: string;
  parameters?: Record<string, any>;
}

export type EventInput =
  | ShowNotificationEventInput
  | SendEmailEventInput
  | ExecuteCommandEventInput;

