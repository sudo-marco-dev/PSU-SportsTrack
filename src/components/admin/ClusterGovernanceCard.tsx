import type { Cluster } from '@/lib/clusterGovernance';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, MapPin, Edit3, Trash2 } from 'lucide-react';
import { formatCampusShort } from '@/lib/psuCampuses';

interface ClusterGovernanceCardProps {
  cluster: Cluster;
  onEdit: (cluster: Cluster) => void;
  onDelete: (cluster: Cluster) => void;
}

export const ClusterGovernanceCard = ({
  cluster,
  onEdit,
  onDelete,
}: ClusterGovernanceCardProps) => {
  const collegesCount = (cluster.college_codes || []).length;
  const campusesCount = (cluster.campuses || []).length;
  const clusterColor = cluster.color || '#f97316';

  return (
    <Card className="rounded-2xl md:rounded-3xl border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between group">
      <CardContent className="p-4 sm:p-5 space-y-4 flex flex-col justify-between h-full">
        {/* Card Header: Color chip, Name, Description & Quick Actions */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="size-4 sm:size-4.5 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: clusterColor }}
              />
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white leading-snug pt-0.5 pb-0.5 truncate group-hover:text-orange-500 transition-colors">
                  {cluster.name}
                </h3>
              </div>
            </div>

            {/* Actions: Edit & Delete */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(cluster)}
                className="size-8 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 cursor-pointer"
                title="Edit Cluster"
              >
                <Edit3 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(cluster)}
                className="size-8 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                title="Delete Cluster"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          {cluster.description && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
              {cluster.description}
            </p>
          )}
        </div>

        {/* Assignments Breakdown */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
          {/* Main Campus Colleges */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1">
                <Building2 className="size-3 text-blue-500" />
                <span>Main Campus Colleges</span>
              </span>
              <span className="text-slate-500 font-bold">{collegesCount}</span>
            </div>

            {collegesCount > 0 ? (
              <div className="flex flex-wrap gap-1">
                {cluster.college_codes.map((code) => (
                  <Badge
                    key={code}
                    variant="outline"
                    className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  >
                    {code}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[10px] italic text-slate-400">
                No Main Campus colleges assigned
              </p>
            )}
          </div>

          {/* External Campuses (Whole Entities) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="size-3 text-emerald-500" />
                <span>External Campuses (Whole)</span>
              </span>
              <span className="text-slate-500 font-bold">{campusesCount}</span>
            </div>

            {campusesCount > 0 ? (
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-0.5">
                {cluster.campuses.map((campus) => (
                  <Badge
                    key={campus}
                    variant="outline"
                    className="text-[9px] font-bold px-2 py-0.5 rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
                    title={campus}
                  >
                    {formatCampusShort(campus)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[10px] italic text-slate-400">
                No external campuses assigned
              </p>
            )}
          </div>
        </div>

        {/* Card Footer: Summary Tag */}
        <div className="pt-2 mt-auto border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400">
          <span
            className="px-2 py-0.5 rounded-md text-white font-bold"
            style={{ backgroundColor: clusterColor }}
          >
            {cluster.name.replace(/^Tribo\s+/i, '')}
          </span>
          <span>
            {collegesCount + campusesCount} Total Affiliated Units
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
