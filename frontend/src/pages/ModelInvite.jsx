import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function ModelInvite() {
    const { agencySlug, token } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [validating, setValidating] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [invitation, setInvitation] = useState(null);
    const [agency, setAgency] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [portalUrl, setPortalUrl] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        bio: '',
        instagram: '',
        twitter: '',
        tiktok: '',
        youtube: '',
        snapchat: '',
        onlyfans_handle: '',
        create_auth_account: false,
        password: '',
        confirm_password: ''
    });

    const [formErrors, setFormErrors] = useState({});

    // Validate invitation token on mount
    useEffect(() => {
        validateInvitation();
    }, [token]);

    const validateInvitation = async () => {
        try {
            setValidating(true);
            const response = await api.validateModelInvitation(token);

            if (response.valid) {
                setInvitation(response.invitation);
                setAgency(response.agency);
                // Pre-fill form data
                setFormData(prev => ({
                    ...prev,
                    name: response.invitation.name || '',
                    email: response.invitation.email
                }));
                setError(null);
            } else {
                setError(response.error || 'Invalid invitation');
            }
        } catch (err) {
            console.error('Error validating invitation:', err);
            setError(err.response?.data?.error || 'Failed to validate invitation');
        } finally {
            setValidating(false);
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        // Clear field-specific error when user starts typing
        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validateForm = () => {
        const errors = {};

        if (!formData.name.trim()) {
            errors.name = 'Name is required';
        }

        if (!formData.email.trim()) {
            errors.email = 'Email is required';
        }

        if (formData.create_auth_account) {
            if (!formData.password) {
                errors.password = 'Password is required when creating an account';
            } else if (formData.password.length < 8) {
                errors.password = 'Password must be at least 8 characters';
            }

            if (formData.password !== formData.confirm_password) {
                errors.confirm_password = 'Passwords do not match';
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            const response = await api.acceptModelInvitation(token, {
                name: formData.name.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim() || null,
                bio: formData.bio.trim() || null,
                instagram: formData.instagram.trim() || null,
                twitter: formData.twitter.trim() || null,
                tiktok: formData.tiktok.trim() || null,
                youtube: formData.youtube.trim() || null,
                snapchat: formData.snapchat.trim() || null,
                onlyfans_handle: formData.onlyfans_handle.trim() || null,
                create_auth_account: formData.create_auth_account,
                password: formData.create_auth_account ? formData.password : null
            });

            if (response.success) {
                const url = `/${response.agency.slug}/portal/${response.model.portal_token}`;
                setPortalUrl(url);
                setSuccess(true);

                // Redirect to portal after 3 seconds
                setTimeout(() => {
                    navigate(url);
                }, 3000);
            }
        } catch (err) {
            console.error('Error accepting invitation:', err);
            setError(err.response?.data?.error || 'Failed to complete profile. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || validating) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Validating invitation...</p>
                </div>
            </div>
        );
    }

    if (error && !invitation) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h2>
                        <p className="text-gray-600">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to {agency?.name}!</h2>
                        <p className="text-gray-600 mb-6">Your profile has been created successfully.</p>
                        <p className="text-sm text-gray-500">Redirecting to your portal in 3 seconds...</p>
                        <a
                            href={portalUrl}
                            className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Go to portal now →
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Welcome to {agency?.name}
                        </h1>
                        <p className="text-gray-600">
                            Complete your profile to get started
                        </p>
                    </div>

                    {invitation?.custom_message && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                {invitation.custom_message}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Basic Info */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                            formErrors.name ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                        placeholder="Your full name"
                                    />
                                    {formErrors.name && (
                                        <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        readOnly
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                                        Phone
                                    </label>
                                    <input
                                        type="tel"
                                        id="phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="+1 (555) 123-4567"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                                        Bio
                                    </label>
                                    <textarea
                                        id="bio"
                                        name="bio"
                                        value={formData.bio}
                                        onChange={handleChange}
                                        rows={4}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Tell us about yourself..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Social Media */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Media</h3>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="onlyfans_handle" className="block text-sm font-medium text-gray-700 mb-1">
                                        OnlyFans Handle
                                    </label>
                                    <input
                                        type="text"
                                        id="onlyfans_handle"
                                        name="onlyfans_handle"
                                        value={formData.onlyfans_handle}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="@username"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="instagram" className="block text-sm font-medium text-gray-700 mb-1">
                                            Instagram
                                        </label>
                                        <input
                                            type="text"
                                            id="instagram"
                                            name="instagram"
                                            value={formData.instagram}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="@username"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="twitter" className="block text-sm font-medium text-gray-700 mb-1">
                                            Twitter/X
                                        </label>
                                        <input
                                            type="text"
                                            id="twitter"
                                            name="twitter"
                                            value={formData.twitter}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="@username"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="tiktok" className="block text-sm font-medium text-gray-700 mb-1">
                                            TikTok
                                        </label>
                                        <input
                                            type="text"
                                            id="tiktok"
                                            name="tiktok"
                                            value={formData.tiktok}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="@username"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="youtube" className="block text-sm font-medium text-gray-700 mb-1">
                                            YouTube
                                        </label>
                                        <input
                                            type="text"
                                            id="youtube"
                                            name="youtube"
                                            value={formData.youtube}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="@channel"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Login Account */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Login Account (Optional)</h3>
                            <div className="space-y-4">
                                <div className="flex items-start">
                                    <input
                                        type="checkbox"
                                        id="create_auth_account"
                                        name="create_auth_account"
                                        checked={formData.create_auth_account}
                                        onChange={handleChange}
                                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="create_auth_account" className="ml-2 block text-sm text-gray-700">
                                        Create a login account so I can sign in later
                                    </label>
                                </div>

                                {formData.create_auth_account && (
                                    <div className="pl-6 space-y-4 border-l-2 border-blue-200">
                                        <div>
                                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                                Password <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="password"
                                                id="password"
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                                    formErrors.password ? 'border-red-500' : 'border-gray-300'
                                                }`}
                                                placeholder="At least 8 characters"
                                            />
                                            {formErrors.password && (
                                                <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                                                Confirm Password <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="password"
                                                id="confirm_password"
                                                name="confirm_password"
                                                value={formData.confirm_password}
                                                onChange={handleChange}
                                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                                    formErrors.confirm_password ? 'border-red-500' : 'border-gray-300'
                                                }`}
                                                placeholder="Re-enter your password"
                                            />
                                            {formErrors.confirm_password && (
                                                <p className="mt-1 text-sm text-red-600">{formErrors.confirm_password}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {submitting ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Creating your profile...
                                    </span>
                                ) : (
                                    'Complete Profile'
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                <p className="text-center text-sm text-gray-600 mt-6">
                    Need help? Contact {agency?.name} for assistance.
                </p>
            </div>
        </div>
    );
}
