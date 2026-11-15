import type { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react';
import { ArrowLeft, Info, LifeBuoy, type LucideProps } from 'lucide-react';
import { MusicCorner } from './MusicCorner';

type IconType = ComponentType<LucideProps>;

export function Screen({
  children,
  top,
  footer,
  tone,
  label,
}: {
  children: ReactNode;
  top?: ReactNode;
  footer?: ReactNode;
  tone?: 'plain' | 'home' | 'family' | 'you' | 'routine' | 'dark';
  label?: string;
}) {
  return (
    <div className={`screen tone-${tone ?? 'plain'}`} aria-label={label}>
      {top}
      <main className="screen-scroll">
        <div className="screen-body">{children}</div>
      </main>
      {footer ? <div className="screen-footer">{footer}</div> : null}
    </div>
  );
}

export function TopBar({
  back,
  getHelp,
  right,
}: {
  back?: { label: string; onClick: () => void };
  getHelp?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="topbar">
      {back ? (
        <button type="button" className="btn-back" onClick={back.onClick}>
          <ArrowLeft size={26} strokeWidth={2.5} aria-hidden />
          <span>{back.label}</span>
        </button>
      ) : (
        <span />
      )}
      <div className="topbar-right">
        {right}
        {getHelp ? (
          <button type="button" className="btn-gethelp-small" onClick={getHelp}>
            <LifeBuoy size={22} strokeWidth={2.5} aria-hidden />
            <span>Get help</span>
          </button>
        ) : null}
        <MusicCorner />
      </div>
    </header>
  );
}

export function Heading({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="heading">
      <h1 tabIndex={-1} data-screen-heading>
        {children}
      </h1>
      {sub ? <p className="heading-sub">{sub}</p> : null}
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'call' | 'danger' | 'quiet' | 'help';

export function Button({
  variant = 'secondary',
  size = 'lg',
  icon: Icon,
  children,
  className,
  block = true,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'xl' | 'lg' | 'md';
  icon?: IconType;
  block?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size}${block ? ' btn-block' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {Icon ? <Icon size={size === 'md' ? 22 : 28} strokeWidth={2.5} aria-hidden /> : null}
      <span>{children}</span>
    </button>
  );
}

/** A link styled as a button, for actions that hand off to another app. */
export function LinkButton({
  href,
  variant = 'secondary',
  icon: Icon,
  children,
  onClick,
  newTab = false,
}: {
  href: string;
  variant?: Variant;
  icon?: IconType;
  children: ReactNode;
  onClick?: () => void;
  newTab?: boolean;
}) {
  return (
    <a
      href={href}
      className={`btn btn-${variant} btn-xl btn-block`}
      onClick={onClick}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {Icon ? <Icon size={28} strokeWidth={2.5} aria-hidden /> : null}
      <span>{children}</span>
    </a>
  );
}

export function Notice({
  children,
  tone = 'info',
  icon: Icon = Info,
}: {
  children: ReactNode;
  tone?: 'info' | 'private' | 'warn' | 'ok';
  icon?: IconType;
}) {
  return (
    <div className={`notice notice-${tone}`}>
      <Icon size={22} strokeWidth={2.5} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`card${className ? ` ${className}` : ''}`}>{children}</section>;
}

export function Stack({ children, gap = 'md' }: { children: ReactNode; gap?: 'sm' | 'md' | 'lg' }) {
  return <div className={`stack stack-${gap}`}>{children}</div>;
}
