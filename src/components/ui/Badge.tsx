import React from 'react';

type BadgeType = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  status: string;
}

const STATUS_MAP: Record<string, { label: string; type: BadgeType }> = {
  // English enum values
  delivered:         { label: 'تم التسليم',     type: 'success'  },
  completed:         { label: 'جاهز للتسليم',   type: 'info'     },
  under_maintenance: { label: 'قيد الصيانة',    type: 'warning'  },
  cancelled:         { label: 'ملغى',            type: 'danger'   },
  // Arabic legacy values
  'تم التسليم':   { label: 'تم التسليم',   type: 'success'  },
  'مكتمل':        { label: 'مكتمل',         type: 'success'  },
  'مسدد':         { label: 'مسدد',          type: 'success'  },
  'جاهز للتسليم': { label: 'جاهز للتسليم', type: 'info'     },
  'مستورد':       { label: 'مستورد',        type: 'info'     },
  'قيد الصيانة':  { label: 'قيد الصيانة',  type: 'warning'  },
  'مفتوح':        { label: 'مفتوح',         type: 'warning'  },
  'مرفوض':        { label: 'مرفوض',         type: 'danger'   },
  'مسحوب':        { label: 'مسحوب',         type: 'danger'   },
  'ملغى':         { label: 'ملغى',           type: 'danger'   },
  'دين':          { label: 'دين',            type: 'danger'   },
};

export const StatusBadge: React.FC<BadgeProps> = ({ status }) => {
  const entry = STATUS_MAP[status];
  const label = entry?.label ?? status;
  const type  = entry?.type  ?? 'neutral';

  return (
    <span className={`badge badge-${type}`}>{label}</span>
  );
};
