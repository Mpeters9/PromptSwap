import { randomUUID } from 'crypto';

type TableRow = Record<string, any>;

type FilterOperator = 'eq' | 'lt' | 'lte' | 'gt' | 'gte';

type Filter = { column: string; operator: FilterOperator; value: any };

type QueryState = {
  table: string;
  rows: TableRow[];
  filters: Filter[];
};

function matchFilters(row: TableRow, filters: Filter[]): boolean {
  return filters.every((filter) => matchFilter(row, filter));
}

function matchFilter(row: TableRow, filter: Filter): boolean {
  const actual = row[filter.column];
  const expected = filter.value;

  switch (filter.operator) {
    case 'eq':
      return actual === expected;
    case 'lt':
      return actual < expected;
    case 'lte':
      return actual <= expected;
    case 'gt':
      return actual > expected;
    case 'gte':
      return actual >= expected;
    default:
      return false;
  }
}

class TableQuery {
  private state: QueryState;
  private parent: ReturnType<typeof createSupabaseMock>;
  private pendingUpdate?: any;

  constructor(state: QueryState, parent: ReturnType<typeof createSupabaseMock>) {
    this.state = state;
    this.parent = parent;
  }

  select(_fields?: string) {
    return this;
  }

  private addFilter(column: string, operator: FilterOperator, value: any) {
    this.state.filters.push({ column, operator, value });
    if (this.pendingUpdate) {
      const res = this.applyPendingUpdate();
      this.pendingUpdate = undefined;
      return res;
    }
    return this;
  }

  eq(column: string, value: any) {
    return this.addFilter(column, 'eq', value);
  }

  lt(column: string, value: any) {
    return this.addFilter(column, 'lt', value);
  }

  lte(column: string, value: any) {
    return this.addFilter(column, 'lte', value);
  }

  gt(column: string, value: any) {
    return this.addFilter(column, 'gt', value);
  }

  gte(column: string, value: any) {
    return this.addFilter(column, 'gte', value);
  }

  or(_expr: string) {
    return this; // not needed for current tests
  }

  maybeSingle() {
    const row = this.state.rows.find((r) => matchFilters(r, this.state.filters));
    if (!row) return { data: null, error: { code: 'PGRST116', message: 'No rows' } };
    return { data: { ...row }, error: null };
  }

  single() {
    return this.maybeSingle();
  }

  then(resolve: (value: any) => any, reject?: (reason: any) => any) {
    const rows = this.state.rows.filter((r) => matchFilters(r, this.state.filters));
    const result = { data: rows, error: null };
    resolve(result);
    return Promise.resolve(result);
  }

  insert(payload: any) {
    const wrapResult = (data: any, error: any = null) => ({
      data,
      error,
      select: () => ({
        maybeSingle: () => ({ data, error }),
        single: () => ({ data, error }),
      }),
      maybeSingle: () => ({ data, error }),
      single: () => ({ data, error }),
    });

    if (this.state.table === 'stripe_events') {
      const id = payload.event_id || payload.eventId;
      const exists = this.parent.data.stripe_events.find((e) => e.event_id === id || e.eventId === id);
      if (exists) {
        return wrapResult(null, { code: '23505', message: 'duplicate key value violates unique constraint' });
      }
      this.parent.data.stripe_events.push({ ...payload });
      return wrapResult(payload, null);
    }

    if (this.state.table === 'purchases') {
      const id = payload.id ?? randomUUID();
      const row = { id, ...payload };
      this.parent.data.purchases.push(row);
      return wrapResult(row, null);
    }

    if (this.state.table === 'refund_requests') {
      const id = payload.id ?? randomUUID();
      const existingOpen = this.parent.data.refund_requests.find(
        (r) => r.purchase_id === payload.purchase_id && r.status === 'open'
      );
      if (existingOpen) {
        return wrapResult(null, { code: '23505', message: 'duplicate open request' });
      }
      const row = { id, ...payload };
      this.parent.data.refund_requests.push(row);
      return wrapResult(row, null);
    }

    if (this.state.table === 'refunds') {
      const row = { ...payload, id: payload.id ?? randomUUID() };
      this.parent.data.refunds.push(row);
      return wrapResult(row, null);
    }

    if (this.state.table === 'prompt_comments') {
      const row = { ...payload, id: payload.id ?? randomUUID() };
      this.parent.data.prompt_comments.push(row);
      return wrapResult(row, null);
    }

    if (this.state.table === 'notifications') {
      const row = { ...payload, id: payload.id ?? randomUUID() };
      this.parent.data.notifications.push(row);
      return wrapResult(row, null);
    }

    return wrapResult(null, null);
  }

  update(payload: any) {
    // Defer update until filters are applied (eq) to mimic query builder chaining
    this.pendingUpdate = payload;
    return this;
  }

  delete() {
    const rows = this.state.rows;
    const index = rows.findIndex((r) => matchFilters(r, this.state.filters));
    if (index === -1) return { error: { code: 'PGRST116', message: 'No rows found' } };
    rows.splice(index, 1);
    return { data: null, error: null };
  }

  private applyPendingUpdate() {
    const rows = this.state.rows;
    const index = rows.findIndex((r) => matchFilters(r, this.state.filters));
    if (index === -1) return { error: { code: 'PGRST116', message: 'No rows found' } };
    rows[index] = { ...rows[index], ...this.pendingUpdate };
    return { data: rows[index], error: null };
  }
}

export function createSupabaseMock(seed?: Partial<ReturnType<typeof defaultData>>) {
  const data = { ...defaultData(), ...seed } as ReturnType<typeof defaultData>;

  const supabase = {
    data,
    auth: {
      getUser: async () => ({ data: { user: data.authUser }, error: null }),
    },
    from(table: string) {
      switch (table) {
        case 'stripe_events':
          return new TableQuery({ table, rows: data.stripe_events, filters: [] }, supabase as any);
        case 'purchases':
          return new TableQuery({ table, rows: data.purchases, filters: [] }, supabase as any);
        case 'prompts':
          return new TableQuery({ table, rows: data.prompts, filters: [] }, supabase as any);
        case 'swaps':
          return new TableQuery({ table, rows: data.swaps, filters: [] }, supabase as any);
        case 'profiles':
          return new TableQuery({ table, rows: data.profiles, filters: [] }, supabase as any);
        case 'refund_requests':
          return new TableQuery({ table, rows: data.refund_requests, filters: [] }, supabase as any);
        case 'refunds':
          return new TableQuery({ table, rows: data.refunds, filters: [] }, supabase as any);
        case 'prompt_comments':
          return new TableQuery({ table, rows: data.prompt_comments, filters: [] }, supabase as any);
        case 'notifications':
          return new TableQuery({ table, rows: data.notifications, filters: [] }, supabase as any);
        case 'rate_limits':
          return new TableQuery({ table, rows: data.rate_limits, filters: [] }, supabase as any);
        default:
          throw new Error(`Table not mocked: ${table}`);
      }
    },
  } as any;

  return supabase;
}

function defaultData() {
  return {
    stripe_events: [] as TableRow[],
    purchases: [] as TableRow[],
    prompts: [] as TableRow[],
    swaps: [] as TableRow[],
    profiles: [] as TableRow[],
    refund_requests: [] as TableRow[],
    refunds: [] as TableRow[],
    prompt_comments: [] as TableRow[],
    notifications: [] as TableRow[],
    rate_limits: [] as TableRow[],
    authUser: null as any,
  };
}
