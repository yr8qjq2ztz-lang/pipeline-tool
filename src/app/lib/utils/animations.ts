// Animation utilities for smooth micro-interactions

export const animationClasses = {
  // Card animations
  cardEnter: "animate-in fade-in duration-300",
  cardHover: "transition-all duration-200 hover:shadow-lg hover:scale-105",
  
  // Button animations
  buttonHover: "transition-all duration-200 hover:scale-110 active:scale-95",
  buttonClick: "active:scale-95 transition-transform duration-100",
  
  // Fade animations
  fadeIn: "animate-in fade-in duration-500",
  fadeOut: "animate-out fade-out duration-300",
  
  // Slide animations
  slideInLeft: "animate-in slide-in-from-left duration-300",
  slideInRight: "animate-in slide-in-from-right duration-300",
  slideInUp: "animate-in slide-in-from-bottom duration-300",
  slideOutDown: "animate-out slide-out-to-bottom duration-200",
  
  // Expand animations
  expandCollapse: "transition-all duration-300",
  
  // Number change animation
  numberTick: "transition-all duration-700",
};

// Smooth number animation from old to new value
export function animateNumber(from: number, to: number, duration: number = 1000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const range = to - from;

    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(animate);
  });
}

// Create a Spring animation effect
export function springAnimation(
  element: HTMLElement,
  from: number,
  to: number,
  duration: number = 600
) {
  const start = Date.now();
  const range = to - from;
  
  const animate = () => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    
    // Spring ease-out curve
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const value = from + range * easeOut;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
}

// Pulse effect for notifications
export const pulseClasses = "animate-pulse";

// Shimmer skeleton loading
export const shimmerClasses = "bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 animate-pulse";
