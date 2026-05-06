import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: string
}

export function PageHeader({ title, description, action, icon }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div className="min-w-0 flex items-start gap-3.5">
        {icon && (
          <span
            className="hidden sm:flex w-11 h-11 shrink-0 rounded-2xl items-center justify-center text-xl shadow-md shadow-violet-100/60"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.12) 60%, rgba(236,72,153,0.10) 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.20), 0 4px 12px rgba(99,102,241,0.12)',
            }}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800 truncate tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-slate-400 mt-0.5 font-normal">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  )
}
