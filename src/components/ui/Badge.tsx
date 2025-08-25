import React, { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800'
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-sm'
  };

  const classes = `
    inline-flex items-center font-medium rounded-full
    ${variants[variant]}
    ${sizes[size]}
    ${className}
  `;

  return (
    <span className={classes} {...props}>
      {dot && (
        <span className={`w-2 h-2 rounded-full mr-2 ${
          variant === 'default' ? 'bg-gray-500' :
          variant === 'success' ? 'bg-green-500' :
          variant === 'warning' ? 'bg-yellow-500' :
          variant === 'error' ? 'bg-red-500' :
          'bg-blue-500'
        }`} />
      )}
      {children}
    </span>
  );
};

interface ConfidenceBadgeProps {
  confidence: number;
  onClick?: () => void;
  editable?: boolean;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  onClick,
  editable = false
}) => {
  const getVariant = (score: number) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'error';
  };

  const formatScore = (score: number) => {
    return (score * 100).toFixed(0) + '%';
  };

  return (
    <Badge
      variant={getVariant(confidence)}
      size="sm"
      className={`${editable ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
    >
      {formatScore(confidence)}
    </Badge>
  );
};