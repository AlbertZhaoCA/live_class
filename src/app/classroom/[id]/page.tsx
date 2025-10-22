'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import MultiAccountSwitcher from '@/components/MultiAccountSwitcher';
import QuizzesTab from '@/components/QuizzesTab';
import GradesTab from '@/components/GradesTab';
import MaterialsTab from '@/components/MaterialsTab';

interface Session {
  id: string;
  title: string;
  scheduledAt: Date;
  status: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  type?: string;
  metadata?: any;
}

// Helper function to extract YouTube video ID from URL
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Helper function to render chat message with quiz links, YouTube embeds, and file attachments
function renderMessage(msg: ChatMessage) {
  // Handle file messages
  if (msg.type === 'file' && msg.metadata) {
    const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
    const { fileUrl, fileName, fileSize, fileType } = metadata;
    
    const fileIconMap: Record<string, string> = {
      'pdf': '📄',
      'ppt': '📊',
      'pptx': '📊',
      'doc': '📝',
      'docx': '📝',
      'xls': '📈',
      'xlsx': '📈',
      'image': '🖼️',
      'video': '🎥',
      'other': '📎',
    };
    const fileIcon = fileIconMap[fileType] || '📎';

    return (
      <div>
        <div className="whitespace-pre-wrap mb-2">{msg.message}</div>
        <a
          href={fileUrl}
          download={fileName}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm border border-gray-300"
        >
          <span className="text-2xl">{fileIcon}</span>
          <div className="text-left">
            <div className="font-medium text-gray-900">{fileName}</div>
            <div className="text-xs text-gray-500">{(fileSize / 1024).toFixed(2)} KB</div>
          </div>
          <span className="ml-2 text-primary-600">⬇ Download</span>
        </a>
      </div>
    );
  }

  // Check for quiz message
  const quizMatch = msg.message.match(/🔗 Quiz ID: (.+)$/m);
  
  if (quizMatch && quizMatch[1]) {
    const quizId = quizMatch[1].trim();
    const messageWithoutLink = msg.message.replace(/\n🔗 Quiz ID: .+$/, '');
    
    return (
      <div>
        <div className="whitespace-pre-wrap">{messageWithoutLink}</div>
        <a
          href={`/quiz/${quizId}`}
          className="inline-block mt-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          Start Quiz →
        </a>
      </div>
    );
  }
  
  // Check for YouTube URL in message
  const youtubeMatch = msg.message.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11}))/);
  
  if (youtubeMatch) {
    const fullUrl = youtubeMatch[1];
    const videoId = getYouTubeVideoId(fullUrl);
    const messageWithoutUrl = msg.message.replace(fullUrl, '').trim();
    
    return (
      <div>
        {messageWithoutUrl && <p className="text-gray-700 mb-2 whitespace-pre-wrap">{messageWithoutUrl}</p>}
        <div className="mt-2 rounded-lg overflow-hidden" style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
          />
        </div>
      </div>
    );
  }
  
  return <p className="text-gray-700 mt-1 whitespace-pre-wrap">{msg.message}</p>;
}

