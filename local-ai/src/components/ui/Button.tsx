import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-primary text-primary-foreground shadow-[0_14px_34px_hsl(var(--primary)/0.22)] hover:translate-y-[-1px] hover:opacity-95',
  ghost:
    'bg-transparent text-foreground/88 hover:bg-accent/55 hover:text-accent-foreground',
  outline:
    'border border-border/90 bg-[hsl(var(--panel-strong))] text-foreground shadow-[var(--surface-shadow-soft)] hover:border-primary/20 hover:bg-accent/35 hover:text-accent-foreground',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-[1.15rem] px-3.5 text-sm',
  md: 'h-10 rounded-[1.3rem] px-4 text-[15px]',
  icon: 'h-10 w-10 p-0',
};

export function Button({
  className,
  variant = 'default',
  size = 'md',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
