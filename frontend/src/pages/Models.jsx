/**
 * Models Management Page (Admin)
 * Comprehensive model profile management with contact info, social media, contracts, and content preferences
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  X,
  Image as ImageIcon,
  Sparkles,
  Calendar,
  DollarSign,
  Zap,
  Mail,
  Phone,
  Upload,
  Loader2,
  Send,
  Copy,
  Check,
  GitBranch,
} from 'lucide-react';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { useModel } from '../context/ModelContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * Tag input component for content preferences
 */
function ContentTagsInput({ tags = [], onChange, placeholder }) {
  const [inputValue, setInputValue] = useState('');

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove) => {
    onChange(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, idx) => (
          <span key={idx} className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm flex items-center gap-2">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-red-400 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="button" variant="secondary" size="sm" onClick={addTag}>
          Add
        </Button>
      </div>
    </div>
  );
}

/**
 * Visibility toggle component for field permissions
 */
function VisibilityToggle({ label, checked, onChange, warning }) {
  return (
    <div className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
      <div>
        <span className="text-sm font-medium text-text">{label}</span>
        {warning && (
          <p className="text-xs text-text-muted mt-0.5">{warning}</p>
        )}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-surface-elevated peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
      </label>
    </div>
  );
}

/**
 * Image upload component with preview
 */
function ImageUpload({ currentUrl, onUpload, onRemove }) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentUrl);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setPreviewUrl(currentUrl);
  }, [currentUrl]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await api.uploadModelAvatar(formData);
      onUpload(response.url);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload image. Please try again.');
      setPreviewUrl(currentUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Avatar preview"
            className="h-20 w-20 rounded-full object-cover border-2 border-border"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-surface-elevated border-2 border-border flex items-center justify-center">
            <Users className="h-10 w-10 text-text-muted" />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-1" />
            {previewUrl ? 'Change Photo' : 'Upload Photo'}
          </Button>
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={uploading}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-text-muted">
          JPG, PNG or GIF. Max 10MB. Square images work best.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}

// ============================================================================
// MODEL FORM MODAL
// ============================================================================

