'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If user is logged in, redirect to dashboard
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Live Class
          </h1>
          <p className="text-2xl text-gray-700 mb-4 font-medium">
            Interactive Real-time Learning Platform
          </p>
          <p className="text-lg text-gray-600 mb-10 max-w-3xl mx-auto">
            A comprehensive online education system featuring live sessions, real-time collaboration, 
            screen sharing, materials management, and interactive assessments
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/login"
              className="px-10 py-4 bg-primary-600 text-white text-lg font-semibold rounded-lg hover:bg-primary-700 transition shadow-lg hover:shadow-xl"
            >
              Get Started
            </Link>
            <Link
              href="/register"
              className="px-10 py-4 bg-white text-primary-600 text-lg font-semibold border-2 border-primary-600 rounded-lg hover:bg-primary-50 transition shadow-lg hover:shadow-xl"
            >
              Sign Up Free
            </Link>
          </div>
        </div>

        {/* Core Features */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-center mb-12">🚀 Core Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            
            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="text-5xl mb-4">💬</div>
              <h3 className="text-xl font-bold mb-3">Real-time Chat</h3>
              <p className="text-gray-600">
                Live messaging with Socket.IO, instant delivery, and announcement support
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="text-5xl mb-4">🖥️</div>
              <h3 className="text-xl font-bold mb-3">Screen Sharing</h3>
              <p className="text-gray-600">
                Teachers can share their screen in real-time using WebRTC technology
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="text-5xl mb-4">📚</div>
              <h3 className="text-xl font-bold mb-3">Materials Library</h3>
              <p className="text-gray-600">
                Upload files (PDF, PPT, DOC, images), organize with categories, track downloads
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="text-5xl mb-4">📺</div>
              <h3 className="text-xl font-bold mb-3">YouTube Integration</h3>
              <p className="text-gray-600">
                Add YouTube videos to materials with thumbnails and view tracking
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="text-5xl mb-4">📝</div>
              <h3 className="text-xl font-bold mb-3">Quiz System</h3>
              <p className="text-gray-600">
                Create quizzes with multiple question types, automatic grading, and instant results
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="text-xl font-bold mb-3">Grade Management</h3>
              <p className="text-gray-600">
                Comprehensive grade tracking, statistics, and performance analytics
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="text-5xl mb-4">👥</div>
              <h3 className="text-xl font-bold mb-3">Multi-account Support</h3>
              <p className="text-gray-600">
                Switch between multiple accounts seamlessly with quick account switcher
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="text-5xl mb-4">🎯</div>
              <h3 className="text-xl font-bold mb-3">Live Sessions</h3>
              <p className="text-gray-600">
                Schedule and manage live sessions with real-time participant tracking
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="text-5xl mb-4">📧</div>
              <h3 className="text-xl font-bold mb-3">Invitation System</h3>
              <p className="text-gray-600">
                Invite students and teachers via email with customizable permissions
              </p>
            </div>
          </div>
        </div>

        {/* User Roles */}
        <div className="mb-20 bg-white rounded-2xl p-12 shadow-xl">
          <h2 className="text-4xl font-bold text-center mb-8">👥 User Roles</h2>
          <p className="text-center text-gray-600 mb-12 text-lg max-w-3xl mx-auto">
            Four distinct roles with tailored permissions and capabilities
          </p>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-6xl mb-4">👨‍🏫</div>
              <h3 className="text-xl font-bold mb-3">Teacher</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Create classrooms</li>
                <li>• Share screen</li>
                <li>• Upload materials</li>
                <li>• Create quizzes</li>
                <li>• Manage grades</li>
              </ul>
            </div>
            <div className="text-center">
              <div className="text-6xl mb-4">👨‍🎓</div>
              <h3 className="text-xl font-bold mb-3">Student</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Join classrooms</li>
                <li>• View shared screens</li>
                <li>• Download materials</li>
                <li>• Take quizzes</li>
                <li>• Check grades</li>
              </ul>
            </div>
            <div className="text-center">
              <div className="text-6xl mb-4">👀</div>
              <h3 className="text-xl font-bold mb-3">Observer</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• View sessions</li>
                <li>• Read chat</li>
                <li>• Access materials</li>
                <li>• Monitor progress</li>
                <li>• No editing rights</li>
              </ul>
            </div>
            <div className="text-center">
              <div className="text-6xl mb-4">👑</div>
              <h3 className="text-xl font-bold mb-3">Administrator</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Full access</li>
                <li>• User management</li>
                <li>• System settings</li>
                <li>• Generate codes</li>
                <li>• Platform oversight</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Technology Stack */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-center mb-12">🛠️ Built With Modern Tech</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
              <h3 className="text-xl font-bold mb-4">Frontend</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Next.js 14 (App Router)</li>
                <li>• React 18</li>
                <li>• TypeScript</li>
                <li>• Tailwind CSS</li>
                <li>• NextAuth.js</li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
              <h3 className="text-xl font-bold mb-4">Backend</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Node.js</li>
                <li>• Socket.IO</li>
                <li>• Drizzle ORM</li>
                <li>• MySQL</li>
                <li>• RESTful API</li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
              <h3 className="text-xl font-bold mb-4">Real-time</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• WebRTC</li>
                <li>• WebSocket</li>
                <li>• Socket.IO Events</li>
                <li>• Live Streaming</li>
                <li>• Instant Updates</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-2xl p-16 shadow-2xl">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Teaching?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of educators using Live Class
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/register"
              className="px-10 py-4 bg-white text-primary-600 text-lg font-semibold rounded-lg hover:bg-gray-100 transition shadow-lg"
            >
              Create Free Account
            </Link>
            <Link
              href="/login"
              className="px-10 py-4 bg-transparent border-2 border-white text-white text-lg font-semibold rounded-lg hover:bg-white hover:text-primary-600 transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
