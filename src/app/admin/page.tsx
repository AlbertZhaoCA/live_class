'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import MultiAccountSwitcher from '@/components/MultiAccountSwitcher';

interface InviteCode {
  id: string;
  code: string;
  isUsed: boolean;
  isRevoked: boolean;
  usedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const user = session.user as any;
      if (user.role !== 'administrator') {
        toast.error('Access denied: Administrator only');
        router.push('/dashboard');
      } else {
        fetchInviteCodes();
      }
    }
  }, [status, session, router]);

  const fetchInviteCodes = async () => {
    try {
      const response = await fetch('/api/teacher-invite-codes');
      if (response.ok) {
        const data = await response.json();
        setInviteCodes(data);
      } else {
        toast.error('Failed to fetch invite codes');
      }
    } catch (error) {
      toast.error('Error fetching invite codes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/teacher-invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: expiresInDays || null }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Invite code generated!');
        setShowGenerateModal(false);
        setExpiresInDays('');
        fetchInviteCodes();
        
        // Copy code to clipboard
        navigator.clipboard.writeText(data.code);
        toast.success('Code copied to clipboard!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to generate code');
      }
    } catch (error) {
      toast.error('Error generating code');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeCode = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this invite code?')) {
      return;
    }

    const reason = prompt('Reason for revocation (optional):');

    try {
      const response = await fetch(`/api/teacher-invite-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        toast.success('Invite code revoked');
        fetchInviteCodes();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to revoke code');
      }
    } catch (error) {
      toast.error('Error revoking code');
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invite code?')) {
      return;
    }

    try {
      const response = await fetch(`/api/teacher-invite-codes/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Invite code deleted');
        fetchInviteCodes();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete code');
      }
    } catch (error) {
      toast.error('Error deleting code');
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const getStatusBadge = (code: InviteCode) => {
    if (code.isUsed) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Used</span>;
    }
    if (code.isRevoked) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Revoked</span>;
    }
    if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">Expired</span>;
    }
    return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Active</span>;
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const user = session?.user as any;
  if (user?.role !== 'administrator') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-primary-600">Live Class</h1>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">👑 Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Dashboard
            </button>
            <MultiAccountSwitcher />
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Teacher Invite Codes Management</h2>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            + Generate New Code
          </button>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inviteCodes.map((code) => (
                <tr key={code.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">
                        {code.code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Copy to clipboard"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(code)}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="font-medium">{code.createdBy.name}</div>
                      <div className="text-gray-500">{code.createdBy.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(code.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {code.expiresAt ? new Date(code.expiresAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {!code.isUsed && !code.isRevoked && (
                        <button
                          onClick={() => handleRevokeCode(code.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                          Revoke
                        </button>
                      )}
                      {!code.isUsed && (
                        <button
                          onClick={() => handleDeleteCode(code.id)}
                          className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {inviteCodes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No invite codes generated yet
            </div>
          )}
        </div>
      </main>

      {/* Generate Code Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-4">Generate Teacher Invite Code</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Expires In (Days)
              </label>
              <input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Leave empty for no expiration"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: Set the number of days until this code expires
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setExpiresInDays('');
                }}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateCode}
                disabled={isGenerating}
                className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