export default function ClassroomPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const classroomId = params.id as string;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'quizzes' | 'grades' | 'materials'>('chat');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenImage, setRemoteScreenImage] = useState<string | null>(null);
  const [isReceivingScreen, setIsReceivingScreen] = useState(false);
  
  // Use ref to always have the latest socket reference
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [classroomId]);

  useEffect(() => {
    if (activeSession) {
      setMessages([]);
      fetchMessages(activeSession.id);

      const newSocket = io('http://localhost:3000');
      socketRef.current = newSocket; // Store in ref for access in closures
      
      newSocket.on('connect', () => {
        console.log('[Classroom] Socket connected, socket.id:', newSocket.id);
        console.log('[Classroom] Joining session:', activeSession.id);
        newSocket.emit('join-session', {
          sessionId: activeSession.id,
          userId: (session?.user as any)?.id,
          userName: session?.user?.name,
        });
      });

      newSocket.on('new-message', (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
      });

      newSocket.on('user-joined', (data) => {
        toast.success(`${data.userName} has joined the session`);
      });

      newSocket.on('user-left', (data) => {
        toast(`${data.userName} has left the session`);
      });

      newSocket.on('screen-sharing-started', ({ userId, userName }) => {
        console.log('[Student] Received screen-sharing-started:', { userId, userName });
        toast.success(`${userName} is sharing their screen`);
        setIsReceivingScreen(true);
      });

      newSocket.on('screen-sharing-stopped', ({ userId, userName }) => {
        console.log('[Student] Received screen-sharing-stopped:', { userId, userName });
        toast(`${userName} stopped sharing screen`);
        setIsReceivingScreen(false);
        setRemoteScreenImage(null);
      });

      newSocket.on('screen-frame', ({ imageData }) => {
        console.log('[Student] Received screen-frame, data length:', imageData?.length || 0);
        setRemoteScreenImage(imageData);
      });

      setSocket(newSocket);

      return () => {
        newSocket.emit('leave-session', {
          sessionId: activeSession.id,
          userId: (session?.user as any)?.id,
          userName: session?.user?.name,
        });
        newSocket.close();
      };
    }
  }, [activeSession, session]);

  const fetchSessions = async () => {
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/sessions`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      toast.error('Failed to fetch classroom');
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to fetch message history:', error);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !socket || !activeSession) return;

    // Check for /share command
    if (messageInput.trim() === '/share') {
      const userRole = (session?.user as any)?.role;
      if (userRole !== 'teacher' && userRole !== 'administrator') {
        toast.error('Only teachers can share screen');
        setMessageInput('');
        return;
      }

      await startScreenShare();
      setMessageInput('');
      return;
    }

    // Normal message
    socket.emit('send-message', {
      sessionId: activeSession.id,
      userId: (session?.user as any)?.id,
      userName: session?.user?.name,
      message: messageInput,
    });

    setMessageInput('');
  };

  const startScreenShare = async () => {
    if (!socket || !activeSession) return;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      setScreenStream(stream);
      setIsScreenSharing(true);

      // Broadcast screen sharing started
      socket.emit('screen-sharing-started', {
        sessionId: activeSession.id,
        userId: (session?.user as any)?.id,
        userName: session?.user?.name,
      });

      // Send notification message
      socket.emit('send-message', {
        sessionId: activeSession.id,
        userId: (session?.user as any)?.id,
        userName: session?.user?.name,
        message: '�️ **Screen Sharing Started**\nThe teacher is now sharing their screen.',
      });

      toast.success('Screen sharing started!');

      // Capture and broadcast screen frames
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const broadcastFrame = () => {
        if (!stream.active) {
          console.log('[Teacher] Stream is not active, stopping broadcast');
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg', 0.5);
        const currentSocket = socketRef.current;
        
        console.log('[Teacher] Broadcasting frame, size:', imageData.length, 'sessionId:', activeSession.id);
        console.log('[Teacher] Socket connected?', currentSocket?.connected, 'Socket ID:', currentSocket?.id);
        
        if (!currentSocket || !currentSocket.connected) {
          console.error('[Teacher] Socket not connected! Cannot broadcast frame.');
          return;
        }

        try {
          currentSocket.emit('broadcast-screen-frame', {
            sessionId: activeSession.id,
            imageData,
          });
          console.log('[Teacher] Frame emitted successfully');
        } catch (error) {
          console.error('[Teacher] Error emitting frame:', error);
        }

        setTimeout(broadcastFrame, 1000); // Send 1 frame per second
      };

      video.onloadedmetadata = () => {
        console.log('[Teacher] Video metadata loaded, starting broadcast. Video size:', video.videoWidth, 'x', video.videoHeight);
        broadcastFrame();
      };

      // Handle stream end
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });
    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('Failed to start screen sharing. Please allow screen access.');
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    
    setIsScreenSharing(false);

    if (socket && activeSession) {
      socket.emit('screen-sharing-stopped', {
        sessionId: activeSession.id,
        userId: (session?.user as any)?.id,
        userName: session?.user?.name,
      });

      socket.emit('send-message', {
        sessionId: activeSession.id,
        userId: (session?.user as any)?.id,
        userName: session?.user?.name,
        message: '🖥️ **Screen Sharing Stopped**',
      });
    }

    toast('Screen sharing stopped');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSession) return;

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setUploadingFile(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', activeSession.id);
      formData.append('classroomId', classroomId);
      formData.append('publishToChat', 'true');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('File uploaded successfully!');
        
        // The socket.io will broadcast the message automatically
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const userRole = (session?.user as any)?.role;

  // Render message helper function with access to component state
  const renderMessageContent = (msg: ChatMessage) => {
    return renderMessage(msg);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-primary-600 hover:underline"
          >
            ← Back
          </button>
          <div className="flex items-center gap-4">
            <MultiAccountSwitcher />
            {userRole === 'teacher' && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Invite Student
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 左侧：Classroom */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Classroom</h2>
                {userRole === 'teacher' && (
                  <button
                    onClick={() => setShowCreateSession(true)}
                    className="text-sm px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                  >
                    Create
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {sessions.map((sess) => (
                  <button
                    key={sess.id}
                    onClick={() => setActiveSession(sess)}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      activeSession?.id === sess.id
                        ? 'bg-primary-100 border-2 border-primary-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-semibold">{sess.title}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(sess.scheduledAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </div>
                    <div className="text-xs">
                      <span
                        className={`px-2 py-1 rounded ${
                          sess.status === 'live'
                            ? 'bg-red-100 text-red-700'
                            : sess.status === 'ended'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {sess.status === 'live'
                          ? 'Live'
                          : sess.status === 'ended'
                          ? 'Ended'
                          : 'Upcoming'}
                      </span>
                    </div>
                  </button>
                ))}

                {sessions.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No Classroom</p>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {activeSession ? (
              <div className="bg-white rounded-xl shadow p-6">
                <h2 className="text-2xl font-bold mb-4">{activeSession.title}</h2>
                
                <div className="flex border-b mb-4">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-4 py-2 font-medium ${
                      activeTab === 'chat'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setActiveTab('quizzes')}
                    className={`px-4 py-2 font-medium ${
                      activeTab === 'quizzes'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Quiz
                  </button>
                  <button
                    onClick={() => setActiveTab('grades')}
                    className={`px-4 py-2 font-medium ${
                      activeTab === 'grades'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Grade
                  </button>
                  <button
                    onClick={() => setActiveTab('materials')}
                    className={`px-4 py-2 font-medium ${
                      activeTab === 'materials'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Materials
                  </button>
                </div>

                {activeTab === 'chat' && (
                  <>
                    {/* Teacher's local screen share preview */}
                    {isScreenSharing && screenStream && (
                      <div className="mb-4 relative">
                        <div className="bg-black rounded-lg overflow-hidden">
                          <video
                            ref={(video) => {
                              if (video && screenStream) {
                                video.srcObject = screenStream;
                                video.play();
                              }
                            }}
                            className="w-full"
                            autoPlay
                            playsInline
                            muted
                          />
                        </div>
                        <button
                          onClick={stopScreenShare}
                          className="absolute top-4 right-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg"
                        >
                          🛑 Stop Sharing
                        </button>
                      </div>
                    )}

                    {/* Student's received screen share */}
                    {isReceivingScreen && (
                      <div className="mb-4 relative">
                        <div className="bg-black rounded-lg overflow-hidden border-2 border-blue-500">
                          <div className="bg-blue-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-between">
                            <span>📡 Teacher is sharing screen</span>
                            <span className="text-xs opacity-75">
                              {remoteScreenImage ? '● Receiving' : '○ Waiting for frames...'}
                            </span>
                          </div>
                          {remoteScreenImage ? (
                            <img 
                              src={remoteScreenImage} 
                              alt="Shared screen" 
                              className="w-full"
                            />
                          ) : (
                            <div className="w-full h-64 flex items-center justify-center text-white">
                              <div className="text-center">
                                <div className="animate-pulse text-4xl mb-2">⏳</div>
                                <div>Loading screen share...</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="border rounded-lg p-4 h-96 overflow-y-auto mb-4 bg-gray-50">
                  {messages.map((msg, idx) => (
                    <div key={idx} className="mb-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm">
                          {msg.userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold text-sm">
                              {msg.userName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(msg.timestamp).toLocaleString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </span>
                            {msg.type === 'announcement' && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                Announcement
                              </span>
                            )}
                          </div>
                          {renderMessageContent(msg)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {messages.length === 0 && (
                    <p className="text-gray-400 text-center py-8">No messages</p>
                  )}
                </div>

                    <div className="flex gap-2">
                      {userRole === 'teacher' && !isScreenSharing && (
                        <button
                          onClick={startScreenShare}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                          🖥️ Share Screen
                        </button>
                      )}
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Entering..."
                        className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                      <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer flex items-center gap-2 border border-gray-300">
                        <span>📎</span>
                        {uploadingFile ? (
                          <span className="text-sm">Uploading...</span>
                        ) : (
                          <span className="text-sm">File</span>
                        )}
                        <input
                          type="file"
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                          className="hidden"
                          accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.mov"
                        />
                      </label>
                      <button
                        onClick={sendMessage}
                        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        Send
                      </button>
                    </div>
                  </>
                )}

                {activeTab === 'quizzes' && (
                  <QuizzesTab 
                    sessionId={activeSession.id} 
                    classroomId={classroomId}
                    userRole={userRole}
                  />
                )}

                {activeTab === 'grades' && (
                  <GradesTab 
                    sessionId={activeSession.id} 
                    classroomId={classroomId}
                    userRole={userRole}
                  />
                )}

                {activeTab === 'materials' && (
                  <MaterialsTab 
                    classroomId={classroomId}
                    sessionId={activeSession.id}
                    userRole={userRole}
                  />
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow p-6 text-center">
                <p className="text-gray-500">Please select a classroom to start</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {showCreateSession && (
        <CreateSessionModal
          classroomId={classroomId}
          onClose={() => setShowCreateSession(false)}
          onSuccess={() => {
            setShowCreateSession(false);
            fetchSessions();
          }}
        />
      )}

      {showInviteModal && (
        <InviteStudentModal
          classroomId={classroomId}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
}

function CreateSessionModal({
  classroomId,
  onClose,
  onSuccess,
}: {
  classroomId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState(90); // 默认90分钟
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`/api/classrooms/${classroomId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, scheduledAt, duration, isPublic }),
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
        <h3 className="text-2xl font-bold mb-4">Create Classroom</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Classroom Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Classroom Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 90)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              min="15"
              step="15"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              How long will this classroom session last? (default: 90 minutes)
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Public Classroom (Visible to Students)</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Unchecking this will make the Classroom visible only to teachers.
            </p>
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

function InviteStudentModal({
  classroomId,
  onClose,
}: {
  classroomId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'observer'>('student');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          classroomId, 
          inviteeEmail: email,
          role,
          message: message || null,
        }),
      });

      if (response.ok) {
        toast.success('Invitation sent successfully!');
        setEmail('');
        setMessage('');
        onClose();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Invitation failed to send');
      }
    } catch (error) {
      toast.error('Sending error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full">
        <h3 className="text-2xl font-bold mb-4">Invite Student</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Student Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="student@example.com"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Invitations will be sent to this email address.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'student' | 'observer')}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="student">Student</option>
              <option value="observer">Observer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Invitation Message (Optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Welcome..."
            />
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
              className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
