'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  totalPoints: number;
  duration: number | null;
  startTime: Date | null;
  endTime: Date | null;
  publishedInChat: boolean;
}

interface QuizzesTabProps {
  sessionId: string;
  classroomId: string;
  userRole: string;
}

export default function QuizzesTab({ sessionId, classroomId, userRole }: QuizzesTabProps) {
  const { data: session } = useSession();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQuizzes();
  }, [sessionId]);

  const fetchQuizzes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/quizzes?classroomId=${classroomId}&sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setQuizzes(data);
      }
    } catch (error) {
      toast.error('Failed to fetch');
    } finally {
      setIsLoading(false);
    }
  };

  const isTeacherOrAdmin = userRole === 'teacher' || userRole === 'administrator';

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      {isTeacherOrAdmin && (
        <div className="mb-4">
          <button
            onClick={() => setShowCreateQuiz(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Create Quiz
          </button>
        </div>
      )}

      {quizzes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No Quiz
        </div>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <QuizCard 
              key={quiz.id} 
              quiz={quiz} 
              userRole={userRole}
              onUpdate={fetchQuizzes}
            />
          ))}
        </div>
      )}

      {showCreateQuiz && (
        <CreateQuizModal
          sessionId={sessionId}
          classroomId={classroomId}
          onClose={() => setShowCreateQuiz(false)}
          onSuccess={() => {
            setShowCreateQuiz(false);
            fetchQuizzes();
          }}
        />
      )}
    </div>
  );
}