function ModelFormModal({ model, onClose, onSaved }) {
  const isEdit = !!model;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('basic');

  // Initialize form data with all fields
  const [formData, setFormData] = useState({
    name: model?.name || '',
    avatar_url: model?.avatar_url || '',
    onlyfans_handle: model?.onlyfans_handle || '',
    notes: model?.notes || '',
    lora_config: {
      path: model?.lora_config?.path || '',
      triggerWord: model?.lora_config?.triggerWord || '',
      weight: model?.lora_config?.weight ?? 0.7
    },

    // NEW PROFILE FIELDS:
    email: model?.email || '',
    phone: model?.phone || '',
    bio: model?.bio || '',
    joined_date: model?.joined_date || new Date().toISOString().split('T')[0],
    social_media: model?.social_media || {
      instagram: '',
      twitter: '',
      tiktok: '',
      youtube: '',
      snapchat: ''
    },
    contract_split: model?.contract_split || '',
    contract_notes: model?.contract_notes || '',
    content_preferences: model?.content_preferences || {
      willing_to_do: [],
      will_not_do: [],
      special_notes: ''
    },
    field_visibility: model?.field_visibility || {
      email: false,
      phone: false,
      bio: true,
      social_media: true,
      onlyfans_handle: true,
      joined_date: false,
      contract_split: false,
      contract_notes: false,
      content_preferences: false
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
      };

      if (isEdit) {
        await api.updateModel(model.id, payload);
      } else {
        await api.createModel(payload);
      }

      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save model');
    } finally {
      setSaving(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateNestedField = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-surface rounded-xl border border-border w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
          <h2 className="text-lg font-bold text-text">{isEdit ? 'Edit Model' : 'Add Model'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-elevated transition-colors">
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-border px-4 overflow-x-auto">
          {[
            { id: 'basic', label: 'Basic Info' },
            { id: 'contact', label: 'Contact & Social' },
            { id: 'contract', label: 'Contract & Business' },
            { id: 'content', label: 'Content Preferences' },
            { id: 'visibility', label: 'Visibility Settings' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          {/* TAB: Basic Info */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-2">Profile Picture</label>
                <ImageUpload
                  currentUrl={formData.avatar_url}
                  onUpload={(url) => updateFormData('avatar_url', url)}
                  onRemove={() => updateFormData('avatar_url', '')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Model Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  placeholder="e.g. Sophia"
                  required
                  className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Bio / Description</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => updateFormData('bio', e.target.value)}
                  rows={4}
                  placeholder="Public bio about this model..."
                  className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm resize-none transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Joined Date</label>
                <input
                  type="date"
                  value={formData.joined_date}
                  onChange={(e) => updateFormData('joined_date', e.target.value)}
                  className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Internal Notes (Admin Only)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => updateFormData('notes', e.target.value)}
                  rows={3}
                  placeholder="Private notes for agency use only..."
                  className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm resize-none transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                />
              </div>

              {/* LoRA Config Section */}
              <div className="border border-border rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-text">AI Generation Settings (LoRA)</span>
                </div>

                <div>
                  <label className="block text-xs text-text-muted mb-1">LoRA File Path (on RunPod)</label>
                  <input
                    type="text"
                    value={formData.lora_config.path}
                    onChange={(e) => updateNestedField('lora_config', 'path', e.target.value)}
                    placeholder="e.g. sophia-v2.safetensors"
                    className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Trigger Word</label>
                    <input
                      type="text"
                      value={formData.lora_config.triggerWord}
                      onChange={(e) => updateNestedField('lora_config', 'triggerWord', e.target.value)}
                      placeholder="e.g. sks_sophia"
                      className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Weight (0-1)</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.lora_config.weight}
                      onChange={(e) => updateNestedField('lora_config', 'weight', parseFloat(e.target.value))}
                      className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Contact & Social */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  placeholder="model@example.com"
                  className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateFormData('phone', e.target.value)}
                  placeholder="+1 (555) 555-5555"
                  className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                />
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-text mb-3">Social Media Handles</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">OnlyFans</label>
                    <input
                      type="text"
                      value={formData.onlyfans_handle}
                      onChange={(e) => updateFormData('onlyfans_handle', e.target.value)}
                      placeholder="@username"
                      className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-muted mb-1">Instagram</label>
                    <input
                      type="text"
                      value={formData.social_media.instagram}
                      onChange={(e) => updateNestedField('social_media', 'instagram', e.target.value)}
                      placeholder="@username"
                      className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-muted mb-1">Twitter/X</label>
                    <input
                      type="text"
                      value={formData.social_media.twitter}
                      onChange={(e) => updateNestedField('social_media', 'twitter', e.target.value)}
                      placeholder="@username"
                      className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-muted mb-1">TikTok</label>
                    <input
                      type="text"
                      value={formData.social_media.tiktok}
                      onChange={(e) => updateNestedField('social_media', 'tiktok', e.target.value)}
                      placeholder="@username"
                      className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-muted mb-1">YouTube</label>
                    <input
                      type="text"
                      value={formData.social_media.youtube}
                      onChange={(e) => updateNestedField('social_media', 'youtube', e.target.value)}
                      placeholder="@channelname"
                      className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-muted mb-1">Snapchat</label>
                    <input
                      type="text"
                      value={formData.social_media.snapchat}
                      onChange={(e) => updateNestedField('social_media', 'snapchat', e.target.value)}
                      placeholder="username"
                      className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Contract & Business */}
          {activeTab === 'contract' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">Contract Revenue Split</label>
                <input
                  type="text"
                  value={formData.contract_split}
                  onChange={(e) => updateFormData('contract_split', e.target.value)}
                  placeholder="e.g., 70/30, 60/40"
                  className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                />
                <p className="text-xs text-text-muted mt-1">Agency / Model split</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Contract Notes (Private)</label>
                <textarea
                  value={formData.contract_notes}
                  onChange={(e) => updateFormData('contract_notes', e.target.value)}
                  rows={6}
                  placeholder="Contract details, terms, special arrangements..."
                  className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm resize-none transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                />
                <p className="text-xs text-text-muted mt-1">This is private and never visible to regular users</p>
              </div>
            </div>
          )}

          {/* TAB: Content Preferences */}
          {activeTab === 'content' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">Willing to Do</label>
                <ContentTagsInput
                  tags={formData.content_preferences.willing_to_do}
                  onChange={(tags) => updateNestedField('content_preferences', 'willing_to_do', tags)}
                  placeholder="lingerie, bikini, fitness, lifestyle..."
                />
                <p className="text-xs text-text-muted mt-1">Types of content this model is comfortable creating</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Will NOT Do</label>
                <ContentTagsInput
                  tags={formData.content_preferences.will_not_do}
                  onChange={(tags) => updateNestedField('content_preferences', 'will_not_do', tags)}
                  placeholder="explicit, alcohol, smoking..."
                />
                <p className="text-xs text-text-muted mt-1">Content boundaries and restrictions</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Special Notes</label>
                <textarea
                  value={formData.content_preferences.special_notes}
                  onChange={(e) => updateNestedField('content_preferences', 'special_notes', e.target.value)}
                  rows={4}
                  placeholder="Any special preferences, requirements, or notes about content creation..."
                  className="w-full rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-text text-sm resize-none transition-all duration-200 hover:border-border hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated placeholder:text-text-muted/60"
                />
              </div>
            </div>
          )}

          {/* TAB: Visibility Settings */}
          {activeTab === 'visibility' && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted mb-4">
                Control which profile fields are visible to regular users (non-admins).
                Admins always see all fields.
              </p>

              <div className="space-y-2">
                <VisibilityToggle
                  label="Email Address"
                  checked={formData.field_visibility.email}
                  onChange={(checked) => updateNestedField('field_visibility', 'email', checked)}
                />

                <VisibilityToggle
                  label="Phone Number"
                  checked={formData.field_visibility.phone}
                  onChange={(checked) => updateNestedField('field_visibility', 'phone', checked)}
                />

                <VisibilityToggle
                  label="Bio / Description"
                  checked={formData.field_visibility.bio}
                  onChange={(checked) => updateNestedField('field_visibility', 'bio', checked)}
                />

                <VisibilityToggle
                  label="Social Media Handles"
                  checked={formData.field_visibility.social_media}
                  onChange={(checked) => updateNestedField('field_visibility', 'social_media', checked)}
                />

                <VisibilityToggle
                  label="OnlyFans Handle"
                  checked={formData.field_visibility.onlyfans_handle}
                  onChange={(checked) => updateNestedField('field_visibility', 'onlyfans_handle', checked)}
                />

                <VisibilityToggle
                  label="Joined Date"
                  checked={formData.field_visibility.joined_date}
                  onChange={(checked) => updateNestedField('field_visibility', 'joined_date', checked)}
                />

                <VisibilityToggle
                  label="Contract Split"
                  checked={formData.field_visibility.contract_split}
                  onChange={(checked) => updateNestedField('field_visibility', 'contract_split', checked)}
                  warning="Typically kept private"
                />

                <VisibilityToggle
                  label="Content Preferences"
                  checked={formData.field_visibility.content_preferences}
                  onChange={(checked) => updateNestedField('field_visibility', 'content_preferences', checked)}
                />
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
                <p className="text-xs text-yellow-400">
                  <strong>Note:</strong> Contract notes and internal admin notes are always private
                  and never visible to regular users, regardless of these settings.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm mt-4">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={saving}>
              {isEdit ? 'Save Changes' : 'Add Model'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MODEL CARD (Dashboard Style)
// ============================================================================

function ModelCard({ model, onEdit, onArchive, onRestore }) {
  const { user } = useAuth();
  const { selectModel } = useModel();
  const isArchived = model.status === 'archived';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  return (
    <div className="w-full max-w-[260px] card-premium overflow-hidden group flex flex-col">
      {/* Profile Image */}
      <div className="relative w-full aspect-square bg-surface-elevated overflow-hidden">
        {model.avatar_url ? (
          <img
            src={model.avatar_url}
            alt={model.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Users className="h-20 w-20 text-purple-400 opacity-50" />
          </div>
        )}

        {/* Badges Overlay */}
        {(isArchived || model.lora_config?.path) && (
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {isArchived && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/90 text-white backdrop-blur-sm">Archived</span>
            )}
            {model.lora_config?.path && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-primary/90 text-white backdrop-blur-sm">LoRA</span>
            )}
          </div>
        )}
      </div>

      {/* Name and Info */}
      <div className="p-3 pb-2 flex-1 flex flex-col">
        <h3 className="text-base font-semibold text-text mb-1">{model.name}</h3>
        {model.onlyfans_handle && (
          <p className="text-xs text-text-muted mb-2 truncate">{model.onlyfans_handle}</p>
        )}

        {/* Compact Stats */}
        {model.stats && (
          <div className="flex items-center gap-3 text-xs text-text-muted mb-auto">
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              {model.stats.galleryItems}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {model.stats.generations}
            </span>
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-col gap-1.5 px-3">
        <Link to="/generate/image" onClick={() => selectModel(model.id)} className="w-full">
          <button className="w-full py-2 px-3 bg-gradient-primary text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-glow-lg hover:scale-105 active:scale-95 transition-all">
            Generate
          </button>
        </Link>
        <div className="flex gap-1.5">
          <Link
            to="/workflows"
            onClick={() => selectModel(model.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface text-text-muted rounded-lg text-xs font-medium hover:bg-surface-elevated hover:text-text transition-colors border border-border"
          >
            <GitBranch className="h-3.5 w-3.5" /> Workflows
          </Link>
          <Link
            to="/gallery"
            onClick={() => selectModel(model.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface text-text-muted rounded-lg text-xs font-medium hover:bg-surface-elevated hover:text-text transition-colors border border-border"
          >
            <ImageIcon className="h-3.5 w-3.5" /> Gallery
          </Link>
        </div>
      </div>

      {/* Management Buttons */}
      <div className="flex gap-1.5 p-3">
        <button
          onClick={() => onEdit(model)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface text-text-muted rounded-lg text-xs font-medium hover:bg-surface-elevated hover:text-text transition-colors border border-border"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        {isArchived ? (
          <button
            onClick={() => onRestore(model)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface text-text-muted rounded-lg text-xs font-medium hover:bg-surface-elevated hover:text-green-400 transition-colors border border-border"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restore
          </button>
        ) : (
          <button
            onClick={() => onArchive(model)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface text-text-muted rounded-lg text-xs font-medium hover:bg-surface-elevated hover:text-yellow-400 transition-colors border border-border"
          >
            <Archive className="h-3.5 w-3.5" /> Archive
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// INVITE MODEL MODAL
// ============================================================================

function InviteModelModal({ isOpen, onClose, onInviteSent }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [invitationLink, setInvitationLink] = useState('');
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setEmail('');
    setName('');
    setCustomMessage('');
    setError(null);
    setSuccess(false);
    setInvitationLink('');
    setCopied(false);
    onClose();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(invitationLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.inviteModel({
        email: email.trim(),
        name: name.trim() || null,
        custom_message: customMessage.trim() || null
      });

      if (response.success) {
        setSuccess(true);
        // Build invitation link (will be in the email, but also show it to admin)
        const agencySlug = window.location.pathname.split('/')[1] || '';
        const inviteToken = response.invitation.id; // Using ID for display, actual token is sent via email
        const link = `${window.location.origin}/${agencySlug}/model-invite/${inviteToken}`;
        setInvitationLink(link);

        if (onInviteSent) {
          onInviteSent();
        }
      }
    } catch (err) {
      console.error('Failed to send invitation:', err);
      setError(err.response?.data?.error || 'Failed to send invitation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-text">
              {success ? 'Invitation Sent!' : 'Invite Model'}
            </h2>
            <button
              onClick={handleClose}
              className="text-text-muted hover:text-text transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
              </div>
              <p className="text-center text-text mb-4">
                Invitation email sent to <strong>{email}</strong>
              </p>
              <p className="text-sm text-text-muted text-center mb-4">
                They will receive an email with a link to complete their profile. The invitation expires in 14 days.
              </p>
              {invitationLink && (
                <div className="bg-surface-elevated border border-border rounded-lg p-4">
                  <label className="block text-sm font-medium text-text mb-2">
                    Invitation Link (also sent via email)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={invitationLink}
                      readOnly
                      className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-muted font-mono"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleCopyLink}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="invite-email" className="block text-sm font-medium text-text mb-1">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="model@example.com"
                  className="w-full px-4 py-2 bg-surface-elevated border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label htmlFor="invite-name" className="block text-sm font-medium text-text mb-1">
                  Name (Optional)
                </label>
                <input
                  id="invite-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Model's name"
                  className="w-full px-4 py-2 bg-surface-elevated border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-text-muted">
                  Pre-fill their name in the onboarding form
                </p>
              </div>

              <div>
                <label htmlFor="invite-message" className="block text-sm font-medium text-text mb-1">
                  Personal Message (Optional)
                </label>
                <textarea
                  id="invite-message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a personal note to the invitation email..."
                  rows={4}
                  className="w-full px-4 py-2 bg-surface-elevated border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClose}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function ModelsPage() {
  const { refreshModels } = useModel();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [editingModel, setEditingModel] = useState(undefined);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const data = await api.getModels({ status: showArchived ? 'all' : 'active' });
      setModels(data.models || []);
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [showArchived]);

  const handleSaved = async () => {
    setEditingModel(undefined);
    await fetchModels();
    await refreshModels();
  };

  const handleArchive = async (model) => {
    try {
      await api.deleteModel(model.id);
      await fetchModels();
      await refreshModels();
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  };

  const handleRestore = async (model) => {
    try {
      await api.updateModel(model.id, { status: 'active' });
      await fetchModels();
      await refreshModels();
    } catch (err) {
      console.error('Failed to restore:', err);
    }
  };

  const activeModels = models.filter((m) => m.status === 'active');
  const archivedModels = models.filter((m) => m.status === 'archived');

  return (
    <Layout>
      <PageHeader
        title="Models"
        description="Manage your agency's creators and their complete profiles"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowInviteModal(true)}>
              <Send className="h-4 w-4 mr-1" />
              Invite Model
            </Button>
            <Button size="sm" onClick={() => setEditingModel(null)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Model
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        {/* Toggle archived */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              showArchived
                ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            <Archive className="h-3.5 w-3.5 inline mr-1.5" />
            {showArchived ? 'Showing archived' : 'Show archived'}
          </button>
          <span className="text-sm text-text-muted">
            {activeModels.length} active model{activeModels.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Models grid */}
        {loading ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          </Card>
        ) : models.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-16 w-16 text-text-muted mb-4" />
              <h3 className="text-lg font-semibold text-text mb-2">No models yet</h3>
              <p className="text-text-muted max-w-md mb-4">
                Add your first creator to start managing their profile and generating personalized AI content.
              </p>
              <Button onClick={() => setEditingModel(null)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Model
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-4">
              {activeModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  onEdit={setEditingModel}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                />
              ))}
            </div>

            {showArchived && archivedModels.length > 0 && (
              <>
                <h3 className="text-sm font-medium text-text-muted mt-6 mb-2">Archived</h3>
                <div className="flex flex-wrap gap-4">
                  {archivedModels.map((model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      onEdit={setEditingModel}
                      onArchive={handleArchive}
                      onRestore={handleRestore}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Form modal */}
      {editingModel !== undefined && (
        <ModelFormModal
          model={editingModel}
          onClose={() => setEditingModel(undefined)}
          onSaved={handleSaved}
        />
      )}

      {/* Invite modal */}
      <InviteModelModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSent={fetchModels}
      />
    </Layout>
  );
}
