import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Input } from "./input"
import { Label } from "./label"
import { Textarea } from "./textarea"

// Enhanced form field with validation states
interface EnhancedFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  success?: string
  hint?: string
  required?: boolean
  loading?: boolean
}

const EnhancedField = React.forwardRef<HTMLInputElement, EnhancedFieldProps>(
  ({ className, label, error, success, hint, required, loading, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === "password"
    const inputType = isPassword && showPassword ? "text" : type

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        
        <div className="relative">
          <Input
            ref={ref}
            type={inputType}
            className={cn(
              "transition-all duration-200",
              error && "border-destructive focus:border-destructive",
              success && "border-success focus:border-success",
              loading && "pr-10",
              isPassword && "pr-10",
              className
            )}
            {...props}
          />
          
          {/* Loading spinner */}
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {/* Password toggle */}
          {isPassword && !loading && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        
        {/* Field messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-1 text-sm text-destructive"
            >
              <AlertCircle className="w-3 h-3" />
              {error}
            </motion.div>
          )}
          
          {success && !error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-1 text-sm text-success"
            >
              <Check className="w-3 h-3" />
              {success}
            </motion.div>
          )}
          
          {hint && !error && !success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-muted-foreground"
            >
              {hint}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
)

EnhancedField.displayName = "EnhancedField"

// Enhanced textarea with character count
interface EnhancedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  success?: string
  hint?: string
  required?: boolean
  maxLength?: number
  showCount?: boolean
}

const EnhancedTextarea = React.forwardRef<HTMLTextAreaElement, EnhancedTextareaProps>(
  ({ className, label, error, success, hint, required, maxLength, showCount, value, ...props }, ref) => {
    const charCount = typeof value === 'string' ? value.length : 0

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {showCount && maxLength && (
            <span className={cn(
              "text-xs",
              charCount > maxLength * 0.8 ? "text-warning" : "text-muted-foreground",
              charCount >= maxLength && "text-destructive"
            )}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
        
        <Textarea
          ref={ref}
          value={value}
          maxLength={maxLength}
          className={cn(
            "transition-all duration-200",
            error && "border-destructive focus:border-destructive",
            success && "border-success focus:border-success",
            className
          )}
          {...props}
        />
        
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-1 text-sm text-destructive"
            >
              <AlertCircle className="w-3 h-3" />
              {error}
            </motion.div>
          )}
          
          {success && !error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-1 text-sm text-success"
            >
              <Check className="w-3 h-3" />
              {success}
            </motion.div>
          )}
          
          {hint && !error && !success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-muted-foreground"
            >
              {hint}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
)

EnhancedTextarea.displayName = "EnhancedTextarea"

// Form progress indicator
interface FormProgressProps {
  steps: string[]
  currentStep: number
  completedSteps: number[]
}

const FormProgress = ({ steps, currentStep, completedSteps }: FormProgressProps) => (
  <div className="flex items-center justify-center mb-8">
    <div className="flex items-center space-x-4">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                completedSteps.includes(index)
                  ? "bg-success text-success-foreground"
                  : currentStep === index
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {completedSteps.includes(index) ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            <span className={cn(
              "text-xs mt-1 transition-colors",
              currentStep === index ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {step}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "h-px w-16 transition-colors",
                completedSteps.includes(index + 1) || completedSteps.includes(index)
                  ? "bg-success"
                  : "bg-muted"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
)

export { EnhancedField, EnhancedTextarea, FormProgress }