import { motion } from 'framer-motion';
import { EnhancedLoading } from './EnhancedLoading';
import { Alert } from './Alert';
import { Button } from './Button';
import { fadeInUp, scaleIn } from '@/utils/animations';
import './StateManager.css';

export const StateManager = ({
  state = 'idle',
  loadingText = '加载中...',
  errorTitle = '出错了',
  errorMessage,
  emptyTitle = '暂无数据',
  emptyMessage = '当前没有找到相关数据',
  emptyActionText = '刷新',
  emptyActionOnClick,
  children,
  className = '',
}) => {
  const renderState = () => {
    switch (state) {
      case 'loading':
        return (
          <motion.div
            key="loading"
            className="state-manager-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <EnhancedLoading text={loadingText} size="medium" />
          </motion.div>
        );

      case 'error':
        return (
          <motion.div
            key="error"
            className="state-manager-content"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
          >
            <div className="state-error-container">
              <div className="state-error-icon">⚠️</div>
              <div className="state-error-content">
                <h3 className="state-error-title">{errorTitle}</h3>
                <p className="state-error-message">{errorMessage || '发生了未知错误'}</p>
                <Button
                  variant="primary"
                  onClick={() => window.location.reload()}
                  className="state-error-button"
                >
                  重新加载
                </Button>
              </div>
            </div>
          </motion.div>
        );

      case 'empty':
        return (
          <motion.div
            key="empty"
            className="state-manager-content"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            <div className="state-empty-container">
              <div className="state-empty-icon">📭</div>
              <div className="state-empty-content">
                <h3 className="state-empty-title">{emptyTitle}</h3>
                <p className="state-empty-message">{emptyMessage}</p>
                {emptyActionText && (
                  <Button
                    variant="outline"
                    onClick={emptyActionOnClick}
                    className="state-empty-button"
                  >
                    {emptyActionText}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        );

      case 'success':
      case 'idle':
        return (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="state-content-wrapper"
          >
            {children}
          </motion.div>
        );

      default:
        return children;
    }
  };

  return (
    <div className={`state-manager-container ${className}`}>
      {renderState()}
    </div>
  );
};

export const DataGridState = ({
  loading = false,
  error = null,
  isEmpty = false,
  totalItems = 0,
  loadingText = '正在加载数据...',
  emptyTitle = '暂无数据',
  emptyMessage = '没有找到符合条件的数据',
  onRefresh,
  children,
}) => {
  if (loading) {
    return (
      <div className="data-grid-state">
        <EnhancedLoading text={loadingText} size="medium" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-grid-state">
        <Alert variant="error" title={error.message || '加载失败'}>
          <p className="data-grid-error-message">请检查网络连接或稍后重试</p>
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh} className="mt-3">
              刷新数据
            </Button>
          )}
        </Alert>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <motion.div
        className="data-grid-state"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="data-grid-empty">
          <div className="data-grid-empty-icon">📊</div>
          <h4 className="data-grid-empty-title">{emptyTitle}</h4>
          <p className="data-grid-empty-message">{emptyMessage}</p>
          {onRefresh && (
            <Button variant="primary" onClick={onRefresh} className="mt-4">
              刷新查看
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="data-grid-content"
    >
      {totalItems > 0 && (
        <div className="data-grid-stats">
          <span className="data-grid-count">共 {totalItems} 条记录</span>
        </div>
      )}
      {children}
    </motion.div>
  );
};

export const InlineState = ({
  state = 'idle',
  message,
  variant = 'info',
  className = '',
}) => {
  const stateConfig = {
    loading: {
      icon: '⏳',
      color: 'var(--primary-color)',
      bg: 'var(--primary-subtle)',
    },
    success: {
      icon: '✅',
      color: 'var(--success-color)',
      bg: 'rgba(var(--success-color-rgb), 0.1)',
    },
    error: {
      icon: '❌',
      color: 'var(--error-color)',
      bg: 'rgba(var(--error-color-rgb), 0.1)',
    },
    warning: {
      icon: '⚠️',
      color: 'var(--warning-color)',
      bg: 'rgba(var(--warning-color-rgb), 0.1)',
    },
    info: {
      icon: 'ℹ️',
      color: 'var(--info-color)',
      bg: 'rgba(var(--info-color-rgb), 0.1)',
    },
  };

  const config = stateConfig[state] || stateConfig.info;

  if (!message) return null;

  return (
    <motion.div
      className={`inline-state ${className}`}
      style={{
        backgroundColor: config.bg,
        color: config.color,
        borderColor: config.color,
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <span className="inline-state-icon">{config.icon}</span>
      <span className="inline-state-message">{message}</span>
    </motion.div>
  );
};