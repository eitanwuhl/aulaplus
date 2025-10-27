import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Button } from "./button"

interface ProgressiveDisclosureProps {
  title: string
  preview?: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  variant?: "default" | "outlined" | "minimal"
}

const ProgressiveDisclosure = ({
  title,
  preview,
  children,
  defaultOpen = false,
  className,
  variant = "default"
}: ProgressiveDisclosureProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const variants = {
    default: "border-border",
    outlined: "border-2 border-primary/20",
    minimal: "border-none shadow-none"
  }

  return (
    <Card className={cn("overflow-hidden", variants[variant], className)}>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors pb-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            {preview && !isOpen && (
              <p className="text-sm text-muted-foreground mt-1">{preview}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" className="p-1 h-auto">
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </Button>
        </div>
      </CardHeader>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <CardContent className="pt-0">
              {children}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

// Specialized disclosure for student sections
interface StudentSectionDisclosureProps {
  title: string
  icon: React.ReactNode
  summary: string
  children: React.ReactNode
  defaultOpen?: boolean
  priority?: "high" | "medium" | "low"
}

const StudentSectionDisclosure = ({
  title,
  icon,
  summary,
  children,
  defaultOpen = false,
  priority = "medium"
}: StudentSectionDisclosureProps) => {
  const priorityColors = {
    high: "border-l-red-400 bg-red-50/50",
    medium: "border-l-blue-400 bg-blue-50/50",
    low: "border-l-green-400 bg-green-50/50"
  }

  return (
    <ProgressiveDisclosure
      title={title}
      preview={summary}
      defaultOpen={defaultOpen}
      variant="outlined"
      className={cn("border-l-4", priorityColors[priority])}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        {children}
      </div>
    </ProgressiveDisclosure>
  )
}

// Tabbed disclosure for complex content
interface TabbedDisclosureProps {
  tabs: {
    id: string
    label: string
    content: React.ReactNode
    badge?: string | number
  }[]
  defaultTab?: string
  className?: string
}

const TabbedDisclosure = ({ tabs, defaultTab, className }: TabbedDisclosureProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all",
                "flex items-center justify-center gap-2",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.badge && (
                <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        <AnimatePresence mode="wait">
          {tabs.map((tab) => (
            activeTab === tab.id && (
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {tab.content}
              </motion.div>
            )
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

export { ProgressiveDisclosure, StudentSectionDisclosure, TabbedDisclosure }