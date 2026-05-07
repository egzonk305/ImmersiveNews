import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: string
}

export function PageHeader({ title, description, action, icon }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8 gap-4 animate-fade-in-up">
      <div className="min-w-0 flex items-start gap-4">
        {icon && (
          <span
            className="hidden sm:flex w-12 h-12 shrink-0 rounded-2xl items-center justify-center text-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.10) 60%, rgba(236,72,153,0.08) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.50), inset 0 0 0 1px rgba(139,92,246,0.18), 0 6px 18px -6px rgba(99,102,241,0.20)',
            }}
            aria-hidden
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold text-slate-800 truncate tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-slate-500 mt-1 font-normal leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  )
}
