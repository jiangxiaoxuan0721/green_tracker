import { motion } from 'framer-motion';
import './EnhancedLoading.css';

export const EnhancedLoading = ({ 
  size = 'medium',
  color = 'primary',
  text,
  fullPage = false,
  className = ''
}) => {
  const sizeClasses = {
    small: 'enhanced-loading-small',
    medium: 'enhanced-loading-medium',
    large: 'enhanced-loading-large',
  };

  const colorClasses = {
    primary: 'enhanced-loading-primary',
    secondary: 'enhanced-loading-secondary',
    white: 'enhanced-loading-white',
    muted: 'enhanced-loading-muted',
  };

  const containerClass = `enhanced-loading-container ${sizeClasses[size]} ${className}`;
  
  if (fullPage) {
    return (
      <div className="enhanced-loading-fullpage">
        <div className={containerClass}>
          <LoadingSpinner size={size} color={color} />
          {text && <div className="enhanced-loading-text">{text}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <LoadingSpinner size={size} color={color} />
      {text && <div className="enhanced-loading-text">{text}</div>}
    </div>
  );
};

const LoadingSpinner = ({ size, color }) => {
  const dotVariants = {
    animate: (i) => ({
      scale: [1, 1.3, 1],
      opacity: [0.3, 1, 0.3],
      transition: {
        duration: 1,
        ease: "easeInOut",
        repeat: Infinity,
        delay: i * 0.15,
      },
    }),
  };

  return (
    <div className={`enhanced-loading-spinner ${color}-color`}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          custom={i}
          variants={dotVariants}
          animate="animate"
          className="enhanced-loading-dot"
        />
      ))}
    </div>
  );
};

export const LoadingSkeleton = ({ 
  count = 1,
  width = '100%',
  height = '20px',
  className = '',
  layout = 'block'
}) => {
  const skeletons = Array.from({ length: count });
  
  const skeletonVariants = {
    initial: { opacity: 0.3 },
    animate: { 
      opacity: 0.7,
      transition: {
        duration: 1,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "reverse",
      }
    },
  };

  if (layout === 'card') {
    return (
      <motion.div 
        className={`loading-skeleton-card ${className}`}
        style={{ width, minHeight: '200px', borderRadius: 'var(--radius-md)' }}
        initial="initial"
        animate="animate"
        variants={skeletonVariants}
      />
    );
  }

  return (
    <div className="loading-skeleton-container">
      {skeletons.map((_, index) => (
        <motion.div
          key={index}
          className={`loading-skeleton-item ${className}`}
          style={{ width, height }}
          initial="initial"
          animate="animate"
          variants={skeletonVariants}
          transition={{ delay: index * 0.1 }}
        />
      ))}
    </div>
  );
};

export const ProgressBar = ({ 
  progress = 0,
  label,
  showPercentage = true,
  color = 'primary',
  className = ''
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  return (
    <div className={`progress-bar-container ${className}`}>
      {label && <div className="progress-bar-label">{label}</div>}
      <div className="progress-bar-track">
        <motion.div
          className={`progress-bar-fill ${color}-color`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.4, ease: [0.43, 0.13, 0.23, 0.96] }}
        />
      </div>
      {showPercentage && (
        <div className="progress-bar-percentage">
          {Math.round(clampedProgress)}%
        </div>
      )}
    </div>
  );
};