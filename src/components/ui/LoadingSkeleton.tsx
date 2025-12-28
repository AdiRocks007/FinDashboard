import React from 'react'
import { cn } from '@/lib/utils/cn'

export interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse'
}) => {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  }
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse-slow',
    none: ''
  }
  
  const style: React.CSSProperties = {
    width: width || (variant === 'circular' ? '40px' : '100%'),
    height: height || (variant === 'text' ? '1em' : variant === 'circular' ? '40px' : '200px')
  }
  
  return (
    <div
      className={cn(
        'bg-neutral-200 dark:bg-neutral-700',
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
      role="status"
      aria-label="Loading"
    />
  )
}

// Preset loading skeletons for common components
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex space-x-4">
        <Skeleton width="25%" height="20px" />
        <Skeleton width="25%" height="20px" />
        <Skeleton width="25%" height="20px" />
        <Skeleton width="25%" height="20px" />
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex space-x-4">
          <Skeleton width="25%" height="16px" />
          <Skeleton width="25%" height="16px" />
          <Skeleton width="25%" height="16px" />
          <Skeleton width="25%" height="16px" />
        </div>
      ))}
    </div>
  )
}

export const CardSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-700">
      <Skeleton width="60%" height="24px" />
      <Skeleton width="100%" height="16px" />
      <Skeleton width="80%" height="16px" />
      <div className="flex space-x-2">
        <Skeleton variant="circular" width="32px" height="32px" />
        <Skeleton variant="circular" width="32px" height="32px" />
        <Skeleton variant="circular" width="32px" height="32px" />
      </div>
    </div>
  )
}

export const ChartSkeleton: React.FC<{ height?: string | number }> = ({ height = '300px' }) => {
  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between">
        <Skeleton width="30%" height="20px" />
        <Skeleton width="20%" height="20px" />
      </div>
      <Skeleton variant="rectangular" width="100%" height={height} />
      <div className="flex justify-center space-x-4">
        <Skeleton width="80px" height="12px" />
        <Skeleton width="80px" height="12px" />
        <Skeleton width="80px" height="12px" />
      </div>
    </div>
  )
}

export const WidgetSkeleton: React.FC = () => {
  return (
    <div className="w-full rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton width="40%" height="24px" />
        <Skeleton variant="circular" width="32px" height="32px" />
      </div>
      <div className="space-y-3">
        <Skeleton width="100%" height="100px" variant="rectangular" />
        <div className="flex space-x-2">
          <Skeleton width="30%" height="16px" />
          <Skeleton width="30%" height="16px" />
          <Skeleton width="30%" height="16px" />
        </div>
      </div>
    </div>
  )
}

export const DashboardSkeleton: React.FC<{ widgets?: number }> = ({ widgets = 6 }) => {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: widgets }).map((_, index) => (
        <WidgetSkeleton key={index} />
      ))}
    </div>
  )
}

export default Skeleton

