import React from 'react';
import { DocStatus } from '../types';
import { CheckCircle, Clock, AlertCircle, Circle } from 'lucide-react';

export const StatusBadge: React.FC<{ status: DocStatus }> = ({ status }) => {
  switch (status) {
    case DocStatus.COMPLETED:
      return <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle size={14} /> 完成</span>;
    case DocStatus.GENERATING:
      return <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400"><Clock size={14} className="animate-pulse" /> 生成中...</span>;
    case DocStatus.ERROR:
      return <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400"><AlertCircle size={14} /> 失败</span>;
    default:
      return <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"><Circle size={14} /> 待处理</span>;
  }
};