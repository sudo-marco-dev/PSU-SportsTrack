import { supabase } from './supabase';

export type AuditAction = 
  | 'APPROVE_DOCUMENT' 
  | 'REJECT_DOCUMENT' 
  | 'CREATE_TOURNAMENT' 
  | 'UPDATE_TOURNAMENT' 
  | 'DELETE_TOURNAMENT'
  | 'APPROVE_TEAM'
  | 'REJECT_TEAM'
  | 'GENERATE_BRACKET'
  | 'AWARD_STAR';

export const logAudit = async (params: {
  action: AuditAction;
  entity_type: string;
  entity_id?: string;
  details?: string;
}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('audit_logs').insert({
      admin_id: user.id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      details: params.details,
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
};
