import React, { useState } from 'react';
import { X, Check, User, Building2, Mail, Phone, Linkedin, Star } from 'lucide-react';
import { Button } from './Button';
import { Card, CardHeader, CardBody } from './Card';

interface LushaContact {
  name: string;
  title: string;
  company: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  hasEmail: boolean;
  hasPhone: boolean;
  hasLinkedIn: boolean;
  score?: number;
}

interface LushaEnrichmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: LushaContact[];
  onSelectContacts: (contacts: LushaContact[]) => void;
  companyName?: string;
}

export const LushaEnrichmentModal: React.FC<LushaEnrichmentModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onSelectContacts,
  companyName
}) => {
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContactToggle = (contactKey: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactKey)) {
      newSelected.delete(contactKey);
    } else {
      newSelected.add(contactKey);
    }
    setSelectedContacts(newSelected);
  };

  const handleConfirmSelection = () => {
    const selected = filteredContacts.filter(contact => 
      selectedContacts.has(`${contact.name}-${contact.title}-${contact.company}`)
    );
    onSelectContacts(selected);
    onClose();
    setSelectedContacts(new Set());
    setSearchQuery('');
  };

  const handleClose = () => {
    setSelectedContacts(new Set());
    setSearchQuery('');
    onClose();
  };

  const getContactKey = (contact: LushaContact) => `${contact.name}-${contact.title}-${contact.company}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Lusha Contact Enrichment</h2>
            <p className="text-sm text-gray-600 mt-1">
              {companyName ? `Enriching contacts for ${companyName}` : 'Select contacts to enrich'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search contacts by name, title, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute right-3 top-2.5 text-gray-400">
              <span className="text-sm">{filteredContacts.length} results</span>
            </div>
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredContacts.map((contact, index) => {
            const contactKey = getContactKey(contact);
            const isSelected = selectedContacts.has(contactKey);
            
            return (
              <div
                key={contactKey}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => handleContactToggle(contactKey)}
              >
                <div className="flex items-start gap-3">
                  {/* Selection checkbox */}
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                      {contact.score && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          <Star className="w-3 h-3" />
                          Score: {contact.score}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">{contact.title}</span>
                      <span>•</span>
                      <span>{contact.company}</span>
                    </div>

                    {/* Contact details */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {contact.hasEmail && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span>{contact.email || 'Email available'}</span>
                        </div>
                      )}
                      {contact.hasPhone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span>{contact.phone || 'Phone available'}</span>
                        </div>
                      )}
                      {contact.hasLinkedIn && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Linkedin className="w-4 h-4" />
                          <span>LinkedIn available</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedContacts.size > 0 
              ? `${selectedContacts.size} contact${selectedContacts.size === 1 ? '' : 's'} selected`
              : 'No contacts selected'
            }
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSelection}
              disabled={selectedContacts.size === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Enrich Selected ({selectedContacts.size})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
