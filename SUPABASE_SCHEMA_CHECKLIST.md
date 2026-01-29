# Supabase schema checklist

Run these in the Supabase **SQL Editor** (in any order). Each script is idempotent.

## Core app

- `opportunities` table exists and is readable/writable via your RLS policies.

## Optional feature columns

- Sales person
  - Script: `SUPABASE_SQL_sales_person.sql`
  - Adds: `opportunities.sales_person` (text)

- Battery Solution
  - Script: `SUPABASE_SQL_battery_solution.sql`
  - Adds: `opportunities.battery_solution` (text)

- Vehicle fields (only used for “Commercial Vehicles and Fleets”)
  - Script: `SUPABASE_SQL_vehicle_fields.sql`
  - Adds: `opportunities.vehicle_brand`, `opportunities.vehicle_model` (text)

- Next action completion tracking (history)
  - Script: `SUPABASE_SQL_next_action_completed_at.sql`
  - Adds: `opportunities.next_action_completed_at` (timestamptz)

- Next action completion audit metadata
  - Script: `SUPABASE_SQL_next_action_audit.sql`
  - Adds: `opportunities.next_action_completed_by`, `opportunities.next_action_completed_note` (text)

- Owner assignment (“My deals”)
  - Script: `SUPABASE_SQL_owner_user_id.sql`
  - Adds: `opportunities.owner_user_id` (uuid)

## Notes

- The app is designed to **degrade gracefully** if optional columns aren’t present (it will hide related UI or retry writes without those fields).
- If you enable `owner_user_id`, you may want to update your RLS policies to allow setting/changing it according to your rules (e.g. only the current owner can change it).
