declare module 'googleapis' {
  type FreeBusyResponse = {
    data: {
      calendars?: Record<string, { busy?: unknown[] }>;
    };
  };

  export const google: {
    calendar: (options: Record<string, unknown>) => {
      freebusy: {
        query: (request: Record<string, unknown>) => Promise<FreeBusyResponse>;
      };
      events: {
        insert: (request: Record<string, unknown>) => Promise<{ data: { id?: string | null; htmlLink?: string | null } }>;
      };
    };
  };

  export namespace calendar_v3 {
    export type Schema$Event = Record<string, unknown>;
  }
}
