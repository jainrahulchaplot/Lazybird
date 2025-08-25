import React, { useState, useEffect } from 'react';
import { useGlobalStore } from '../../stores/globalStore';
import { db } from '../../lib/supabase';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { User, MapPin, DollarSign, Save, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

export const ProfileEditor: React.FC = () => {
  const { user, setUser } = useGlobalStore();
  const [loading, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    headline: '',
    locations: [] as string[],
    notice_period: '',
    salary_expectation_min: '',
    salary_expectation_max: '',
    currency: 'INR',
    sectors: [] as string[],
    tags: [] as string[]
  });
  const [newLocation, setNewLocation] = useState('');
  const [newSector, setNewSector] = useState('');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        headline: user.headline || '',
        locations: user.locations || [],
        notice_period: user.notice_period || '',
        salary_expectation_min: user.salary_expectation_min?.toString() || '',
        salary_expectation_max: user.salary_expectation_max?.toString() || '',
        currency: user.currency || 'INR',
        sectors: user.sectors || [],
        tags: user.tags || []
      });
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {
        ...formData,
        salary_expectation_min: formData.salary_expectation_min ? parseInt(formData.salary_expectation_min) : null,
        salary_expectation_max: formData.salary_expectation_max ? parseInt(formData.salary_expectation_max) : null,
      };

      const { data, error } = await db.updateUser('me', updates);
      
      if (error) {
        toast.error('Failed to update profile');
        return;
      }

      setUser(data);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const addItem = (field: 'locations' | 'sectors' | 'tags', value: string, setter: (value: string) => void) => {
    if (value.trim() && !formData[field].includes(value.trim())) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }));
      setter('');
    }
  };

  const removeItem = (field: 'locations' | 'sectors' | 'tags', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Personal Information"
          subtitle="Basic details about yourself"
          action={
            <Button
              onClick={handleSave}
              loading={loading}
              icon={Save}
              size="sm"
            >
              Save Changes
            </Button>
          }
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Full Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              icon={User}
              placeholder="Your full name"
            />
            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="your.email@example.com"
            />
          </div>
          
          <div className="mt-6">
            <TextArea
              label="Professional Headline"
              value={formData.headline}
              onChange={(e) => setFormData(prev => ({ ...prev, headline: e.target.value }))}
              placeholder="e.g., Senior Product Manager with 8+ years in fintech"
              rows={3}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Work Preferences"
          subtitle="Location and employment details"
        />
        <CardBody>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Locations
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.locations.map((location, index) => (
                  <Badge key={index} variant="info">
                    <MapPin className="h-3 w-3 mr-1" />
                    {location}
                    <button
                      onClick={() => removeItem('locations', index)}
                      className="ml-2 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add location (e.g., Bangalore, Remote)"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addItem('locations', newLocation, setNewLocation)}
                />
                <Button
                  onClick={() => addItem('locations', newLocation, setNewLocation)}
                  icon={Plus}
                  variant="outline"
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Notice Period"
                value={formData.notice_period}
                onChange={(e) => setFormData(prev => ({ ...prev, notice_period: e.target.value }))}
                placeholder="e.g., 2 months"
              />
              <Input
                label="Min Salary Expectation"
                type="number"
                value={formData.salary_expectation_min}
                onChange={(e) => setFormData(prev => ({ ...prev, salary_expectation_min: e.target.value }))}
                placeholder="1200000"
                icon={DollarSign}
              />
              <Input
                label="Max Salary Expectation"
                type="number"
                value={formData.salary_expectation_max}
                onChange={(e) => setFormData(prev => ({ ...prev, salary_expectation_max: e.target.value }))}
                placeholder="1800000"
                icon={DollarSign}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Skills & Sectors"
          subtitle="Areas of expertise and industry focus"
        />
        <CardBody>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Industry Sectors
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.sectors.map((sector, index) => (
                  <Badge key={index} variant="success">
                    {sector}
                    <button
                      onClick={() => removeItem('sectors', index)}
                      className="ml-2 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add sector (e.g., Fintech, E-commerce)"
                  value={newSector}
                  onChange={(e) => setNewSector(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addItem('sectors', newSector, setNewSector)}
                />
                <Button
                  onClick={() => addItem('sectors', newSector, setNewSector)}
                  icon={Plus}
                  variant="outline"
                >
                  Add
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skills & Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.tags.map((tag, index) => (
                  <Badge key={index}>
                    {tag}
                    <button
                      onClick={() => removeItem('tags', index)}
                      className="ml-2 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add skill (e.g., Product Strategy, Analytics)"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addItem('tags', newTag, setNewTag)}
                />
                <Button
                  onClick={() => addItem('tags', newTag, setNewTag)}
                  icon={Plus}
                  variant="outline"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};