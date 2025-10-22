'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

interface Question {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  options: string[] | null;
  points: number;
  order: number;
  correctAnswer: string | null; // null for students
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  totalPoints: number;
  duration: number | null;
  startTime: Date | null;
  endTime: Date | null;
}

interface QuizDetails {
  quiz: Quiz;
  questions: Question[];
  hasSubmitted: boolean;
  submission: any | null;
}

export default function TakeQuizPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const quizId = params.id as string;

  const [quizDetails, setQuizDetails] = useState<QuizDetails | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQuizDetails();
  }, [quizId]);

  useEffect(() => {
    if (quizDetails?.quiz.duration && timeRemaining === null) {
      setTimeRemaining(quizDetails.quiz.duration * 60); // Convert to seconds
    }
  }, [quizDetails]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const fetchQuizDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/quizzes/${quizId}`);
      if (response.ok) {
        const data = await response.json();
        setQuizDetails(data);
        
        // If already submitted, show results
        if (data.hasSubmitted) {
          toast('You have already submitted this quiz', { icon: 'ℹ️' });
        }
      } else {
        toast.error('Failed to load quiz');
        router.back();
      }
    } catch (error) {
      toast.error('Error loading quiz');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoSubmit = async () => {
    toast('Time is up, auto-submitting quiz', { icon: '⏰' });
    await handleSubmit();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    if (!quizDetails) return;

    // Check if all questions have been answered
    const unansweredQuestions = quizDetails.questions.filter(
      q => !answers[q.id] || answers[q.id].trim() === ''
    );

    if (unansweredQuestions.length > 0) {
      const confirm = window.confirm(
        `There are still ${unansweredQuestions.length} unanswered questions. Are you sure you want to submit?`
      );
      if (!confirm) return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Submitted successfully!');
        
        // Show results
        if (result.needsManualGrading) {
          toast('Some questions require manual grading, please check back later for final grade', { icon: 'ℹ️' });
        }
        
        // Reload quiz details to show results
        await fetchQuizDetails();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to submit');
      }
    } catch (error) {
      toast.error('Error submitting quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  if (!quizDetails) {
    return null;
  }

  const { quiz, questions, hasSubmitted, submission } = quizDetails;

  // If already submitted, show results page
  if (hasSubmitted && submission) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-xl shadow p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
              <p className="text-gray-600">Quiz Completed</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
              <div className="text-center">
                <div className="text-5xl font-bold text-green-600 mb-2">
                  {submission.score}/{quiz.totalPoints}
                </div>
                <div className="text-lg text-gray-700">
                  Score: {((submission.score / quiz.totalPoints) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  Submitted at: {new Date(submission.submittedAt).toLocaleString('en-US')}
                </div>
              </div>
            </div>

            {submission.needsManualGrading && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 text-sm">
                  ⚠️ Some questions require manual grading. The displayed score is from auto-grading, and the final score may change.
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Back to Classroom
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if quiz can be started
  const now = new Date();
  const canStart = !quiz.startTime || new Date(quiz.startTime) <= now;
  const isEnded = quiz.endTime && new Date(quiz.endTime) < now;

  if (!canStart) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Quiz Not Started Yet</h2>
          <p className="text-gray-600 mb-6">
            Start time: {quiz.startTime && new Date(quiz.startTime).toLocaleString('en-US')}
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (isEnded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Quiz Has Ended</h2>
          <p className="text-gray-600 mb-6">
            End time: {quiz.endTime && new Date(quiz.endTime).toLocaleString('en-US')}
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Top Info Bar */}
        <div className="bg-white rounded-xl shadow p-6 mb-6 sticky top-4 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold mb-1">{quiz.title}</h1>
              <p className="text-sm text-gray-600">
                Total Points: {quiz.totalPoints} | Questions: {questions.length}
              </p>
            </div>
            {timeRemaining !== null && (
              <div className="text-right">
                <div className="text-sm text-gray-600 mb-1">Time Remaining</div>
                <div className={`text-3xl font-bold ${
                  timeRemaining < 300 ? 'text-red-600' : 'text-primary-600'
                }`}>
                  {formatTime(timeRemaining)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-6 mb-6">
          {questions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-lg">
                  {index + 1}. {question.question}
                </h3>
                <span className="text-sm text-gray-500 ml-4 flex-shrink-0">
                  {question.points} pts
                </span>
              </div>

              {/* Multiple Choice */}
              {question.type === 'multiple_choice' && question.options && (
                <div className="space-y-2">
                  {question.options.map((option, oIndex) => (
                    <label
                      key={oIndex}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={String.fromCharCode(65 + oIndex)}
                        checked={answers[question.id] === String.fromCharCode(65 + oIndex)}
                        onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                        className="mt-1"
                      />
                      <span className="flex-1">
                        <span className="font-medium mr-2">{String.fromCharCode(65 + oIndex)}.</span>
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* True/False */}
              {question.type === 'true_false' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value="true"
                      checked={answers[question.id] === 'true'}
                      onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                    />
                    <span>True</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value="false"
                      checked={answers[question.id] === 'false'}
                      onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                    />
                    <span>False</span>
                  </label>
                </div>
              )}

              {/* Short Answer */}
              {question.type === 'short_answer' && (
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Please enter your answer..."
                />
              )}

              {/* Essay */}
              {question.type === 'essay' && (
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={6}
                  placeholder="Please enter your answer..."
                />
              )}
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="bg-white rounded-xl shadow p-6 sticky bottom-4">
          <div className="flex gap-4">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to go back? Unsubmitted answers will be lost.')) {
                  router.back();
                }
              }}
              className="px-6 py-3 border rounded-lg hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
