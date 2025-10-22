'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

interface QuizGrade {
  id: string;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: Date;
  testTitle: string;
}

interface GradeStats {
  quizGrades: QuizGrade[];
  totalScore: number;
  totalMaxScore: number;
  totalPercentage: number;
  quizCount: number;
}

interface RankingEntry {
  rank: number;
  userId: string;
  userName: string;
  totalScore: number;
  totalMaxScore: number;
  totalPercentage: number;
  quizCount: number;
  avgPercentage: number;
}

interface GradesTabProps {
  sessionId: string;
  classroomId: string;
  userRole: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
}

export default function GradesTab({ sessionId, classroomId, userRole }: GradesTabProps) {
  const { data: session } = useSession();
  const [activeView, setActiveView] = useState<'my-grades' | 'ranking'>('my-grades');
  const [gradeStats, setGradeStats] = useState<GradeStats | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (userRole === 'teacher' || userRole === 'administrator') {
      fetchStudents();
    }
  }, [classroomId]);

  useEffect(() => {
    if (activeView === 'my-grades') {
      fetchGrades();
    } else {
      fetchRanking();
    }
  }, [activeView, selectedStudentId]);

  const fetchStudents = async () => {
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/members?role=student`);
      if (response.ok) {
        const data = await response.json();
        setStudents(data);
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
  };

  const fetchGrades = async () => {
    try {
      setIsLoading(true);
      const userId = (session?.user as any)?.id;
      const params = new URLSearchParams({ classroomId });
      
      if ((userRole === 'teacher' || userRole === 'administrator') && selectedStudentId) {
        params.append('studentId', selectedStudentId);
      }
      
      const response = await fetch(`/api/grades?${params}`);
      if (response.ok) {
        const data = await response.json();
        setGradeStats(data);
      }
    } catch (error) {
      toast.error('Failed to fetch grades');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRanking = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/grades/ranking?classroomId=${classroomId}`);
      if (response.ok) {
        const data = await response.json();
        setRanking(data);
      }
    } catch (error) {
      toast.error('Failed to fetch ranking');
    } finally {
      setIsLoading(false);
    }
  };

  const isTeacherOrAdmin = userRole === 'teacher' || userRole === 'administrator';
  const currentUserId = (session?.user as any)?.id;
  const myRank = ranking.find(r => r.userId === currentUserId);

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      {/* View Toggle */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('my-grades')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeView === 'my-grades'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isTeacherOrAdmin ? 'Student Grades' : 'My Grades'}
          </button>
          <button
            onClick={() => setActiveView('ranking')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeView === 'ranking'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Leaderboard
          </button>
        </div>

        {/* Student Selector (only shown for teachers/admins when viewing grades) */}
        {isTeacherOrAdmin && activeView === 'my-grades' && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Select Student:</label>
            <select
              value={selectedStudentId || ''}
              onChange={(e) => setSelectedStudentId(e.target.value || null)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">-- Select Student --</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.email})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* My Grades View */}
      {activeView === 'my-grades' && (
        <div>
          {!gradeStats ? (
            <div className="text-center py-8 text-gray-500">
              {isTeacherOrAdmin ? 'Please select a student to view grades' : 'No grade data'}
            </div>
          ) : (
            <>
              {/* Overall Statistics */}
              <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 mb-1">Total Score</div>
              <div className="text-2xl font-bold text-blue-700">
                {gradeStats.totalScore}/{gradeStats.totalMaxScore}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 mb-1">Average</div>
              <div className="text-2xl font-bold text-green-700">
                {gradeStats.totalPercentage.toFixed(1)}%
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-600 mb-1">Quiz Count</div>
              <div className="text-2xl font-bold text-purple-700">
                {gradeStats.quizCount}
              </div>
            </div>
            {myRank && (
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-sm text-orange-600 mb-1">My Rank</div>
                <div className="text-2xl font-bold text-orange-700">
                  #{myRank.rank}
                </div>
              </div>
            )}
          </div>

          {/* Quiz Grades */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quiz Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Max Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {gradeStats.quizGrades.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No grade records
                      </td>
                    </tr>
                  ) : (
                    gradeStats.quizGrades.map((grade) => (
                      <tr key={grade.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {grade.testTitle}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{grade.score}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{grade.maxScore}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            grade.percentage >= 90 ? 'bg-green-100 text-green-800' :
                            grade.percentage >= 80 ? 'bg-blue-100 text-blue-800' :
                            grade.percentage >= 70 ? 'bg-yellow-100 text-yellow-800' :
                            grade.percentage >= 60 ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {grade.percentage.toFixed(1)}%
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(grade.submittedAt).toLocaleString('en-US')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {/* Leaderboard View */}
      {activeView === 'ranking' && (
        <div>
          {/* My Rank Card */}
          {myRank && (
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 mb-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm opacity-90 mb-1">My Rank</div>
                  <div className="text-4xl font-bold">#{myRank.rank}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm opacity-90 mb-1">Total Score</div>
                  <div className="text-2xl font-bold">
                    {myRank.totalScore}/{myRank.totalMaxScore}
                  </div>
                  <div className="text-sm opacity-90 mt-1">
                    Avg: {myRank.avgPercentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard List */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Max Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Average
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quiz Count
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ranking.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No ranking data
                      </td>
                    </tr>
                  ) : (
                    ranking.map((entry) => {
                      const isCurrentUser = entry.userId === currentUserId;
                      return (
                        <tr 
                          key={entry.userId} 
                          className={`hover:bg-gray-50 ${isCurrentUser ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {entry.rank <= 3 ? (
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                  entry.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                                  entry.rank === 2 ? 'bg-gray-300 text-gray-800' :
                                  'bg-orange-400 text-orange-900'
                                }`}>
                                  {entry.rank}
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-8 h-8 text-gray-700 font-medium">
                                  {entry.rank}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="text-sm font-medium text-gray-900">
                                {entry.userName}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs text-blue-600">(Me)</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {entry.totalScore}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {entry.totalMaxScore}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              entry.avgPercentage >= 90 ? 'bg-green-100 text-green-800' :
                              entry.avgPercentage >= 80 ? 'bg-blue-100 text-blue-800' :
                              entry.avgPercentage >= 70 ? 'bg-yellow-100 text-yellow-800' :
                              entry.avgPercentage >= 60 ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {entry.avgPercentage.toFixed(1)}%
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {entry.quizCount}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
