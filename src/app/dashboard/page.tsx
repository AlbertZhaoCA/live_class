'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import MultiAccountSwitcher from '@/components/MultiAccountSwitcher';

interface Classroom {
  id: string;
  name: string;
  description: string | null;
  teacherId: string;
  role: string;
  createdAt: Date;
}

interface PublicClassroom {
  id: string;
  name: string;
  description: string | null;
  isJoined: boolean;
  memberCount: number;
  teacherCount: number;
  studentCount: number;
}

interface Invitation {
  id: string;
  classroomId: string;
  message: string | null;
  status: string;
  createdAt: Date;
  classroom: {
    name: string;
  };
  inviter: {
    name: string;
    email: string;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [publicClassrooms, setPublicClassrooms] = useState<PublicClassroom[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'public' | 'invitations'>('my');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchClassrooms();
      fetchPublicClassrooms();
      fetchInvitations();
    }
  }, [status, router]);

  const fetchClassrooms = async () => {
    try {
      const response = await fetch('/api/classrooms');
      if (response.ok) {
        const data = await response.json();
        setClassrooms(data);
      }
    } catch (error) {
      toast.error('Failed to fetch classrooms');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPublicClassrooms = async () => {
    try {
      const response = await fetch('/api/classrooms/public');
      if (response.ok) {
        const data = await response.json();
        setPublicClassrooms(data);
      }
    } catch (error) {
      console.error('Failed to fetch public classrooms:', error);
    }
  };

  const fetchInvitations = async () => {
    try {
      const response = await fetch('/api/invitations?type=received&status=pending');
      if (response.ok) {
        const data = await response.json();
        setInvitations(data);
      }
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  };

  const handleJoinClassroom = async (classroomId: string) => {
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'student' }),
      });

      if (response.ok) {
        toast.success('Successfully joined classroom!');
        fetchClassrooms();
        fetchPublicClassrooms();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to join');
      }
    } catch (error) {
      toast.error('Join error');
    }
  };

  const handleRespondInvitation = async (invitationId: string, action: 'accept' | 'decline') => {
    try {
      const response = await fetch(`/api/invitations/${invitationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        toast.success(action === 'accept' ? 'Invitation accepted!' : 'Invitation declined');
        fetchInvitations();
        fetchClassrooms();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Operation failed');
      }
    } catch (error) {
      toast.error('Operation error');
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const userRole = (session?.user as any)?.role;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary-600">Live Class</h1>
          <div className="flex items-center gap-4">
            {userRole === 'administrator' && (
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
              >
                👑 Admin Panel
              </button>
            )}
            <MultiAccountSwitcher />
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold">Classroom Management</h2>
            {invitations.length > 0 && (
              <span className="px-3 py-1 bg-red-500 text-white text-sm rounded-full">
                {invitations.length} new invitation{invitations.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {userRole === 'teacher' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Create Classroom
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'my'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Classrooms ({classrooms.length})
          </button>
          <button
            onClick={() => setActiveTab('public')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'public'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Public Classrooms ({publicClassrooms.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'invitations'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Invitations
            {invitations.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {invitations.length}
              </span>
            )}
          </button>
        </div>

        {/* My Classrooms */}
        {activeTab === 'my' && (
          <>
            {classrooms.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">No classrooms yet</p>
                {userRole === 'teacher' && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 text-primary-600 hover:underline"
                  >
                    Create your first classroom
                  </button>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classrooms.map((classroom) => (
                  <Link
                    key={classroom.id}
                    href={`/classroom/${classroom.id}`}
                    className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition"
                  >
                    <h3 className="text-xl font-bold mb-2">{classroom.name}</h3>
                    <p className="text-gray-600 mb-4">
                      {classroom.description || 'No description'}
                    </p>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">
                        Role: {classroom.role === 'teacher' ? 'Teacher' : classroom.role === 'student' ? 'Student' : 'Observer'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* Public Classrooms */}
        {activeTab === 'public' && (
          <>
            {publicClassrooms.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">No public classrooms available</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {publicClassrooms.map((classroom) => (
                  <div
                    key={classroom.id}
                    className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition"
                  >
                    <h3 className="text-xl font-bold mb-2">{classroom.name}</h3>
                    <p className="text-gray-600 mb-4">
                      {classroom.description || 'No description'}
                    </p>
                    <div className="flex justify-between items-center text-sm mb-4">
                      <span className="text-gray-500">
                        Members: {classroom.memberCount} (Teachers: {classroom.teacherCount}, Students: {classroom.studentCount})
                      </span>
                    </div>
                    {classroom.isJoined ? (
                      <Link
                        href={`/classroom/${classroom.id}`}
                        className="block w-full py-2 text-center bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Joined - Enter Classroom
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleJoinClassroom(classroom.id)}
                        className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        Join Classroom
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Invitations */}
        {activeTab === 'invitations' && (
          <>
            {invitations.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">No invitations</p>
              </div>
            ) : (
              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="bg-white p-6 rounded-xl shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold mb-2">
                          {invitation.classroom.name}
                        </h3>
                        <p className="text-gray-600 mb-2">
                          <span className="font-medium">{invitation.inviter.name}</span> invited you to join this classroom
                        </p>
                        {invitation.message && (
                          <p className="text-gray-500 text-sm italic">
                            &ldquo;{invitation.message}&rdquo;
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-gray-400">
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleRespondInvitation(invitation.id, 'accept')}
                        className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespondInvitation(invitation.id, 'decline')}
                        className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {showCreateModal && (
        <CreateClassroomModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchClassrooms();
          }}
        />
      )}
    </div>
  );
}

function CreateClassroomModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, isPublic }),
      });

      if (response.ok) {
        toast.success('Classroom created successfully!');
        onSuccess();
      } else {
        toast.error('Creation failed');
      }
    } catch (error) {
      toast.error('Creation error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full">
        <h3 className="text-2xl font-bold mb-4">Create New Classroom</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Classroom Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              rows={3}
            />
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Public Classroom (everyone can see and join)</span>
            </label>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
