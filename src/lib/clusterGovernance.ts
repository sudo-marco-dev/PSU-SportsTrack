import type { SupabaseClient } from '@supabase/supabase-js';
import { logAudit } from './audit';

export interface Cluster {
  id: string;
  name: string;
  description: string;
  college_codes: string[];
  campuses: string[];
  color: string;
  created_at?: string;
  updated_at?: string;
}

export const CLUSTER_COLOR_PALETTE = [
  '#f97316', // Orange (Apolaki default)
  '#3b82f6', // Blue (Libulan default)
  '#eab308', // Amber (Tala default)
  '#a855f7', // Purple (Haliya default)
  '#10b981', // Emerald (Mapulon default)
  '#06b6d4', // Cyan (Dumangan default)
  '#ec4899', // Pink
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#f59e0b', // Amber-warm
  '#64748b', // Slate
];

export const DEFAULT_BINTURUNGAN_TRIBES: Omit<Cluster, 'id'>[] = [
  {
    name: 'Tribo Apolaki',
    description: 'God of Sun & War — College of Teacher Education (CTE), College of Criminal Justice Education (CCJE)',
    college_codes: ['CTE', 'CCJE'],
    campuses: [],
    color: '#f97316',
  },
  {
    name: 'Tribo Libulan',
    description: 'Deity of the Moon & Guidance — College of Engineering, Architecture and Technology (CEAT), College of Nursing and Health Sciences (CNHS), School of Law (SOL), School of Medicine (SOM)',
    college_codes: ['CEAT', 'CNHS', 'SOL', 'SOM'],
    campuses: [],
    color: '#3b82f6',
  },
  {
    name: 'Tribo Tala',
    description: 'Goddess of the Morning Star — College of Business and Accountancy (CBA), College of Hospitality Management and Tourism (CHMT)',
    college_codes: ['CBA', 'CHMT'],
    campuses: [],
    color: '#eab308',
  },
  {
    name: 'Tribo Haliya',
    description: 'Goddess of Moonlight & Protection — College of Sciences (CS), College of Arts and Humanities (CAH)',
    college_codes: ['CS', 'CAH'],
    campuses: [],
    color: '#a855f7',
  },
  {
    name: 'Tribo Mapulon',
    description: 'God of Seasons & Harvest — Southern External Campuses as whole entities',
    college_codes: [],
    campuses: [
      "PSU Brooke's Point",
      'PSU Bataraza',
      'PSU Balabac',
      'PSU Sofronio Española',
      'PSU Narra',
      'PSU Quezon',
      'PSU Rizal',
    ],
    color: '#10b981',
  },
  {
    name: 'Tribo Dumangan',
    description: 'God of Bountiful Harvest — Northern & Island External Campuses as whole entities',
    college_codes: [],
    campuses: [
      'PSU Roxas',
      'PSU Taytay',
      'PSU Coron',
      'PSU San Vicente',
      'PSU El Nido',
      'PSU Cuyo',
      'PSU Dumaran',
      'PSU Linapacan',
      'PSU San Rafael',
      'PSU Araceli',
    ],
    color: '#06b6d4',
  },
];

/**
 * Resets all clusters in the database back to the official 6 PSU Binturungan Tribes presets.
 */
export async function resetToOfficialBinturunganTribes(supabase: SupabaseClient): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    for (const tribe of DEFAULT_BINTURUNGAN_TRIBES) {
      const { data: existing } = await supabase
        .from('clusters')
        .select('id')
        .eq('name', tribe.name)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('clusters')
          .update({
            description: tribe.description,
            college_codes: tribe.college_codes,
            campuses: tribe.campuses,
            color: tribe.color,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('clusters').insert(tribe);
      }
    }

    await logAudit({
      action: 'RESET_CLUSTERS',
      entity_type: 'clusters',
      details: 'Reset university clusters back to authentic 6 PSU Binturungan Tribes presets',
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error resetting clusters:', err);
    return { success: false, error: err.message || 'Failed to reset clusters' };
  }
}
