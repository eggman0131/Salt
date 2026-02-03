
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  // Standardised to min-h-[44px] for kitchen/mobile touch targets
  const base = "px-6 py-3 min-h-[44px] rounded-lg font-semibold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-[#2563eb] text-white hover:bg-[#1d4ed8] focus:ring-blue-500 shadow-sm",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-300",
    ghost: "bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900 focus:ring-gray-200",
  };
  
  return (
    <button 
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div 
    {...props} 
    className={`bg-white border border-gray-100 rounded-lg shadow-sm ${className}`}
  >
    {children}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <input 
      {...props}
      ref={ref}
      // Standardised to min-h-[44px] for kitchen/mobile touch targets and 16px (text-base) font for mobile legibility/distance
      className={`w-full px-4 py-3 min-h-[44px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-[#2563eb] outline-none transition-all bg-white text-gray-900 text-base md:text-sm placeholder:text-gray-400 font-normal ${props.className || ''}`}
    />
  )
);

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ children, className = '', ...props }) => (
  <label 
    {...props}
    className={`block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ${className}`}
  >
    {children}
  </label>
);
