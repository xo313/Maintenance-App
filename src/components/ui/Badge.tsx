import React from 'react';

type BadgeType = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  status: string;
}

export const StatusBadge: React.FC<BadgeProps> = ({ status }) => {
  let badgeType: BadgeType = 'neutral';

  switch (status) {
    case 'تم التسليم':
    case 'مسدد':
    case 'مكتمل':
      badgeType = 'success';
      break;
    case 'قيد الصيانة':
    case 'مفتوح':
      badgeType = 'warning';
      break;
    case 'مرفوض':
    case 'مسحوب':
    case 'دين':
      badgeType = 'danger';
      break;
    case 'جاهز للتسليم':
    case 'مستورد':
      badgeType = 'info';
      break;
    default:
      badgeType = 'neutral';
  }

  return (
    <span className={`badge badge-${badgeType}`}>
      {status}
    </span>
  );
};
