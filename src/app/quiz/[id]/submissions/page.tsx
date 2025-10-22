'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

interface Submission {
  id: string;
  userId: string;
  userName: string;
  score: number;
  submittedAt: Date;
  answers: Record<string, string>;
}

interface Question {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  options: string[] | null;
  points: number;
  order: number;
  correctAnswer: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  totalPoints: number;
}

export default function QuizSubmissionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const quizId = params.id as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gradingScores, setGradingScores] = useState<Record<string, number>>({});

  const userRole = (session?.user as any)?.role;

  useEffect(() => {
    if (userRole !== 'teacher' && userRole !== 'administrator') {
      toast.error('无权限访问');
      router.back();
      return;
    }
    fetchQuizAndSubmissions();
  }, [quizId]);

  const fetchQuizAndSubmissions = async () => {
    try {
      setIsLoading(true);
      
      // 获取Quiz详情
      const quizResponse = await fetch(`/api/quizzes/${quizId}`);
      if (quizResponse.ok) {
        const quizData = await quizResponse.json();
        setQuiz(quizData.quiz);
        setQuestions(quizData.questions);
      }

      // 获取所有Submit
      const submissionsResponse = await fetch(`/api/quizzes/${quizId}/submissions`);
      if (submissionsResponse.ok) {
        const submissionsData = await submissionsResponse.json();
        console.log('Submissions data:', submissionsData);
        setSubmissions(submissionsData);
      }
    } catch (error) {
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGradeSubmission = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/quizzes/${quizId}/submissions/${submissionId}/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: gradingScores }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Grade成功！总分: ${result.score}/${result.maxScore}`);
        
        // 重新获取数据
        await fetchQuizAndSubmissions();
        
        // 找到更新后的Submit记录并重新选中
        const updatedSubmissions = await fetch(`/api/quizzes/${quizId}/submissions`);
        if (updatedSubmissions.ok) {
          const data = await updatedSubmissions.json();
          const updatedSubmission = data.find((s: Submission) => s.id === submissionId);
          if (updatedSubmission) {
            setSelectedSubmission(updatedSubmission);
          }
        }
        
        setGradingScores({});
      } else {
        toast.error('Grade失败');
      }
    } catch (error) {
      toast.error('Grade出错');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-primary-600 hover:underline mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
          <p className="text-gray-600">
            总分: {quiz.totalPoints} 分 | Submit数: {submissions.length}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* 左侧：Submit列表 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-bold mb-4">StudentSubmit</h2>
              
              {submissions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">NoSubmit</p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((submission) => (
                    <button
                      key={submission.id}
                      onClick={() => setSelectedSubmission(submission)}
                      className={`w-full text-left p-4 rounded-lg transition ${
                        selectedSubmission?.id === submission.id
                          ? 'bg-primary-100 border-2 border-primary-500'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-semibold">{submission.userName}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Score: {submission.score}/{quiz.totalPoints}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(submission.submittedAt).toLocaleString('zh-CN')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：Submit详情 */}
          <div className="lg:col-span-2">
            {selectedSubmission ? (
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedSubmission.userName}</h2>
                    <p className="text-gray-600">
                      Score: {selectedSubmission.score}/{quiz.totalPoints} ({((selectedSubmission.score / quiz.totalPoints) * 100).toFixed(1)}%)
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      SubmitTime: {new Date(selectedSubmission.submittedAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>

                {/* Answer列表 */}
                <div className="space-y-6">
                  {questions.map((question, index) => {
                    const userAnswer = selectedSubmission.answers[question.id];
                    console.log(`Question ${question.id}:`, {
                      userAnswer,
                      correctAnswer: question.correctAnswer,
                      allAnswers: selectedSubmission.answers,
                      answersType: typeof selectedSubmission.answers
                    });
                    const isCorrect = userAnswer === question.correctAnswer;
                    const needsManualGrading = question.type === 'short_answer' || question.type === 'essay';

                    return (
                      <div key={question.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold">
                            {index + 1}. {question.question}
                          </h3>
                          <span className="text-sm text-gray-500">
                            {question.points} 分
                          </span>
                        </div>

                        {/* Select题/判断题 */}
                        {(question.type === 'multiple_choice' || question.type === 'true_false') && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">StudentAnswer:</span>
                              <span className={`px-2 py-1 rounded text-sm ${
                                isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {userAnswer || 'No answer'}
                                {isCorrect ? ' ✓' : ' ✗'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">CorrectAnswer:</span>
                              <span className="text-sm text-green-700">
                                {question.correctAnswer}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 简答题/论述题 */}
                        {needsManualGrading && (
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm font-medium mb-1">StudentAnswer:</div>
                              <div className="bg-gray-50 rounded p-3 text-sm whitespace-pre-wrap">
                                {userAnswer || 'No answer'}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium mb-1">参考Answer:</div>
                              <div className="bg-blue-50 rounded p-3 text-sm whitespace-pre-wrap">
                                {question.correctAnswer}
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">
                                给分 (满分: {question.points})
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={question.points}
                                step="0.5"
                                value={gradingScores[question.id] ?? ''}
                                onChange={(e) => setGradingScores({
                                  ...gradingScores,
                                  [question.id]: parseFloat(e.target.value) || 0
                                })}
                                className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Grade按钮 */}
                {questions.some(q => q.type === 'short_answer' || q.type === 'essay') && (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => handleGradeSubmission(selectedSubmission.id)}
                      className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      SaveGrade
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow p-6 text-center">
                <p className="text-gray-500">PleaseSelectaSubmit记录View</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
