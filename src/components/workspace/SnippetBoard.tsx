import React, { useState, useEffect } from 'react';
import { db } from '../../lib/supabase';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Save, 
  X,
  Trophy,
  AlertCircle,
  BookOpen,
  TrendingUp,
  Briefcase
} from 'lucide-react';
import { Snippet } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const categoryIcons = {
  achievement: Trophy,
  incident: AlertCircle,
  story: BookOpen,
  metric: TrendingUp,
  'case-study': Briefcase
};

const categoryLabels = {
  achievement: 'Achievement',
  incident: 'Incident',
  story: 'Story',
  metric: 'Metric',
  'case-study': 'Case Study'
};

interface SnippetFormData {
  category: Snippet['category'];
  content: string;
  tags: string[];
  evidence_links: string[];
}

export const SnippetBoard: React.FC = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<SnippetFormData>({
    category: 'achievement',
    content: '',
    tags: [],
    evidence_links: []
  });
  const [newTag, setNewTag] = useState('');
  const [newLink, setNewLink] = useState('');

  useEffect(() => {
    loadSnippets();
  }, []);

  const loadSnippets = async () => {
    try {
      const { data, error } = await db.getSnippets();
      if (error) {
        toast.error('Failed to load snippets');
        return;
      }
      setSnippets(data || []);
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'achievement',
      content: '',
      tags: [],
      evidence_links: []
    });
    setNewTag('');
    setNewLink('');
    setEditingId(null);
    setShowCreateForm(false);
  };

  const handleSave = async () => {
    if (!formData.content.trim()) {
      toast.error('Content is required');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { data, error } = await db.updateSnippet(editingId, formData);
        if (error) {
          toast.error('Failed to update snippet');
          return;
        }
        setSnippets(prev => prev.map(s => s.id === editingId ? data : s));
        toast.success('Snippet updated');
      } else {
        const { data, error } = await db.createSnippet(formData);
        if (error) {
          toast.error('Failed to create snippet');
          return;
        }
        setSnippets(prev => [data, ...prev]);
        toast.success('Snippet created');
      }
      resetForm();
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (snippet: Snippet) => {
    setFormData({
      category: snippet.category,
      content: snippet.content,
      tags: snippet.tags || [],
      evidence_links: snippet.evidence_links || []
    });
    setEditingId(snippet.id);
    setShowCreateForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this snippet?')) return;

    try {
      const { error } = await db.deleteSnippet(id);
      if (error) {
        toast.error('Failed to delete snippet');
        return;
      }
      setSnippets(prev => prev.filter(s => s.id !== id));
      toast.success('Snippet deleted');
    } catch (err) {
      toast.error('An error occurred');
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const addLink = () => {
    if (newLink.trim() && !formData.evidence_links.includes(newLink.trim())) {
      setFormData(prev => ({
        ...prev,
        evidence_links: [...prev.evidence_links, newLink.trim()]
      }));
      setNewLink('');
    }
  };

  const removeLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      evidence_links: prev.evidence_links.filter((_, i) => i !== index)
    }));
  };

  const filteredSnippets = snippets.filter(snippet => {
    const matchesSearch = snippet.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || snippet.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) return <LoadingSpinner size="lg" text="Loading snippets..." />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Snippet Library"
          subtitle={`Reusable content pieces (${snippets.length})`}
          action={
            <Button
              onClick={() => setShowCreateForm(true)}
              icon={Plus}
              size="sm"
            >
              Add Snippet
            </Button>
          }
        />
        <CardBody>
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search snippets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Create/Edit Form */}
          {showCreateForm && (
            <Card className="mb-6 border-blue-200 bg-blue-50">
              <CardHeader
                title={editingId ? 'Edit Snippet' : 'Create New Snippet'}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={X}
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                }
              />
              <CardBody>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as Snippet['category'] }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <TextArea
                    label="Content"
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Describe your achievement, story, or experience..."
                    rows={6}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.tags.map((tag, index) => (
                        <Badge key={index} variant="info">
                          {tag}
                          <button
                            onClick={() => removeTag(index)}
                            className="ml-2 hover:text-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add tag"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      />
                      <Button onClick={addTag} variant="outline" size="sm">
                        Add
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Evidence Links
                    </label>
                    <div className="space-y-2 mb-2">
                      {formData.evidence_links.map((link, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-100 rounded">
                          <span className="flex-1 text-sm text-blue-600 truncate">{link}</span>
                          <button
                            onClick={() => removeLink(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add evidence link (URL)"
                        value={newLink}
                        onChange={(e) => setNewLink(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addLink()}
                      />
                      <Button onClick={addLink} variant="outline" size="sm">
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSave}
                      loading={saving}
                      icon={Save}
                    >
                      {editingId ? 'Update' : 'Create'} Snippet
                    </Button>
                    <Button
                      onClick={resetForm}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Snippets Grid */}
          {filteredSnippets.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery || selectedCategory !== 'all' ? 'No matching snippets' : 'No snippets yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || selectedCategory !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Create your first snippet to start building your content library'
                }
              </p>
              {!searchQuery && selectedCategory === 'all' && (
                <Button
                  onClick={() => setShowCreateForm(true)}
                  icon={Plus}
                >
                  Create Your First Snippet
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredSnippets.map((snippet) => {
                const Icon = categoryIcons[snippet.category];
                return (
                  <Card key={snippet.id} hover>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Icon className="h-5 w-5 text-gray-600" />
                        <Badge variant="default" size="sm">
                          {categoryLabels[snippet.category]}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Edit3}
                          onClick={() => handleEdit(snippet)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          onClick={() => handleDelete(snippet.id)}
                        />
                      </div>
                    </div>

                    <p className="text-gray-900 mb-4 line-clamp-4">
                      {snippet.content}
                    </p>

                    {snippet.tags && snippet.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {snippet.tags.map((tag, index) => (
                          <Badge key={index} size="sm" variant="info">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{format(new Date(snippet.created_at), 'MMM d, yyyy')}</span>
                      {snippet.evidence_links && snippet.evidence_links.length > 0 && (
                        <span>{snippet.evidence_links.length} evidence link(s)</span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};