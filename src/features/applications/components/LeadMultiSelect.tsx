import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Lead } from '../../../lib/types/applications';

interface LeadMultiSelectProps {
  leads: Lead[];
  selectedLeadIds: string[];
  onSelectionChange: (leadIds: string[]) => void;
  placeholder?: string;
}

export const LeadMultiSelect: React.FC<LeadMultiSelectProps> = ({
  leads,
  selectedLeadIds,
  onSelectionChange,
  placeholder = "Filter by leads..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedLeads = useMemo(() => 
    leads.filter(lead => selectedLeadIds.includes(lead.id)),
    [leads, selectedLeadIds]
  );

  const filteredLeads = useMemo(() => 
    leads.filter(lead => 
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [leads, searchQuery]
  );

  const handleLeadToggle = (leadId: string) => {
    const newSelection = selectedLeadIds.includes(leadId)
      ? selectedLeadIds.filter(id => id !== leadId)
      : [...selectedLeadIds, leadId];
    onSelectionChange(newSelection);
  };

  const handleRemoveLead = (leadId: string) => {
    onSelectionChange(selectedLeadIds.filter(id => id !== leadId));
  };

  const handleResetFilters = () => {
    onSelectionChange([]);
  };

  return (
    <div className="relative">
      {/* Selected leads chips */}
      {selectedLeads.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedLeads.map(lead => (
            <div
              key={lead.id}
              className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
            >
              <span>{lead.name}</span>
              <button
                onClick={() => handleRemoveLead(lead.id)}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="text-gray-500 hover:text-gray-700"
          >
            Reset filters
          </Button>
        </div>
      )}

      {/* Dropdown button */}
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        {selectedLeads.length === 0 
          ? placeholder 
          : `${selectedLeads.length} lead${selectedLeads.length === 1 ? '' : 's'} selected`
        }
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Lead list */}
          <div className="p-1">
            {filteredLeads.length === 0 ? (
              <div className="px-2 py-2 text-sm text-gray-500">
                No leads found
              </div>
            ) : (
              filteredLeads.map(lead => (
                <div
                  key={lead.id}
                  className="flex items-center px-2 py-2 hover:bg-gray-100 cursor-pointer rounded"
                  onClick={() => handleLeadToggle(lead.id)}
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border border-gray-300 rounded flex items-center justify-center">
                      {selectedLeadIds.includes(lead.id) && (
                        <Check className="w-3 h-3 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{lead.name}</div>
                      <div className="text-xs text-gray-500">{lead.email}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
