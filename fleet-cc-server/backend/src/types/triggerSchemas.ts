/**
 * TypeScript type definitions for trigger output schemas
 * These types correspond to the JSON Schemas stored in the database
 */

export interface DeviceOnlineTriggerOutput {
  device: {
    id: number;
    device_id: string;
    hostname?: string | null;
    status: string;
    [key: string]: any;
  };
  timestamp: string; // ISO 8601 date-time string
}

export interface DeviceOfflineTriggerOutput {
  device: {
    id: number;
    device_id: string;
    hostname?: string | null;
    status: string;
    [key: string]: any;
  };
  timestamp: string; // ISO 8601 date-time string
}

export interface CommandCompletedTriggerOutput {
  command: {
    id: number;
    command: string;
    status: string;
    [key: string]: any;
  };
  device: {
    id: number;
    device_id: string;
    hostname?: string | null;
    [key: string]: any;
  };
  timestamp: string; // ISO 8601 date-time string
}

export interface CommandFailedTriggerOutput {
  command: {
    id: number;
    command: string;
    status: string;
    error?: string | null;
    [key: string]: any;
  };
  device: {
    id: number;
    device_id: string;
    hostname?: string | null;
    [key: string]: any;
  };
  error: string;
  timestamp: string; // ISO 8601 date-time string
}

export interface DateTimeTriggerOutput {
  timestamp: string; // ISO 8601 date-time string
  date?: string;
  time?: string;
}

export type TriggerOutput =
  | DeviceOnlineTriggerOutput
  | DeviceOfflineTriggerOutput
  | CommandCompletedTriggerOutput
  | CommandFailedTriggerOutput
  | DateTimeTriggerOutput;


