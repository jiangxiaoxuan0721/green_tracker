// 动画配置和工具函数
import { cubicBezier } from 'framer-motion';

// 缓动函数
export const easings = {
  // Material Design 标准缓动
  standard: cubicBezier(0.4, 0.0, 0.2, 1),
  deceleration: cubicBezier(0.0, 0.0, 0.2, 1),
  acceleration: cubicBezier(0.4, 0.0, 1, 1),
  sharp: cubicBezier(0.4, 0.0, 0.6, 1),
  
  // 特殊缓动
  bounceOut: cubicBezier(0.34, 1.56, 0.64, 1),
  springLike: cubicBezier(0.68, -0.6, 0.32, 1.6),
};

// 动画变体
export const fadeInUp = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: easings.deceleration,
    },
  },
};

export const fadeIn = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: easings.standard,
    },
  },
};

export const scaleIn = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: easings.standard,
    },
  },
};

export const slideInRight = {
  hidden: {
    opacity: 0,
    x: 20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: easings.deceleration,
    },
  },
};

export const slideInLeft = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: easings.deceleration,
    },
  },
};

// Card悬停动画
export const cardHover = {
  rest: {
    scale: 1,
    boxShadow: 'var(--shadow-default)',
  },
  hover: {
    scale: 1.02,
    boxShadow: 'var(--shadow-hover)',
    transition: {
      duration: 0.2,
      ease: easings.standard,
    },
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.1,
    },
  },
};

// Button点击动画
export const buttonAnimations = {
  tap: {
    scale: 0.95,
    transition: {
      duration: 0.1,
    },
  },
  hover: {
    boxShadow: '0 0 0 2px var(--primary-medium)',
    transition: {
      duration: 0.2,
    },
  },
};

// 列表项动画 (用于stagger效果)
export const listContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const listItem = {
  hidden: { 
    opacity: 0,
    y: 10,
  },
  visible: { 
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: easings.deceleration,
    },
  },
};

// 页面切换动画
export const pageTransition = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: easings.deceleration,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
    },
  },
};

// 工具函数：生成延迟动画
export const createDelayedAnimation = (delay = 0, baseAnimation = fadeInUp) => ({
  ...baseAnimation,
  visible: {
    ...baseAnimation.visible,
    transition: {
      ...baseAnimation.visible.transition,
      delay,
    },
  },
});

// 工具函数：生成无限循环的脉动动画
export const createPulseAnimation = (scale = 1.05) => ({
  animate: {
    scale: [1, scale, 1],
    transition: {
      duration: 2,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatType: 'reverse',
    },
  },
});