/**
 * Hand-maintained mirror of `supabase/migrations/0001_init.sql`.
 * Regenerate with `npx supabase gen types typescript --local` once you
 * have a real project and want the exhaustive generated version instead.
 */

export type PocketType = "spend" | "savings" | "investments";
export type ProfileRole = "super_admin" | "family_admin" | "child";
export type AdminStatus = "pending" | "active" | "rejected";
export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "allowance"
  | "savings_bonus"
  | "market_adjustment"
  | "admin_adjustment";
export type TransactionStatus = "pending" | "completed" | "rejected";
export type AllowanceFrequency = "weekly" | "monthly" | "custom_days";
export type BonusRunStatus = "applied" | "undone";
export type InvestmentMode = "manual" | "auto";
export type RateSource = "manual" | "auto";

// Matches postgrest-js's GenericTable shape exactly (Relationships is a
// *required* field there) — without it, Database silently fails to satisfy
// GenericSchema and every query result collapses to `never`.
type Table<Row, RequiredInsert, OptionalInsert = Partial<Row>> = {
  Row: Row;
  Insert: RequiredInsert & Partial<OptionalInsert>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          family_id: string | null;
          role: ProfileRole;
          display_name: string;
          username: string | null;
          locale_pref: string | null;
          created_at: string;
        },
        { id: string; role: ProfileRole; display_name: string }
      >;
      families: Table<
        { id: string; name: string; created_at: string; created_by: string },
        { name: string; created_by: string }
      >;
      family_admins: Table<
        {
          family_id: string;
          user_id: string;
          status: AdminStatus;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
        },
        { family_id: string; user_id: string }
      >;
      pockets: Table<
        {
          id: string;
          child_id: string;
          type: PocketType;
          balance: number;
          enabled: boolean;
          created_at: string;
        },
        { child_id: string; type: PocketType }
      >;
      transactions: Table<
        {
          id: string;
          family_id: string;
          child_id: string;
          pocket_type: PocketType;
          type: TransactionType;
          amount: number;
          status: TransactionStatus;
          description: string | null;
          savings_bonus_run_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          family_id: string;
          child_id: string;
          pocket_type: PocketType;
          type: TransactionType;
          amount: number;
          created_by: string;
        }
      >;
      allowance_configs: Table<
        {
          id: string;
          child_id: string;
          spend_amount: number;
          savings_amount: number;
          investments_amount: number;
          frequency: AllowanceFrequency;
          interval_days: number | null;
          weekly_weekday: number | null;
          monthly_day: number | null;
          monthly_last_day: boolean;
          next_run_date: string;
          active: boolean;
          created_by: string;
          updated_at: string;
        },
        {
          child_id: string;
          spend_amount: number;
          savings_amount: number;
          investments_amount: number;
          frequency: AllowanceFrequency;
          next_run_date: string;
          created_by: string;
        }
      >;
      savings_bonus_runs: Table<
        {
          id: string;
          family_id: string;
          run_date: string;
          status: BonusRunStatus;
          created_by: string | null;
          undone_at: string | null;
          created_at: string;
        },
        { family_id: string; run_date: string }
      >;
      market_benchmarks: Table<
        {
          id: string;
          name: string;
          api_symbol: string;
          last_rate_pct: number | null;
          last_fetched_at: string | null;
        },
        { name: string; api_symbol: string }
      >;
      family_investment_settings: Table<
        {
          family_id: string;
          mode: InvestmentMode;
          benchmark_id: string | null;
          updated_at: string;
        },
        { family_id: string }
      >;
      investment_rate_history: Table<
        {
          id: string;
          family_id: string;
          rate_pct: number;
          source: RateSource;
          applied_at: string;
          applied_by: string | null;
        },
        { family_id: string; rate_pct: number; source: RateSource }
      >;
      push_subscriptions: Table<
        {
          endpoint: string;
          profile_id: string;
          p256dh: string;
          auth: string;
          created_at: string;
        },
        { endpoint: string; profile_id: string; p256dh: string; auth: string }
      >;
      webauthn_credentials: Table<
        {
          id: string;
          user_id: string;
          credential_id: string;
          public_key: string;
          counter: number;
          device_type: string | null;
          backed_up: boolean;
          transports: string[] | null;
          created_at: string;
          last_used_at: string | null;
        },
        { user_id: string; credential_id: string; public_key: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      complete_family_admin_signup: {
        Args: { p_family_name: string; p_display_name: string };
        Returns: string;
      };
      set_family_admin_status: {
        Args: { p_family_id: string; p_user_id: string; p_status: AdminStatus };
        Returns: void;
      };
      provision_child: {
        Args: {
          p_child_auth_id: string;
          p_family_id: string;
          p_display_name: string;
          p_username: string;
        };
        Returns: void;
      };
      resolve_child_email: {
        Args: { p_username: string };
        Returns: string | null;
      };
      request_withdrawal: {
        Args: { p_amount: number; p_description: string | null };
        Returns: string;
      };
      approve_withdrawal: {
        Args: { p_transaction_id: string };
        Returns: void;
      };
      reject_withdrawal: {
        Args: { p_transaction_id: string };
        Returns: void;
      };
      admin_adjust_balance: {
        Args: {
          p_child_id: string;
          p_pocket_type: PocketType;
          p_amount: number;
          p_direction: "deposit" | "withdrawal";
          p_description: string | null;
        };
        Returns: string;
      };
      run_savings_bonus: {
        Args: { p_family_id: string };
        Returns: string;
      };
      undo_savings_bonus: {
        Args: { p_run_id: string };
        Returns: void;
      };
      recalculate_savings_bonus: {
        Args: { p_run_id: string };
        Returns: string;
      };
      apply_market_rate: {
        Args: {
          p_family_id: string;
          p_rate_pct: number;
          p_source: RateSource;
        };
        Returns: string;
      };
      process_due_allowances: {
        Args: Record<string, never>;
        Returns: number;
      };
      run_savings_bonus_for_all_families_if_month_end: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
  };
}
