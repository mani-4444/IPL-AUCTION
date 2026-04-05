/**
 * Import players from Excel into Supabase players table.
 * Usage: npx ts-node scripts/import-players.ts --file="IPL 2026 PLAYER RATINGS.xlsx"
 *
 * Excel sheets used:
 *   - 'Performance Ratings': Player Name, Team (India/Overseas), Role, Category, Rating (1-10), Base Price
 *   - 'All Teams':           Player, Team (IPL franchise like CSK, MI, etc.)
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../apps/server/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/server/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Role mapping from Excel values to our type
const ROLE_MAP: Record<string, string> = {
  'Batter': 'Batsman',
  'Wicketkeeper': 'Wicketkeeper',
  'All-rounder': 'All-Rounder',
  'Bowler': 'Bowler',
};

/**
 * Parse base price string to Crores (numeric).
 * Examples: "50 Lakhs" → 0.5, "20 Lakhs" → 0.2, "2 Crore" → 2.0
 */
function parseBasePrice(raw: string): number {
  const s = raw.trim().toLowerCase();
  const num = parseFloat(s);
  if (s.includes('lakh')) {
    return num / 100; // convert Lakhs to Crores
  }
  return num; // already in Crores
}

/**
 * Convert rating from 1–10 scale to 1–100.
 */
function scaleRating(raw: number): number {
  return Math.round(raw * 10);
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith('--file='));
  const filePath = fileArg
    ? path.resolve(fileArg.replace('--file=', ''))
    : path.resolve(__dirname, '../IPL 2026 PLAYER RATINGS.xlsx');

  console.log(`Reading Excel file: ${filePath}`);
  const wb = XLSX.readFile(filePath);

  // --- Build IPL franchise map from 'All Teams' sheet ---
  const allTeamsWs = wb.Sheets['All Teams'];
  const allTeamsData = XLSX.utils.sheet_to_json<{
    No: string;
    Player: string;
    Acquisition: string;
    Type: string;
    Role: string;
    Team: string;
  }>(allTeamsWs);

  const iplTeamMap = new Map<string, string>(); // playerName → IPL franchise
  for (const row of allTeamsData) {
    if (row.Player && row.Team) {
      iplTeamMap.set(row.Player.trim(), row.Team.trim());
    }
  }
  console.log(`Loaded ${iplTeamMap.size} IPL franchise mappings`);

  // --- Parse 'Performance Ratings' sheet ---
  const ratingsWs = wb.Sheets['Performance Ratings'];
  const ratingsData = XLSX.utils.sheet_to_json<{
    'Player Name': string;
    'Team': string;         // India | Overseas
    'Role': string;
    'Category (Capped/Uncapped)': string;
    'Rating': number;
    'Base Price': string;
  }>(ratingsWs);

  console.log(`Found ${ratingsData.length} players in Performance Ratings sheet`);

  const players = ratingsData
    .filter((row) => row['Player Name'] && row['Role'] && row['Rating'] && row['Base Price'])
    .map((row) => {
      const name = row['Player Name'].trim();
      const role = ROLE_MAP[row['Role'].trim()] ?? row['Role'].trim();
      const nationality = row['Team'].trim() === 'India' ? 'Indian' : 'Overseas';
      const rating = scaleRating(row['Rating']);
      const basePrice = parseBasePrice(row['Base Price']);
      const iplTeam = iplTeamMap.get(name) ?? 'Unknown';

      return { name, role, rating, base_price: basePrice, nationality, ipl_team: iplTeam };
    });

  console.log(`Prepared ${players.length} players for insert`);
  console.log('Sample:', players[0]);

  // --- Validate roles ---
  const validRoles = new Set(['Batsman', 'Wicketkeeper', 'Bowler', 'All-Rounder']);
  const invalidRoles = players.filter((p) => !validRoles.has(p.role));
  if (invalidRoles.length > 0) {
    console.warn('Players with unexpected roles:', invalidRoles.map((p) => `${p.name}: ${p.role}`));
  }

  // --- Upsert into Supabase (clear first for idempotency) ---
  console.log('Clearing existing players...');
  const { error: deleteError } = await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteError) {
    console.error('Delete error:', deleteError.message);
    process.exit(1);
  }

  console.log('Inserting players in batches of 50...');
  const BATCH_SIZE = 50;
  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const batch = players.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('players').insert(batch);
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
      process.exit(1);
    }
    console.log(`  Inserted batch ${i / BATCH_SIZE + 1} (${batch.length} players)`);
  }

  // --- Verify ---
  const { count, error: countError } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Count error:', countError.message);
  } else {
    console.log(`\nDone! Total players in Supabase: ${count}`);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
