export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          preferred_language: string;
          teaching_depth: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          preferred_language?: string;
          teaching_depth?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          preferred_language?: string;
          teaching_depth?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      teaching_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          topic: string;
          subject: string | null;
          status: "active" | "completed" | "archived";
          preferred_language: string;
          teaching_depth: string;
          current_step_index: number;
          current_stage_id: string | null;
          board_state: Json;
          visual_state: Json;
          visual3d_state: Json;
          lesson_objective: Json | null;
          created_at: string;
          updated_at: string;
          last_activity_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          topic: string;
          subject?: string | null;
          status?: "active" | "completed" | "archived";
          preferred_language: string;
          teaching_depth: string;
          current_step_index?: number;
          current_stage_id?: string | null;
          board_state: Json;
          visual_state: Json;
          visual3d_state: Json;
          lesson_objective?: Json | null;
          created_at?: string;
          updated_at?: string;
          last_activity_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          topic?: string;
          subject?: string | null;
          status?: "active" | "completed" | "archived";
          preferred_language?: string;
          teaching_depth?: string;
          current_step_index?: number;
          current_stage_id?: string | null;
          board_state?: Json;
          visual_state?: Json;
          visual3d_state?: Json;
          lesson_objective?: Json | null;
          created_at?: string;
          updated_at?: string;
          last_activity_at?: string;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "teaching_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_steps: {
        Row: {
          id: string;
          session_id: string;
          step_index: number;
          stage_id: string | null;
          stage_intent: string | null;
          speech: string;
          board_actions: Json;
          visual_actions: Json;
          visual3d_actions: Json;
          pedagogy: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          step_index: number;
          stage_id?: string | null;
          stage_intent?: string | null;
          speech: string;
          board_actions: Json;
          visual_actions: Json;
          visual3d_actions: Json;
          pedagogy?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          step_index?: number;
          stage_id?: string | null;
          stage_intent?: string | null;
          speech?: string;
          board_actions?: Json;
          visual_actions?: Json;
          visual3d_actions?: Json;
          pedagogy?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_steps_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "teaching_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          message_type: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          message_type?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          role?: "user" | "assistant";
          content?: string;
          message_type?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "teaching_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_lessons: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          title: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          title: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string | null;
          title?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_lessons_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_lessons_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "teaching_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_progress: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          topic: string;
          subject: string | null;
          completed_steps: number;
          total_steps: number;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          topic: string;
          subject?: string | null;
          completed_steps?: number;
          total_steps?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          topic?: string;
          subject?: string | null;
          completed_steps?: number;
          total_steps?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_progress_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "teaching_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_records: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          provider: string;
          model: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          total_tokens: number | null;
          request_type: "lesson" | "step" | "interruption";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          provider: string;
          model?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          total_tokens?: number | null;
          request_type?: "lesson" | "step" | "interruption";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string | null;
          provider?: string;
          model?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          total_tokens?: number | null;
          request_type?: "lesson" | "step" | "interruption";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_records_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "teaching_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      session_status: "active" | "completed" | "archived";
      message_role: "user" | "assistant";
      request_type: "lesson" | "step" | "interruption";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"])
    : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"])
    ? PublicTableNameOrOptions
    : never = PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"])
    : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"])
    ? PublicTableNameOrOptions
    : never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"])
  ? (Database["public"]["Tables"])[PublicTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"])
    : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"])
    ? PublicTableNameOrOptions
    : never = PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"])
    : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"])
    ? PublicTableNameOrOptions
    : never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"])[TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"])
  ? (Database["public"]["Tables"])[PublicTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"])
    : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"])
    ? PublicTableNameOrOptions
    : never = PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"])
    : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"])
    ? PublicTableNameOrOptions
    : never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"])[TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"])
  ? (Database["public"]["Tables"])[PublicTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof (Database["public"]["Enums"])
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicEnumNameOrOptions["schema"]]["Enums"])
    : PublicEnumNameOrOptions extends keyof (Database["public"]["Enums"])
    ? PublicEnumNameOrOptions
    : never = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicEnumNameOrOptions["schema"]]["Enums"])
    : PublicEnumNameOrOptions extends keyof (Database["public"]["Enums"])
    ? PublicEnumNameOrOptions
    : never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicEnumNameOrOptions["schema"]]["Enums"])[EnumName]
  : PublicEnumNameOrOptions extends keyof (Database["public"]["Enums"])
  ? (Database["public"]["Enums"])[PublicEnumNameOrOptions]
  : never;

export type TeachingSession = Database["public"]["Tables"]["teaching_sessions"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type LessonStep = Database["public"]["Tables"]["lesson_steps"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type SavedLesson = Database["public"]["Tables"]["saved_lessons"]["Row"];
export type LearningProgress = Database["public"]["Tables"]["learning_progress"]["Row"];
export type UsageRecord = Database["public"]["Tables"]["usage_records"]["Row"];