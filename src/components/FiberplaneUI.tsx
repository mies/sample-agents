import React from 'react';

interface FiberplaneSidebarProps {
  children: React.ReactNode;
  className?: string;
}

export function FiberplaneSidebar({ children, className = '' }: FiberplaneSidebarProps) {
  return <div className={`fiberplane-sidebar ${className}`}>{children}</div>;
}

interface FiberplaneSidebarItemProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function FiberplaneSidebarItem({ 
  children, 
  active = false, 
  onClick,
  className = '' 
}: FiberplaneSidebarItemProps) {
  return (
    <div 
      className={`fiberplane-sidebar-item ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface FiberplaneHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function FiberplaneHeader({ children, className = '' }: FiberplaneHeaderProps) {
  return <div className={`fiberplane-header ${className}`}>{children}</div>;
}

interface FiberplaneCardProps {
  children: React.ReactNode;
  className?: string;
}

export function FiberplaneCard({ children, className = '' }: FiberplaneCardProps) {
  return <div className={`fiberplane-card ${className}`}>{children}</div>;
}

interface FiberplaneToolRowProps {
  name: string;
  description: string;
  onClick?: () => void;
  className?: string;
}

export function FiberplaneToolRow({ 
  name, 
  description, 
  onClick,
  className = '' 
}: FiberplaneToolRowProps) {
  return (
    <div 
      className={`fiberplane-tool-row ${className}`}
      onClick={onClick}
    >
      <div className="flex flex-col">
        <div className="font-medium">{name}</div>
        <div className="text-neutral-400 text-sm">{description}</div>
      </div>
      <div className="fiberplane-details-cell">
        <span className="text-xs">›</span>
      </div>
    </div>
  );
}

interface FiberplaneEventProps {
  type: string;
  message: string;
  timestamp: Date;
  className?: string;
}

export function FiberplaneEvent({ 
  type,
  message,
  timestamp,
  className = '' 
}: FiberplaneEventProps) {
  return (
    <div className={`fiberplane-event ${className}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="fiberplane-badge">{type}</span>
          <span className="fiberplane-event-time">{formatTime(timestamp)}</span>
        </div>
        <div className="text-sm">{message}</div>
      </div>
    </div>
  );
}

interface FiberplaneTabProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function FiberplaneTab({ 
  children, 
  active = false, 
  onClick,
  className = '' 
}: FiberplaneTabProps) {
  return (
    <div 
      className={`fiberplane-tab ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Helper function to format time as seen in the screenshot
function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function FiberplaneToolsContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="fiberplane-container flex flex-col w-full h-full">
      <h3 className="px-4 py-3 font-medium border-b border-neutral-800">Tools</h3>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export function FiberplaneEventsContainer({ 
  children, 
  count 
}: { 
  children: React.ReactNode; 
  count: number 
}) {
  return (
    <div className="fiberplane-container flex flex-col w-full h-full">
      <div className="px-4 py-3 font-medium border-b border-neutral-800 flex items-center">
        <span>Events</span>
        <span className="ml-1 text-xs bg-neutral-800 text-white px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export function FiberplaneDetailsPanel() {
  return (
    <div className="fiberplane-container flex flex-col w-full h-full">
      <div className="flex border-b border-neutral-800">
        <FiberplaneTab active>Details</FiberplaneTab>
      </div>
      <div className="flex-1 p-4">
        <div className="text-sm text-neutral-400">
          No details to display
        </div>
      </div>
    </div>
  );
} 