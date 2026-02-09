
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
  const base = "px-5 py-2 min-h-[44px] rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500 shadow-md shadow-orange-500/10",
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
    className={`bg-white border border-gray-100 rounded-2xl shadow-sm ${className}`}
  >
    {children}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <input 
      {...props}
      ref={ref}
      className={`w-full px-4 py-2 min-h-[44px] border border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-100 focus:border-orange-500 outline-none transition-all bg-white text-gray-900 text-base md:text-sm placeholder:text-gray-400 font-normal ${props.className || ''}`}
    />
  )
);

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ children, className = '', ...props }) => (
  <label 
    {...props}
    className={`block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ${className}`}
  >
    {children}
  </label>
);

export class ErrorBoundary extends React.Component<{ children: React.ReactNode, fallback?: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
          <p className="text-sm text-gray-500">The Kitchen Encountered a technical error. Please try again.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold"
          >
            Refresh Kitchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