function QuizCard({ quiz, userRole, onUpdate }: { 
  quiz: Quiz; 
  userRole: string;
  onUpdate: () => void;
}) {
  const router = useRouter();
  const now = new Date();
  const isActive = quiz.startTime && quiz.endTime && 
    new Date(quiz.startTime) <= now && new Date(quiz.endTime) >= now;
  const isEnded = quiz.endTime && new Date(quiz.endTime) < now;

  return (
    <div className="border rounded-lg p-4 bg-white hover:shadow-md transition">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{quiz.title}</h3>
          {quiz.description && (
            <p className="text-gray-600 text-sm mt-1">{quiz.description}</p>
          )}
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            <span>Total: {quiz.totalPoints}</span>
            {quiz.duration && <span>Duration: {quiz.duration} minutes</span>}
          </div>
          {quiz.startTime && quiz.endTime && (
            <div className="text-xs text-gray-400 mt-1">
              {new Date(quiz.startTime).toLocaleString('en-US')} - {new Date(quiz.endTime).toLocaleString('en-US')}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            isActive ? 'bg-green-100 text-green-700' :
            isEnded ? 'bg-gray-100 text-gray-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {isActive ? 'Progressing' : isEnded ? 'Ended' : 'Upcoming'}
          </span>
          {quiz.publishedInChat && (
            <span className="text-xs text-purple-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h10v2H5V6zm0 4h10v2H5v-2z"/>
              </svg>
              Chat Published
            </span>
          )}
        </div>
      </div>
      
      <div className="mt-4 flex gap-2">
        {userRole === 'student' || userRole === 'observer' ? (
          <>
            {isActive && (
              <button 
                onClick={() => router.push(`/quiz/${quiz.id}`)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
              >
                Start Quiz
              </button>
            )}
            <button 
              onClick={() => router.push(`/quiz/${quiz.id}`)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              View Details
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={() => router.push(`/quiz/${quiz.id}/submissions`)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
            >
              View Submissions
            </button>
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
              Edit
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CreateQuizModal({ 
  sessionId, 
  classroomId,
  onClose, 
  onSuccess 
}: { 
  sessionId: string;
  classroomId: string;
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('60');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [publishInChat, setPublishInChat] = useState(false);
  const [questions, setQuestions] = useState<Array<{
    questionText: string;
    questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
    options: string[];
    correctAnswer: string;
    points: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addQuestion = () => {
    setQuestions([...questions, {
      questionText: '',
      questionType: 'multiple_choice',
      options: ['', '', '', ''],
      correctAnswer: '',
      points: 1
    }]);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const updateQuestionOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (questions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }

    // Validate all questions are filled
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || !q.questionText.trim()) {
        toast.error(`❌ Question ${i + 1}: Please fill in the question content`);
        // Scroll to the question
        const element = document.getElementById(`question-${i}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-red-500');
          setTimeout(() => element.classList.remove('ring-2', 'ring-red-500'), 3000);
        }
        return;
      }
      if (!q.correctAnswer || !q.correctAnswer.trim()) {
        toast.error(`❌ Question ${i + 1}: Please fill in the correct answer`);
        const element = document.getElementById(`question-${i}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-red-500');
          setTimeout(() => element.classList.remove('ring-2', 'ring-red-500'), 3000);
        }
        return;
      }
      if (q.questionType === 'multiple_choice') {
        const validOptions = q.options.filter(o => o && o.trim());
        if (validOptions.length < 2) {
          toast.error(`❌ Question ${i + 1}: Multiple choice requires at least 2 options`);
          const element = document.getElementById(`question-${i}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-2', 'ring-red-500');
            setTimeout(() => element.classList.remove('ring-2', 'ring-red-500'), 3000);
          }
          return;
        }
      }
    }

    setIsLoading(true);

    const payload = {
      classroomId,
      sessionId,
      title,
      description: description || null,
      duration: duration ? parseInt(duration) : null,
      startTime: startTime || null,
      endTime: endTime || null,
      publishInChat,
      questions: questions.map(q => ({
        question: q.questionText,
        type: q.questionType,
        options: q.questionType === 'multiple_choice' ? q.options.filter(o => o.trim()) : [],
        correctAnswer: q.correctAnswer,
        points: q.points
      }))
    };

    console.log('Sending quiz data:', payload);

    try {
      const response = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Quiz created successfully!');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create quiz');
      }
    } catch (error) {
      toast.error('Error creating quiz');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold mb-6">Create Quiz</h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Quiz Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
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
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">End Time</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="publishInChat"
                checked={publishInChat}
                onChange={(e) => setPublishInChat(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="publishInChat" className="text-sm">
                Publish notification in chat
              </label>
            </div>
          </div>

          {/* Questions List */}
          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold">Questions</h4>
              <button
                type="button"
                onClick={addQuestion}
                className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                + Add Question
              </button>
            </div>

            {questions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No questions yet</p>
            ) : (
              <div className="space-y-6">
                {questions.map((question, qIndex) => (
                  <div key={qIndex} id={`question-${qIndex}`} className="border rounded-lg p-4 bg-gray-50 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <h5 className="font-medium">Question {qIndex + 1}</h5>
                      <button
                        type="button"
                        onClick={() => removeQuestion(qIndex)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Question Content *</label>
                        <textarea
                          value={question.questionText}
                          onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                          rows={2}
                          placeholder="Enter question content..."
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Question Type *</label>
                          <select
                            value={question.questionType}
                            onChange={(e) => updateQuestion(qIndex, 'questionType', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="true_false">True/False</option>
                            <option value="short_answer">Short Answer</option>
                            <option value="essay">Essay</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">Points *</label>
                          <input
                            type="number"
                            value={question.points}
                            onChange={(e) => updateQuestion(qIndex, 'points', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                            min="1"
                            required
                          />
                        </div>
                      </div>

                      {/* Multiple Choice Options */}
                      {question.questionType === 'multiple_choice' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Options</label>
                          <div className="space-y-2">
                            {question.options.map((option, oIndex) => (
                              <div key={oIndex} className="flex gap-2 items-center">
                                <span className="text-sm font-medium w-8">
                                  {String.fromCharCode(65 + oIndex)}.
                                </span>
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => updateQuestionOption(qIndex, oIndex, e.target.value)}
                                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                                  placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Correct Answer */}
                      <div>
                        <label className="block text-sm font-medium mb-1">Correct Answer *</label>
                        {question.questionType === 'multiple_choice' ? (
                          <select
                            value={question.correctAnswer}
                            onChange={(e) => updateQuestion(qIndex, 'correctAnswer', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                            required
                          >
                            <option value="">Please select</option>
                            {question.options.map((_, oIndex) => (
                              <option key={oIndex} value={String.fromCharCode(65 + oIndex)}>
                                Option {String.fromCharCode(65 + oIndex)}
                              </option>
                            ))}
                          </select>
                        ) : question.questionType === 'true_false' ? (
                          <select
                            value={question.correctAnswer}
                            onChange={(e) => updateQuestion(qIndex, 'correctAnswer', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                            required
                          >
                            <option value="">Please select</option>
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        ) : (
                          <textarea
                            value={question.correctAnswer}
                            onChange={(e) => updateQuestion(qIndex, 'correctAnswer', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                            rows={2}
                            placeholder="Reference answer (for teacher grading)"
                            required
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Quiz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
