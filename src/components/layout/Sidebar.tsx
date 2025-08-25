import React from 'react';
import { useGlobalStore } from '../../stores/globalStore';
import { 
  Users, 
  Target, 
  Palette, 
  BarChart3, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Bird,
  Brain,
  Sparkles
} from 'lucide-react';

const navItems = [
  { id: 'applications', label: 'Applications', icon: BarChart3, href: '/applications' },
  { id: 'leads', label: 'Leads', icon: Target, href: '/leads' },
  { id: 'workspace', label: 'Workspace', icon: Users, href: '/workspace' },
  { id: 'knowledge', label: 'Knowledge Base', icon: Brain, href: '/knowledge' },
  // { id: 'studio', label: 'Content Studio', icon: Palette, href: '/studio' },
  { id: 'ai-config', label: 'AI Configurations', icon: Sparkles, href: '/ai-config' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { sidebarOpen, setSidebarOpen } = useGlobalStore();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div
        className={`
          fixed left-0 top-0 h-full bg-white border-r border-gray-200 z-50
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-auto
          ${sidebarOpen ? 'w-64' : 'w-16'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {sidebarOpen && (
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Bird className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">Lazy Bird</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath.startsWith(item.href);
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.href)}
                className={`
                  w-full flex items-center px-4 py-3 text-left transition-colors
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                {sidebarOpen && (
                  <span className="ml-3 font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};